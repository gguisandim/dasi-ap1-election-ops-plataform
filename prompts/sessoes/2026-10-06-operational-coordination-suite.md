Você está trabalhando no monorepo **Election Ops Platform**.

Esta é uma execução GRANDE e intencionalmente profunda:

```text
OPERATIONAL COORDINATION SUITE
```

Criar três novos plugins integrados:

```text
1. Command Center / Situation Room
2. Resource Requests
3. Postmortem / RCA
```

Packages esperados:

```text
@eops/plugin-command-center
@eops/plugin-resource-requests
@eops/plugin-postmortems
```

Diretórios esperados:

```text
plugins/monitoring/command-center
plugins/operations/resource-requests
plugins/operations/postmortems
```

Objetivo arquitetural:

```text
                   COMMAND CENTER
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
   Incidents        Transmission      Workforce
       │                 │                 │
       ├─────────────────┼─────────────────┤
       │                 │                 │
     Tasks           Logistics       Handovers
       │                 │                 │
       └─────────────┬───┴─────────────────┘
                     │
              Resource Requests
                     │
              Operational Action
                     │
              Incident Resolution
                     │
                Postmortem / RCA
```

A suíte deve representar três momentos distintos:

```text
Command Center
→ o que está acontecendo agora?

Resource Requests
→ de que recurso a operação precisa e como ele será atendido?

Postmortem
→ o que aconteceu, por quê e o que precisa mudar?
```

Não duplicar ownership de plugins existentes.

---

# 0. INTENÇÃO DESTA EXECUÇÃO

Este escopo é propositalmente maior que as execuções anteriores.

NÃO implemente apenas:

```text
manifest
controller vazio
CRUD superficial
dashboard fake
```

Os três plugins devem sair com profundidade funcional real.

A implementação deve naturalmente produzir bastante código porque deve conter:

```text
domain models
business rules
DTOs
services
controllers
frontend services
pages
components
filters
dashboards
history
RBAC
Event Bus
Notifications
Prisma
migrations
tests
docs
```

Uma implementação saudável deste escopo pode naturalmente adicionar aproximadamente:

```text
8.000 – 15.000 LOC
```

Isso NÃO é critério de aceitação.

NÃO produzir:

```text
padding
boilerplate duplicado
arquivos artificiais
testes repetidos
DTOs inúteis
comentários para inflar LOC
fixtures gigantes sem finalidade
código morto
```

Se uma implementação completa exigir menos ou mais linhas, priorize qualidade.

---

# 1. BASELINE ATUAL

O snapshot conhecido possui aproximadamente:

```text
64.046 LOC
663 arquivos
23 plugins
```

Última migration conhecida:

```text
202610050004_shift_handover
```

O estado real do repositório é a fonte de verdade.

Antes de qualquer implementação, executar:

```bash
git status --short
git log --oneline -12
npm run count:loc
npm run spec:check -- HEAD
npm run check:boundaries
npx prisma migrate status --schema packages/database/prisma/schema.prisma
```

Não hardcode os números acima.

Registre no handoff:

```text
HEAD
LOC
arquivos
plugins
última migration
migrate status
```

---

# 2. ESTADO FUNCIONAL EXISTENTE

Já existem e NÃO devem ser reconstruídos:

```text
Incidents
Transmission
Operational Map
Reports
Operational Simulator

Field Teams
Field Dispatch
Shifts
Shift Handovers

Tasks
Preparation Checklists

Inventory
Routes

Communications
Documents / Evidence
Knowledge / Runbooks
Risk Management

Access Control
Audit
Notifications
```

Os novos plugins devem consumir dados desses domínios.

Não mover ownership.

---

# 3. OWNERSHIP GLOBAL

## Command Center

Owner de:

```text
visão operacional agregada
saved views
situation snapshots
aggregation contracts
attention ranking
```

NÃO é owner de:

```text
Incident
Task
TransmissionPoint
FieldShift
FieldDispatch
Route
Asset
ResourceRequest
Postmortem
```

---

## Resource Requests

Owner de:

```text
pedido operacional de recurso
triagem
aprovação
responsabilidade
fulfillment
histórico do pedido
```

NÃO é owner de:

```text
Asset
FieldTeam
Vehicle
Route
Task
```

---

## Postmortem

Owner de:

```text
análise pós-incidente
RCA
timeline analítica
causas
lições aprendidas
ações corretivas
review
publication
```

NÃO altera o Incident original.

---

# 4. PROMPT REGISTRATION

Salvar este prompt literalmente em:

```text
prompts/sessoes/2026-10-06-operational-coordination-suite.md
```

Não resumir.

Não substituir pelo handoff.

---

# 5. LEITURA OBRIGATÓRIA

Leia:

```text
AGENTS.md
SPEC/README.md
docs/AI-PLUGIN-GUIDE.md
docs/UI-DESIGN-GUIDE.md
docs/execution-issues/README.md
```

Depois inspecione apenas as partes relevantes de:

```text
plugins/monitoring/incidents
plugins/monitoring/transmission
plugins/operations/tasks
plugins/operations/field-teams
plugins/operations/shifts
plugins/operations/shift-handovers
plugins/operations/preparation-checklists
plugins/logistics/inventory
plugins/logistics/routes
plugins/system/notifications
plugins/system/audit

packages/security
packages/event-bus
packages/shared
packages/database
```

Não carregue indiscriminadamente todo o monorepo.

---

# 6. SPEC GATE

Classificação:

```text
NEW_SPEC
```

Criar UMA SPEC normativa coesa:

```text
SPEC/2026-10-06-operational-coordination-suite.md
```

Ela deve conter seções independentes para:

```text
Command Center
Resource Requests
Postmortem / RCA
Cross-domain integrations
```

---

