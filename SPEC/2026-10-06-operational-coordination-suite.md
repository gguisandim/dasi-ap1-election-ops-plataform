# SPEC — Operational Coordination Suite

## Status

`approved`

## Contexto

A plataforma já possui domínios profundos para incidentes, transmissão, força de trabalho, logística, preparação, tarefas, continuidade entre turnos, inventário e rotas. Cada um deles responde bem à pergunta do seu próprio domínio, mas não existe:

- uma visão operacional agregada do estado atual do pleito;
- um domínio formal para pedido operacional de recurso que não seja ativo/equipe/rota;
- um domínio formal para análise pós-incidente (RCA), lições aprendidas e ações corretivas.

Esta SPEC define três plugins novos que representam três momentos distintos da coordenação operacional:

```text
Command Center    → o que está acontecendo agora?
Resource Requests → de que recurso a operação precisa e como ele será atendido?
Postmortem / RCA  → o que aconteceu, por quê e o que precisa mudar?
```

## Objetivo

- criar os plugins `@eops/plugin-command-center`, `@eops/plugin-resource-requests` e `@eops/plugin-postmortems`;
- agregar sinais operacionais reais de múltiplos domínios sem duplicar ownership;
- formalizar lifecycle, triagem, aprovação e fulfillment de pedidos de recurso;
- formalizar análise causal, lições, ações corretivas, review e publicação de postmortem;
- integrar os três plugins entre si e com os domínios existentes via Event Bus, contratos compartilhados e leitura de banco autorizada.

## Fora de escopo

Não faz parte desta SPEC:

- Kafka, Redis, WebSockets, machine learning, LLM, geração automática de causa raiz;
- rastreamento GPS, API externa de mapas, otimização automática de rota;
- service desk completo, compras, contabilidade, gestão de armazém;
- alteração do lifecycle dos domínios existentes (Incident, Task, Asset, FieldTeam, Vehicle, DistributionRoute, FieldShift, ShiftHandover, PreparationChecklist, TransmissionPoint);
- reescrita do shell, do `HomeDashboard` ou do design system.

## Vocabulário

- **sinal**: dado derivado de um domínio existente que indica atenção operacional.
- **attention item**: item normalizado e derivado (não persistido) que representa um sinal.
- **aggregate read**: leitura somente-leitura de modelos Prisma de outro domínio, dentro do mesmo banco centralizado, sem importar código de outro plugin.
- **availableActions**: lista de ações que o ator pode executar, derivada no servidor.
- **urgency**: estado temporal derivado de `neededAt` e do status, nunca persistido.

## Invariante arquitetural

Um plugin nunca importa `src/` de outro workspace. Toda integração cross-domain usa exatamente um destes caminhos:

1. leitura Prisma somente-leitura dos modelos do domínio (banco é centralizado e compartilhado por decisão de arquitetura);
2. contrato compartilhado em `@eops/shared/<dominio>`;
3. evento tipado em `@eops/event-bus`;
4. endpoint público consumido pelo cliente via `@eops/api-client`.

Nenhum plugin novo pode escrever em tabelas de outro domínio.

---

# Parte 1 — Command Center / Situation Room

## 1.1 Plugin

```text
diretório: plugins/monitoring/command-center
package:   @eops/plugin-command-center
entrypoints: "." e "./server"
```

Manifest:

```text
id:              command-center
name:            Central de Comando
shortName:       Comando
category:        monitoring
navigationIcon:  siren
route:           /command-center
permissions:     ["command-center.read"]
```

## 1.2 Ownership

Command Center é owner de:

```text
visão operacional agregada
saved views
situation snapshots
contratos de agregação
ranking de atenção
```

Command Center **não** é owner de `Incident`, `Task`, `TransmissionPoint`, `FieldShift`, `FieldDispatch`, `ShiftHandover`, `PreparationChecklist`, `DistributionRoute`, `Asset`, `ResourceRequest`, `Postmortem`. Ele lê esses dados; nunca os altera.

## 1.3 Rotas de frontend

```text
/command-center
/command-center/attention
/command-center/zones
/command-center/views
/command-center/snapshots
```

Modo wallboard em `/command-center?mode=wallboard`.

## 1.4 Rotas de backend

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

Todas exigem `command-center.read` no controller. Nenhum endpoint cria, altera ou remove dados de outro domínio.

`GET /command-center/summary` aceita `electionId` e `electoralZoneId` como escopo opcional.

## 1.5 Contrato de summary

```ts
type OperationalHealth = "NORMAL" | "ATTENTION" | "CRITICAL";

interface OperationalSummary {
  generatedAt: string;                  // ISO, definido pelo servidor
  scope: { electionId?: string; electoralZoneId?: string };
  health: OperationalHealth;
  metrics: OperationalMetrics;
  criticalItems: OperationalAttentionItem[];
  warnings: OperationalAttentionItem[];
  sections: OperationalSections;
}
```

`OperationalMetrics` contém somente contagens inteiras derivadas:

```text
totalItems, criticalItems, warnings
activeIncidents, criticalIncidents, overdueIncidents, unacknowledgedIncidents
transmissionFailures, transmissionOffline, transmissionOverdueAlerts
shiftsTotal, shiftsCoverageEmpty, shiftsCoverageCritical
activeDispatches, waitingDispatches
pendingHandovers, oldestPendingHandoverAgeSeconds
preparationBlocked, preparationOverdue
routesDelayed, routesFailedDeliveries, assetsLost, assetsInMaintenance
resourceRequestsCritical, resourceRequestsOverdue, resourceRequestsApprovedUnfulfilled
```

Cada métrica de um domínio só é preenchida quando a permissão de leitura correspondente existe (ver 1.10). Quando indisponível, a métrica é `null` e a seção correspondente é `{ available: false }`.

O servidor **não** retorna objetos Prisma crus em nenhum endpoint do plugin.

## 1.6 Contrato de attention item

```ts
type OperationalAttentionSource =
  | "INCIDENT"
  | "TRANSMISSION"
  | "PREPARATION"
  | "SHIFT_COVERAGE"
  | "FIELD_DISPATCH"
  | "SHIFT_HANDOVER"
  | "ROUTE"
  | "ASSET"
  | "RESOURCE_REQUEST";

type OperationalDeadlineState = "OVERDUE" | "DUE_SOON" | "ON_TRACK" | "COMPLETED" | "NONE";

type OperationalStatusState =
  | "UNACKNOWLEDGED"
  | "ESCALATED"
  | "BLOCKED"
  | "WAITING"
  | "IN_PROGRESS"
  | "RESOLVED";

interface OperationalAttentionItem {
  id: string;                       // `${sourceType}:${sourceId}`
  sourceType: OperationalAttentionSource;
  sourceId: string;
  title: string;
  summary: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: string;                   // estado do domínio de origem, exibível
  statusState: OperationalStatusState;
  deadlineState: OperationalDeadlineState;
  electionId?: string | null;
  electoralZoneId?: string | null;
  pollingPlaceId?: string | null;
  occurredAt: string;               // ISO
  ageSeconds: number;               // servidor calcula a partir de `now`
  score: number;                    // ver 1.7
  deepLink: string;                 // rota interna existente do domínio de origem
  metadata: Record<string, string | number | boolean | null>;
}
```

Attention items **não são persistidos**. São derivados a cada consulta. Persistir somente em snapshot (1.9).

`deepLink` deve apontar para uma rota real já existente da plataforma. Exemplos normativos:

