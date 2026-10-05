# Inteligência operacional — Transmission, Map, Simulator e Reports

**Data:** 2026-10-05
**Status:** proposed
**Plugins:** `plugins/monitoring/transmission`, `plugins/monitoring/operational-map`, `plugins/simulation/operational-simulator`, `plugins/analytics/reports`

## 1. Contexto

Quatro módulos já implementados operam hoje de forma isolada e com profundidade desigual:

- **Transmission** possui fila, tentativas, conectividade, alertas e prazo, mas não oferece uma visão de saúde operacional (NOC), não distingue risco de prazo de forma derivada, não possui lifecycle completo de alerta (`acknowledgedBy`/`resolvedBy`/notas) nem retry operacional com histórico;
- **Operational Map** é um plugin somente-cliente que desenha locais de votação obtidos de `GET /polling-places/map`; não existe contrato unificado de features, layers operacionais, filtros, clustering nem painel de seleção;
- **Operational Simulator** executa um ciclo `create → start → pause → tick → finish` que gera incidentes genéricos, sem cenários com eventos programados, sem relógio lógico determinístico, sem score e sem replay explicativo;
- **Reports** concentra tudo em um relatório executivo único com comparação de período e export CSV/PDF, sem análises por domínio.

Esta SPEC define a evolução desses quatro plugins como uma vertical integrada de inteligência operacional, sobre o estado atual do repositório (baseline `5a16450`, 611 arquivos / 58.100 linhas).

## 2. Escopo e não escopo

### 2.1 Escopo

- visão NOC e estado de prazo derivado em Transmission; lifecycle de alerta; retry manual e em lote; histórico de conectividade; métricas de dashboard;
- contrato unificado de features, layers, filtros, clustering e painel de seleção no Operational Map, com API agregadora própria;
- Scenario Builder, eventos programados, execução determinística por seed, score explícito e replay no Simulator;
- relatórios por domínio com filtros compartilhados e comparação de período em Reports.

### 2.2 Não escopo

```text
Kafka, RabbitMQ, Redis, WebSocket, job queue externa
machine learning, predição por IA, GPS tracking, otimização de rotas
Inventory lifecycle avançado, Routes lifecycle avançado, Shift Handover
Command Center novo, Resource Requests
redesenho de Incidents, Field Teams, Shifts, Tasks, Preparation Checklists,
Access Control, Communications, Evidence, Knowledge, Risks
alteração da arquitetura do plugin Audit
```

Plugins maduros permanecem consumidores/fontes via persistência compartilhada, contratos públicos ou Event Bus. Nenhum import interno cross-plugin é permitido.

### 2.3 Propriedade de domínio

```text
Transmission  → TransmissionPoint, tentativas, conectividade, alertas de transmissão
Operational Map → agregação geográfica (não possui entidades de domínio próprias)
Simulator     → Simulation, SimulationScenario, SimulationEvent
Reports       → leitura analítica (não possui entidades de domínio próprias)
Incidents / Field Teams / Routes / Inventory → owners das entidades lidas
```

## 3. Transmission

### 3.1 Estado de prazo derivado

Função pura exportada, nunca persistida:

```text
deriveDeadlineState(status, operationalDeadline, now)
  status SUCCESS                    → COMPLETED
  sem operationalDeadline           → ON_TRACK
  now > operationalDeadline         → OVERDUE
  operationalDeadline - now <= 60min → DUE_SOON
  caso contrário                    → ON_TRACK
```

A janela de 60 minutos é constante exportada e coincide com o critério já utilizado pelo alerta `DEADLINE_NEAR`, para que alerta e estado não divirjam.

### 3.2 Visão NOC

```http
GET /api/transmission/noc
```

Filtros: `electionId`, `zoneId`, `pollingPlaceId`. Deve ser declarada antes de `:id`.

Resposta derivada, sem persistência:

```text
totals          total, success, queued, transmitting, failed, offline
rates           successRate, failureRate
latency         averageLatencyMs
volume          attemptsToday
risk            deadlineRisk (DUE_SOON + OVERDUE), overdue, dueSoon
byStatus        contagem por TransmissionStatus
byDeadlineState contagem por estado derivado
byZone          zoneId, number, name, total, success, failed, offline, deadlineRisk, successRate, averageLatencyMs
byPlace         pollingPlaceId, name, zoneId, total, success, failed, offline, deadlineRisk
needsAttention  até 12 pontos ordenados por risco (OVERDUE, DUE_SOON, FAILED, OFFLINE)
```

