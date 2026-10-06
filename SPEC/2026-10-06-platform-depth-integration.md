# SPEC — Platform Depth & Integration Phase

## Status

`approved`

## Contexto

A plataforma já possui amplitude funcional suficiente: 26 plugins cobrindo estrutura eleitoral, operações, logística, monitoramento, analytics, simulação e sistema. A distribuição de código, porém, é desequilibrada: a categoria `operations` concentra a maior parte da profundidade, enquanto `simulation`, `analytics/reports`, `monitoring/transmission` e `system/audit` permanecem rasos em relação ao papel que exercem na operação, e a cobertura E2E é marginal (2 arquivos, ~95 linhas) frente ao tamanho da plataforma.

Esta SPEC normatiza uma fase de **profundidade e integração**, não de amplitude. Não cria verticais novos de domínio operacional.

## Objetivo

1. tornar o Operational Simulator uma ferramenta completa de treinamento e análise;
2. transformar Reports em analytics operacional com séries temporais, SLA, comparação de zonas e drill-down;
3. elevar Transmission/NOC a um domínio com modelo de conectividade, histórico de estado, SLA, failover e correlação;
4. transformar Audit de subscriber passivo em experiência real de rastreabilidade;
5. construir suíte E2E cross-domain de alto valor;
6. adicionar CI e hardening de entrega;
7. crescer LOC oficial (`cloc`) com código funcional defensável.

## Relação com SPECs anteriores

As SPECs `2026-10-01-reports-bi.md`, `2026-10-01-transmission-monitor.md` e `2026-10-01-incidents-inventory-rbac-events-simulator.md` são reconstruções retroativas de uma página, com critérios já atendidos. Esta SPEC **não as substitui em bloco**: elas permanecem como registro histórico do estado reconstruído. Para os recortes que esta SPEC redefine — Simulator, Reports, Transmission e Audit — esta SPEC é a referência normativa vigente, porque descreve requisitos ainda não implementados e altera comportamento materialmente.

`2026-10-06-operational-coordination-suite.md` permanece integralmente vigente e não é alterada. O Command Center continua sendo a visão agregadora da plataforma; esta fase não cria um segundo agregador.

## Fora de escopo

- criar novos plugins de domínio operacional, exceto o item condicional da seção 8;
- WebSocket, Kafka, Redis, machine learning, LLM;
- sonda de rede real, API externa de topologia, infraestrutura telecom específica;
- reescrever módulos existentes sem necessidade;
- alterar migrations históricas, `prisma migrate reset`, `prisma db push`;
- substituir PDF de relatórios por uma stack pesada.

## Invariantes globais

I1. Nenhum workspace importa `src/` de outro workspace. Toda integração usa entrypoints públicos `@eops/*`, contratos em `@eops/shared/<dominio>`, Event Bus ou API HTTP interna.

I2. Nenhum plugin escreve em tabela de outro domínio. Dados externos entram por leitura somente-leitura com `select` explícito, ou por evento, ou por endpoint público do domínio owner.

I3. Autorização é sempre verificada no backend por permissão. UI condiciona exibição, nunca substitui o guard.

I4. Dados de eleições diferentes nunca se misturam. Toda consulta multi-domínio filtra por `electionId` quando o domínio possui esse campo; quando não possui, o filtro é feito pela entidade âncora (zona, local, ativo, time) que o possui.

I5. Números expostos ao usuário vêm de dados persistidos. Ausência de dado produz `null`, estado vazio explícito ou `available: false`; nunca zero inventado nem valor de exemplo.

I6. Operações idempotentes são explicitamente marcadas na SPEC e implementadas com chave natural ou transação. Reexecutar a mesma chamada não cria duplicata.

I7. Servidor define ator, timestamps, transições de estado, derivações e cálculos. DTOs não aceitam `actorId`, `createdAt`, `updatedAt`, `score`, `metrics` ou timestamps de transição vindos do cliente.

I8. Toda leitura auditável roda sobre dados do tenant lógico do pleito; nada de consulta global sem escopo quando a rota aceita escopo.

---

# Parte 1 — Simulator 2.0

## 1.1 Ownership

O plugin `@eops/plugin-simulator` é owner de: cenários, eventos de cenário, execuções (runs), snapshots de execução, decisões de operador, métricas e score de simulação.

Nunca é owner de `Incident`, `Asset`, `TransmissionPoint`, `FieldShift`, `FieldTeam`, `Route`, `ResourceRequest` ou `Task`. Efeitos sobre esses domínios são **consequências explícitas e opcionais** da execução, sempre com restauração registrada.

## 1.2 Isolamento de dados simulados

Todo artefato criado pelo simulador em domínio real é marcado como simulado:

- `Incident.isSimulated = true` e `Incident.simulationId` preenchido;
- alterações de ativo só ocorrem quando `Simulation.applyToOperations = true` e são revertidas no encerramento, a partir do payload registrado no evento.

Consultas operacionais reais (Command Center, Reports, Audit por padrão) excluem artefatos simulados: `isSimulated = false` em `Incident`. Reports expõe um parâmetro explícito `includeSimulated` (default `false`) quando fizer sentido analítico.

## 1.3 Lifecycle da execução

Enum `SimulationStatus` é estendido com `FAILED`. O mapeamento normativo é:

```text
CREATED   ≡ DRAFT
RUNNING   = RUNNING
PAUSED    = PAUSED
COMPLETED ≡ FINISHED
FAILED    = FAILED   (novo)
CANCELLED = CANCELLED
```

Os valores `DRAFT` e `FINISHED` permanecem no banco por compatibilidade histórica; a SPEC adota os nomes conceituais `CREATED` e `COMPLETED` e exige que a UI e os contratos de API usem esses nomes.

Transições permitidas:

```text
DRAFT     → RUNNING, CANCELLED
RUNNING   → PAUSED, FINISHED, FAILED, CANCELLED
PAUSED    → RUNNING, FINISHED, FAILED, CANCELLED
FINISHED  → (terminal)
FAILED    → (terminal)
CANCELLED → (terminal)
```

`FAILED` é alcançável apenas por falha de execução registrada com motivo (`failureReason`). Qualquer transição fora da tabela é rejeitada com `409`.

## 1.4 Relógio lógico

Velocidades permitidas: `1, 2, 5, 10, 20`. Valor fora do conjunto é rejeitado com `400`.

Operações:

```text
POST /simulations/:id/start    CREATED|PAUSED → RUNNING
POST /simulations/:id/pause    RUNNING → PAUSED
POST /simulations/:id/step     avança exatamente um tick
POST /simulations/:id/tick     avança conforme a velocidade (mantido por compatibilidade)
POST /simulations/:id/finish   RUNNING|PAUSED → COMPLETED
POST /simulations/:id/cancel   CREATED|RUNNING|PAUSED → CANCELLED
POST /simulations/:id/fail     RUNNING|PAUSED → FAILED, exige motivo
```

