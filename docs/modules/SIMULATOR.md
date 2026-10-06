# Simulador Operacional 2.0

Plugin `@eops/plugin-simulator`, em `plugins/simulation/operational-simulator`, categoria `simulation`, rota `/simulator`.

Documentação descritiva. A fonte normativa é `SPEC/2026-10-06-platform-depth-integration.md` (Parte 1).

## Papel

Treinamento e análise. O simulador injeta carga operacional controlada e mede a resposta do time. Ele **não** é o Command Center (estado atual), nem Reports (histórico analítico).

É dono de cenários, eventos de cenário, execuções (runs), snapshots de execução, decisões de operador, métricas e score. Nunca é dono de `Incident`, `Asset`, `TransmissionPoint`, `FieldShift`, `FieldTeam`, `Route`, `ResourceRequest` ou `Task`.

## Isolamento

Todo artefato criado em domínio real é marcado como simulado: `Incident.isSimulated = true` e `Incident.simulationId` preenchido. Consultas operacionais reais excluem esses registros; Reports tem `includeSimulated` explícito (default `false`).

Efeitos por tipo de evento, com limite de escrita explícito:

| Tipo | Efeito real |
| --- | --- |
| `INCIDENT_CREATE`, `INCIDENT_CRITICAL` | cria `Incident` simulado |
| `ASSET_FAILURE`, `ASSET_RECOVERY` | escreve `Asset` **somente** com `applyToOperations`, revertendo no encerramento |
| transmissão, veículo, rota, equipe, turno, recurso, preparação, passagem | apenas estado simulado no run — nenhum domínio externo é tocado |

O simulador nunca cria `ResourceRequest`, `Task`, `Postmortem` ou `TransmissionPoint` reais.

## Lifecycle da execução

```text
DRAFT (CREATED) → RUNNING → PAUSED → RUNNING
                 ↓            ↓
              FINISHED     FAILED / CANCELLED
              (COMPLETED)
```

`FINISHED`, `FAILED` e `CANCELLED` são terminais. `FAILED` exige motivo. Transição fora da tabela devolve `409`.

A API expõe o vocabulário conceitual (`CREATED`, `COMPLETED`) e mantém `statusCode` com o valor persistido, porque o banco conserva `DRAFT`/`FINISHED` por compatibilidade histórica.

## Relógio lógico

Velocidades: `1, 2, 5, 10, 20`. `step` avança um tick; `tick` avança `velocidade × tick`. A execução é determinística para `(cenário, seed, sequência de ticks)`: o gerador pseudoaleatório é semeado por `seed + offsetSeconds`, nunca por relógio de parede.

## Cenário

Possui status (`DRAFT`, `PUBLISHED`, `ARCHIVED`), `isTemplate`, versão, linhagem de clonagem, objetivos, critérios de sucesso e falha, pesos de score e condições iniciais validados no servidor. Eventos individuais podem ser desabilitados e não executam.

`PUBLISHED` não aceita edição de eventos nem de configuração — só clonagem ou arquivamento. Clonar gera novo `DRAFT` com linhagem e versão incrementada.

Critérios de falha **classificam** o resultado; não interrompem a execução automaticamente.

## Score

Score composto 0..100 sobre 11 dimensões (`responseTime`, `unresolvedIncidents`, `deadlineMisses`, `availability`, `recoveryTime`, `workforceCoverage`, `resourceFulfillment`, `transmission`, `readiness`, `accumulatedCriticality`, `decisionQuality`), normalizadas por fórmula explícita em `packages/shared/src/simulation.ts`:

```text
score = Σ(weight_i × dimension_i) / Σ(weight_i)
```

Pesos default em `DEFAULT_SIMULATION_WEIGHTS`, sobrescrevíveis por cenário; soma zero é rejeitada. `scoreBreakdown` guarda dimensões, pesos efetivos e a versão do cálculo.

## Snapshots, replay e decisões

Snapshot é gravado a cada tick que produza evento e no encerramento, com `health` no mesmo vocabulário do Command Center (`NORMAL`, `ATTENTION`, `CRITICAL`) calculado sobre o estado simulado — nunca lido do sistema real.

O replay é derivado de snapshots + eventos: `GET /simulations/:id/replay` devolve os frames e `GET /simulations/:id/replay/frame?offsetSeconds=N` devolve o snapshot mais recente até `N` com os eventos ocorridos depois dele.

Decisões do operador (`SimulationDecision`) têm tipo restrito, justificativa obrigatória e entram na dimensão `decisionQuality`.

## Comparação

`POST /simulations/compare` aceita de 2 a 6 execuções do mesmo pleito. Dimensão ausente em uma execução (score antigo sem breakdown) retorna `null`, nunca `0`. Mistura de seeds é permitida, sinalizada com `seedMismatch`.

## Rotas

```text
/simulator
/simulator/scenarios
/simulator/scenarios/new
/simulator/scenarios/:id
/simulator/runs
/simulator/runs/:id
/simulator/runs/:id/replay
/simulator/compare
```

## Endpoints

Leitura com `simulation.read`; mutações com `simulation.manage`.

```text
GET    /simulations/runs
GET    /simulations/scenarios
GET    /simulations/scenarios/:id
GET    /simulations/:id
GET    /simulations/:id/report
GET    /simulations/:id/replay
GET    /simulations/:id/replay/frame
GET    /simulations/:id/decisions
POST   /simulations
POST   /simulations/compare
POST   /simulations/scenarios
PATCH  /simulations/scenarios/:id
DELETE /simulations/scenarios/:id
POST   /simulations/scenarios/:id/clone
POST   /simulations/scenarios/:id/publish
POST   /simulations/scenarios/:id/archive
POST   /simulations/scenarios/:id/events
PATCH  /simulations/scenarios/:id/events/:eventId
POST   /simulations/scenarios/:id/events/:eventId/duplicate
DELETE /simulations/scenarios/:id/events/:eventId
POST   /simulations/:id/start
POST   /simulations/:id/pause
POST   /simulations/:id/tick
POST   /simulations/:id/step
POST   /simulations/:id/decisions
POST   /simulations/:id/finish
POST   /simulations/:id/cancel
POST   /simulations/:id/fail
```

## Eventos

`simulation.started`, `simulation.paused`, `simulation.resumed`, `simulation.finished`, `simulation.scored`, `simulation.failed`, `simulation.cancelled`, `simulation.decision_recorded`, `simulated_incident.created`, além de `asset.status_changed` quando `applyToOperations` está ativo. Nenhum evento é emitido para navegação, filtro ou seleção de frame.

## Limites conhecidos

- Comparação entre execuções de pleitos diferentes é recusada com `400`.
- A remoção de cenário exige status `DRAFT`; cenários publicados ou arquivados são protegidos.
- O score depende do `scoreBreakdown` persistido; execuções antigas aparecem com lacunas na comparação.