`queued` = `WAITING + QUEUED + RETRYING`. `failed` = `FAILED + OFFLINE`. `offline` = `connectivity = OFFLINE`.

### 3.3 Lifecycle de alerta

`TransmissionAlert` recebe `acknowledgedAt`, `acknowledgedById`, `resolvedById`, `notes`.

Estados existentes preservados: `OPEN`, `ACKNOWLEDGED`, `RESOLVED`.

```http
PATCH /api/transmission/alerts/:id   { status, notes? }   transmission.manage
GET   /api/transmission/alerts?status=&includeResolved=
```

Regras:

- transições permitidas: `OPEN → ACKNOWLEDGED`, `OPEN → RESOLVED`, `ACKNOWLEDGED → RESOLVED`;
- transição regressiva (por exemplo `RESOLVED → OPEN`) é rejeitada;
- `acknowledgedAt`/`acknowledgedById` são gravados pelo servidor na primeira passagem para `ACKNOWLEDGED`;
- `resolvedAt`/`resolvedById` são gravados na passagem para `RESOLVED`;
- alertas nunca são excluídos; consultas incluem histórico quando solicitado.

Eventos: `transmission.alert_acknowledged`, `transmission.alert_resolved`.

### 3.4 Retry operacional

```http
POST /api/transmission/:id/retry   { reason? }   transmission.manage
POST /api/transmission/retry       { ids, reason }   transmission.manage
```

- retry manual recoloca o ponto na fila (`QUEUED`), limpa `lastError` e registra um evento de timeline `RETRY` com o motivo;
- elegíveis: `FAILED`, `OFFLINE`, `RETRYING`, `WAITING`;
- retry em lote é atômico e limitado a 100 identificadores; se qualquer ponto não existir ou não for elegível, nada é aplicado;
- o histórico de tentativas (`TransmissionAttempt`) permanece intacto e continua exposto no detalhe;
- não existe scheduler, daemon ou execução automática.

Evento: `transmission.retry_requested` (uma vez por operação, com `count`).

### 3.5 Histórico de conectividade

```http
GET /api/transmission/:id/connectivity-history
```

Derivado de `TransmissionTimelineEvent` (`CONNECTIVITY_CHANGED`, com `metadata.latencyMs`) e de `TransmissionAttempt`:

```text
entries          [{ at, connectivity, latencyMs }]  ordem cronológica
current          estado atual de conectividade e latência
lastCheckedAt    último check registrado
lastSuccessAt    endedAt da última tentativa SUCCESS
failureStreak    tentativas consecutivas não-SUCCESS a partir da mais recente
```

Função pura exportada `calculateFailureStreak(attempts)` para teste.
Nenhuma infraestrutura de séries temporais é criada.

### 3.6 Dashboard

`GET /api/transmission/dashboard` mantém os campos atuais e passa a incluir:

```text
successRate, failureRate, deadlineRisk, offlineLocations, averageLatencyMs, attemptsToday
```

Nenhum campo existente é removido ou renomeado.

### 3.7 Frontend

```text
/transmission          dashboard com as novas métricas
/transmission/noc      visão NOC com totais, agregados por zona/local e lista de atenção
/transmission/:id      detalhe com estado, local, zona, prazo, SLA, conectividade,
                       latência, tentativas, alertas (com acknowledge/resolve) e timeline
```

## 4. Operational Map

### 4.1 API agregadora

O plugin passa a possuir backend próprio (entrypoint `@eops/plugin-operational-map/server`), registrado no composition root.

```http
GET /api/operational-map/features
```

Filtros: `electionId`, `zoneId`, `pollingPlaceId`, `types` (lista separada por vírgula), `status`, `severity`.

### 4.2 Contrato de feature

```ts
interface OperationalMapFeature {
  id: string;            // `${type}:${entityId}`
  type: "POLLING_PLACE" | "INCIDENT" | "TRANSMISSION" | "FIELD_TEAM" | "ROUTE" | "ASSET";
  latitude: number;
  longitude: number;
  title: string;
  subtitle?: string;
  status: string;
  severity?: string;
  entityId: string;
  updatedAt: string;
  metadata: Record<string, string | number | boolean | null>;
  deepLink?: string;
}
```