# 7. AUTORIZAÇÃO DIRETA PARA O COMMIT DA SPEC

Está explicitamente autorizado executar somente:

```bash
git add SPEC/2026-10-06-operational-coordination-suite.md
```

e o commit exclusivo:

```text
docs(spec): define operational coordination suite
```

Trailers:

```text
Agent: Codex
Spec: SPEC/2026-10-06-operational-coordination-suite.md
```

Antes:

```bash
git diff --cached --name-only
```

deve mostrar somente:

```text
SPEC/2026-10-06-operational-coordination-suite.md
```

Se `.git/index.lock` ou política do ambiente exigir execução escalada:

ESTÁ AUTORIZADA execução escalada exclusivamente para:

```text
git add da SPEC
commit exclusivo da SPEC
```

Nenhum outro commit está autorizado.

Após o commit, continue automaticamente a implementação.

---

# PARTE A — COMMAND CENTER / SITUATION ROOM

# 8. OBJETIVO

Criar uma visão operacional central que responda:

```text
O que está crítico agora?

Onde está acontecendo?

O que está atrasado?

Quem está atuando?

Quais recursos estão indisponíveis?

Quais turnos/equipes precisam de atenção?

Quais transmissões estão em risco?

Quais passagens ainda não foram confirmadas?

Quais solicitações operacionais aguardam atendimento?
```

Não transformar Reports no Command Center.

Reports permanece:

```text
histórico / análise
```

Command Center é:

```text
estado operacional atual
```

---

# 9. PLUGIN

Criar:

```text
plugins/monitoring/command-center
```

Package:

```text
@eops/plugin-command-center
```

Entrypoints:

```text
.
./server
```

Manifest sugerido:

```text
id: command-center
name: Central de Comando
shortName: Comando
category: monitoring
route: /command-center
permissions:
  command-center.read
```

---

# 10. COMMAND CENTER ROUTES

Frontend mínimo:

```text
/command-center
/command-center/attention
/command-center/zones
/command-center/views
/command-center/snapshots
```

Backend sugerido:

```text
GET    /command-center/summary
GET    /command-center/attention
GET    /command-center/zones
GET    /command-center/workforce
GET    /command-center/logistics
GET    /command-center/continuity

GET    /command-center/views
POST   /command-center/views
PATCH  /command-center/views/:id
DELETE /command-center/views/:id

GET    /command-center/snapshots
GET    /command-center/snapshots/:id
POST   /command-center/snapshots
```

Não criar endpoints redundantes sem necessidade.

---

# 11. OPERATIONAL SUMMARY

Criar contrato agregado equivalente a:

```ts
{
  generatedAt,
  scope,
  health,
  metrics,
  criticalItems,
  warnings,
  workforce,
  logistics,
  continuity
}
```

Não retornar objetos Prisma crus.

---

# 12. HEALTH STATE

Criar estado derivado:

```text
NORMAL
ATTENTION
CRITICAL
```

A regra precisa ser determinística.

Exemplo conceitual:

```text
CRITICAL
→ existe incidente CRITICAL ativo
→ OU transmissão crítica vencida/offline relevante
→ OU cobertura crítica
→ OU rota crítica atrasada
→ OU blocker operacional crítico

ATTENTION
→ existem warnings sem condição crítica

NORMAL
→ nenhum attention item relevante
```

A fórmula final deve estar na SPEC.

---

# 13. UNIFIED ATTENTION FEED

Criar um contrato unificado:

```ts
OperationalAttentionItem {
  id
  sourceType
  sourceId
  title
  summary
  severity
  status
  electionId?
  electoralZoneId?
  pollingPlaceId?
  occurredAt
  ageSeconds
  score
  deepLink
  metadata
}
```

Sources possíveis:

```text
INCIDENT
TRANSMISSION
PREPARATION
SHIFT_COVERAGE
FIELD_DISPATCH
SHIFT_HANDOVER
ROUTE
ASSET
RESOURCE_REQUEST
```

Não persistir attention items se puderem ser derivados.

---

# 14. ATTENTION SCORE

Criar score determinístico para ordenação.

Considerar:

```text
severity
age
deadline state
operational impact
status
```

Não usar AI/ML.

Documentar fórmula.

Testar.

---

# 15. INCIDENT SIGNALS

Consumir:

```text
CRITICAL/HIGH ativos
overdue SLA
escalated
unacknowledged
```

Não alterar Incidents.

---

# 16. TRANSMISSION SIGNALS

Consumir:

```text
FAILED
OFFLINE
deadline OVERDUE
open critical alerts
high failure streak
```

Não duplicar cálculo de SLA se Transmission já expõe helper/serviço público adequado.

---

# 17. WORKFORCE SIGNALS

Consumir:

```text
coverage critical
coverage empty
active dispatches
dispatches waiting
unavailable teams
absence relevant
```

---

# 18. CONTINUITY SIGNALS

Consumir:

```text
shift handovers pending confirmation
old pending handovers
shifts without expected continuity
```

Não criar SLA arbitrário.

Pode mostrar:

```text
pending age
```

---

# 19. PREPARATION SIGNALS

Consumir:

```text
critical blockers
OVERDUE
AT_RISK
awaiting approval
```

---

# 20. LOGISTICS SIGNALS

Consumir:

```text
routes delayed
routes at risk
failed deliveries
route exceptions
assets overdue
assets lost
open corrective maintenance
```

---

# 21. RESOURCE REQUEST SIGNALS

Após o novo plugin existir, incluir:

```text
critical submitted requests
overdue requests
approved but unfulfilled
partially fulfilled
```

---

# 22. ZONE SITUATION VIEW

Criar visão agregada por:

```text
ElectoralZone
```

Exibir:

```text
health
active incidents
transmission problems
coverage
dispatches
preparation blockers
routes
resource requests
```