Regra de determinismo: dado `(scenario, seed, sequência de chamadas de tick/step)`, a execução é reproduzível. O gerador pseudoaleatório é semeado por `seed + offsetSeconds` e nunca por relógio de parede. Nenhum efeito depende de `Date.now()` para decidir qual evento ocorre — `Date.now()` só é usado para carimbar `createdAt` de registros persistidos.

`step` avança `TICK_SECONDS` independentemente da velocidade; `tick` avança `speed × TICK_SECONDS`.

## 1.5 Scenario Builder

`SimulationScenario` é estendido com:

```text
status            SimulationScenarioStatus @default(DRAFT)   (DRAFT | PUBLISHED | ARCHIVED)
isTemplate        Boolean @default(false)
speed             Int     @default(1)
version           Int     @default(1)
clonedFromId      String?
objectives        Json?
successCriteria   Json?
failureCriteria   Json?
scoreWeights      Json?
initialConditions Json?
```

Estruturas JSON validadas no servidor (rejeição com `400` quando malformadas):

```text
objectives        [{ key, label, target, direction: "AT_LEAST" | "AT_MOST", weight }]
successCriteria   [{ metric, operator: "GTE" | "LTE", value, label }]
failureCriteria   [{ metric, operator: "GTE" | "LTE", value, label }]
scoreWeights      { <dimensão>: número ≥ 0 }
initialConditions { zones?: string[], coverages?: { shiftCoveragePercent?, transmissionOnlineTarget? },
                    flags?: { degradedStart?, noBackupCircuit? } }
```

`metric` e `key` são restritos ao vocabulário de métricas do domínio de simulação (1.8). Chave desconhecida é rejeitada.

Regras:

```text
cenário PUBLISHED não aceita edição de eventos nem de configuração — só clonagem ou arquivamento
cenário ARCHIVED não aceita edição nem execução
clonar gera novo cenário com status DRAFT, clonedFromId preenchido e version = original.version + 1
marcar isTemplate permite clonagem por terceiros; não permite execução
rascunho (DRAFT) aceita edição livre de eventos e configuração
```

## 1.6 Event Injection

`SimulationScenarioEventType` é estendido (aditivo) com:

```text
INCIDENT_CRITICAL       incidente de severidade crítica
OPERATIONAL_DELAY       atraso operacional acumulado
CONNECTIVITY_LOSS       perda de conectividade de ponto
TRANSMISSION_DEGRADATION degradação (não queda) de transmissão
TEAM_UNAVAILABLE        indisponibilidade de equipe
OPERATOR_ABSENCE        ausência de operador em turno
VEHICLE_UNAVAILABLE     indisponibilidade de veículo
ROUTE_FAILURE           falha de rota
RESOURCE_REQUEST_CREATE criação de solicitação de recurso no cenário
PREPARATION_BLOCKER     bloqueio de preparação
HANDOVER_PENDING        passagem de turno pendente
WORKFORCE_SHORTAGE      insuficiência de cobertura de turno
SERVICE_RECOVERY        recuperação de serviço
```

Tipos existentes (`INCIDENT_CREATE`, `TRANSMISSION_FAILURE`, `TRANSMISSION_RECOVERY`, `ASSET_FAILURE`, `ASSET_RECOVERY`) permanecem.

Cada evento de cenário possui:

```text
offsetSeconds   instante simulado
type            tipo
severity        opcional
targetType      NONE | POLLING_PLACE | ZONE | ASSET | TRANSMISSION
targetId        opcional, validado contra o pleito do cenário
probability     0..100
enabled         Boolean @default(true)   (novo)
payload         Json validado
impact          impacto esperado declarado
```

`enabled = false` significa que o evento existe no plano mas nunca é executado, e aparece no replay como `DISABLED`. Eventos desabilitados não contam em `plannedEvents` do score.

Validação de cenário (já existente, mantida e ampliada):

```text
offsetSeconds ≥ 0
probability em 0..100
tipos que exigem alvo precisam de targetType coerente e targetId existente no pleito
não pode haver dois eventos com o mesmo (offsetSeconds, type)
offsetSeconds ≤ durationSeconds quando durationSeconds definido
```

Efeitos por tipo, com limite explícito de escrita cross-domain:

```text
INCIDENT_CREATE / INCIDENT_CRITICAL   cria Incident com isSimulated = true
ASSET_FAILURE / ASSET_RECOVERY        escreve Asset somente se applyToOperations
TRANSMISSION_FAILURE / _DEGRADATION /
  _RECOVERY / CONNECTIVITY_LOSS       NUNCA escreve em TransmissionPoint — efeito apenas simulado
OPERATOR_ABSENCE / TEAM_UNAVAILABLE /
  WORKFORCE_SHORTAGE                  NUNCA escreve em FieldShift/FieldTeam — estado simulado no run
VEHICLE_UNAVAILABLE / ROUTE_FAILURE   NUNCA escreve em Vehicle/DistributionRoute
RESOURCE_REQUEST_CREATE               registra intenção simulada; não cria ResourceRequest real
PREPARATION_BLOCKER / HANDOVER_PENDING estado simulado no run
OPERATIONAL_DELAY / SERVICE_RECOVERY   estado simulado no run
```

O simulador **não** é autorizado a criar `ResourceRequest`, `Task`, `Postmortem` ou `TransmissionPoint` reais. Esses tipos existem no cenário para produzir carga operacional mensurável, não para escrever em domínio alheio.

## 1.7 Run, snapshots e decisões

Novos modelos:

```text
SimulationSnapshot
  id, simulationId, offsetSeconds, health, metrics Json, payload Json, createdAt
  @@unique([simulationId, offsetSeconds])
  @@index([simulationId, offsetSeconds])

SimulationDecision
  id, simulationId, offsetSeconds, kind, rationale, actorId?, payload Json?, createdAt
  @@index([simulationId, offsetSeconds])

enum SimulationDecisionKind
  ESCALATE | DISPATCH_TEAM | ACTIVATE_FAILOVER | REQUEST_RESOURCE |
  RECLASSIFY_SEVERITY | ACCEPT_DEGRADATION | ABORT_OPERATION
```

`Simulation` é estendido com: `simulatedStartedAt DateTime?`, `failureReason String?`, `cancelledAt DateTime?`, `metrics Json?`.

Snapshot é gravado:

```text
a cada tick/step que produza ao menos um evento
obrigatoriamente no encerramento (COMPLETED, FAILED ou CANCELLED)
```

`health` usa o mesmo vocabulário do Command Center (`NORMAL`, `ATTENTION`, `CRITICAL`) calculado sobre o estado simulado acumulado até aquele offset — nunca lido do Command Center real.

Decisão é registrada pelo operador durante o replay/análise e é avaliada no score (dimensão `decisionQuality`). `kind` restrito ao enum; `rationale` obrigatório e não vazio.