```text
INCIDENT          → /incidents/:id
TRANSMISSION      → /transmission/:id
SHIFT_COVERAGE    → /shifts/:id
FIELD_DISPATCH    → /field-teams/dispatches/:id
SHIFT_HANDOVER    → /shift-handovers/:id
PREPARATION       → /preparation-checklists/:id
ROUTE             → /routes/:id
ASSET             → /inventory/assets/:id
RESOURCE_REQUEST  → /resource-requests/:id
```

Se um domínio de origem não possuir rota de detalhe, o `deepLink` aponta para a rota de lista do domínio.

## 1.7 Attention score

O score é determinístico, inteiro, sem IA/ML e calculado exclusivamente por esta fórmula:

```text
score = severityWeight + deadlineWeight + statusWeight + ageWeight + impactWeight

severityWeight
  CRITICAL = 100
  HIGH     = 60
  MEDIUM   = 30
  LOW      = 10

deadlineWeight
  OVERDUE   = 50
  DUE_SOON  = 25
  NONE      = 0
  ON_TRACK  = 0
  COMPLETED = 0

statusWeight
  UNACKNOWLEDGED = 20
  ESCALATED      = 15
  BLOCKED        = 15
  WAITING        = 10
  IN_PROGRESS    = 0
  RESOLVED       = 0

ageWeight = min(floor(ageSeconds / 3600), 40)     // 1 ponto por hora cheia, teto 40

impactWeight (por origem)
  INCIDENT          = 20 se severity = CRITICAL, senão 5
  TRANSMISSION      = 10 se point.priority <= 2, senão 5
  SHIFT_COVERAGE    = 15 se cobertura vazia, 8 se cobertura crítica
  PREPARATION       = 10 se existe item obrigatório BLOCKED, senão 5
  ROUTE             = 10 se existe entrega FAILED, senão 5
  ASSET             = 10 se status = LOST, senão 5
  RESOURCE_REQUEST  = 10 se priority = CRITICAL, senão 5
  FIELD_DISPATCH    = 5
  SHIFT_HANDOVER    = 5
```

Ordenação: `score` DESC, depois `occurredAt` ASC, depois `sourceType` ASC, depois `sourceId` ASC. A ordenação é total e estável.

## 1.8 Health

Classificação de cada item:

```text
CRITICAL se severity = CRITICAL
         ou deadlineState = OVERDUE
         ou statusState ∈ { ESCALATED, BLOCKED }
WARNING  caso contrário
```

Estado derivado:

```text
health = CRITICAL   se existe ao menos um item CRITICAL
health = ATTENTION  se não existe item CRITICAL e existe ao menos um item WARNING
health = NORMAL     se não existe nenhum item
```

`criticalItems` contém os itens CRITICAL; `warnings` contém os itens WARNING. Ambos truncados ao limite de 100 itens mais bem posicionados, e sempre ordenados pela regra de 1.7.

## 1.9 Situation snapshot

`CommandCenterSnapshot` persiste apenas dados agregados:

```text
id, createdById, name, description?, electionId?, electoralZoneId?, health, payload Json, createdAt
```

`payload` contém exclusivamente:

```text
scope
health
metrics            (o mesmo contrato de 1.5, apenas as métricas disponíveis para o criador)
topItems           (até 20 attention items, no contrato de 1.6)
zones              (resumo por ElectoralZone: zoneId, zoneName, health, itemCount)
```

Proibido copiar listas completas de entidades, textos longos ou qualquer dado fora dos agregados acima.

Um snapshot só pode ser criado para as seções que o criador tem permissão de ler; seções indisponíveis entram como `available: false` no payload.

Snapshots são imutáveis (sem PATCH/DELETE nesta versão).

## 1.10 Saved views

`CommandCenterSavedView`:

```text
id, ownerId, name, description?, filters Json, layoutMode, refreshSeconds, isDefault, shared, createdAt, updatedAt
```

`layoutMode ∈ { STANDARD, WALLBOARD }`, default `STANDARD`.
`refreshSeconds` inteiro entre 15 e 300, default 45.
`filters` aceita somente: `severity[]`, `sourceType[]`, `electionId`, `electoralZoneId`, `statusState[]`.

Regras:

```text
view privada (shared = false) → visível apenas para owner
view compartilhada (shared = true) → visível para usuários com command-center.read
criar/editar/remover view privada → owner com command-center.manage? não; owner com command-center.read
criar/editar/remover view compartilhada → owner ou quem possui command-center.manage
marcar isDefault = true → remove isDefault das demais views do mesmo owner (transação)
```

Cada owner pode ter no máximo 20 views. Não existe layout drag-and-drop nesta versão.

## 1.11 Wallboard

`/command-center?mode=wallboard`:

- auto-refresh por polling entre 30 e 60 segundos (default 45);
- usa `refreshSeconds` da view default do usuário quando existir, respeitando o intervalo 30–60;
- sem WebSocket, sem formulários, sem navegação lateral adicional;
- o efeito de polling deve ser limpo no unmount (cleanup obrigatório) e não pode iniciar novo fetch se o anterior ainda estiver pendente;
- exibe: health geral, contagem crítica, zonas mais críticas, feed de atenção.

## 1.12 Zone view

`GET /command-center/zones` entrega, por `ElectoralZone`, no escopo de um pleito:

```text
zoneId, zoneNumber, zoneName, municipality, state
health
itemCount, criticalItemCount
activeIncidents
transmissionProblems
coverageEmptyShifts
waitingDispatches
preparationBlockers
routesDelayed
resourceRequestsOpen
```

Ordenação: `health` DESC (`CRITICAL` > `ATTENTION` > `NORMAL`), depois `criticalItemCount` DESC, depois `itemCount` DESC, depois `zoneNumber` ASC.

Zonas sem nenhum sinal aparecem com `health = NORMAL` e contagens zeradas. Uma zona só é incluída quando o usuário possui ao menos uma permissão de leitura de domínio; caso contrário os campos sem permissão ficam `null`.

## 1.13 Sinais por domínio

### Incident

Fontes: `status ∉ { CLOSED, CANCELLED }` e (`severity ∈ { CRITICAL, HIGH }` ou `slaDeadline < now` ou `acknowledgedAt = null` ou `escalationLevel > 0`).

```text
severity       = incident.severity
deadlineState  = OVERDUE se slaDeadline < now
                 DUE_SOON se slaDeadline - now <= 4h
                 NONE se slaDeadline = null
statusState    = UNACKNOWLEDGED se acknowledgedAt = null e status = NEW
                 ESCALATED se escalationLevel > 0
                 BLOCKED se status = ASSIGNED e slaDeadline < now
                 IN_PROGRESS se status ∈ { TRIAGED, ASSIGNED, IN_PROGRESS }
occurredAt     = openedAt
```

Command Center nunca altera Incident.

### Transmission

Fontes:

```text
point.status ∈ { FAILED, OFFLINE }                     (severity HIGH)
point.connectivity = OFFLINE                           (severity HIGH)
point.operationalDeadline < now e status ∉ { SUCCESS } (severity CRITICAL, deadline OVERDUE)
alert.status = OPEN e alert.type ∈ { REPEATED_FAILURE, POINT_OFFLINE, TOO_MANY_ATTEMPTS } (severity HIGH)
```

`REPEATED_FAILURE`/`TOO_MANY_ATTEMPTS` é derivado do próprio alerta já produzido pelo plugin Transmission. Command Center **não** recalcula streak, SLA nem deadline: usa `operationalDeadline` e `TransmissionAlert` como já persistidos pelo domínio owner.

### Workforce