Nenhum objeto Prisma é exposto. Somente features com coordenadas válidas são emitidas.

### 4.3 Layers e resolução de coordenadas

Coordenadas existem apenas em `PollingPlace` e `RouteStop`. As demais camadas resolvem a posição pelo local de votação relacionado:

```text
POLLING_PLACE  coordenadas próprias
INCIDENT       pollingPlace do incidente
TRANSMISSION   pollingPlace do ponto
ASSET          pollingPlace do ativo
FIELD_TEAM     pollingPlace da FieldAllocation ativa (equipe distinta)
ROUTE          coordenadas do RouteStop, com a rota como título
```

Features sem coordenada resolvível são omitidas, nunca posicionadas em valor fictício.

### 4.4 RBAC por camada

O endpoint exige `elections.read` e **filtra as camadas pela permissão do solicitante**:

```text
POLLING_PLACE  elections.read
INCIDENT       incidents.read
TRANSMISSION   transmission.read
ASSET          inventory.read
FIELD_TEAM     field-teams.read
ROUTE          routes.read
```

Uma camada solicitada em `types` sem permissão é silenciosamente omitida — a API nunca retorna dado de domínio que o usuário não pode ler. Não são criadas permissões novas.

### 4.5 Layer desconhecido

`types` com valor fora do conjunto é rejeitado com 400.

### 4.6 Clustering

Função pura exportada `clusterFeatures(features, cellSize)` agrupa por grade geográfica determinística, retornando clusters com contagem e centroide. O cliente só renderiza clusters quando o total de features excede o limiar `CLUSTER_THRESHOLD = 60`; abaixo disso renderiza marcadores individuais.

### 4.7 Semântica de marcador

Cada tipo possui ícone, rótulo textual e forma própria; o status nunca é comunicado apenas por cor (`Badge` textual + ícone).

### 4.8 Filtros e painel de seleção

Filtros: layer, zona, severidade, status.

Painel lateral ao selecionar uma feature: tipo, nome/código, status, resumo, última atualização e deep link para a rota existente do domínio:

```text
POLLING_PLACE → /polling-places/:id
INCIDENT      → /incidents/:id
TRANSMISSION  → /transmission/:id
FIELD_TEAM    → /field-teams/teams/:id
ROUTE         → /routes/:id
ASSET         → /inventory/:id
```

### 4.9 Modo fullscreen

A página do mapa suporta modo operacional em tela cheia (contêiner do plugin), sem alterar o shell global.

## 5. Operational Simulator

### 5.1 Isolamento (obrigatório)

A simulação **não** pode corromper estado operacional real. Estratégia, reutilizando o que já existe:

```text
Incident          gravado com isSimulated = true e simulationId (padrão já existente)
Asset             só é alterado quando applyToOperations = true, e é restaurado no finish
TransmissionPoint nunca é alterado pela simulação; o efeito é registrado apenas
                  no payload do SimulationEvent e no replay
```

Consequência explícita: eventos `TRANSMISSION_FAILURE` e `TRANSMISSION_RECOVERY` produzem estado **simulado** (marcador), não escrevem em `TransmissionPoint`. Isso é deliberado e está documentado para não misturar treinamento com operação real.

### 5.2 Modelo

`SimulationScenario` recebe `seed Int?` e `durationSeconds Int?`.

Novo `SimulationScenarioEvent`:

```text
id, scenarioId, offsetSeconds, type, severity?, targetType?, targetId?,
probability Int (0..100), payload Json?, createdAt
@@unique([scenarioId, offsetSeconds, type])
@@index([scenarioId, offsetSeconds])
```

`Simulation` recebe `seed Int?`, `score Int?`, `scoreBreakdown Json?`.

`SimulationEvent` recebe `scenarioEventId String?`, `result String?` (`APPLIED | SKIPPED | FAILED`), `severity String?`, com `@@unique([simulationId, scenarioEventId])` para impedir execução duplicada.

### 5.3 Tipos de evento

Somente eventos com execução real implementada:

```text
INCIDENT_CREATE        cria Incident simulado
TRANSMISSION_FAILURE   registra falha simulada no replay
TRANSMISSION_RECOVERY  registra recuperação simulada no replay
ASSET_FAILURE          altera ativo somente se applyToOperations
ASSET_RECOVERY         restaura ativo somente se applyToOperations
```

Enum `SimulationScenarioEventType` e enum `SimulationTargetType` (`POLLING_PLACE | ZONE | ASSET | TRANSMISSION | NONE`).

### 5.4 Scenario Builder

```http
GET    /api/simulations/scenarios
GET    /api/simulations/scenarios/:id
POST   /api/simulations/scenarios          { name, description?, seed?, durationSeconds?, configuration, events[] }
PATCH  /api/simulations/scenarios/:id      { name?, description?, seed?, durationSeconds?, active? }
DELETE /api/simulations/scenarios/:id      (somente sem simulações vinculadas)
POST   /api/simulations/scenarios/:id/events
POST   /api/simulations/scenarios/:id/events/:eventId/duplicate
```

Validação de cenário: nome obrigatório, `offsetSeconds >= 0`, offsets únicos por tipo, `probability` entre 0 e 100, `targetType` obrigatório para tipos que exigem alvo (`INCIDENT_CREATE`, `ASSET_FAILURE`, `ASSET_RECOVERY`, `TRANSMISSION_*`).

Rotas de frontend:

```text
/simulator/scenarios
/simulator/scenarios/new
/simulator/scenarios/:id
```

Devem ser declaradas antes de `/simulator/:id`.

### 5.5 Relógio lógico, velocidade e tick

- o tempo é lógico: `elapsedSeconds` avança por `speed * TICK_SECONDS`, sem timers reais longos;
- velocidades aceitas: `1, 2, 5, 10, 20, 100` (o conjunto anterior `1, 5, 20, 100` é preservado e `2` e `10` são adicionados);
- `tick` executa todos os eventos de cenário com `offsetSeconds` dentro da janela avançada que ainda não foram executados;
- lifecycle preservado: `start`, `pause`, `resume` (start a partir de `PAUSED`), `tick`, `finish`;
- engine continua in-process.

### 5.6 Determinismo

PRNG determinístico exportado (`createRng(seed)`), usado para rolagem de probabilidade e escolha de alvo. Duas execuções com o mesmo cenário, mesma seed e mesmos dados de entrada produzem a mesma sequência de eventos. Sem seed, o comportamento permanece não determinístico.

### 5.7 Execução de evento

```text
identificar evento  → validar alvo → executar → registrar resultado → persistir SimulationEvent
```

Falha de validação ou execução é registrada com `result = FAILED` e mensagem, sem abortar a simulação.

### 5.8 Compatibilidade

Simulações cujo cenário não possui eventos programados mantêm o comportamento legado de `tick` (geração de incidente genérico por categoria habilitada). O comportamento atual não é quebrado.

### 5.9 Score

Calculado no `finish`, antes da resolução automática dos incidentes, com fórmula explícita:

```text
coverage   = plannedEvents > 0 ? round(executedEvents / plannedEvents * 100) : 100
penalties  = slaViolations * 10 + unresolvedCritical * 15 + failedEvents * 5 + unrecoveredFailures * 8
skillScore = clamp(100 - penalties, 0, 100)
score      = round(skillScore * 0.7 + coverage * 0.3)
```

Onde:

```text
plannedEvents        eventos de cenário com offsetSeconds <= duração lógica alcançada
executedEvents       SimulationEvent com result = APPLIED
failedEvents         SimulationEvent com result = FAILED
slaViolations        incidentes simulados resolvidos após slaDeadline
unresolvedCritical   incidentes simulados CRITICAL ainda abertos no momento do cálculo
unrecoveredFailures  TRANSMISSION_FAILURE sem TRANSMISSION_RECOVERY posterior para o mesmo alvo
```

`averageRecoverySeconds` é reportado como métrica, mas **não** entra na fórmula: o engine ainda não possui ação explícita de acknowledgement, e ponderar um tempo sem significado acordado produziria número arbitrário.

`score` é persistido; o detalhamento (`scoreBreakdown`) é derivado no relatório.

### 5.10 Relatório e replay

```http
GET /api/simulations/:id/report
```