## 1.8 Métricas e score

Score composto, 0..100, calculado no servidor. Dimensões:

```text
responseTime          rapidez média de resposta aos incidentes simulados
unresolvedIncidents   incidentes não resolvidos ao final
deadlineMisses        prazos (SLA simulado) perdidos
availability          disponibilidade simulada de transmissão
recoveryTime          tempo de recuperação após falha
workforceCoverage     cobertura de turno mantida
resourceFulfillment   atendimento das solicitações simuladas
transmission          integridade da malha de transmissão
readiness             prontidão de preparação
accumulatedCriticality criticidade acumulada dos eventos não tratados
decisionQuality       qualidade das decisões registradas
```

Cada dimensão é normalizada em `0..100` por fórmula explícita e documentada em `packages/shared/src/simulation.ts` (constantes + funções puras). O score final é:

```text
score = Σ(weight_i × dimension_i) / Σ(weight_i)
```

Pesos default centralizados em `DEFAULT_SIMULATION_WEIGHTS`; um cenário pode sobrescrever via `scoreWeights`, e a soma zero é rejeitada com `400`.

`scoreBreakdown` persistido guarda: dimensões calculadas, pesos efetivos, contadores de origem, e a versão do cálculo (`weightsVersion`) para que comparações históricas sejam auditáveis.

Toda métrica usada em `objectives`, `successCriteria` e `failureCriteria` pertence a este vocabulário. Chave fora dele é rejeitada.

Avaliação de critérios no encerramento produz:

```text
objectiveResults  [{ key, label, target, actual, met }]
successEvaluated  Boolean
failureTriggered  Boolean
failureReasons    string[]
```

`failureCriteria` dispara `FAILED` somente quando a execução está `RUNNING`/`PAUSED` e o critério é observado no encerramento ou em `POST /fail`. Critério de falha **não** interrompe a execução automaticamente; ele apenas classifica o resultado. Isso evita efeito destrutivo silencioso.

## 1.9 Replay

```text
GET /simulations/:id/replay                  frames ordenados por offsetSeconds
GET /simulations/:id/replay/frame?offsetSeconds=N   estado no offset N
GET /simulations/:id/decisions               decisões registradas
POST /simulations/:id/decisions              registra decisão
```

Replay é derivado de `SimulationSnapshot` + `SimulationEvent`. `frame?offsetSeconds=N` devolve o snapshot mais recente com `offsetSeconds ≤ N` e os eventos ocorridos em `(snapshotOffset, N]`. Se não houver snapshot anterior, devolve estado inicial vazio com `available: false` explícito.

Determinismo obrigatório: reexecutar a mesma run com mesma seed e mesma sequência de ticks produz os mesmos eventos, na mesma ordem e com os mesmos offsets. A suíte de testes cobre essa propriedade.

## 1.10 Comparação

```text
POST /simulations/compare   body { simulationIds: string[] }   2..6 runs
```

Compara por dimensão e por contador. Regras:

```text
runs precisam pertencer ao mesmo pleito; caso contrário 400
mescla de runs com seed diferente é permitida, mas o retorno marca seedMismatch: true
dimensões ausentes em uma run (run antiga sem scoreBreakdown) retornam null, nunca 0
```

## 1.11 Rotas de frontend

```text
/simulator                         panorama: runs recentes, cenários, indicadores
/simulator/scenarios               lista de cenários com filtro por status/template
/simulator/scenarios/new           builder
/simulator/scenarios/:id           detalhe + builder + eventos
/simulator/runs                    lista de execuções com filtros
/simulator/runs/:id                detalhe, score, métricas, timeline
/simulator/runs/:id/replay         replay com navegação por offset
/simulator/compare                 comparação de runs
```

`ScenarioBuilderPage` existente é reaproveitada e ampliada; não criar segunda página de builder.

## 1.12 Permissões

```text
simulation.read     leitura de cenários, runs, replay, score e comparação
simulation.manage   criar/editar/clonar/arquivar cenário, iniciar/pausar/step/tick/encerrar run,
                    registrar decisão
```

Registrar decisão durante a análise exige `simulation.manage`. Leitura de replay exige `simulation.read`.

## 1.13 Eventos

```text
simulation.started      (existente)
simulation.paused       (existente)
simulation.resumed      (existente)
simulation.finished     (existente)
simulation.scored       (existente)
simulation.failed       novo
simulation.cancelled    novo
simulation.decision_recorded  novo
simulated_incident.created    novo — incidente criado por execução simulada
```

`simulated_incident.created` existe para que consumidores possam distinguir carga simulada de incidente real sem inspecionar `isSimulated` no payload. Nenhum evento é emitido para navegação, filtro, seleção de frame ou abertura de página.

---

# Parte 2 — Reports / Operational Analytics 2.0

## 2.1 Escopo

Reports responde "o que aconteceu e como se comportou ao longo do tempo". Não duplica o Command Center (estado atual) nem o Simulator (treinamento).

## 2.2 Séries temporais

```text
GET /reports/timeseries
  metric       obrigatório, restrito ao vocabulário 2.3
  granularity  hour | day | week     (default day)
  from / to    ISO, obrigatórios, janela máxima 366 dias
  electionId, electoralZoneId, pollingPlaceId   filtros opcionais
  includeSimulated  boolean, default false
```

Resposta:

```text
{ metric, granularity, from, to, bucketCount,
  buckets: [{ bucketStart, bucketEnd, value, sampleSize }],
  totals: { value, sampleSize } }
```

Regras:

```text
buckets vazios são retornados com value = 0 e sampleSize = 0 — o eixo temporal é contínuo
`sampleSize` é obrigatório porque séries com denominadores diferentes não podem ser lidas como equivalentes
granularity inválida → 400
janela maior que 366 dias → 400
```

## 2.3 Vocabulário de métricas

Séries e SLA usam um vocabulário fechado, definido em `@eops/shared/reports.ts`:

```text
incidentsOpened        incidentsOpenedCritical      incidentsResolved
incidentsEscalated     incidentsOverdueSla          incidentsActive
transmissionFailures   transmissionOffline          transmissionSuccessRate
resourceRequestsCreated resourceRequestsFulfilled   resourceRequestsOverdue
shiftCoveragePercent   shiftCoverageEmpty            dispatchesActive
routesDelayed          deliveriesFailed              deliveriesCompleted
preparationReady       preparationBlocked            assetsLost
assetsInMaintenance    assetsUnavailable
```

Métrica fora do vocabulário é rejeitada com `400`. A UI só oferece as métricas publicadas em `REPORT_METRICS`.

## 2.4 SLA Analytics

```text
GET /reports/sla
```

Fórmulas normativas, todas documentadas no código e cobertas por teste:

```text
meanResponseMinutes   = média de (acknowledgedAt - openedAt) dos incidentes reconhecidos
                        no período; null quando não há amostra
meanResolutionMinutes = média de (resolvedAt - openedAt) dos incidentes resolvidos
                        no período; null quando não há amostra
mttrMinutes           = média de (resolvedAt - openedAt) restrita a incidentes
                        com severity HIGH ou CRITICAL; null sem amostra
slaCompliancePercent  = 100 × resolvidos dentro do prazo / incidentes com slaDeadline
                        definido no período; null quando o denominador é 0
deadlineMisses        = incidentes com slaDeadline < now e status não terminal,
                        mais incidentes terminais resolvidos após o slaDeadline
escalationRatePercent = 100 × incidentes com escalationLevel > 0 / total de incidentes
                        abertos no período; null com denominador 0
transmissionDowntimeMinutes = soma das durações de intervalos OFFLINE em
                        TransmissionStateTransition dentro do período
transmissionUptimePercent   = 100 × (janela - downtime) / janela; null quando
                        não há janela observada
fulfillmentMeanMinutes      = média de (fulfilledAt - submittedAt) das solicitações
                        atendidas no período; null sem amostra
dispatchMeanMinutes         = média de (completedAt - requestedAt) dos dispatches
                        concluídos no período; null sem amostra
```

Regra transversal: **nenhuma média é calculada com denominador zero**. Quando não há amostra, o valor é `null` e a resposta inclui `sampleSize: 0` para aquele indicador. O frontend exibe "sem dados" e nunca `0`.

## 2.5 Comparação de zonas

```text
GET /reports/zones?electionId=&from=&to=&metrics=
```

Por zona retorna:

```text
zoneId, zoneNumber, zoneName, municipality, state
pollingPlaceCount, pollingSectionCount, registeredVoters
metrics: { <métrica>: { value, per1000Voters | null, perPlace | null } }
rankings: { <métrica>: { byAbsolute: number | null, byNormalized: number | null } }
```

Regra anti-ranking enganoso:

```text
zona sem denominador (registeredVoters = 0 ou pollingPlaceCount = 0) recebe
per1000Voters / perPlace = null e byNormalized = null
o ranking normalizado é sempre acompanhado do denominador e do sampleSize da métrica
o frontend é obrigado a exibir o denominador junto do ranking normalizado
```

## 2.6 Drill-down

Toda métrica agregada exposta em `/reports/timeseries` e `/reports/zones` possui drill-down:

```text
GET /reports/drilldown?metric=&from=&to=&bucketStart=&bucketEnd=&electionId=&zoneId=&limit=
```

Resposta:

```text
{ metric, bucketStart, bucketEnd, total, truncated,
  items: [{ id, kind, title, subtitle, status, severity, occurredAt, deepLink, zoneId?, pollingPlaceId? }] }
```

`kind` restrito a: `INCIDENT`, `TRANSMISSION_POINT`, `RESOURCE_REQUEST`, `FIELD_SHIFT`, `FIELD_DISPATCH`, `ROUTE`, `ASSET`, `PREPARATION_CHECKLIST`.

`deepLink` aponta para rota real existente:

```text
INCIDENT            /incidents/:id
TRANSMISSION_POINT  /transmission/:id
RESOURCE_REQUEST    /resource-requests/:id
FIELD_SHIFT         /shifts/:id
FIELD_DISPATCH      /field-teams/dispatch/:id
ROUTE               /routes/:id
ASSET               /inventory/:id
PREPARATION_CHECKLIST /preparation-checklists/:id
```

`truncated: true` quando o resultado excede `limit` (default 50, máximo 200). O total continua sendo o total real, não o tamanho da página.

## 2.7 Saved analytics views

```text
GET    /reports/views
POST   /reports/views
PATCH  /reports/views/:id
DELETE /reports/views/:id
```

Modelo próprio do plugin:

```text
ReportSavedView
  id, ownerId, name, description?, filters Json, metricsJson Json, granularity, isDefault,
  shared, createdAt, updatedAt
  @@unique([ownerId, name])
```

Justificativa normativa para não reutilizar `CommandCenterSavedView`: o modelo do Command Center pertence ao plugin de Command Center e a fronteira entre plugins proíbe importar sua implementação interna. Promover um modelo genérico para `packages/database` compartilhado exigiria versionar um contrato de views entre dois plugins com semânticas de filtro distintas (o Command Center filtra *attention items*; Reports filtra *séries e métricas*), criando acoplamento entre domínios que a arquitetura evita. A duplicação é de forma, não de regra: cada plugin mantém sua própria validação de filtros.

Regras de visibilidade: idênticas ao padrão já estabelecido — privada por padrão, compartilhada exige `reports.manage`, edição pelo owner ou por quem gerencia, `isDefault` transacional por owner, máximo 20 por owner.

Isso exige adicionar `reports.manage` ao catálogo.

## 2.8 Export

```text
GET /reports/export.csv    (existente, mantido)
GET /reports/export.pdf    (existente, mantido)
GET /reports/export.json   novo — JSON estruturado
```

`export.json` devolve:

```text
{ generatedAt, scope: { electionId?, electoralZoneId?, pollingPlaceId?, from, to, includeSimulated },
  sections: { executive, operations, incidents, transmission, workforce, logistics, assets },
  timeseries: { <métrica>: buckets } quando solicitado via ?metrics= }
```

Todos os exports exigem `reports.export` e respeitam o escopo. Nenhum export inclui artefato simulado por default.

## 2.9 Frontend

```text
/reports                      panorama analítico (existente, ampliado)
/reports/timeseries           séries temporais com granularidade e drill-down
/reports/sla                  SLA, MTTR, downtime, fulfillment
/reports/zones                comparação de zonas
/reports/views                visões salvas
/reports/export               exportação
```

As páginas por domínio existentes (`ReportsIncidentsPage`, `ReportsTransmissionPage`, `ReportsWorkforcePage`, `ReportsLogisticsPage`, `ReportsAssetsPage`, `ReportsOperationsPage`) são mantidas e passam a oferecer deep link para drill-down. `BarChart` existente é reaproveitado; nenhuma biblioteca de gráficos nova é adicionada.

## 2.10 Permissões

```text
reports.read     dashboards, séries, SLA, zonas, drill-down, views read, export.json
reports.manage   criar/editar/remover views, compartilhar views
reports.export   CSV, PDF, JSON
```

## 2.11 Eventos

Nenhum evento para leitura analítica. Somente mutações próprias:

```text
report_view.created   nova
report_view.shared    nova
```

---

# Parte 3 — Transmission / NOC 2.0

## 3.1 Escopo

Transmission é owner de pontos de transmissão, circuitos, provedores, histórico de estado, failover, tentativas, alertas e SLA de transmissão. Continua respondendo "como está a malha de transmissão e o que aconteceu com ela".

## 3.2 Modelo de conectividade

Novos modelos, sem duplicar `TransmissionPoint`:

```text
TransmissionProvider
  id, code @unique, name, contact?, slaTargetUptimePercent Decimal? @db.Decimal(5,2),
  notes?, active Boolean @default(true), createdAt, updatedAt
  @@index([active, name])

TransmissionCircuit
  id, pointId, providerId?, code @unique, name,
  technology String?            (rótulo livre: FIBER, RADIO, SATELLITE, LTE — não enum fechado)
  bandwidthMbps Int?
  isPrimary Boolean @default(true)
  status ConnectivityStatus @default(UNKNOWN)
  lastSeenAt DateTime?
  activatedAt DateTime @default(now())
  deactivatedAt DateTime?
  notes? @db.Text
  createdAt, updatedAt
  @@index([pointId, isPrimary])
  @@index([providerId, status])
  @@index([status])
```

Regras:

```text
um ponto pode ter no máximo um circuito com isPrimary = true e status ativo
criar circuito primário quando já existe primário ativo → 409
circuito pertence sempre a um ponto existente
transição de status do circuito registra TransmissionStateTransition
```

## 3.3 Histórico de estado

```text
TransmissionStateTransition
  id, pointId, circuitId?, from ConnectivityStatus, to ConnectivityStatus,
  reason String?, actorId?, durationSeconds Int?, occurredAt DateTime @default(now())
  @@index([pointId, occurredAt])
  @@index([to, occurredAt])
  @@index([pointId, circuitId])
```

Regras:

```text
toda mudança de connectivity do ponto ou do circuito cria uma transição
a transição anterior do mesmo escopo (ponto, ou ponto+circuito) recebe
  durationSeconds = occurredAt_atual - occurredAt_anterior
transição com from = to é rejeitada (409) — não há histórico de não-mudança
durationSeconds é sempre calculado no servidor
```

`durationSeconds` na transição anterior é o mecanismo que torna uptime/downtime analisáveis sem varrer event logs.

Estados normativos (reaproveitando `ConnectivityStatus`): `ONLINE`, `DEGRADED`, `OFFLINE`, `UNKNOWN`. Conceitualmente:

```text
ONLINE      operando normalmente
DEGRADED    operando com degradação declarada
OFFLINE     indisponível
UNKNOWN     sem leitura recente — nunca contabilizado como downtime
```

`UNKNOWN` é excluído do cálculo de uptime e reportado separadamente como `unknownMinutes`.

## 3.4 Failover

```text
TransmissionFailover
  id, pointId, fromCircuitId?, toCircuitId, reason String,
  status TransmissionFailoverStatus @default(ACTIVE),
  startedAt DateTime @default(now()), recoveredAt DateTime?, recoveredById String?,
  notes? @db.Text
  @@index([pointId, startedAt])
  @@index([status, startedAt])

enum TransmissionFailoverStatus { ACTIVE | RECOVERED | CANCELLED }
```

Regras:

```text
failover exige circuito de destino ativo e diferente da origem
failover registra transição do ponto para o estado do circuito de destino
não pode haver dois failovers ACTIVE para o mesmo ponto → 409
recuperação exige failover ACTIVE, registra recoveredAt, transição de volta e,
  opcionalmente, encerra o intervalo do circuito de destino
failover não altera provedor nem circuito de origem além do status quando aplicável
```

## 3.5 SLA

Funções puras em `@eops/shared/transmission.ts`, usadas pelo servidor e testadas:

```text
uptimePercent(intervals, window)      = 100 × onlineMinutes / observedMinutes
observedMinutes = janela − unknownMinutes
downtimeMinutes                       = soma de intervalos OFFLINE
degradedMinutes                       = soma de intervalos DEGRADED
unknownMinutes                        = soma de intervalos UNKNOWN
recoverySeconds                       = média de duração de intervalos OFFLINE até o
                                        próximo intervalo não-OFFLINE; null sem amostra
deadlineRiskPercent                   = 100 × pontos com operationalDeadline < now e
                                        status != SUCCESS / pontos com deadline definido
providerPerformance                   = por provedor: uptimePercent ponderado por circuitos,
                                        incidentCount, failoverCount
```

Quando a janela observada é zero, todos os percentuais retornam `null`.

Endpoints:

```text
GET /transmission/sla                        visão geral no escopo
GET /transmission/:id/sla                    SLA do ponto
GET /transmission/:id/state-history          histórico de estado
GET /transmission/analytics                  uptime por zona e por provedor, MTTR,
                                             risco de deadline, top ofensores
GET /transmission/providers                  lista
GET /transmission/:id/circuits               circuitos do ponto
GET /transmission/:id/failovers              histórico de failover
```

## 3.6 Correlação

```text
GET /transmission/correlation?pointId=&electionId=&from=&to=
```

Retorna, somente leitura:

```text
incidents        incidentes do mesmo pollingPlace/electoralZone na janela
attentionItems   referência ao feed do Command Center (rota e filtros, não cópia)
resourceRequests solicitações do mesmo local na janela
postmortems      publicações cuja timeline referencia o incidente correlacionado
handovers        passagens de turno do mesmo local na janela
```

Regras:

```text
correlação é sempre derivada — nada é persistido
nenhuma escrita em Incident, ResourceRequest, Postmortem, ShiftHandover ou Command Center
o máximo por seção é 20 itens, com contagem total real
quando o ator não possui a permissão de leitura do domínio correlacionado, a seção
  retorna available: false e não expõe contagem
```

## 3.7 Escrita (mutations)

```text
POST   /transmission/providers
PATCH  /transmission/providers/:id
POST   /transmission/:id/circuits
PATCH  /transmission/circuits/:circuitId
POST   /transmission/:id/failover
POST   /transmission/:id/failover/:failoverId/recover
POST   /transmission/:id/failover/:failoverId/cancel
POST   /transmission/:id/recovery            registra recuperação de conectividade
```

Todas exigem `transmission.manage`.

`PATCH /transmission/:id/connectivity` existente passa a criar `TransmissionStateTransition` automaticamente.

## 3.8 Permissões

```text
transmission.read     leitura de pontos, circuitos, provedores, SLA, correlação e analytics
transmission.manage   create/update de ponto, circuito, provedor, conectividade,
                      failover, recuperação, retry e alertas
```

Nenhuma permissão nova é necessária.

## 3.9 Eventos

```text
transmission.connectivity_changed   (existente)
transmission.failed                 (existente)
transmission.alert_created          (existente)
transmission.state_transition       novo
transmission.circuit_created        novo
transmission.circuit_status_changed novo
transmission.failover_started       novo
transmission.failover_recovered     novo
transmission.provider_updated       novo
```

---

# Parte 4 — Audit / Observability 2.0

## 4.1 Escopo

Audit responde "quem fez o quê, quando, sobre qual entidade e em que cadeia". Continua sendo subscriber global (`subscribeAll`) — não passa a ser produtor manual de eventos.

## 4.2 Correlation ID

Introduzido incrementalmente, sem reescrever a plataforma.