```text
FieldShift.status = SCHEDULED e startsAt - now <= 4h e operadores atribuídos < requiredOperators
  → SHIFT_COVERAGE, severity HIGH
  → statusState BLOCKED se nenhum operador atribuído (cobertura vazia), senão WAITING
  → deadlineState OVERDUE se startsAt < now, DUE_SOON se <= 2h

FieldDispatch.status ∈ { REQUESTED, DISPATCHED, ACCEPTED, EN_ROUTE, ARRIVED, IN_PROGRESS }
  → FIELD_DISPATCH
  → severity HIGH se priority ∈ { HIGH, CRITICAL }, senão MEDIUM
  → statusState WAITING se status ∈ { REQUESTED, DISPATCHED }, senão IN_PROGRESS
  → deadlineState NONE
```

Contagens do bloco workforce: `shiftsTotal`, `shiftsCoverageEmpty`, `shiftsCoverageCritical`, `activeDispatches`, `waitingDispatches`. Nenhuma equipe ou turno é alterado.

### Continuity

```text
ShiftHandover.status = PENDING_CONFIRMATION
  → SHIFT_HANDOVER
  → severity HIGH se submittedAt < now - 24h, senão MEDIUM
  → deadlineState OVERDUE se submittedAt < now - 24h, senão ON_TRACK
  → statusState WAITING
  → occurredAt = submittedAt
```

`oldestPendingHandoverAgeSeconds` é o maior `now - submittedAt` entre as passagens pendentes, ou `0` quando não há pendências. Nenhum SLA novo é criado; apenas `ageSeconds` e o limiar objetivo de 24 horas já usado para classificar severidade.

### Preparation

```text
checklist.status = BLOCKED, ou
checklist.status ∈ { PENDING, IN_PROGRESS } e dueAt < now, ou
checklist.status = READY_FOR_APPROVAL e dueAt - now <= 4h, ou
existe item `required = true` com status = BLOCKED
  → PREPARATION
  → severity CRITICAL se existe item obrigatório BLOCKED ou checklist.status = BLOCKED
    severity HIGH se dueAt < now
    severity MEDIUM caso contrário
  → statusState BLOCKED se existe item obrigatório BLOCKED, senão WAITING
  → deadlineState OVERDUE / DUE_SOON / ON_TRACK
```

### Logistics

```text
DistributionRoute.status = DELAYED, ou
route possuir entrega FAILED, ou
route possuir RouteException não resolvida, ou
Asset.status = LOST, ou
Asset.status = MAINTENANCE com AssetMaintenance.status ∈ { OPEN, IN_PROGRESS } do tipo CORRECTIVE
  → ROUTE / ASSET
  → severity CRITICAL se Asset.status = LOST ou existe entrega FAILED em rota DELAYED
    severity HIGH se route DELAYED ou exception aberta
    severity MEDIUM se manutenção corretiva aberta
```

### Resource Request (integração, ver Parte 4)

```text
ResourceRequest.status ∈ { SUBMITTED, TRIAGED, APPROVED, PARTIALLY_FULFILLED } e priority = CRITICAL
ResourceRequest com urgency = OVERDUE e status ∈ { SUBMITTED, TRIAGED, APPROVED, PARTIALLY_FULFILLED }
ResourceRequest.status = APPROVED e neededAt <= now + 4h (aprovado sem atendimento)
  → RESOURCE_REQUEST
```

### Permissões subjacentes (obrigatório)

Cada bloco de sinal só é produzido quando o usuário possui a permissão de leitura correspondente:

```text
INCIDENT          → incidents.read
TRANSMISSION      → transmission.read
SHIFT_COVERAGE    → shifts.read
FIELD_DISPATCH    → field-teams.read
SHIFT_HANDOVER    → shift-handovers.read
PREPARATION       → preparation-checklists.read
ROUTE             → routes.read
ASSET             → inventory.read
RESOURCE_REQUEST  → resource-requests.read
```

Sem a permissão, o bloco é omitido integralmente: não gera attention item, não gera métrica e a seção correspondente retorna `{ available: false }`. Contagens sensíveis também são omitidas, porque neste domínio contagem é informação de acesso ao domínio.

`command-center.read` é condição necessária, mas nunca substitui as permissões acima.

---

# Parte 2 — Resource Requests

## 2.1 Plugin

```text
diretório: plugins/operations/resource-requests
package:   @eops/plugin-resource-requests
entrypoints: "." e "./server"
```

Rotas de frontend:

```text
/resource-requests
/resource-requests/new
/resource-requests/:id
/resource-requests/:id/edit
/resource-requests/dashboard
/resource-requests/queue
```

## 2.2 Ownership

Owner de: pedido operacional de recurso, triagem, aprovação, responsabilidade, fulfillment e histórico do pedido.

Não é owner de `Asset`, `AssetReservation`, `AssetType`, `FieldTeam`, `Vehicle`, `DistributionRoute`, `Task`, `Incident`. Referencia esses domínios, nunca altera o lifecycle deles.

## 2.3 Lifecycle

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

Transições permitidas (tabela normativa):

```text
DRAFT                 → SUBMITTED, CANCELLED
SUBMITTED             → TRIAGED, REJECTED, CANCELLED
TRIAGED               → APPROVED, REJECTED, CANCELLED
APPROVED              → PARTIALLY_FULFILLED, FULFILLED, CANCELLED
PARTIALLY_FULFILLED   → FULFILLED, CANCELLED
FULFILLED             → (terminal)
REJECTED              → (terminal)
CANCELLED             → (terminal)
```

Qualquer transição fora desta tabela é rejeitada com `409`. Não existe regressão arbitrária; reabrir um pedido exige criar um novo pedido.

`PARTIALLY_FULFILLED` e `FULFILLED` são derivados do cálculo de fulfillment (2.7), nunca definidos diretamente pelo cliente.

## 2.4 Modelo

```text
ResourceRequest
  id, code @unique, electionId, electoralZoneId?, pollingPlaceId?, incidentId?, taskId?
  title, description
  priority (LOW | NORMAL | HIGH | CRITICAL), default NORMAL
  status   (ver 2.3), default DRAFT
  requestedById, ownerId?
  neededAt?, submittedAt?, triagedAt?, approvedAt?, fulfilledAt?, rejectedAt?, cancelledAt?
  triageNotes?, rejectionReason?, cancellationReason?
  createdAt, updatedAt
```

`code` é gerado pelo servidor no formato `RR-<ANO>-<sequência de 4 dígitos por ano>`, único e legível operacionalmente.

`priority` usa um enum próprio (`ResourceRequestPriority`) com a mesma semântica do enum de tarefas; reutilizar `TaskPriority` acoplaria dois domínios de prioridade distintos.

## 2.5 Itens

```text
ResourceRequestItem
  id, requestId
  kind (ASSET | ASSET_TYPE | FIELD_TEAM | VEHICLE | TRANSPORT | TECH_SUPPORT | MATERIAL | OTHER)
  label, description?, quantity (Int >= 1), notes?
  assetTypeId?, fieldTeamId?, vehicleId?
  createdAt, updatedAt
```

Regras:

```text
quantity >= 1
ASSET_TYPE exige assetTypeId válido
FIELD_TEAM  exige fieldTeamId válido
VEHICLE     exige vehicleId válido
demais kinds não aceitam FK (evita FK impossível para conceito genérico)
um pedido possui no mínimo 1 item para sair de DRAFT
```

`TRANSPORT`, `TECH_SUPPORT`, `MATERIAL` e `OTHER` são conceitos genéricos: são descritos por `label`/`description` e atendidos por `quantity` em fulfillment, sem FK de catálogo.

## 2.6 Fulfillment

```text
ResourceRequestFulfillment
  id, requestItemId, quantity (Int >= 1)
  fulfilledById
  assetId?, assetReservationId?, fieldTeamId?, vehicleId?, routeId?, taskId?
  notes?, createdAt
```

Múltiplos fulfillments por item são permitidos.