Ordenar zonas mais críticas primeiro.

---

# 23. SAVED VIEWS

Criar model:

```text
CommandCenterSavedView
```

Campos conceituais:

```text
id
ownerId
name
description?
filters Json
layoutMode
refreshSeconds
isDefault
shared
createdAt
updatedAt
```

Regras:

```text
views privadas → somente owner
shared → usuários com command-center.read
edit/delete → owner ou manage
```

Não criar sistema complexo de layout drag-and-drop.

---

# 24. SITUATION SNAPSHOTS

Criar:

```text
CommandCenterSnapshot
```

Finalidade:

registrar manualmente o estado operacional em um instante.

Campos:

```text
id
createdById
name
description?
electionId?
electoralZoneId?
payload Json
createdAt
```

Snapshot deve conter apenas dados agregados necessários.

Não copiar bancos inteiros para JSON.

Uso:

```text
comparação
registro de situação
handover gerencial
post-event reference
```

---

# 25. FULLSCREEN / WALLBOARD

Criar modo:

```text
/command-center?mode=wallboard
```

ou equivalente.

Características:

```text
cards grandes
densidade operacional
auto-refresh
sem formulários
sem navegação desnecessária
```

Não usar WebSockets.

Polling:

```text
30–60 segundos
```

com cleanup correto.

---

# PARTE B — RESOURCE REQUESTS

# 26. OBJETIVO

Criar o domínio formal:

```text
precisamos de algo
→ pedido
→ triagem
→ aprovação
→ atendimento
→ fulfillment
```

Exemplos:

```text
equipamento
equipe
veículo
transporte
apoio técnico
material
outro recurso operacional
```

---

# 27. PLUGIN

Criar:

```text
plugins/operations/resource-requests
```

Package:

```text
@eops/plugin-resource-requests
```

Frontend:

```text
/resource-requests
/resource-requests/new
/resource-requests/:id
/resource-requests/:id/edit
/resource-requests/dashboard
/resource-requests/queue
```

---

# 28. RESOURCE REQUEST STATUS

Lifecycle:

```text
DRAFT
SUBMITTED
TRIAGED
APPROVED
PARTIALLY_FULFILLED
FULFILLED
REJECTED
CANCELLED
```

Fluxos válidos devem ser explícitos na SPEC.

Exemplo:

```text
DRAFT
→ SUBMITTED
→ TRIAGED
→ APPROVED
→ PARTIALLY_FULFILLED
→ FULFILLED
```

Também:

```text
SUBMITTED/TRIAGED
→ REJECTED

DRAFT/SUBMITTED/TRIAGED/APPROVED
→ CANCELLED
```

Não permitir regressões arbitrárias.

---

# 29. RESOURCE REQUEST MODEL

Criar:

```text
ResourceRequest
```

Campos conceituais:

```text
id
code
electionId
electoralZoneId?
pollingPlaceId?

title
description

priority
status

requestedById
ownerId?

neededAt?
submittedAt?
triagedAt?
approvedAt?
fulfilledAt?
rejectedAt?
cancelledAt?

rejectionReason?
cancellationReason?

createdAt
updatedAt
```

`code` deve ser legível operacionalmente.

---

# 30. PRIORITY

Usar:

```text
LOW
NORMAL
HIGH
CRITICAL
```

ou reutilizar enum compatível existente somente se semanticamente adequado.

---

# 31. REQUEST ITEMS

Uma solicitação pode conter múltiplos itens.

Criar:

```text
ResourceRequestItem
```

Tipo:

```text
ASSET
ASSET_TYPE
FIELD_TEAM
VEHICLE
TRANSPORT
TECH_SUPPORT
MATERIAL
OTHER
```

Campos:

```text
id
requestId
kind
label
description?
quantity
assetTypeId?
fieldTeamId?
notes?
createdAt
updatedAt
```

A modelagem final pode ser ajustada para manter integridade.

Não criar FK impossível para conceitos genéricos.

---

# 32. FULFILLMENTS

Criar:

```text
ResourceRequestFulfillment
```

Representa atendimento real.

Campos conceituais:

```text
id
requestItemId
quantity
fulfilledById
assetId?
assetReservationId?
fieldTeamId?
vehicleId?
routeId?
notes?
createdAt
```

Permitir múltiplos fulfillments.

Calcular:

```text
fulfilledQuantity
remainingQuantity
```

por item.

---

# 33. PARTIAL FULFILLMENT

Status:

```text
PARTIALLY_FULFILLED
```

quando:

```text
> 0 itens/quantidade atendida
e
< total requerido
```

`FULFILLED` somente quando todos os itens obrigatórios estiverem satisfeitos.

Regras devem estar no backend.

---

# 34. TRIAGE

Triagem deve permitir:

```text
definir owner
ajustar prioridade
validar contexto
registrar nota
aprovar/rejeitar posteriormente
```

Registrar histórico.

---

# 35. APPROVAL

Aprovação exige:

```text
resource-requests.approve
```

Não permitir aprovação de:

```text
DRAFT
REJECTED
CANCELLED
FULFILLED
```

---

# 36. FULFILLMENT VALIDATION

Quando fulfillment referencia Asset:

validar estado operacional atual.

Não aceitar silenciosamente:

```text
LOST
RETIRED
MAINTENANCE
```

Quando houver reservation:

validar que a reservation corresponde ao asset/contexto quando aplicável.

Resource Requests NÃO deve alterar diretamente o lifecycle de Inventory.

---

# 37. FIELD TEAM FULFILLMENT

Quando referenciar FieldTeam:

validar:

```text
team exists
team active
election compatible
```

Não alterar disponibilidade da equipe automaticamente.

---

# 38. VEHICLE / ROUTE FULFILLMENT

Quando atendimento utilizar:

```text
Vehicle
DistributionRoute
```