```text
score, breakdown, plannedEvents, executedEvents, failedEvents,
incidentsCreated, incidentesResolvidos, transmissionFailures, transmissionRecoveries,
averageRecoverySeconds, slaViolations, unresolved, timeline[]
```

`GET /api/simulations/:id` passa a expor, por evento: `offsetSeconds` (tempo lógico), `eventType`, alvo, `result`, entidade relacionada e mensagem.

### 5.11 Eventos de domínio

```text
simulation.started, simulation.paused, simulation.resumed, simulation.finished, simulation.scored
```

`tick` não emite evento de domínio.

## 6. Reports

### 6.1 Filtros compartilhados

`ReportQueryDto` permanece o contrato comum (`from`, `to`, `electionId`, `zoneId`, `pollingPlaceId`, `status`, `categoryId`). Filtros específicos são adicionados por domínio somente quando houver uso real.

### 6.2 Endpoints por domínio

```http
GET /api/reports/operations
GET /api/reports/incidents
GET /api/reports/transmission
GET /api/reports/workforce
GET /api/reports/logistics
GET /api/reports/assets
```

Todos exigem `reports.read`. `GET /api/reports/executive` e os exports CSV/PDF permanecem.

Cada relatório retorna `period`, `filters`, `summary`, `breakdown` (por zona e, quando aplicável, por local) e `comparison` (período atual × período anterior) quando `from` e `to` estiverem presentes.

Conteúdo mínimo:

```text
operations   incidentes, transmissão, equipes, tasks, ativos e rotas combinados
incidents    volume, severidade, tempo de resolução, SLA, categorias, zonas, tendência
transmission success rate, failure rate, latência, retry rate, períodos offline, violações de prazo
workforce    cobertura, dispatches, tempo de resposta, utilização, disponibilidade
logistics    rotas, entregas, atrasos, exceções
assets       status, movimentações, distribuição, disponibilidade
```

Reports é histórico/análise; não se torna command center em tempo real.

### 6.3 Comparação

Comparação de período: o período anterior tem a mesma duração e termina no início do período atual. Comparação zona × zona é apresentada como ranking por indicador no `breakdown`.

### 6.4 Drill-down

Linhas de zona e local linkam para páginas existentes (`/polling-places/:id`, `/incidents`, `/transmission`, `/inventory/:id`, `/routes/:id`). Nenhum link aponta para rota inexistente.

### 6.5 Frontend

```text
/reports              visão geral (executivo preservado)
/reports/operations
/reports/incidents
/reports/transmission
/reports/workforce
/reports/logistics
/reports/assets
```

## 7. Persistência

Migration nova, próxima ao último identificador existente, sem alterar migrations históricas:

```text
packages/database/prisma/migrations/<próximo-id>_operational_intelligence_improvements/migration.sql
```

Alterações:

```text
TransmissionAlert              + acknowledgedAt, acknowledgedById, resolvedById, notes
SimulationScenario             + seed, durationSeconds
Simulation                     + seed, score, scoreBreakdown
SimulationEvent                + scenarioEventId, result, severity
SimulationScenarioEvent        novo
enum SimulationScenarioEventType  novo
enum SimulationTargetType         novo
```

Índices apenas para queries reais:

```text
TransmissionAlert(status, createdAt)
SimulationScenarioEvent(scenarioId, offsetSeconds) único
SimulationEvent(simulationId, scenarioEventId) único
Simulation(seed)
```

`TransmissionPoint` já possui `(priority, queuedAt)`, `(connectivity)` e índices por pleito/zona/local; nenhum índice duplicado é adicionado.

O seed não precisa de alteração: nenhuma permissão nova é criada.

## 8. RBAC

Nenhuma permissão nova.

```text
Transmission   transmission.read / transmission.manage  (preservadas)
Map            elections.read (base) + filtragem por camada conforme a permissão do usuário
Simulator      simulation.read / simulation.manage      (preservadas)
Reports        reports.read / reports.export            (preservadas)
```

Toda autorização é validada no backend.

## 9. Eventos e auditoria

Novos eventos:

```text
transmission.alert_acknowledged, transmission.alert_resolved, transmission.retry_requested
simulation.started, simulation.paused, simulation.resumed, simulation.finished, simulation.scored
```