Derivados por item (nunca persistidos):

```text
fulfilledQuantity = soma das quantities dos fulfillments do item
remainingQuantity = max(quantity - fulfilledQuantity, 0)
satisfied         = fulfilledQuantity >= quantity
```

## 2.7 Status derivado

Após qualquer inclusão ou remoção de fulfillment, o servidor recalcula em transação:

```text
todos os itens satisfeitos                                  → FULFILLED, fulfilledAt = now
ao menos um item com fulfilledQuantity > 0 e algum insatisfeito → PARTIALLY_FULFILLED
nenhum fulfillment                                          → permanece o status anterior
                                                              (APPROVED, TRIAGED ou SUBMITTED)
```

`FULFILLED` é permitido a partir de `APPROVED`, `PARTIALLY_FULFILLED` ou `TRIAGED` (quando o pedido foi atendido diretamente). O servidor é a única autoridade sobre `fulfilledAt`.

## 2.8 Urgência

Derivada, nunca persistida:

```text
status ∈ { FULFILLED, REJECTED, CANCELLED } → COMPLETED
neededAt = null                             → ON_TRACK
now > neededAt                              → OVERDUE
neededAt - now <= 4 horas                   → DUE_SOON
caso contrário                              → ON_TRACK
```

## 2.9 Triagem

Triagem (`resource-requests.manage`) permite, em uma única operação ou separadamente:

```text
definir owner (usuário ACTIVE)
ajustar priority
registrar triageNotes
mover DRAFT→SUBMITTED é do requester; SUBMITTED→TRIAGED é de quem gerencia
```

Toda triagem registra histórico com `TRIAGED`, `OWNER_CHANGED` e/ou `PRIORITY_CHANGED` conforme o que mudou.

## 2.10 Aprovação e rejeição

```text
APPROVED exige resource-requests.approve
REJECTED exige resource-requests.approve
```

Proibido aprovar a partir de `DRAFT`, `REJECTED`, `CANCELLED`, `FULFILLED`.
Proibido rejeitar a partir de `DRAFT`, `APPROVED`, `PARTIALLY_FULFILLED`, `FULFILLED`, `REJECTED`, `CANCELLED`.
Rejeição exige `rejectionReason` não vazio.

`approvedAt` e `rejectedAt` são definidos exclusivamente pelo servidor.

## 2.11 Validação de fulfillment

Quando o fulfillment referenciar `Asset`:

```text
asset deve existir
asset.status ∈ { AVAILABLE, ALLOCATED, IN_USE, IN_TRANSIT }
asset.status ∉ { LOST, RETIRED, MAINTENANCE }  → rejeitado com 400
```

Quando referenciar `AssetReservation`:

```text
reservation deve existir, pertencer ao asset informado e ter status ∈ { REQUESTED, APPROVED }
```

Resource Requests **não** altera o lifecycle de Inventory: não muda `Asset.status`, não cria, aprova ou cancela reservas, não abre manutenção.

Quando referenciar `FieldTeam`:

```text
team deve existir
team.status = ACTIVE
team.electionId = request.electionId
```

A disponibilidade da equipe **não** é alterada automaticamente.

Quando referenciar `Vehicle` ou `DistributionRoute`:

```text
o vínculo é registrado
Vehicle.status = UNAVAILABLE → rejeitado
route.electionId = request.electionId quando informado
o status do veículo e da rota não é alterado
```

## 2.12 Histórico e comentários

```text
ResourceRequestHistory
  id, requestId, actorId?, action, description, metadata Json?, createdAt
```

Ações: `CREATED`, `UPDATED`, `SUBMITTED`, `TRIAGED`, `OWNER_CHANGED`, `PRIORITY_CHANGED`, `APPROVED`, `REJECTED`, `FULFILLMENT_ADDED`, `FULFILLMENT_REMOVED`, `PARTIALLY_FULFILLED`, `FULFILLED`, `CANCELLED`, `COMMENT_ADDED`.

```text
ResourceRequestComment
  id, requestId, authorId, body, createdAt
```

Comentários são append-only nesta versão (sem edição e sem remoção).

## 2.13 availableActions

Derivadas no servidor a partir de `status`, permissões do ator e vínculo do ator:

```text
edit             status = DRAFT e (actor = requestedBy ou manage)
submit           status = DRAFT e actor = requestedBy
triage           status = SUBMITTED e manage
approve          status ∈ { SUBMITTED, TRIAGED } e approve
reject           status ∈ { SUBMITTED, TRIAGED } e approve
addFulfillment   status ∈ { TRIAGED, APPROVED, PARTIALLY_FULFILLED } e fulfill
removeFulfillment status ∈ { APPROVED, PARTIALLY_FULFILLED, FULFILLED } e fulfill
cancel           status ∈ { DRAFT, SUBMITTED, TRIAGED, APPROVED, PARTIALLY_FULFILLED }
                 e (manage ou actor ∈ { requestedBy, ownerId })
addComment       status ≠ qualquer terminal, ou manage
```

## 2.14 Dashboard e fila

`GET /resource-requests/dashboard` retorna contagens reais:

```text
draft, submitted, awaitingTriage, awaitingApproval, approved,
partiallyFulfilled, fulfilledToday, overdue, critical
```

mais quebras por `priority`, por zona, por `kind` de item e por `owner`.

`GET /resource-requests/queue` retorna a fila operacional ordenada por:

```text
urgency (OVERDUE > DUE_SOON > ON_TRACK > COMPLETED)
priority DESC
neededAt ASC (nulls por último)
createdAt ASC
```

com filtros: `status`, `priority`, `electionId`, `electoralZoneId`, `pollingPlaceId`, `ownerId`, `requestedById`, `itemKind`, `overdue` (booleano).

---

# Parte 3 — Postmortem / RCA

## 3.1 Plugin

```text
diretório: plugins/operations/postmortems
package:   @eops/plugin-postmortems
entrypoints: "." e "./server"
```

Rotas de frontend:

```text
/postmortems
/postmortems/dashboard
/postmortems/new
/postmortems/:id
/postmortems/:id/edit
/postmortems/:id/timeline
/postmortems/insights
```

## 3.2 Ownership

Owner de: análise pós-incidente, RCA, timeline analítica, causas, lições aprendidas, ações corretivas, review e publicação.

Postmortem **nunca** altera o `Incident` original: não muda status, severidade, responsável, nem cria `IncidentEvent`. Publicar um postmortem não fecha o incidente.

## 3.3 Lifecycle

```text
DRAFT
IN_REVIEW
CHANGES_REQUESTED
APPROVED
PUBLISHED
ARCHIVED
```

Transições permitidas:

```text
DRAFT               → IN_REVIEW, ARCHIVED
IN_REVIEW           → APPROVED, CHANGES_REQUESTED, ARCHIVED
CHANGES_REQUESTED   → IN_REVIEW, ARCHIVED
APPROVED            → PUBLISHED, ARCHIVED
PUBLISHED           → ARCHIVED
ARCHIVED            → (terminal)
```

Proibido: `PUBLISHED → DRAFT`, `PUBLISHED → CHANGES_REQUESTED`, `APPROVED → DRAFT`, qualquer transição a partir de `ARCHIVED`, e qualquer edição de conteúdo em `ARCHIVED`.

Edição de conteúdo (`executiveSummary`, `impactSummary`, `detectionSummary`, `responseSummary`, `resolutionSummary`, `rootCauseSummary`, `lessonsSummary`, causas, lições, ações, timeline) é permitida somente em `DRAFT` e `CHANGES_REQUESTED`. Em `IN_REVIEW`, `APPROVED` e `PUBLISHED`, apenas ações administrativas (arquivar, publicar) são permitidas.