registrar vínculo.

Não assumir ownership.

---

# 39. URGENCY STATE

Derivar:

```text
ON_TRACK
DUE_SOON
OVERDUE
COMPLETED
```

a partir de:

```text
neededAt
status
current time
```

Definir janela objetiva.

Não persistir se derivável.

---

# 40. HISTORY

Criar:

```text
ResourceRequestHistory
```

Ações:

```text
CREATED
UPDATED
SUBMITTED
TRIAGED
OWNER_CHANGED
PRIORITY_CHANGED
APPROVED
REJECTED
FULFILLMENT_ADDED
FULFILLMENT_REMOVED
PARTIALLY_FULFILLED
FULFILLED
CANCELLED
COMMENT_ADDED
```

---

# 41. COMMENTS

Criar:

```text
ResourceRequestComment
```

Campos:

```text
requestId
authorId
body
createdAt
updatedAt?
```

Se edição de comentário não for necessária, mantenha append-only.

---

# 42. REQUEST DASHBOARD

Exibir:

```text
draft
submitted
awaiting triage
awaiting approval
approved
partially fulfilled
fulfilled today
overdue
critical
```

Quebras:

```text
por prioridade
por zona
por tipo de item
por owner
```

---

# 43. QUEUE

Criar fila operacional ordenada por:

```text
priority
urgency
neededAt
age
```

Filtros:

```text
status
priority
election
zone
place
owner
requester
item kind
overdue
```

---

# 44. DETAIL PAGE

Seções:

```text
Summary
Requested Items
Fulfillment
Context
Timeline
Comments
Available Actions
```

---

# 45. AVAILABLE ACTIONS

Backend deve derivar:

```text
edit
submit
triage
approve
reject
addFulfillment
cancel
```

considerando:

```text
status
permission
actor
```

---

# PARTE C — POSTMORTEM / RCA

# 46. OBJETIVO

Criar análise estruturada pós-incidente.

Responder:

```text
O que aconteceu?

Qual foi o impacto?

Como foi detectado?

Como respondemos?

Qual foi a causa raiz?

Quais fatores contribuíram?

O que funcionou?

O que falhou?

O que precisa mudar?

Quem é responsável pelas ações corretivas?
```

---

# 47. PLUGIN

Criar:

```text
plugins/operations/postmortems
```

Package:

```text
@eops/plugin-postmortems
```

Rotas:

```text
/postmortems
/postmortems/dashboard
/postmortems/new
/postmortems/:id
/postmortems/:id/edit
/postmortems/:id/timeline
/postmortems/insights
```

---

# 48. POSTMORTEM STATUS

Lifecycle:

```text
DRAFT
IN_REVIEW
CHANGES_REQUESTED
APPROVED
PUBLISHED
ARCHIVED
```

Transições formais.

Não permitir:

```text
PUBLISHED → DRAFT
ARCHIVED → edição normal
```

---

# 49. PRIMARY INCIDENT

Todo Postmortem deve possuir:

```text
primaryIncidentId
```

Regra recomendada:

```text
1 postmortem ativo por primary incident
```

ou justificar outra cardinalidade na SPEC.

---

# 50. POSTMORTEM MODEL

Criar:

```text
Postmortem
```

Campos:

```text
id
code
title
primaryIncidentId
status

executiveSummary
impactSummary
detectionSummary
responseSummary
resolutionSummary
rootCauseSummary
lessonsSummary?

createdById
ownerId?

submittedForReviewAt?
approvedAt?
publishedAt?
archivedAt?

createdAt
updatedAt
```

---

# 51. RELATED INCIDENTS

Criar:

```text
PostmortemRelatedIncident
```

para incidentes correlacionados.

Não duplicar Incident.

---

# 52. TIMELINE

Criar:

```text
PostmortemTimelineEntry
```

Campos:

```text
id
postmortemId
occurredAt
sourceType
sourceId?
title
description
imported
createdById?
createdAt
```

Sources:

```text
INCIDENT_EVENT
SHIFT_HANDOVER
TASK
RESOURCE_REQUEST
MANUAL
```

---

# 53. TIMELINE IMPORT

Criar ação:

```text
Importar timeline
```

a partir de:

```text
IncidentEvent
acknowledgement
escalation
assignments
resolution
reopen
close
related Shift Handover
```

Não criar duplicatas ao reimportar.

Use chave/source tracking.

---

# 54. ROOT CAUSE MODEL

Criar estrutura de causa:

```text
PostmortemCause
```

Tipos:

```text
ROOT_CAUSE
CONTRIBUTING_FACTOR
CONDITION
```

Categorias:

```text
PEOPLE
PROCESS
TECHNOLOGY
COMMUNICATION
LOGISTICS
EXTERNAL
OTHER
```

Campos:

```text
id
postmortemId
parentId?
type
category
statement
evidence
createdAt
updatedAt
```

Permitir árvore simples de causas.

---

# 55. RCA UI

Criar componente de análise causal.

Não precisa ser gráfico complexo.

Exibir:

```text
root causes
children
contributing factors
conditions
evidence
```

Permitir:

```text
add
edit
remove
reorder quando necessário
```

---

# 56. FIVE WHYS

Adicionar uma ferramenta simples opcional de:

```text
5 Whys
```

Pode ser representada usando `PostmortemCause` hierárquico.

NÃO criar sistema separado se o mesmo modelo atende.

---

# 57. LESSONS LEARNED

Criar:

```text
PostmortemLesson
```

Tipos:

```text
WENT_WELL
WENT_WRONG
LESSON
FOLLOW_UP
```

Campos:

```text
title
description
category?
createdAt
```

---

# 58. CORRECTIVE ACTIONS

Criar:

```text
PostmortemActionItem
```

Campos:

```text
id
postmortemId
title
description
priority
ownerUserId?
dueAt?
status
taskId?
createdAt
updatedAt
completedAt?
```

Status:

```text
OPEN
IN_PROGRESS
DONE
CANCELLED
```

---

# 59. TASK LINK

Permitir vincular action item a uma Task existente.

Não duplicar Task.

Se `taskId` existir:

exibir deep link.

Não criar Task automaticamente sem uma ação explícita do usuário.

---

# 60. REVIEW WORKFLOW

Criar:

```text
PostmortemReview
```

Campos:

```text
postmortemId
reviewerId
decision
comment?
createdAt
```

Decision:

```text
APPROVED
CHANGES_REQUESTED
```

---

# 61. SUBMIT FOR REVIEW

Requisitos mínimos:

```text
incident primary existe
incident RESOLVED ou CLOSED
executive summary preenchido
impact preenchido
root cause preenchido
pelo menos uma causa estruturada
pelo menos uma lesson
```

Para incidente:

```text
HIGH
CRITICAL
```

exigir pelo menos uma corrective action.

---

# 62. REVIEWERS

Defina reviewers explicitamente.

Pode haver:

```text
PostmortemReviewer
```

ou lista equivalente.

Usuário deve estar:

```text
ACTIVE
```

Não usar role names hardcoded.

---

# 63. APPROVAL

Um Postmortem só chega a:

```text
APPROVED
```

quando os reviewers obrigatórios aprovarem conforme regra definida na SPEC.

Mantenha regra simples e determinística.

Exemplo:

```text
todos os reviewers designados devem aprovar
```

---

# 64. CHANGES REQUESTED

Qualquer:

```text
CHANGES_REQUESTED
```

leva o Postmortem para:

```text
CHANGES_REQUESTED
```

O owner pode editar e reenviar.

Histórico de reviews deve ser preservado.

---

# 65. PUBLICATION

`PUBLISHED` exige:

```text
APPROVED
```

Registrar:

```text
publishedAt
publishedById
```

Não alterar Knowledge automaticamente.

Pode fornecer link/ação futura para criação de artigo, mas não implementar integração pesada se não houver API pública adequada.

---

# 66. POSTMORTEM DASHBOARD

Exibir:

```text
draft
awaiting review
changes requested
approved
published
overdue action items
critical incidents without postmortem
```

---

# 67. INSIGHTS

Criar:

```text
/postmortems/insights
```

Análises derivadas:

```text
causas recorrentes
categorias de causa
incidentes por severidade
tempo médio até publicação
action items abertas
action items overdue
lessons por categoria
```

Isso NÃO substitui Reports.

É análise específica de RCA.

---

# PARTE D — CROSS-PLUGIN INTEGRATION

# 68. COMMAND CENTER + RESOURCE REQUESTS

Command Center deve consumir:

```text
critical requests
overdue requests
unfulfilled approved requests
```

com deep link.

---

# 69. INCIDENT + RESOURCE REQUEST

Resource Request pode possuir:

```text
incidentId?
```

quando nasce em resposta a incidente.

Não exigir Incident para pedidos normais.

---

# 70. INCIDENT + POSTMORTEM

Postmortem possui Incident primário obrigatório.

Não alterar status do Incident ao publicar Postmortem.

---

# 71. RESOURCE REQUEST + POSTMORTEM

Timeline de Postmortem pode referenciar Resource Requests relevantes ao incidente.

Não copiar toda a solicitação.

---

# 72. HANDOVER

Command Center deve mostrar:

```text
pending confirmations
recent confirmed handovers
```

Postmortem pode importar handovers vinculados ao incidente como contexto da timeline.

---

# 73. TASKS

Resource Request pode possuir:

```text
taskId?
```

para acompanhamento.

Postmortem actions podem vincular Task.

Não criar relação automática em massa.

---

# PARTE E — RBAC

# 74. COMMAND CENTER PERMISSIONS

Adicionar:

```text
command-center.read
command-center.manage
```

`read`:

```text
summary
attention
zones
views read
snapshots read
```

`manage`:

```text
shared views
snapshots
```

---

# 75. UNDERLYING PERMISSIONS

Command Center não pode vazar dados.

Se usuário não possuir:

```text
incidents.read
```

não deve receber incident details.

Mesma regra para:

```text
transmission.read
field-teams.read
shifts.read
shift-handovers.read
tasks.read
preparation-checklists.read
routes.read
inventory.read
resource-requests.read
```

O summary pode omitir completamente a seção ou retornar `unavailable`.

Não vazar contagem sensível se o padrão atual considerar isso acesso ao domínio.

---

# 76. RESOURCE REQUEST PERMISSIONS

Criar:

```text
resource-requests.read
resource-requests.manage
resource-requests.approve
resource-requests.fulfill
```

---

# 77. POSTMORTEM PERMISSIONS

Criar:

```text
postmortems.read
postmortems.manage
postmortems.review
postmortems.publish
```

Adicionar ao catálogo oficial.

---

# 78. SEED

Atualizar seed seguindo perfis existentes.

Sugestão:

```text
Admin
→ todas

Supervisor
→ todas de coordenação

Operator
→ command-center.read
→ resource-requests read/manage/fulfill
→ postmortems.read/manage

Technician
→ command-center.read conforme padrão
→ resource-requests.read

Viewer
→ leitura apenas conforme política atual
```

Não hardcode autorização somente por role name no runtime.

Runtime usa permission.

---

# PARTE F — EVENT BUS

# 79. RESOURCE REQUEST EVENTS

Adicionar:

```text
resource_request.created
resource_request.submitted
resource_request.triaged
resource_request.approved
resource_request.rejected
resource_request.partially_fulfilled
resource_request.fulfilled
resource_request.cancelled
```

---

# 80. POSTMORTEM EVENTS