```text
- novo módulo packages/shared/src/correlation.ts com contrato e naming
- novo AsyncLocalStorage em @eops/security (correlation-context.ts) exposto como
  withCorrelationId(id, fn) e currentCorrelationId()
- interceptor HTTP no composition root (apps/api) lê o header x-correlation-id:
  usa quando presente e válido (≤ 64 chars, ASCII imprimível), senão gera um novo
  (crypto.randomUUID()); devolve o valor no header x-correlation-id da resposta
- EventBus.emit anexa correlationId ao DomainEvent quando houver contexto ativo
- AuditEvent ganha coluna correlationId (nullable, indexada)
- o subscriber de audit persiste event.correlationId
- Notification ganha coluna correlationId (nullable, indexada) e o subscriber
  de notificações a persiste
```

Regra de compatibilidade: ausência de correlation ID nunca quebra emissão, persistência ou entrega; o campo fica `null`.

Consultas:

```text
GET /audit/correlation/:correlationId   cadeia completa: audit events + notifications
```

## 4.3 Enriquecimento do registro de auditoria

`AuditEvent` é estendido (aditivo, nullable, indexado):

```text
correlationId String?
category      String?    domínio derivado do namespace do evento (incident, asset, ...)
severity      AuditEventSeverity?
electionId    String?
electoralZoneId String?

enum AuditEventSeverity { INFO | NOTICE | WARNING | CRITICAL }
```

Regras de derivação (servidor, funções puras testadas):

```text
category  = namespace do eventName (prefixo antes do primeiro ponto);
            para eventName ausente, deriva de entityType em minúsculas kebab
severity  = CRITICAL para eventos de falha/escalonamento/cancelamento crítico,
            WARNING para mudança de status/severidade, NOTICE para criação,
            INFO para o restante
electionId / electoralZoneId = copiados do payload quando presentes e string;
            senão null — nunca inferidos por consulta adicional
```

## 4.4 Sanitização

`sanitizeAuditValue` existente é ampliado e passa a ser aplicado em **escrita e leitura** (defesa em profundidade). Chaves redigidas (case-insensitive, comparação por inclusão de substring):

```text
password, senha, passwd, token, secret, authorization, apikey, api_key,
credential, refresh_token, access_token, private_key, certificate, hash,
cookie, sessionid, cpf
```

Regras:

```text
substituição por "[REDACTED]" preservando a forma do objeto
aplicada recursivamente a objetos e arrays
aplicada a oldData, newData e metadata no momento da persistência
reaplicada na leitura antes de devolver ao cliente
payload maior que 8 KB é truncado com marcador "[TRUNCATED]" em vez de rejeitado
```

## 4.5 Explorer

```text
GET /audit                     (existente, ampliado)
GET /audit/summary             (existente, ampliado)
GET /audit/:id                 (existente)
GET /audit/entities/:entityType/:entityId        timeline da entidade
GET /audit/correlation/:correlationId
GET /audit/explorer            consulta avançada com facets
GET /audit/categories          vocabulário de categorias e severidades observadas
GET /audit/actors              atores com atividade no período (id, nome, contagem)
```

Filtros aceitos em `/audit`, `/audit/summary` e `/audit/explorer`:

```text
from, to (ISO, obrigatórios; janela máxima 366 dias)
actorId, action, entityType, entityId, eventName, category, severity
electionId, electoralZoneId
correlationId
search (busca textual restrita a eventName, entityType, entityId e metadata serializado)
page, pageSize (≤ 100)
```

`/audit/explorer` devolve ainda facets:

```text
{ byAction: [{key,count}], byCategory: [{key,count}], bySeverity: [{key,count}], byActor: [{id,name,count}] }
```

## 4.6 Before / After

```text
GET /audit/:id/diff
```

Devolve diferenças normalizadas, calculadas no servidor por função pura:

```text
{ changed: [{ field, before, after }], unchanged: number, truncated: boolean }
```

Regras:

```text
o diff considera a união das chaves de oldData e newData
campos presentes em ambos com valor igual contam em `unchanged` e não em `changed`
campos ausentes em um lado aparecem com null no lado faltante
o resultado passa por sanitização antes de ser devolvido
`changed` é limitado a 200 entradas; excedente marca `truncated: true`
```

## 4.7 RBAC do Explorer

Audit não pode virar canal de descoberta de domínios.

```text
mapa categoria → permissão de leitura exigida:
  incident              → incidents.read
  asset                 → inventory.read
  route                 → routes.read
  delivery              → routes.read
  transmission          → transmission.read
  resource_request      → resource-requests.read
  postmortem            → postmortems.read
  task                  → tasks.read
  shift                 → shifts.read
  shift_handover        → shift-handovers.read
  field_team            → field-teams.read
  field_member          → field-teams.read
  field_dispatch        → field-teams.read
  preparation_checklist → preparation-checklists.read
  communication         → communications.read
  evidence              → evidence.read
  runbook               → knowledge.read
  risk                  → risks.read
  user                  → users.read
  election              → elections.read
  command_center        → command-center.read
  simulation            → simulation.read
```

Regras:

```text
o servidor remove do resultado toda linha cuja categoria exige permissão ausente
as contagens de `summary` e as facets de `explorer` são recalculadas sobre o
  conjunto visível, e a resposta inclui `restrictedCategories: string[]` listando
  as categorias removidas — sem revelar quantas linhas foram omitidas
categoria sem mapeamento é tratada como restrita (negada por padrão)
`GET /audit/entities/:entityType/:entityId` respeita o mesmo mapa; entidade de
  categoria restrita devolve 403, não lista vazia
```

Isso mantém a auditoria útil para quem tem escopo amplo sem transformá-la em bypass de autorização.

## 4.8 Frontend

```text
/audit                    explorer com filtros, facets e seleção de período
/audit/:id                detalhe com diff before/after e correlação
/audit/entities/:type/:id timeline de entidade (rota nova)
/audit/correlation/:id    cadeia por correlation ID (rota nova)
```

`AuditListPage` e `AuditDetailPage` existentes são ampliadas; as duas rotas novas são adicionadas ao `pluginRegistry` pelo índice do plugin.

## 4.9 Permissões

```text
audit.read   tudo em /audit, incluindo explorer, timeline de entidade e correlação
```

Nenhuma permissão nova. O controle adicional é o mapa categoria → permissão de domínio descrito em 4.7.

## 4.10 Eventos

Audit não emite eventos de negócio próprios. A única emissão é interna e desnecessária: nenhuma é adicionada nesta fase.

---

# Parte 5 — Cross-domain E2E

## 5.1 Objetivo

Cobrir fluxos de alto valor que atravessam múltiplos domínios, onde os testes unitários não alcançam a integração.

## 5.2 Fluxos obrigatórios