## 3.4 Incidente primário e cardinalidade

Todo Postmortem possui `primaryIncidentId` obrigatório e válido.

Cardinalidade normativa: **no máximo um postmortem não arquivado por incidente primário**. A regra é verificada pelo servidor dentro da transação de criação; tentativa de criar um segundo postmortem ativo para o mesmo incidente retorna `409`.

Um postmortem arquivado libera o incidente para um novo postmortem, preservando o histórico.

## 3.5 Modelo

```text
Postmortem
  id, code @unique, title, primaryIncidentId, status default DRAFT
  executiveSummary?, impactSummary?, detectionSummary?
  responseSummary?, resolutionSummary?, rootCauseSummary?, lessonsSummary?
  createdById, ownerId?
  submittedForReviewAt?, approvedAt?, publishedAt?, publishedById?, archivedAt?
  createdAt, updatedAt
```

`code` no formato `PM-<ANO>-<sequência de 4 dígitos por ano>`, único.

## 3.6 Incidentes relacionados

```text
PostmortemRelatedIncident
  id, postmortemId, incidentId, note?
  @@unique([postmortemId, incidentId])
```

Referencia `Incident`; não duplica dados do incidente.

## 3.7 Timeline

```text
PostmortemTimelineEntry
  id, postmortemId, occurredAt, sourceType, sourceId?, title, description?
  imported Boolean, createdById?, createdAt
  @@unique([postmortemId, sourceType, sourceId])
```

`sourceType ∈ { INCIDENT_EVENT, SHIFT_HANDOVER, TASK, RESOURCE_REQUEST, MANUAL }`.

## 3.8 Import de timeline

A ação `Importar timeline` lê, para o incidente primário e para os incidentes relacionados:

```text
IncidentEvent (todos os tipos: criação, reconhecimento, escalonamento, atribuição,
               mudança de status/severidade, comentário, resolução, reabertura, fechamento, cancelamento)
Incident.openedAt / acknowledgedAt / escalatedAt / resolvedAt / closedAt
ShiftHandover vinculado a qualquer incidente do postmortem (submissão, confirmação, cancelamento)
ResourceRequest vinculado ao incidente primário (submissão, triagem, aprovação, fulfillment)
Task vinculada ao incidente primário via FieldDispatch ou ShiftHandover
```

Cada entrada importada define:

```text
sourceType
sourceId = `${tipo}:${id}` do registro de origem
occurredAt
imported = true
createdById = ator da importação
```

Idempotência: a chave única `(postmortemId, sourceType, sourceId)` garante que reimportar não cria duplicata. Entradas `MANUAL` têm `sourceId = null` e portanto não colidem entre si. A importação usa `skipDuplicates` e retorna a contagem de entradas criadas e ignoradas.

O import nunca cria, altera ou remove dados nos domínios de origem.

## 3.9 Causas (RCA)

```text
PostmortemCause
  id, postmortemId, parentId?, type, category, statement, evidence?
  order Int, createdAt, updatedAt
  @@index([postmortemId, type])
```

```text
type     ∈ { ROOT_CAUSE, CONTRIBUTING_FACTOR, CONDITION }
category ∈ { PEOPLE, PROCESS, TECHNOLOGY, COMMUNICATION, LOGISTICS, EXTERNAL, OTHER }
```

Regras:

```text
parent deve pertencer ao mesmo postmortem
profundidade máxima da árvore: 5 níveis
não é permitido ciclo
Remover uma causa remove sua subárvore (onDelete: Cascade no autorrelacionamento)
```

## 3.10 5 Whys

A ferramenta 5 Whys é representada com `PostmortemCause` hierárquico:

```text
raiz: type = ROOT_CAUSE
níveis intermediários: type = CONTRIBUTING_FACTOR
profundidade máxima: 5
```

Não existe modelo separado. Os condicionantes estruturais do ambiente (por exemplo falta de energia, clima, ausência de fornecedor) podem ser registrados como `type = CONDITION`.

## 3.11 Lições

```text
PostmortemLesson
  id, postmortemId, type, title, description, category?, createdAt, updatedAt
```

```text
type ∈ { WENT_WELL, WENT_WRONG, LESSON, FOLLOW_UP }
category opcional ∈ PostmortemCauseCategory
```

## 3.12 Ações corretivas

```text
PostmortemActionItem
  id, postmortemId, title, description?, priority default MEDIUM, ownerUserId?, dueAt?
  status default OPEN, taskId?, createdById?, completedAt?, createdAt, updatedAt
```

```text
status ∈ { OPEN, IN_PROGRESS, DONE, CANCELLED }
priority reutiliza TaskPriority
```

Regras:

```text
ownerUserId, quando informado, deve ser usuário ACTIVE
taskId, quando informado, deve referenciar Task existente — o postmortem não cria Task automaticamente
DONE define completedAt pelo servidor; sair de DONE limpa completedAt
overdue = status ∈ { OPEN, IN_PROGRESS } e dueAt < now
```

## 3.13 Review

```text
PostmortemReviewer
  id, postmortemId, userId, createdAt
  @@unique([postmortemId, userId])

PostmortemReview
  id, postmortemId, reviewerId, decision, comment?, createdAt
```

```text
decision ∈ { APPROVED, CHANGES_REQUESTED }
```

Regras:

```text
reviewer deve ser usuário ACTIVE no momento da designação e no momento do review
reviewer deve possuir postmortems.review
role names nunca são usados no runtime; a autorização é sempre por permissão
cada review cria um novo registro; o histórico é preservado e nunca sobrescrito
```

## 3.14 Submit para review

`POST /postmortems/:id/submit-for-review` exige:

```text
status ∈ { DRAFT, CHANGES_REQUESTED }
incidente primário existe e está persistido
incidente primário com status ∈ { RESOLVED, CLOSED }
executiveSummary preenchido
impactSummary preenchido
rootCauseSummary preenchido
ao menos uma PostmortemCause com type = ROOT_CAUSE
ao menos uma PostmortemLesson
ao menos um PostmortemReviewer designado para incidente LOW/MEDIUM
ao menos uma PostmortemActionItem para incidente HIGH/CRITICAL
```

Falha em qualquer item retorna `400` com mensagem objetiva e o postmortem permanece em `DRAFT`/`CHANGES_REQUESTED`.

## 3.15 Aprovação e mudanças

```text
APPROVED exige que todos os reviewers designados possuam um PostmortemReview com decision = APPROVED
        e nenhum reviewer pendente
qualquer CHANGES_REQUESTED recebido enquanto o postmortem está IN_REVIEW
        move o postmortem para CHANGES_REQUESTED
```

O registro de `CHANGES_REQUESTED` é inserido em `PostmortemReview` antes da transição; reviews anteriores nunca são removidos.

Reenviar após mudanças (`CHANGES_REQUESTED → IN_REVIEW`) não apaga as decisões anteriores; a regra de aprovação considera a **decisão mais recente de cada reviewer**. Um reviewer que pediu mudanças passa a contar como aprovado somente quando registrar nova decisão `APPROVED`.

## 3.16 Publicação

```text
PUBLISHED exige status = APPROVED
PUBLISHED exige postmortems.publish
servidor registra publishedAt e publishedById
PUBLISHED é a partir daí somente-leitura; a única transição restante é ARCHIVED
```

Publicar não altera Knowledge, Reports nem o Incident. A página exibe um link de navegação para o módulo de conhecimento; nenhuma criação automática de artigo é executada.

## 3.17 availableActions do postmortem

Derivadas no servidor:

```text
edit                status ∈ { DRAFT, CHANGES_REQUESTED } e (actor = ownerId ou createdById) com postmortems.manage
submitForReview     status ∈ { DRAFT, CHANGES_REQUESTED } e (actor = ownerId ou createdById) com postmortems.manage
review              status = IN_REVIEW e actor é reviewer designado com postmortems.review
publish             status = APPROVED e postmortems.publish
archive             status ∈ { DRAFT, IN_REVIEW, CHANGES_REQUESTED, APPROVED, PUBLISHED } e postmortems.manage
importTimeline      status ∈ { DRAFT, CHANGES_REQUESTED } e postmortems.manage
```

## 3.18 Dashboard e insights

`GET /postmortems/dashboard`:

```text
draft, inReview, changesRequested, approved, published
overdueActionItems
criticalIncidentsWithoutPostmortem
recentPublished
```

`criticalIncidentsWithoutPostmortem` considera incidentes com `severity ∈ { HIGH, CRITICAL }`, `status ∈ { RESOLVED, CLOSED }` e sem postmortem não arquivado.

`GET /postmortems/insights` retorna análises derivadas de dados reais:

```text
causesByCategory          (categoria → contagem), apenas de postmortems não arquivados
recurringCauses           (categoria + type → contagem), ordenado desc
incidentsBySeverity       (severidade → postmortem count)
averageTimeToPublishHours (média de publishedAt - createdAt), null quando não há publicação
openActionItems, overdueActionItems
lessonsByType, lessonsByCategory
```

Insights não substituem Reports e não recalculam métricas de domínios alheios.

---

# Parte 4 — Integrações cross-domain

## 4.1 Command Center + Resource Requests

Command Center consome `ResourceRequest` quando o usuário tem `resource-requests.read`:

```text
priority = CRITICAL e status não terminal        → attention item CRITICAL
urgency = OVERDUE e status não terminal           → attention item, deadlineState OVERDUE
status = APPROVED e neededAt <= now + 4h          → attention item, severity HIGH
```

Todo item traz `deepLink` para `/resource-requests/:id`.

## 4.2 Incident + Resource Request

`ResourceRequest.incidentId` é opcional e referencia um `Incident` existente. Pedidos normais não exigem incidente. Quando presente, o incidente deve pertencer ao mesmo `electionId` do pedido.

## 4.3 Incident + Postmortem

`Postmortem.primaryIncidentId` é obrigatório. Publicar ou arquivar um postmortem não altera o incidente.

## 4.4 Resource Request + Postmortem

O import de timeline pode incluir `ResourceRequest` vinculados ao incidente primário como `sourceType = RESOURCE_REQUEST`, usando `sourceId = "ResourceRequest:<id>"`. A entrada registra título e status; não copia o conteúdo completo da solicitação.

## 4.5 Shift Handover

Command Center mostra `pendingHandovers`, `oldestPendingHandoverAgeSeconds` e as passagens recentemente confirmadas (`ShiftHandover.status = CONFIRMED`, ordenado por `confirmedAt` desc, limite 5).

O import de timeline do Postmortem inclui as `ShiftHandover` vinculadas aos incidentes do postmortem (submissão, confirmação, cancelamento) como `sourceType = SHIFT_HANDOVER`.

## 4.6 Tasks

`ResourceRequest.taskId` é opcional e serve para acompanhamento; não cria relação automática.
`PostmortemActionItem.taskId` é opcional; o frontend exibe deep link para `/tasks/:id` quando presente.
Nenhum dos dois plugins cria Task automaticamente.

## 4.7 Leitura de outros domínios

Toda leitura cross-domain usa `PrismaService` compartilhado em modo somente-leitura, com `select` explícito, nunca `include` irrestrito em tabelas alheias. Nenhum plugin novo escreve em tabela de outro domínio.

---

# Parte 5 — RBAC

## 5.1 Catálogo

Adicionar em `packages/security/src/permissions.ts`:

```text
commandCenter:    read, manage
resourceRequests: read, manage, approve, fulfill
postmortems:      read, manage, review, publish
```

Todas entram em `PLATFORM_PERMISSION_KEYS`. O catálogo de `/permissions` é derivado de `PERMISSIONS`, portanto as novas chaves aparecem automaticamente.

## 5.2 Uso

```text
command-center.read     → summary, attention, zones, workforce, logistics, continuity,
                          leitura de views e snapshots
command-center.manage   → criar/editar/remover views compartilhadas, criar snapshots,
                          editar/remover views de terceiros
resource-requests.read   → leitura
resource-requests.manage → criar, editar rascunho, submeter como gestor, triagem, cancelar
resource-requests.approve→ aprovar, rejeitar
resource-requests.fulfill→ registrar e remover fulfillment
postmortems.read         → leitura
postmortems.manage       → criar, editar, arquivar, submeter para review
postmortems.review       → registrar decisão de review
postmortems.publish      → publicar
```

## 5.3 Seed

Atualizar `packages/database/prisma/seed.ts` seguindo os perfis existentes:

```text
ADMIN      → todas as novas permissões
SUPERVISOR → command-center.read, command-center.manage,
             resource-requests.* (todas), postmortems.* (todas)
OPERATOR   → command-center.read, resource-requests.read, resource-requests.manage,
             resource-requests.fulfill, postmortems.read, postmortems.manage
TECHNICIAN → command-center.read, resource-requests.read, postmortems.read
VIEWER     → leitura das novas permissões conforme a política atual (`.read` apenas)
```

O runtime autoriza exclusivamente por permissão. Role name nunca é consultado no código de negócio.

---

# Parte 6 — Event Bus

## 6.1 Eventos adicionados a `DomainEventMap`

```text
resource_request.created
resource_request.submitted
resource_request.triaged
resource_request.approved
resource_request.rejected
resource_request.partially_fulfilled
resource_request.fulfilled
resource_request.cancelled

postmortem.created
postmortem.submitted
postmortem.changes_requested
postmortem.approved
postmortem.published
postmortem.archived
postmortem.action_overdue

command_center.snapshot_created
command_center.shared_view_created
```

## 6.2 Payload mínimo

Todo evento carrega:

```text
entityId
actorId
```

mais os campos de contexto necessários à notificação e à auditoria. Eventos não carregam o objeto completo da entidade.

## 6.3 Eventos proibidos

Não emitir evento para leitura de dashboard, mudança de aba, mudança de filtro, abertura de página, seleção de nó de RCA ou renderização de componente.

## 6.4 `requiredPermissionForEvent`

Adicionar os prefixos:

```text
resource_request. → resource-requests.read
postmortem.       → postmortems.read
command_center.   → command-center.read
```

e entradas explícitas no `NOTIFICATION_EVENT_CATALOG` para os eventos que geram notificação (Parte 7), com o `requiredPermission` específico de cada audiência.

---

# Parte 7 — Notificações

## 7.1 Audiences direcionadas

```text
resource_request.submitted          → usuários ACTIVE com resource-requests.approve
resource_request.triaged            → owner recém-designado (quando o ator não é o próprio owner)
resource_request.approved           → requestedBy
resource_request.rejected           → requestedBy
resource_request.fulfilled          → requestedBy

postmortem.submitted                → reviewers designados
postmortem.changes_requested        → owner
postmortem.approved                 → owner
postmortem.published                → owner e reviewers
postmortem.action_overdue           → owner da action
```

## 7.2 Regras obrigatórias

```text
nunca realizar broadcast global
usuário deve estar ACTIVE
usuário deve possuir a permissão exigida do evento
usuário com preference desabilitada para o evento não recebe
o ator não recebe notificação da própria ação quando a audiência for ele mesmo
```

## 7.3 Eventos sem notificação

```text
resource_request.created, resource_request.cancelled
postmortem.created, postmortem.archived
command_center.snapshot_created, command_center.shared_view_created
```