Adicionar:

```text
postmortem.created
postmortem.submitted
postmortem.changes_requested
postmortem.approved
postmortem.published
postmortem.archived
postmortem.action_overdue
```

Não emitir evento para:

```text
tab changed
filter changed
page viewed
RCA node selected
```

---

# 81. COMMAND CENTER EVENTS

Não emitir eventos para leitura do dashboard.

Somente mutações próprias:

```text
command_center.snapshot_created
command_center.shared_view_created
```

se isso tiver valor de audit.

---

# PARTE G — AUDIT

# 82. AUDIT

Não alterar arquitetura.

Continuar usando:

```text
subscribeAll
```

Event payloads devem carregar:

```text
entityId
actorId
eventName
relevant before/after/context
```

Não escrever AuditEvent manualmente se não necessário.

---

# PARTE H — NOTIFICATIONS

# 83. RESOURCE REQUEST NOTIFICATIONS

Notificar de forma direcionada.

Exemplos:

```text
submitted
→ pessoas com approve/triage aplicável

owner assigned
→ owner

approved
→ requester

rejected
→ requester

fulfilled
→ requester
```

Evitar broadcast global.

---

# 84. POSTMORTEM NOTIFICATIONS

```text
submitted for review
→ reviewers

changes requested
→ owner

approved
→ owner

published
→ participantes relevantes somente se fizer sentido

corrective action overdue
→ owner da action
```

Respeitar:

```text
User ACTIVE
permission
preferences
```

---

# 85. COMMAND CENTER NOTIFICATIONS

Command Center não cria duplicatas dos alertas já emitidos por outros domínios.

Ele agrega visualmente.

Não notificar apenas porque um item apareceu no feed.

---

# PARTE I — DATABASE

# 86. MODELS ESPERADOS

Prováveis novos models:

```text
CommandCenterSavedView
CommandCenterSnapshot

ResourceRequest
ResourceRequestItem
ResourceRequestFulfillment
ResourceRequestHistory
ResourceRequestComment

Postmortem
PostmortemRelatedIncident
PostmortemTimelineEntry
PostmortemCause
PostmortemLesson
PostmortemActionItem
PostmortemReviewer
PostmortemReview
```

Ajuste somente se encontrar solução melhor.

Não criar tabelas sem lifecycle/query real.

---

# 87. RELAÇÕES REVERSAS

Todas as relações Prisma devem possuir lado reverso correto.

Revisar especialmente:

```text
User
Election
ElectoralZone
PollingPlace
Incident
Task
Asset
FieldTeam
Vehicle
DistributionRoute
```

Não repetir o antigo problema de relações unilaterais.

---

# 88. MIGRATION

Criar migration NOVA.

Inspecione primeiro:

```text
packages/database/prisma/migrations/
```

Última conhecida:

```text
202610050004_shift_handover
```

Como a data atual da execução pode ser 2026-10-06, nome natural caso esteja livre:

```text
202610060001_operational_coordination_suite
```

Mas descubra o próximo identificador real.

Não hardcode.

---

# 89. MIGRATION REMOTA

NÃO aplicar automaticamente.

No handoff:

```text
migration criada: sim
migration aplicada: não
```

---

# 90. INDEXES

Adicionar índices alinhados às queries.

Exemplos:

```text
ResourceRequest(status, priority)
ResourceRequest(electionId, status)
ResourceRequest(neededAt, status)
ResourceRequest(ownerId, status)

ResourceRequestItem(requestId, kind)

Postmortem(status, createdAt)
Postmortem(primaryIncidentId)
Postmortem(ownerId, status)

PostmortemActionItem(status, dueAt)
PostmortemCause(postmortemId, type)

CommandCenterSavedView(ownerId, isDefault)
CommandCenterSnapshot(electionId, createdAt)
```

Não duplicar índices.

---

# PARTE J — BACKEND QUALITY

# 91. SERVER AUTHORITY

Servidor define:

```text
actor
timestamps
status transitions
permissions
derived states
attention scores
fulfillment calculations
review results
```

DTOs não devem aceitar:

```text
actorId
approvedAt
publishedAt
fulfilledAt
createdAt
updatedAt
```

como valores arbitrários do cliente.

---

# 92. TRANSACTIONS

Usar transações para:

```text
state transition + history
fulfillment + recalculation
review + lifecycle transition
publication
snapshot persistence
```

Não deixar estado parcial.

---

# 93. AVAILABLE ACTIONS

Resource Request detail:

```text
availableActions
```

Postmortem detail:

```text
availableActions
```

Derivadas no backend.

---

# PARTE K — FRONTEND COMMAND CENTER

# 94. MAIN PAGE

Criar dashboard visualmente forte.

Seções sugeridas:

```text
Overall Health
Critical Attention
Zones
Incidents
Transmission
Workforce
Continuity
Logistics
Resource Requests
```

Não mostrar 40 cards iguais.

Hierarquia visual.

---

# 95. ATTENTION FEED

Criar:

```text
severity
source icon
title
scope
age
state
deep link
```

Filtros:

```text
severity
source
zone
status
election
```

---

# 96. ZONE MATRIX

Tabela/cards por zona:

```text
Zone
Health
Incidents
Transmission
Coverage
Preparation
Logistics
Requests
```

Permitir drill-down.

---

# 97. SAVED VIEWS UI

Criar:

```text
list
create
edit
delete
set default
share/unshare
```

Filtros configuráveis.

---

# 98. SNAPSHOT UI

Criar:

```text
snapshot list
create modal
detail
comparison básico entre snapshot e current
```

Comparação pode mostrar deltas de métricas.

Não criar BI engine.

---

# PARTE L — FRONTEND RESOURCE REQUESTS

# 99. DASHBOARD

Indicadores e breakdowns.

---