```text
E2E-1  Incidente crítico → Command Center → Resource Request (create, submit, triage,
       approve, partial fulfillment, full fulfillment) → Command Center atualizado
E2E-2  Turno → operador indisponível → problema de cobertura → substituição → dispatch →
       Shift Handover (submit, confirm)
E2E-3  Incidente → resolução → Postmortem → import de timeline → causa raiz → lição →
       ação corretiva → review → approve → publish
E2E-4  Inventário → reserva de ativo → rota → dispatch → entrega/check-in → evidência →
       custódia/histórico
E2E-5  Degradação/queda de transmissão → sinal de atenção → incidente → Command Center →
       recuperação → analytics
E2E-6  RBAC: ADMIN, SUPERVISOR, OPERATOR, TECHNICIAN, VIEWER contra rota, endpoint,
       ação e conteúdo retornado
```

## 5.3 Requisitos de teste

```text
- autorização verificada no backend, não apenas botão escondido: cada caso de RBAC
  chama o endpoint diretamente e verifica 403, além de verificar a navegação
- helpers reutilizáveis, pequenos e legíveis:
  loginAs(role), getSeedContext(), apiGet/apiPost com token, deepLink, cleanup
- nenhuma dependência de dados frágeis: os testes resolvem entidades por consulta
  à API (primeiro registro existente do pleito semeado), não por id fixo
- cada fluxo cria seus próprios artefatos com sufixo único e não depende de ordem
  entre arquivos
- os testes não alteram migrations nem resetam banco
```

## 5.4 Infraestrutura

E2E usa o `playwright.config.ts` existente (API + preview do web). Requer:

```text
DATABASE_URL apontando para banco migrado e semeado
JWT_SECRET definido (o config já fornece um valor de teste quando ausente)
build prévio: npm run build
```

No CI, o job de E2E sobe Postgres como service, aplica `prisma migrate deploy`, semeia e executa. Se o ambiente não permitir, o job é separado e documentado — e a execução NÃO é declarada como bem-sucedida.

---

# Parte 6 — CI

`.github/workflows/ci.yml` com jobs independentes:

```text
static    npm ci → spec:check → check:boundaries → typecheck → lint → db:validate
unit      npm ci → test
build     npm ci → build
e2e       postgres service → npm ci → prisma migrate deploy → db:seed → build → playwright
```

Requisitos:

```text
- Node na versão exigida em package.json (engines)
- cache do npm via actions/setup-node
- jobs independentes para que a falha de um não mascare os outros
- o job de E2E declara explicitamente a dependência de banco e não roda quando o
  segredo de banco não estiver configurado (falha explícita, nunca skip silencioso)
- nenhuma ferramenta nova além das já usadas pelo projeto
```

---

# Parte 7 — Banco de dados

## 7.1 Migrations

Uma migration nova, aditiva, criada após esta SPEC. Sem `DROP` de tabela existente, sem `ALTER` destrutivo, sem reset.

Migrations históricas não são alteradas. `202610060001_operational_coordination_suite` já está aplicada e não é tocada.

## 7.2 Modelos novos

```text
SimulationSnapshot
SimulationDecision
TransmissionProvider
TransmissionCircuit
TransmissionStateTransition
TransmissionFailover
ReportSavedView
```

## 7.3 Modelos estendidos

```text
SimulationScenario   status, isTemplate, speed, version, clonedFromId, objectives,
                     successCriteria, failureCriteria, scoreWeights, initialConditions
SimulationScenarioEvent  enabled
Simulation           simulatedStartedAt, failureReason, cancelledAt, metrics
AuditEvent           correlationId, category, severity, electionId, electoralZoneId
Notification         correlationId
```

## 7.4 Enums

```text
SimulationStatus              + FAILED
SimulationScenarioStatus      novo: DRAFT | PUBLISHED | ARCHIVED
SimulationScenarioEventType   + 13 tipos (seção 1.6)
SimulationDecisionKind        novo
TransmissionFailoverStatus    novo
AuditEventSeverity            novo
```

Ampliação de enum é aditiva e não remove valores existentes.

## 7.5 Índices

```text
SimulationSnapshot        (simulationId, offsetSeconds) único, (health)
SimulationDecision        (simulationId, offsetSeconds), (kind)
SimulationScenario        (status, name), (isTemplate, active)
TransmissionProvider      (active, name)
TransmissionCircuit       (pointId, isPrimary), (providerId, status), (status)
TransmissionStateTransition (pointId, occurredAt), (to, occurredAt), (pointId, circuitId)
TransmissionFailover      (pointId, startedAt), (status, startedAt)
ReportSavedView           (ownerId, isDefault), (shared, updatedAt)
AuditEvent                (correlationId), (category, createdAt), (severity, createdAt),
                          (electionId, createdAt), (electoralZoneId, createdAt)
Notification              (correlationId)
```

---

# Parte 8 — Business Continuity (condicional)

Somente é implementado se **todas** as condições forem verdadeiras:

```text
1. o `cloc` oficial permanecer substancialmente abaixo de 100.000 depois das seções 1–6;
2. Simulator, Reports, Transmission, Audit, E2E e CI estiverem funcionalmente completos;
3. todos os testes focados e a suíte completa estiverem verdes;
4. não houver dívida crítica aberta causada por esta fase;
5. o domínio agregar valor real de continuidade operacional;
6. não for usado como mecanismo de geração de LOC.
```

Se ativado, o escopo normativo é: planos de continuidade com escopo por pleito, critérios de ativação, procedimentos versionados, recursos e equipes responsáveis, sites alternativos, referências de comunicação e critérios de recuperação; lifecycle `DRAFT → READY → ACTIVATED → RECOVERING → CLOSED → ARCHIVED` com tabela de transições explícita; execução com passos, conclusão, responsáveis, evidências, bloqueios e progresso; triggers que produzem **sinal de atenção**, nunca ativação automática; integração somente leitura como contexto.

Se não for ativado, o handoff declara `NOT_CREATED` com a métrica que dispensou o plugin.

---

# Critérios de aceite

## Simulator 2.0

```text
SIM-01  cenário possui status, objetivos, critérios de sucesso e falha, pesos e condições iniciais validados
SIM-02  clonagem de cenário preserva linhagem e incrementa versão
SIM-03  cenário PUBLISHED não aceita edição de eventos; ARCHIVED não aceita edição nem execução
SIM-04  evento individual pode ser desabilitado e não executa
SIM-05  os 13 novos tipos de evento existem e são validados
SIM-06  velocidades restritas a 1/2/5/10/20; valor inválido é rejeitado
SIM-07  step avança um tick; tick avança speed × tick
SIM-08  execução é determinística para (cenário, seed, sequência de ticks)
SIM-09  lifecycle tem tabela de transições normativa e estado FAILED com motivo
SIM-10  snapshots são gravados por tick com evento e no encerramento
SIM-11  score composto usa pesos centralizados e dimensões documentadas
SIM-12  pesos com soma zero são rejeitados; scoreBreakdown guarda pesos efetivos
SIM-13  critério de falha classifica a run e nunca interrompe a execução automaticamente
SIM-14  replay navega por offset e é derivado de snapshots + eventos
SIM-15  decisão registrada exige kind válido e justificativa
SIM-16  comparação de runs rejeita pleitos diferentes e não converte ausência em zero
SIM-17  simulador nunca escreve em TransmissionPoint, Vehicle, Route, ResourceRequest ou Task
SIM-18  alteração real de ativo só ocorre com applyToOperations e é revertida no encerramento
SIM-19  artefatos simulados são excluídos das consultas operacionais reais por default
```