Esses eventos existem apenas para auditoria e integração.

## 7.4 Command Center

Command Center não cria notificações. Ele agrega visualmente alertas já emitidos pelos domínios de origem. Nenhuma notificação é disparada apenas porque um item apareceu no feed de atenção.

## 7.5 `postmortem.action_overdue`

`postmortem.action_overdue` é emitido pelo serviço de postmortem no momento em que uma action item com `dueAt` vencido é observada por uma consulta autenticada de dashboard, no máximo uma vez por action item (controle por `metadata.notifiedAt` persistido na própria action item em `PostmortemActionItem`). Não há scheduler, cron ou job assíncrono.

---

# Parte 8 — Auditoria

A auditoria continua centralizada no subscriber global do plugin Audit, que usa `subscribeAll`. Nenhum plugin novo escreve `AuditEvent` manualmente.

Ajustes necessários e permitidos:

```text
inferEntityType: mapear os prefixos `resource_request` → ResourceRequest,
                 `postmortem` → Postmortem,
                 `command_center.snapshot_created` → CommandCenterSnapshot,
                 `command_center.shared_view_created` → CommandCenterSavedView
```

Os payloads dos eventos novos carregam `actorId`, `entityId`, `from`/`to` ou `changes` quando aplicável, para que a auditoria registre before/after útil.

---

# Parte 9 — Banco de dados

## 9.1 Modelos novos

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

## 9.2 Enums novos

```text
CommandCenterHealth            NORMAL | ATTENTION | CRITICAL
CommandCenterLayoutMode        STANDARD | WALLBOARD

ResourceRequestStatus          DRAFT | SUBMITTED | TRIAGED | APPROVED | PARTIALLY_FULFILLED | FULFILLED | REJECTED | CANCELLED
ResourceRequestPriority        LOW | NORMAL | HIGH | CRITICAL
ResourceRequestItemKind        ASSET | ASSET_TYPE | FIELD_TEAM | VEHICLE | TRANSPORT | TECH_SUPPORT | MATERIAL | OTHER
ResourceRequestHistoryAction   CREATED | UPDATED | SUBMITTED | TRIAGED | OWNER_CHANGED | PRIORITY_CHANGED | APPROVED |
                               REJECTED | FULFILLMENT_ADDED | FULFILLMENT_REMOVED | PARTIALLY_FULFILLED |
                               FULFILLED | CANCELLED | COMMENT_ADDED

PostmortemStatus               DRAFT | IN_REVIEW | CHANGES_REQUESTED | APPROVED | PUBLISHED | ARCHIVED
PostmortemCauseType            ROOT_CAUSE | CONTRIBUTING_FACTOR | CONDITION
PostmortemCauseCategory        PEOPLE | PROCESS | TECHNOLOGY | COMMUNICATION | LOGISTICS | EXTERNAL | OTHER
PostmortemLessonType           WENT_WELL | WENT_WRONG | LESSON | FOLLOW_UP
PostmortemActionStatus         OPEN | IN_PROGRESS | DONE | CANCELLED
PostmortemReviewDecision       APPROVED | CHANGES_REQUESTED
PostmortemTimelineSource       INCIDENT_EVENT | SHIFT_HANDOVER | TASK | RESOURCE_REQUEST | MANUAL
```

## 9.3 Relações reversas obrigatórias

Toda relação Prisma nova possui lado reverso. Obrigatoriamente revisados:

```text
User          → resourceRequests (requester), ownedResourceRequests, resourceRequestHistory,
                resourceRequestComments, resourceRequestFulfillments,
                commandCenterSavedViews, commandCenterSnapshots,
                createdPostmortems, ownedPostmortems, publishedPostmortems,
                postmortemActionItems (owner), createdPostmortemActionItems,
                postmortemReviews, postmortemReviewerAssignments, postmortemTimelineEntries
Election      → resourceRequests, commandCenterSnapshots
ElectoralZone → resourceRequests, commandCenterSnapshots
PollingPlace  → resourceRequests
Incident      → resourceRequests, postmortems (primary), postmortemRelatedIncidents
Task          → resourceRequests, resourceRequestFulfillments, postmortemActionItems
Asset         → resourceRequestFulfillments
AssetType     → resourceRequestItems
AssetReservation → resourceRequestFulfillments
FieldTeam     → resourceRequestItems, resourceRequestFulfillments
Vehicle       → resourceRequestItems, resourceRequestFulfillments
DistributionRoute → resourceRequestFulfillments
```

Relações com nome explícito obrigatório quando existir mais de uma relação para o mesmo par de modelos (`User`↔`ResourceRequest`, `User`↔`Postmortem`, `Postmortem`→`User` para owner/creator/publisher, `Incident`↔`Postmortem`).

## 9.4 Índices exigidos

```text
ResourceRequest        (status, priority) (electionId, status) (neededAt, status)
                       (ownerId, status) (requestedById, status) (incidentId) (taskId)
ResourceRequestItem    (requestId, kind) (assetTypeId) (fieldTeamId) (vehicleId)
ResourceRequestFulfillment (requestItemId, createdAt) (assetId) (assetReservationId)
                       (fieldTeamId) (vehicleId) (routeId) (taskId)
ResourceRequestHistory (requestId, createdAt) (actorId, createdAt)
ResourceRequestComment (requestId, createdAt)
CommandCenterSavedView (ownerId, isDefault) (shared, updatedAt)
CommandCenterSnapshot  (electionId, createdAt) (createdAt)
Postmortem             (status, createdAt) (primaryIncidentId) (ownerId, status)
PostmortemTimelineEntry(postmortemId, occurredAt)
PostmortemCause        (postmortemId, type) (parentId)
PostmortemLesson       (postmortemId, type)
PostmortemActionItem   (postmortemId, status) (status, dueAt) (ownerUserId, status) (taskId)
PostmortemReviewer     (userId)
PostmortemReview       (postmortemId, createdAt) (reviewerId, createdAt)
```

Índices únicos exigidos:

```text
ResourceRequest.code
Postmortem.code
CommandCenterSavedView (ownerId, name)
PostmortemTimelineEntry (postmortemId, sourceType, sourceId)
PostmortemRelatedIncident (postmortemId, incidentId)
PostmortemReviewer (postmortemId, userId)
```

## 9.5 Migration

Criar uma migration nova em `packages/database/prisma/migrations/`. A migration é criada e **não aplicada**. Não alterar nenhuma migration histórica. Ao final, `prisma migrate status` deve reportar a nova migration como pendente.

---

# Parte 10 — Frontend

## 10.1 Regras gerais

- seguir `docs/UI-DESIGN-GUIDE.md`;
- CSS específico em `*.module.css` dentro do próprio plugin;
- usar primitives de `@eops/ui` (`Button`, `LinkButton`, `Input`, `Select`, `Field`, `Badge`, `Card`, `Loading`, `EmptyState`, `ErrorState`, `Breadcrumb`, `Pagination`);
- usar `useAsync` de `@eops/ui` para carga de dados e `apiClient` de `@eops/api-client` em services próprios do plugin;
- toda página trata `loading`, `error`, `empty` e `success`;
- usar `useAuth().hasPermission` para condicionar exibição, nunca duplicando regra de negócio: a autoridade final é o backend;
- não adicionar biblioteca nova de gráficos;
- não criar design system paralelo.

## 10.2 Command Center

- página principal com hierarquia visual: health geral, feed de atenção crítico, matriz de zonas, blocos de workforce/continuity/logistics/requests;
- feed de atenção com severidade, ícone de origem, título, escopo, idade, estado e deep link;
- filtros de severidade, origem, zona, estado e pleito;
- matriz de zonas com drill-down;
- views: listar, criar, editar, remover, definir padrão, compartilhar;
- snapshots: listar, criar, detalhar e comparar com o estado atual (deltas de métricas);
- wallboard sem formulários.