# 100. QUEUE

Tabela operacional densa com:

```text
code
title
priority
status
requester
owner
neededAt
urgency
fulfillment progress
```

---

# 101. CREATE / EDIT

Form dividido em:

```text
Context
Request
Items
Timing
Review
```

Permitir múltiplos items.

---

# 102. DETAIL

Cards/tabs:

```text
Summary
Items
Fulfillment
Comments
Timeline
Related entities
```

---

# 103. FULFILLMENT UI

Wizard ou painel para:

```text
selecionar item
quantidade
tipo de fulfillment
asset/team/vehicle/route
notas
confirmar
```

Mostrar:

```text
required
fulfilled
remaining
```

---

# PARTE M — FRONTEND POSTMORTEM

# 104. EDITOR

Editor estruturado por seções:

```text
Executive Summary
Impact
Detection
Response
Resolution
Root Cause
Lessons
Actions
Timeline
Review
```

Não implementar rich text pesado se textarea/editor simples for suficiente.

---

# 105. RCA COMPONENT

Criar componente reutilizável para árvore causal.

Permitir visualização e edição.

---

# 106. TIMELINE COMPONENT

Timeline rica:

```text
time
source
title
description
deep link
imported/manual badge
```

---

# 107. ACTION ITEMS

Tabela/board:

```text
title
owner
priority
dueAt
status
linked task
```

Destacar overdue.

---

# 108. REVIEW PANEL

Mostrar:

```text
reviewers
decision
comment
date
pending reviewers
```

Botões condicionados a `availableActions`.

---

# 109. INSIGHTS PAGE

Gráficos/tabelas simples.

Usar bibliotecas já existentes.

Não adicionar framework de charts novo se não necessário.

---

# PARTE N — DESIGN

# 110. UI DESIGN GUIDE

Seguir:

```text
docs/UI-DESIGN-GUIDE.md
```

Reutilizar:

```text
@eops/ui
```

Não criar design system paralelo.

---

# 111. PAGE STATES

Todas as páginas:

```text
loading
error
empty
success
```

---

# 112. RESPONSIVE

Considerar:

```text
1440px
1024px
<=760px
```

Se visual QA não estiver disponível:

```text
VISUAL_QA = NOT_ACTIONABLE
```

---

# PARTE O — TEST STRATEGY

# 113. RISK-BASED TESTING

Este é um escopo grande.

Não rodar suíte completa repetidamente.

Durante desenvolvimento:

```text
implementar bloco
→ teste focado
→ próximo bloco
```

---

# 114. COMMAND CENTER TESTS

Priorizar:

```text
health derivation
attention score
permission filtering
zone aggregation
saved view ownership
snapshot contents
```

---

# 115. RESOURCE REQUEST TESTS

Priorizar:

```text
lifecycle
triage
approval
partial fulfillment
full fulfillment
invalid transition
asset eligibility
team compatibility
urgency
availableActions
```

---

# 116. POSTMORTEM TESTS

Priorizar:

```text
incident eligibility
submit preconditions
timeline import idempotency
cause tree
review workflow
changes requested
approval
publication
overdue actions
```

---

# 117. NOTIFICATION TESTS

Testar:

```text
request requester/owner audiences
postmortem reviewers
preference disabled
inactive user
no unintended broadcast
```

---

# 118. TEST VOLUME

Orientação aproximada:

```text
30–50 novos casos relevantes
```

Não é quota.

Não testar:

```text
CSS
DTO trivial
constantes
ícones
wrappers simples
```

---

# PARTE P — BUILD

# 119. BUILD PIPELINE

Preservar:

```text
scripts/sync-server-workspace-dist.mjs
apps/api/tsconfig.build.json
```

Não reverter correções recentes.

Shared runtime deve ser publicado corretamente.

---

# PARTE Q — FORA DO ESCOPO

# 120. NÃO IMPLEMENTAR

Não implementar:

```text
Kafka
Redis
WebSockets
machine learning
LLM summary
AI root cause generation
GPS tracking
external maps API
full service desk
procurement
financial accounting
warehouse management
automatic route optimization
```

Não criar quarta vertical enorme incidentalmente.

---

# PARTE R — DOCUMENTAÇÃO

# 121. DOCS MODULES

Criar:

```text
docs/modules/command-center.md
docs/modules/resource-requests.md
docs/modules/postmortems.md
```

Documentação descritiva.

SPEC permanece normativa.

---

# 122. EXECUTION ISSUES

Criar se necessário:

```text
docs/execution-issues/2026-10-06-operational-coordination-suite.md
```

Não registrar debugging trivial.

---

# PARTE S — FINAL VALIDATION

# 123. FINAL GATES

Somente depois dos três plugins estarem implementados:

```bash
npm run spec:check
npm run check:boundaries
npm run typecheck
npm run lint
```

Depois:

```text
focused tests finais
```

Depois UMA execução:

```bash
npm test
```

Depois:

```bash
npm run build
npm run db:validate
npm run count:loc
git diff --check
```

Também:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-ap1.ps1
```

Está autorizado `-ExecutionPolicy Bypass` exclusivamente para esse script.

---

# 124. MIGRATE STATUS FINAL

Executar:

```bash
npx prisma migrate status --schema packages/database/prisma/schema.prisma
```

Migration nova deve aparecer como pendente.

Não aplicar.

---

# 125. LOC REPORT

Reportar:

```text
Antes
Depois
Delta

Arquivos antes
Arquivos depois

LOC por plugin novo:
Command Center
Resource Requests
Postmortems
```

Não esconder LOC baixo.

Não criar padding se o delta for menor que o esperado.

---

# PARTE T — ACCEPTANCE CRITERIA

# 126. COMMAND CENTER ACS

A SPEC deve possuir critérios equivalentes a:

```text
CC-01 Command Center é plugin independente.