## Reports / Analytics 2.0

```text
REP-01  séries temporais com granularidade hour/day/week e eixo contínuo
REP-02  buckets vazios retornam 0 com sampleSize 0
REP-03  janela acima de 366 dias é rejeitada
REP-04  métrica fora do vocabulário é rejeitada
REP-05  SLA calcula response, resolution, MTTR, compliance, misses, escalation, downtime,
        uptime, fulfillment e dispatch com fórmulas documentadas
REP-06  nenhuma média usa denominador zero; ausência de amostra retorna null
REP-07  comparação de zonas expõe denominador e não produz ranking normalizado sem denominador
REP-08  drill-down devolve as entidades do bucket com deep link real e total não truncado
REP-09  visões salvas têm ownership, compartilhamento por permissão e default transacional
REP-10  export JSON estruturado existe e respeita escopo
REP-11  artefatos simulados ficam fora das séries por default
```

## Transmission / NOC 2.0

```text
TRN-01  circuito pertence a ponto e provedor é modelado
TRN-02  no máximo um circuito primário ativo por ponto
TRN-03  toda mudança de conectividade cria transição com duração calculada no servidor
TRN-04  transição com from = to é rejeitada
TRN-05  failover exige destino ativo e diferente; dois ACTIVE no mesmo ponto é rejeitado
TRN-06  recuperação exige failover ACTIVE e registra timestamp
TRN-07  SLA calcula uptime, downtime, degradação, desconhecido e recuperação
TRN-08  percentuais retornam null quando a janela observada é zero
TRN-09  UNKNOWN é excluído do uptime e reportado separadamente
TRN-10  correlação é derivada, nunca persistida, e respeita permissões por domínio
TRN-11  nenhuma escrita em Incident, ResourceRequest, Postmortem ou ShiftHandover
```

## Audit / Observability 2.0

```text
AUD-01  correlation ID flui de HTTP até audit e notificação
AUD-02  ausência de correlation ID não quebra emissão nem persistência
AUD-03  categoria e severidade derivadas por regra testada
AUD-04  electionId e electoralZoneId copiados do payload quando presentes
AUD-05  sanitização cobre a lista de chaves sensíveis e é aplicada na escrita e na leitura
AUD-06  payload acima de 8 KB é truncado, não rejeitado
AUD-07  explorer filtra por ator, ação, entidade, categoria, severidade, pleito, zona e correlação
AUD-08  facets recalculadas sobre o conjunto visível
AUD-09  linhas de categoria sem permissão são removidas e restrições são declaradas sem contagem
AUD-10  timeline de entidade respeita o mapa de permissões e devolve 403 quando restrita
AUD-11  diff before/after normalizado, sanitizado e limitado
AUD-12  audit continua usando subscribeAll e não escreve AuditEvent manualmente
```

## E2E

```text
E2E-01  os 6 fluxos existem e cobrem os domínios exigidos
E2E-02  RBAC verificado no backend com 403, não apenas na UI
E2E-03  helpers reutilizáveis sem dependência de id fixo
E2E-04  resultado real da execução é reportado; ausência de execução é declarada
```

## CI

```text
CI-01  workflow existe com jobs independentes
CI-02  roda npm ci, spec:check, check:boundaries, typecheck, lint, test, build, db:validate
CI-03  job de E2E com banco, documentado, sem skip silencioso
CI-04  cache apenas do npm
CI-05  nenhuma ferramenta nova introduzida
```

## Global

```text
GLB-01  nenhum import cross-workspace interno; check:boundaries verde
GLB-02  nenhum plugin escreve em tabela de outro domínio
GLB-03  autorização sempre no backend
GLB-04  isolamento entre eleições preservado
GLB-05  eventos tipados, sem evento de interação visual
GLB-06  notificações sempre direcionadas
GLB-07  migrations aditivas, sem reset, sem alteração de histórica
GLB-08  suíte completa verde
GLB-09  build verde
GLB-10  cloc oficial medido antes e depois, sem uso do contador interno como prova
GLB-11  nenhum arquivo criado apenas para aumentar LOC
```

---

# Testes

Estratégia: implementar bloco → teste focado → próximo bloco. Suíte completa e build apenas nos gates finais.

Cobertura mínima exigida:

```text
Simulator     determinismo, lifecycle, validação de cenário, score e pesos, snapshots,
              replay por offset, comparação, limites de escrita cross-domain
Reports       buckets e granularidade, fórmulas de SLA com denominador zero,
              normalização por zona, drill-down e total não truncado, validação de métrica
Transmission  transições e duração, primário único, failover, fórmulas de uptime,
              UNKNOWN fora do uptime, correlação gateada por permissão
Audit         derivação de categoria/severidade, sanitização, truncamento de payload,
              diff, mapa de permissões e omissão de contagens
```

Não testar: CSS, DTO trivial, getters, labels, wrappers, componentes puramente visuais.

---

# Validação

Ao final da implementação, uma rodada única:

```bash
npm run spec:check
npm run check:boundaries
npm run typecheck
npm run lint
npm test
npm run build
npm run db:validate
git diff --check
npx prisma migrate status --schema packages/database/prisma/schema.prisma
```

e, se existir:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-ap1.ps1
```

E2E é executado se o ambiente permitir. Caso não permita, o handoff declara exatamente o que não foi executado.

`VISUAL_QA = NOT_ACTIONABLE` quando não houver ambiente de verificação visual.

---

# Métrica de LOC

A métrica oficial é o `cloc` com as exclusões acordadas:

```bash
cloc . --vcs=git \
  --exclude-dir=node_modules,vendor,dist,build,prompts \
  --exclude-lang=Markdown,JSON,YAML,CSV,Text,SVG \
  --not-match-f='(lock|\.min\.)'
```

`npm run count:loc` é métrica **interna** e não pode ser usada para afirmar que o projeto atingiu qualquer meta. O handoff reporta as duas separadamente e identifica a origem do crescimento.

Nenhum arquivo é criado apenas para aumentar a contagem. Se a meta não for atingida com código real, a execução termina abaixo dela e declara o número honestamente.

---

# Rastreabilidade

Os commits desta fase usam escopo do plugin ou domínio afetado e os trailers de `docs/COMMIT-GUIDE.md`, apontando para este arquivo.