## 10.3 Resource Requests

- dashboard com indicadores e quebras;
- fila densa com `code`, `title`, `priority`, `status`, `requester`, `owner`, `neededAt`, `urgency`, progresso de fulfillment;
- formulário dividido em Contexto, Pedido, Itens, Prazo e Revisão, com múltiplos itens;
- detalhe com Summary, Items, Fulfillment, Comments, Timeline, Related entities e Available Actions;
- painel de fulfillment mostrando `required`, `fulfilled` e `remaining` por item, com validação no backend.

## 10.4 Postmortems

- editor por seções: Executive Summary, Impact, Detection, Response, Resolution, Root Cause, Lessons, Actions, Timeline, Review;
- componente de árvore causal reutilizável com add/editar/remover;
- timeline com horário, origem, título, descrição, deep link e badge importado/manual;
- tabela de ações corretivas com destaque para vencidas e link para Task;
- painel de review com reviewers, decisão, comentário, data e pendentes;
- página de insights com tabelas e barras simples em CSS.

## 10.5 Responsividade

Layout deve funcionar em 1440 px, 1024 px e abaixo de 760 px. `VISUAL_QA = NOT_ACTIONABLE` quando não houver ambiente de verificação visual.

---

# Parte 11 — Estratégia de testes

Testes focados por bloco, executados durante o desenvolvimento. Não rodar a suíte completa repetidamente.

Cobertura mínima exigida por área (o volume exato é orientativo, não quota):

```text
Command Center: derivação de health, fórmula do attention score e ordenação total,
                filtragem por permissão, agregação por zona, ownership de saved views,
                conteúdo do snapshot, idade de passagens pendentes, deadlines.

Resource Requests: tabela de transições, triagem, aprovação e rejeição, fulfillment parcial,
                   fulfillment total derivado, transição inválida, elegibilidade de asset,
                   compatibilidade de equipe e veículo, urgência, availableActions,
                   histórico, comentários.

Postmortems: elegibilidade do incidente, cardinalidade de postmortem ativo, pré-condições de submit,
             idempotência de import de timeline, árvore de causas e profundidade máxima,
             fluxo de review, changes requested preservando reviews, regra de aprovação por
             decisão mais recente, publicação, action items vencidas, insights.

Notificações: audiência de requester e owner, reviewers de postmortem, preference desabilitada,
              usuário inativo, ausência de broadcast não intencional.
```

Não testar CSS, DTO trivial, constantes, ícones ou wrappers simples.

---

# Critérios de aceite

## Command Center

```text
CC-01  Command Center é plugin independente registrado em pluginRegistry e AppModule.
CC-02  summary utiliza dados reais persistidos; nenhum número é hardcoded.
CC-03  health é derivado pela regra determinística de 1.8.
CC-04  attention feed agrega incident, transmission, preparation, shift coverage,
       field dispatch, shift handover, route, asset e resource request.
CC-05  attention score é determinístico e ordenado pela fórmula de 1.7.
CC-06  seções e métricas sem permissão subjacente são omitidas ou retornam available: false.
CC-07  zone view agrega estado por ElectoralZone e ordena as zonas mais críticas primeiro.
CC-08  saved views possuem ownership e visibilidade privada por padrão.
CC-09  shared views respeitam RBAC (leitura por command-center.read, gestão por owner ou manage).
CC-10  snapshots persistem apenas os agregados definidos em 1.9.
CC-11  wallboard possui auto-refresh por polling entre 30 e 60 segundos, com cleanup, sem WebSocket.
CC-12  deep links apontam para rotas reais existentes dos domínios de origem.
```

## Resource Requests

```text
RR-01  Resource Request possui lifecycle formal com tabela de transições normativa.
RR-02  um pedido possui um ou mais itens com kind e quantity validados.
RR-03  submit usa o requester da sessão; DTO não aceita actorId.
RR-04  triage registra owner e histórico.
RR-05  approval e rejection exigem resource-requests.approve.
RR-06  fulfillment pode ser parcial.
RR-07  fulfillment total e remainingQuantity são calculados no backend.
RR-08  assets LOST, RETIRED e MAINTENANCE não podem ser usados em fulfillment.
RR-09  equipe incompatível com pleito ou inativa é rejeitada.
RR-10  urgency é derivada de neededAt e do status, nunca persistida.
RR-11  comments e history são preservados; comentários são append-only.
RR-12  availableActions são calculadas no backend.
RR-13  Command Center exibe requests críticos, vencidos e aprovados sem atendimento.
RR-14  Event Bus possui os eventos tipados de 6.1 com payload consistente.
RR-15  Notifications são direcionadas conforme 7.1 e não fazem broadcast global.
```

## Postmortem

```text
PM-01  Postmortem referencia Incident existente via primaryIncidentId obrigatório.
PM-02  o incidente original não é alterado em nenhuma operação do postmortem.
PM-03  o lifecycle é formal e transições proibidas são rejeitadas.
PM-04  a timeline pode importar IncidentEvent e marcos do incidente.
PM-05  o import de timeline é idempotente.
PM-06  as causas possuem estrutura hierárquica com parentId e profundidade máxima 5.
PM-07  uma causa raiz é obrigatória antes do review.
PM-08  lessons são persistidas com tipo.
PM-09  incidente HIGH/CRITICAL exige ao menos uma corrective action antes do review.
PM-10  action items podem referenciar Task existente sem duplicá-la.
PM-11  reviewers são usuários ACTIVE e autorizados por postmortems.review.
PM-12  changes requested preserva todos os reviews anteriores.
PM-13  approval depende da decisão mais recente de todos os reviewers designados.
PM-14  publish exige APPROVED e registra publishedAt e publishedById.
PM-15  insights usam dados reais persistidos.
PM-16  Notifications são direcionadas conforme 7.1.
PM-17  Audit usa a infraestrutura global subscribeAll, sem escrita manual de AuditEvent.
```

## Global

```text
GLOBAL-01  nenhum import interno cross-plugin.
GLOBAL-02  apenas APIs públicas são usadas entre workspaces.
GLOBAL-03  as novas permissões entram no catálogo oficial derivado de PERMISSIONS.
GLOBAL-04  o seed é atualizado para os cinco perfis.
GLOBAL-05  todas as relações Prisma novas possuem lado reverso válido.
GLOBAL-06  nenhuma migration histórica é alterada.
GLOBAL-07  a migration nova não é aplicada remotamente.
GLOBAL-08  testes focados cobrem as regras críticas.
GLOBAL-09  a suíte completa passa.
GLOBAL-10  o build passa.
GLOBAL-11  db:validate passa.
GLOBAL-12  check-ap1 passa.
GLOBAL-13  o LOC é medido e reportado honestamente.
GLOBAL-14  nenhum código existe apenas para aumentar LOC.
```

---

# Validação

Após os três plugins estarem implementados:

```bash
npm run spec:check
npm run check:boundaries
npm run typecheck
npm run lint
npm test
npm run build
npm run db:validate
npm run count:loc
git diff --check
npx prisma migrate status --schema packages/database/prisma/schema.prisma
```

e

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-ap1.ps1
```

Se alguma validação depender de infraestrutura indisponível, registrar exatamente o que não pôde ser validado. Não declarar sucesso não verificado.

---

# Rastreabilidade

Os commits de implementação desta SPEC devem usar o escopo do plugin afetado e os trailers de `docs/COMMIT-GUIDE.md`, apontando para este arquivo.