Nenhum evento para visualização de mapa/relatório, mudança de filtro ou `tick`.

`requiredPermissionForEvent` em `packages/event-bus` recebe o mapeamento do prefixo `simulation.` (o prefixo `transmission.` já existe).

Audit não é alterado: continua consumindo todos os eventos pelo subscriber global. Notifications **não** ganha novas assinaturas nesta SPEC — nenhum dos eventos novos entra na lista de eventos notificáveis, evitando spam por construção.

## 10. Frontend — regras gerais

- `docs/UI-DESIGN-GUIDE.md` é obrigatório; primitives de `@eops/ui` são reutilizadas;
- CSS específico em CSS Modules do próprio plugin;
- toda página nova cobre loading, erro, vazio e sucesso;
- responsividade em 1440 px, 1024 px e ≤760 px;
- nenhuma regra de negócio de plugin é movida para o shell;
- marcadores e status nunca dependem apenas de cor.

## 11. Limitações declaradas

- `TRANSMISSION_FAILURE`/`TRANSMISSION_RECOVERY` produzem estado simulado, não escrevem em `TransmissionPoint` (§5.1); consequentemente não geram alertas reais nem eventos `transmission.*`;
- o score não pondera tempo de acknowledgement porque o engine não possui essa ação;
- clustering é por grade determinística no cliente, sem dependência nova;
- relatórios usam os dados persistidos disponíveis; nenhum período histórico é sintetizado;
- a API do mapa lê o schema compartilhado em vez de chamar as APIs públicas de cada domínio, para evitar requisições múltiplas; o isolamento é garantido por leitura, nunca por import de implementação.

## 12. Critérios de aceite

```text
AC-01  Transmission possui visão NOC em /transmission/noc com totais e agregados reais.
AC-02  SLA/deadline possui estado derivado consistente (ON_TRACK/DUE_SOON/OVERDUE/COMPLETED).
AC-03  alertas possuem acknowledgement e resolução com ator, timestamp e histórico preservado.
AC-04  retry manual e em lote mantém histórico de tentativas e é atômico no lote.
AC-05  conectividade possui histórico suficiente para análise (entradas, latência, último sucesso, sequência de falhas).
AC-06  Operational Map possui layers operacionais reais.
AC-07  Map não assume ownership de outros domínios.
AC-08  Map features possuem contrato unificado e não expõem objetos Prisma.
AC-09  Map suporta filtros e clustering quando necessário.
AC-10  Simulator possui Scenario Builder com rotas próprias.
AC-11  cenário possui eventos programados com offset, tipo, alvo, severidade e probabilidade.
AC-12  somente eventos executáveis são aceitos.
AC-13  seed permite comportamento determinístico quando aplicável, com teste dedicado.
AC-14  engine preserva o lifecycle start/pause/resume/tick/finish.
AC-15  score possui fórmula explícita na SPEC e teste dedicado.
AC-16  replay explica os eventos executados, incluindo falhas de execução.
AC-17  Reports possui análises por domínio com endpoints próprios.
AC-18  Reports possui filtros compartilhados consistentes.
AC-19  Reports suporta comparação de período.
AC-20  drill-down utiliza rotas existentes e dados reais.
AC-21  Event Bus recebe apenas eventos novos relevantes.
AC-22  Audit continua pela infraestrutura existente, sem alteração de arquitetura.
AC-23  Notifications não recebe eventos triviais nem spam novo.
AC-24  nenhum import interno cross-plugin é criado.
AC-25  migrations históricas permanecem intactas.
AC-26  regras críticas possuem testes focados.
AC-27  full suite passa ao final.
AC-28  LOC antes/depois é reportada sem expansão artificial.
```

## 13. Arquivos principais

```text
plugins/monitoring/transmission/**
plugins/monitoring/operational-map/**
plugins/simulation/operational-simulator/**
plugins/analytics/reports/**
packages/event-bus/src/contracts.ts
packages/database/prisma/schema.prisma
packages/database/prisma/migrations/<próximo-id>_operational_intelligence_improvements/
apps/api/src/app.module.ts
apps/web/src/pluginRegistry.ts (somente se necessário)
docs/modules/*
```

Alterações em arquivos compartilhados limitam-se ao necessário para schema, migration, eventos e registro de módulo.
