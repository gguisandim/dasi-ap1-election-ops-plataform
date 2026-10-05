# Simulador Operacional

Plugin: `plugins/simulation/operational-simulator`

Documento descritivo. A SPEC `SPEC/2026-10-05-operational-intelligence-improvements.md` permanece normativa.

## Objetivo

Produzir eventos de treinamento claramente marcados como simulados e exercitar Incidentes, Inventário, mapa, Event Bus, notificações e auditoria.

## Entidades

- `SimulationScenario`
- `SimulationScenarioEvent`
- `Simulation`
- `SimulationEvent`

## Estados

```text
DRAFT
RUNNING
PAUSED
FINISHED
CANCELLED
```

## Fluxo

1. criar uma simulação para um pleito, opcionalmente vinculada a um cenário programado;
2. escolher velocidade, probabilidade e tipos de falha;
3. iniciar; cada `tick` executa os eventos de cenário vencidos ou, sem cenário, gera uma falha genérica;
4. `Incident` é criado com `isSimulated=true` e `simulationId`;
5. opcionalmente o ativo é colocado temporariamente em manutenção;
6. ao encerrar, o score é calculado, incidentes simulados ativos são resolvidos e estados temporários de ativos são restaurados;
7. `SimulationEvent` mantém a timeline usada pelo replay.

## Scenario Builder

Rotas (`simulation.read` para leitura, `simulation.manage` para escrita):

```http
GET    /api/simulations/scenarios
GET    /api/simulations/scenarios/:id
POST   /api/simulations/scenarios
PATCH  /api/simulations/scenarios/:id
DELETE /api/simulations/scenarios/:id            (somente sem simulações vinculadas)
POST   /api/simulations/scenarios/:id/events
POST   /api/simulations/scenarios/:id/events/:eventId/duplicate
DELETE /api/simulations/scenarios/:id/events/:eventId
```

`SimulationScenario` possui `seed` e `durationSeconds`. `SimulationScenarioEvent` possui `offsetSeconds`, `type`, `severity`, `targetType`, `targetId`, `probability` (0..100) e `payload`.

Tipos de evento (`SimulationScenarioEventType`) e alvo (`SimulationTargetType`):

```text
INCIDENT_CREATE        cria Incident simulado
TRANSMISSION_FAILURE   registra falha simulada no replay
TRANSMISSION_RECOVERY  registra recuperação simulada no replay
ASSET_FAILURE          altera ativo somente se applyToOperations
ASSET_RECOVERY         restaura ativo somente se applyToOperations

targetType: NONE | POLLING_PLACE | ZONE | ASSET | TRANSMISSION
```

Validação (mensagens em português, HTTP 400): nome obrigatório; `offsetSeconds >= 0`; sem par `(offsetSeconds, type)` duplicado; `probability` entre 0 e 100; `targetType` obrigatório e diferente de `NONE` para `INCIDENT_CREATE`, `ASSET_FAILURE`, `ASSET_RECOVERY`, `TRANSMISSION_FAILURE` e `TRANSMISSION_RECOVERY`. A unicidade `(scenarioId, offsetSeconds, type)` também é garantida no banco.

## Relógio lógico, velocidade e tick

- o tempo é lógico: `elapsedSeconds += speed * TICK_SECONDS` (TICK_SECONDS = 180); não há timers reais longos;
- velocidades aceitas: `1, 2, 5, 10, 20, 100`;
- `tick` executa os eventos de cenário com `offsetSeconds <= elapsedSeconds` avançado que ainda não foram executados;
- execução única garantida em código (conjunto de `scenarioEventId` já gravados) e no banco (`@@unique([simulationId, scenarioEventId])`);
- lifecycle preservado: `start`, `pause`, `resume` (start a partir de `PAUSED`), `tick`, `finish`;
- quando a simulação não possui cenário ou o cenário não possui eventos, o `tick` mantém o comportamento genérico legado;
- `tick` não emite eventos de domínio.

## Determinismo (seed)

`createRng(seed)` é um PRNG determinístico exportado (mulberry32), usado nas rolagens de probabilidade. Com seed, mesma simulação/cenário e mesmos inputs produzem a mesma sequência; sem seed, o comportamento usa `Math.random` e não é determinístico.

## Resultado de execução

Cada `SimulationEvent` executa e grava `result`:

```text
APPLIED  evento executado
SKIPPED  rolagem de probabilidade não atingida
FAILED   erro de validação/execução (com mensagem); não aborta a simulação
```

## Score

Calculado no `finish`, antes da resolução automática dos incidentes:

```text
coverage   = plannedEvents > 0 ? round(executedEvents / plannedEvents * 100) : 100
penalties  = slaViolations*10 + unresolvedCritical*15 + failedEvents*5 + unrecoveredFailures*8
skillScore = clamp(100 - penalties, 0, 100)
score      = round(skillScore*0.7 + coverage*0.3)
```

`plannedEvents` = eventos de cenário com `offsetSeconds <= elapsedSeconds`; `executedEvents` = eventos `APPLIED`; `failedEvents` = eventos `FAILED`; `slaViolations` = incidentes simulados resolvidos após `slaDeadline`; `unresolvedCritical` = incidentes CRITICAL ainda abertos; `unrecoveredFailures` = `TRANSMISSION_FAILURE` sem `TRANSMISSION_RECOVERY` posterior para o mesmo alvo. O `score` é persistido; o detalhamento é derivado no relatório.

## Relatório e replay

```http
GET /api/simulations/:id/report
```

Retorna `score, breakdown, plannedEvents, executedEvents, failedEvents, incidentsCreated, resolvedIncidents, transmissionFailures, transmissionRecoveries, averageRecoverySeconds, slaViolations, unresolved, timeline[]`.

`GET /api/simulations/:id` expõe, por evento, `offsetSeconds`, `eventType`, alvo, `result`, entidade relacionada e mensagem.

Eventos de domínio emitidos: `simulation.started`, `simulation.resumed`, `simulation.paused`, `simulation.finished`, `simulation.scored`.

## Frontend

```text
/simulator                   lista e criação de simulações (velocidades atualizadas, seleção de cenário)
/simulator/scenarios         lista de cenários
/simulator/scenarios/new     builder
/simulator/scenarios/:id     edição + eventos (adicionar, duplicar, remover)
/simulator/:id               detalhe com score, relatório e replay
```

As rotas de cenário são declaradas antes de `/simulator/:id`.

## Isolamento

A simulação não corrompe estado operacional real:

```text
Incident          gravado com isSimulated = true e simulationId
Asset             alterado somente quando applyToOperations = true, e restaurado no finish
TransmissionPoint nunca é escrito pela simulação; TRANSMISSION_FAILURE/RECOVERY registram
                  apenas estado simulado no payload do SimulationEvent e no replay
```

`applyToOperations=false` mantém a simulação isolada das condições dos ativos produtivos. Mesmo assim os incidentes criados continuam explicitamente marcados como simulados. Nenhum evento `transmission.*` é emitido pelo simulador.

## Segurança

Consulta exige `simulation.read`; criação e controles exigem `simulation.manage`. O criador é obtido da sessão autenticada.