CC-02 summary utiliza dados reais.

CC-03 health é derivado por regra determinística.

CC-04 attention feed agrega múltiplos domínios.

CC-05 attention score é determinístico.

CC-06 dados sem permission são omitidos.

CC-07 zone view agrega estado por ElectoralZone.

CC-08 saved views possuem ownership.

CC-09 shared views respeitam RBAC.

CC-10 snapshots persistem somente agregados necessários.

CC-11 wallboard possui auto-refresh sem WebSocket.

CC-12 deep links apontam para entidades reais.
```

---

# 127. RESOURCE REQUEST ACS

```text
RR-01 Resource Request possui lifecycle formal.

RR-02 request possui um ou mais items.

RR-03 submit usa requester da sessão.

RR-04 triage registra owner e histórico.

RR-05 approval exige permission.

RR-06 fulfillment pode ser parcial.

RR-07 fulfillment total é calculado no backend.

RR-08 assets inválidos não podem ser usados.

RR-09 team incompatível é rejeitado.

RR-10 urgency é derivada de neededAt.

RR-11 comments e history são preservados.

RR-12 availableActions são calculadas no backend.

RR-13 Command Center exibe requests críticos.

RR-14 Event Bus possui eventos tipados.

RR-15 Notifications são direcionadas.
```

---

# 128. POSTMORTEM ACS

```text
PM-01 Postmortem referencia Incident existente.

PM-02 incident original não é alterado.

PM-03 lifecycle é formal.

PM-04 timeline pode importar IncidentEvents.

PM-05 import de timeline é idempotente.

PM-06 causas possuem estrutura hierárquica.

PM-07 root cause é obrigatório antes do review.

PM-08 lessons são persistidas.

PM-09 HIGH/CRITICAL exige corrective action.

PM-10 actions podem referenciar Task.

PM-11 reviewers são usuários ACTIVE.

PM-12 changes requested preserva reviews anteriores.

PM-13 approval depende dos reviewers.

PM-14 publish exige APPROVED.

PM-15 insights usam dados reais.

PM-16 Notifications são direcionadas.

PM-17 Audit usa infraestrutura global.
```

---

# 129. GLOBAL ACS

```text
GLOBAL-01 Nenhum import interno cross-plugin.

GLOBAL-02 Public APIs são utilizadas.

GLOBAL-03 Permissions entram no catálogo oficial.

GLOBAL-04 Seed é atualizado.

GLOBAL-05 Relações Prisma reversas são válidas.

GLOBAL-06 Migration histórica não é alterada.

GLOBAL-07 Migration nova não é aplicada remotamente.

GLOBAL-08 Focused tests cobrem regras críticas.

GLOBAL-09 Full suite passa.

GLOBAL-10 Build passa.

GLOBAL-11 db:validate passa.

GLOBAL-12 check-ap1 passa.

GLOBAL-13 LOC é medido honestamente.

GLOBAL-14 Nenhum código existe apenas para aumentar LOC.
```

---

# PARTE U — GIT

# 130. IMPLEMENTATION COMMITS

NÃO fazer commits de implementação.

Somente a SPEC pode ser commitada automaticamente.

No handoff sugerir algo próximo de:

```text
feat(command-center): add operational situation aggregation and wallboard

feat(command-center): add saved views and situation snapshots

feat(resource-requests): add operational request lifecycle and triage

feat(resource-requests): add fulfillment queue and resource integrations

feat(postmortems): add RCA domain timeline and causal analysis

feat(postmortems): add review workflow corrective actions and insights

feat(notifications): add coordination suite targeted notifications

docs(coordination): document operational coordination suite
```

Trailers:

```text
Agent: Codex
Spec: SPEC/2026-10-06-operational-coordination-suite.md
```

---

# 131. HANDOFF FINAL

Entregar:

## Prompt registration

## SPEC Gate

```text
Classification
SPEC
SPEC commit
```

## Baseline

```text
HEAD
plugins
files
LOC
last migration
migrate status
```

## Command Center

```text
routes
aggregation
health
attention
zone view
views
snapshots
wallboard
```

## Resource Requests

```text
lifecycle
items
triage
approval
fulfillment
history
dashboard
```

## Postmortems

```text
lifecycle
timeline
RCA
causes
lessons
corrective actions
review
publication
insights
```

## Cross-domain integrations

## RBAC

## Event Bus

## Notifications

## Database

```text
models
enums
indexes
migration
applied? NÃO
```

## Tests

```text
focused
new tests
full suite
```

## Validation

Tabela.

## LOC

Obrigatório:

```text
Before total
After total
Delta total

Command Center LOC
Resource Requests LOC
Postmortems LOC
```

## Execution Issues

Tabela.

## SPEC Compliance

```text
PASS
PARTIAL
BLOCKED
```

## Git

```text
SPEC commit
working tree
suggested commits
```

---

# 132. CRITÉRIO FINAL DE SUCESSO

Não considerar esta execução concluída apenas porque os plugins compilam.

Ao final deve ser possível demonstrar o seguinte fluxo:

```text
Command Center detecta situação crítica
        ↓
operador identifica necessidade de recurso
        ↓
Resource Request é criado
        ↓
pedido é submetido
        ↓
triagem define responsável
        ↓
pedido é aprovado
        ↓
recurso é parcialmente ou totalmente atendido
        ↓
estado aparece no Command Center
        ↓
incidente é resolvido
        ↓
Postmortem é criado
        ↓
timeline operacional é importada
        ↓
causas são analisadas
        ↓
lições são registradas
        ↓
ações corretivas recebem responsáveis
        ↓
review é realizado
        ↓
Postmortem é aprovado/publicado
```

Os três plugins devem parecer partes reais da mesma plataforma, e não três CRUDs independentes.
