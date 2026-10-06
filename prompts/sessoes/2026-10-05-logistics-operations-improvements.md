Você está trabalhando no monorepo **Election Ops Platform**.

Esta execução é:

```text
PLUGIN IMPROVEMENTS — LOGISTICS OPERATIONS
```

Plugins-alvo:

```text
Inventory
Routes / Distribution
```

Objetivo:

transformar os módulos logísticos atuais em uma vertical operacional integrada:

```text
Inventory
   ↓
reserva
   ↓
separação / custódia
   ↓
carga
   ↓
Route
   ↓
dispatch
   ↓
delivery
   ↓
return / check-in
```

A implementação deve aprofundar funcionalidades existentes.

NÃO reconstruir os plugins do zero.

NÃO criar funcionalidades artificiais apenas para aumentar LOC.

---

# 0. CONTEXTO ATUAL DO REPOSITÓRIO

A ordem originalmente planejada das execuções foi alterada.

Já foram executadas antes desta etapa:

```text
Administration / Work Improvements
→ Access Control
→ Tasks
→ Preparation Checklists

Operational Intelligence Improvements
→ Transmission
→ Operational Map
→ Simulator
→ Reports
```

Também houve uma correção estrutural no pipeline de build:

```text
scripts/sync-server-workspace-dist.mjs
```

O sincronizador agora publica corretamente dependências runtime compartilhadas dos plugins e serializa sincronizações no modo watch.

NÃO reverta essa correção.

O banco também já teve seu histórico reconciliado.

No último estado conhecido:

```text
npx prisma migrate status
→ Database schema is up to date!
```

As migrations anteriores incluem:

```text
202610050001_administration_work_improvements
202610050002_operational_intelligence_improvements
```

Mas NÃO presuma que `003` esteja livre.

Descubra o próximo identificador real durante o preflight.

A fonte de verdade desta execução é:

```text
HEAD atual
+
working tree atual
+
schema Prisma atual
+
migrations atuais
+
SPECs atuais
+
contratos públicos atuais
```

Não tente restaurar qualquer estado antigo do projeto.

---

# 1. BASELINE DE LOC

O último snapshot conhecido estava aproximadamente em:

```text
60.927 LOC
640 arquivos
```

Isso é apenas contexto.

NÃO hardcode esse número.

Execute:

```bash
npm run count:loc
```

e utilize o resultado real como baseline desta execução.

A meta do projeto NÃO justifica:

```text
padding
arquivos artificiais
DTOs sem necessidade
testes duplicados
configuração inútil
código morto
```

Priorize código operacional real.

---

# 2. DISCIPLINA DE EXECUÇÃO

Esta tarefa será executada por um agente que pode ficar lento com validações excessivas.

Durante desenvolvimento:

```text
implementação
→ teste focado
→ implementação
→ teste focado
```

Evite repetir:

```text
npm test
npm run build
npm run typecheck
```

após pequenas alterações.

A suíte completa deve ser executada apenas no gate final.

Se um teste focado falhar:

```text
corrigir
→ repetir somente o teste relacionado
```

---

# 3. PROMPT REGISTRATION

Salvar este prompt literalmente em:

```text
prompts/sessoes/2026-10-05-logistics-operations-improvements.md
```

Não resumir.

Não substituir posteriormente pelo handoff.

---

# 4. PREFLIGHT

Executar:

```bash
git status --short
git log --oneline -12
npm run spec:check -- HEAD
npm run check:boundaries
npm run count:loc
```

Inspecionar:

```text
packages/database/prisma/migrations/
packages/database/prisma/schema.prisma

plugins/**/inventory
plugins/**/routes
```

Use os paths reais existentes.

Também consultar apenas quando necessário:

```text
packages/shared
packages/event-bus
packages/security
packages/ui
```

Leia:

```text
AGENTS.md
SPEC/README.md
docs/AI-PLUGIN-GUIDE.md
docs/UI-DESIGN-GUIDE.md
docs/execution-issues/README.md
```

Não carregue todo o monorepo no contexto.

---

# 5. EXECUTION ISSUES PREFLIGHT

Revise issues ainda abertas somente se relevantes.

Classifique como:

```text
BLOCKS_CURRENT_TASK
RELATED_NON_BLOCKING
OUT_OF_SCOPE
```

Possíveis issues históricas:

```text
Prisma/Windows EPERM
browser visual QA
```

A antiga divergência de migration Resource Planning NÃO deve ser tratada como ativa se:

```text
prisma migrate status
```

mostrar:

```text
Database schema is up to date!
```

Não reabra issues resolvidos sem nova evidência.

---

# 6. SPEC GATE

Classificação esperada:

```text
NEW_SPEC
```

Criar:

```text
SPEC/2026-10-05-logistics-operations-improvements.md
```

A SPEC deve refletir o estado ATUAL dos dois plugins.

Antes de escrever a SPEC:

inspecione o que Inventory e Routes já fazem.

NÃO escreva requisitos para funcionalidades já existentes como se fossem novas.

---

# 7. COMMIT EXCLUSIVO DA SPEC

Você está autorizado a realizar SOMENTE o commit inicial da SPEC.

Stage exclusivamente:

```text
SPEC/2026-10-05-logistics-operations-improvements.md
```

Confirme:

```bash
git diff --cached --name-only
```

Commit:

```text
docs(spec): define logistics operations improvements
```

Trailers:

```text
Agent: claude/deepseek-flash-1m
Spec: SPEC/2026-10-05-logistics-operations-improvements.md
```

Não fazer nenhum outro commit.

---

# PARTE A — OWNERSHIP

# 8. OWNERSHIP DOS DOMÍNIOS

Defina claramente:

```text
Inventory
→ owner de Asset
→ disponibilidade
→ reserva
→ custody
→ movimentação
→ manutenção simples

Routes
→ owner de Route
→ carga
→ stops
→ despacho
→ entrega
→ retorno logístico
```

Não mover ownership para:

```text
Tasks
Field Teams
Shifts
Documents
Operational Map
```

Integrações devem ocorrer por:

```text
IDs
contratos públicos
Event Bus
API pública
```

Nunca por imports físicos de:

```text
outro-plugin/src/**
```

---

# PARTE B — INVENTORY

# 9. OBJETIVO DO INVENTORY

O Inventory atual já possui conceitos básicos de:

```text
assets
asset types
movements
assignments
status
condition
location
dashboard
```

Preserve tudo que estiver funcional.

Aprofunde o fluxo para representar a vida operacional do ativo.

---

# 10. ASSET LIFECYCLE

Formalizar um lifecycle operacional equivalente a:

```text
AVAILABLE
RESERVED
IN_CUSTODY
IN_USE
MAINTENANCE
UNAVAILABLE
RETIRED
```

Antes de adicionar novos enums:

verifique os status atuais.

Reutilize status existentes quando semanticamente compatíveis.

Evite migração destrutiva desnecessária.

Defina na SPEC transições permitidas.

Exemplo conceitual:

```text
AVAILABLE
→ RESERVED
→ IN_CUSTODY
→ IN_USE
→ AVAILABLE
```

e:

```text
AVAILABLE / IN_USE
→ MAINTENANCE
→ AVAILABLE ou UNAVAILABLE
```

---

# 11. DERIVED AVAILABILITY

Separar:

```text
status físico/administrativo
```

de:

```text
disponibilidade operacional
```

Quando possível, disponibilidade deve ser derivada de:

```text
estado atual
reservas
custódia
manutenção
```

Não persistir um segundo estado redundante sem necessidade.

---

# 12. RESERVATIONS

Criar reserva operacional de ativos.

Campos conceituais:

```text
id
assetId ou critério de asset type quando aplicável
requesterId / requesterName
purpose
startsAt
endsAt
status
notes
createdBy
createdAt
updatedAt
```

Lifecycle equivalente a:

```text
REQUESTED
APPROVED
FULFILLED
CANCELLED
```

Se a arquitetura permitir fluxo mais simples, documente na SPEC.

---

# 13. RESERVATION VALIDATION

Validar:

```text
asset existente
asset ativo
asset operacionalmente disponível
conflito de horário
maintenance overlap
reservation overlap
```

Se uma reserva referenciar asset individual:

não permitir dupla reserva incompatível.

Se reservas forem por tipo/quantidade:

calcular disponibilidade real antes da aprovação.

---

# 14. CHECK-OUT / CUSTODY

Criar fluxo explícito de retirada.

Um check-out deve responder:

```text
qual ativo?
quem recebeu?
de onde saiu?
para onde foi?
quando?
para qual finalidade?
quem registrou?
```

Persistir histórico.

Campos conceituais:

```text
assetId
recipientName / responsibleId
origin
destination
checkedOutAt
expectedReturnAt
conditionOut
notes
actorId
```

---

# 15. CHECK-IN

Criar devolução.

Registrar:

```text
returnedAt
conditionIn
returnedTo
receivedBy
notes
problemDetected
```

Se houver problema:

não devolver automaticamente o ativo para `AVAILABLE`.

Pode ir para:

```text
MAINTENANCE
UNAVAILABLE
```

conforme regra explícita.

---

# 16. CURRENT CUSTODY

A plataforma deve conseguir responder diretamente:

```text
onde está o ativo?
com quem está?
desde quando?
qual foi a última movimentação?
quando deveria voltar?
```

Preferir estado derivado/histórico consistente.

---

# 17. MOVEMENT HISTORY

Preservar o sistema atual de movimentações.

Melhorar a timeline para distinguir:

```text
reservation
check-out
transfer
assignment
route load
return
maintenance
```

Não duplicar eventos quando o movimento atual já registra informação suficiente.

---

# 18. MAINTENANCE

Implementar manutenção simples.

NÃO criar um CMMS completo.

Tipos:

```text
PREVENTIVE
CORRECTIVE
```

Campos:

```text
assetId
type
description
openedAt
completedAt
responsible
cost opcional
result
notes
status
```

Status simples:

```text
OPEN
IN_PROGRESS
COMPLETED
CANCELLED
```

---

# 19. MAINTENANCE RULES

Enquanto existir manutenção ativa:

o ativo deve ficar indisponível para:

```text
nova reserva
novo check-out
nova carga de rota
```

quando aplicável.

Ao concluir:

definir explicitamente se o ativo volta a:

```text
AVAILABLE
```

ou:

```text
UNAVAILABLE
```

conforme resultado.

---

# 20. INVENTORY DASHBOARD

Aprofundar dashboard com dados reais.

Indicadores:

```text
total assets
available
reserved
in custody
in use
maintenance
unavailable
retired
overdue returns
reservations today
```

Adicionar:

```text
recent movements
current custody
overdue reservations
open maintenance
```

Somente indicadores calculáveis.

---

# 21. INVENTORY PAGES

A estrutura pode incluir:

```text
/inventory
/inventory/assets
/inventory/assets/:id
/inventory/reservations
/inventory/reservations/:id
/inventory/maintenance
```

Use rotas existentes quando possível.

Não criar rotas duplicadas.

---

# PARTE C — ROUTES

# 22. OBJETIVO DO ROUTES

O plugin Routes atual já possui conceitos como:

```text
routes
vehicles
stops
deliveries
batches
history
delay
delivery items
```

Preservar funcionalidades existentes.

Aprofundar lifecycle e execução logística.

---

# 23. ROUTE LIFECYCLE

Formalizar lifecycle equivalente a:

```text
PLANNED
READY
DISPATCHED
IN_PROGRESS
COMPLETED
CANCELLED
```

Antes de adicionar enum:

inspecione o modelo atual.

Mapeie estados existentes sempre que possível.

---

# 24. TRANSITION RULES

Definir na SPEC transições válidas.

Exemplo:

```text
PLANNED
→ READY
→ DISPATCHED
→ IN_PROGRESS
→ COMPLETED
```

Cancelamento deve obedecer regras.

Não permitir transição arbitrária.

---

# 25. ROUTE RESPONSIBILITY

Uma rota deve possuir responsável operacional.

Quando suportado pelo modelo atual:

```text
driver
responsible
vehicle
```

Não criar sistema completo de motoristas se Field Teams/Users já puderem representar a pessoa.

---

# 26. VEHICLE CAPACITY

Utilizar capacidade do veículo quando disponível.

Antes de marcar rota como READY ou DISPATCHED:

validar carga conhecida.

Exemplo:

```text
plannedLoad <= vehicleCapacity
```

Não inventar unidades incompatíveis.

Se capacidade atual for apenas quantitativa:

usar regra simples.

---

# 27. ROUTE LOAD

Integrar carga com Inventory sem assumir ownership.

Uma rota pode carregar:

```text
assets
delivery items
batches
```

Utilize contratos públicos ou relacionamentos apropriados.

Inventory continua owner dos ativos.

Routes registra apenas o vínculo logístico necessário.

---

# 28. LOAD VALIDATION

Um ativo:

```text
em manutenção
indisponível
retirado por outro responsável
em outra rota ativa
```

não deve ser carregado silenciosamente.

A validação precisa estar no backend.

---

# 29. ROUTE STOPS

Formalizar lifecycle das paradas.

Equivalente a:

```text
PENDING
ARRIVED
DELIVERED
FAILED
SKIPPED
```

Verifique estados existentes antes de criar novos.

---

# 30. STOP OPERATIONS

Permitir ações:

```text
mark arrived
mark delivered
mark failed
skip
```

Registrar:

```text
actor
timestamp
notes/reason
```

Nunca usar timestamps enviados pelo cliente como fonte autoritativa.

---

# 31. DELIVERY EXCEPTIONS

Criar representação simples de exceções.

Exemplos:

```text
recipient absent
wrong address
access blocked
vehicle problem
asset problem
delivery refused
other
```

Campos:

```text
reason
notes
actor
occurredAt
resolvedAt opcional
```

Não criar Incident automaticamente para toda exceção.

Integração futura pode existir.

---

# 32. PROOF OF DELIVERY

Implementar prova simples de entrega.

Campos possíveis:

```text
recipientName
deliveredAt
notes
actor
```

Integração com Evidence:

```text
FUTURE / optional
```

Não importar internals do Documents/Evidence.

Se já existir relação pública segura:

pode apenas armazenar `evidenceId`.

---

# 33. STOP REORDERING

Permitir reordenação segura das paradas.

Regras:

```text
não duplicar position
não deixar posições inválidas
registrar alteração relevante
```

Se rota já estiver:

```text
IN_PROGRESS
COMPLETED
```

restringir conforme SPEC.

---

# 34. DELIVERY RISK

Derivar estado operacional equivalente a:

```text
ON_TIME
AT_RISK
DELAYED
```

Basear em:

```text
scheduled time
current time
stop progress
route lifecycle
```

Não persistir se puder ser calculado.

Defina regra objetiva na SPEC.

---

# 35. ROUTES DASHBOARD

Criar visão operacional com:

```text
routes today
planned
ready
active
completed
delayed
failed stops
assets in transit
deliveries pending
```

Adicionar:

```text
routes at risk
recent exceptions
```

quando suportado.

---

# 36. ROUTE DETAIL

A página de detalhe deve mostrar algo equivalente a:

```text
summary
status
vehicle
responsible
load
stops
delivery status
exceptions
history
available actions
```

A UI deve receber ações permitidas quando isso já fizer parte do padrão do projeto.

Evite reproduzir regras de transição complexas somente no frontend.

---

# PARTE D — INTEGRAÇÃO INVENTORY ↔ ROUTES

# 37. FLUXO LOGÍSTICO

A vertical deve conseguir representar:

```text
asset disponível
→ reservado
→ check-out / custody
→ atribuído à carga
→ rota despachada
→ em trânsito
→ entregue/retornado
→ check-in
```

Não é obrigatório que cada passo mude automaticamente o domínio vizinho.

Especifique claramente quem faz o quê.

---

# 38. OWNERSHIP

Inventory continua responsável por:

```text
asset status
reservation
custody
maintenance
movement
```

Routes continua responsável por:

```text
route
vehicle
stop
delivery
logistics lifecycle
```

Uma Route não pode alterar diretamente status interno de Inventory por import físico.

Use:

```text
service público
event
API
contrato compartilhado
```

conforme arquitetura existente.

---

# 39. EVENTUAL CONSISTENCY

Se integração via Event Bus for mais consistente com a arquitetura:

utilize.

Mas não crie complexidade desnecessária.

Preferência:

```text
operação síncrona para invariantes críticas
evento para observabilidade/notificação
```

---

# PARTE E — EVENT BUS

# 40. INVENTORY EVENTS

Adicionar somente eventos relevantes ainda inexistentes.

Possíveis:

```text
inventory.reservation_created
inventory.reservation_approved
inventory.reservation_cancelled

inventory.asset_checked_out
inventory.asset_checked_in

inventory.maintenance_opened
inventory.maintenance_completed
```

Verifique o catálogo existente antes.

---

# 41. ROUTE EVENTS

Possíveis:

```text
route.ready
route.dispatched
route.started
route.completed
route.cancelled

route.stop_arrived
route.delivery_completed
route.delivery_failed
```

Não criar evento para:

```text
filtro
tab
page viewed
minor UI state
```

---

# PARTE F — AUDIT

# 42. AUDIT

Não modificar arquitetura do Audit.

O subscriber global existente deve continuar sendo usado.

Garanta payload adequado para alterações relevantes.

Evite escrita manual duplicada em:

```text
AuditEvent
```

se EventBus já gera auditoria.

---

# PARTE G — NOTIFICATIONS

# 43. NOTIFICATIONS

Adicionar somente notificações com valor operacional.

Possíveis:

```text
asset return overdue
critical maintenance opened
route delayed
delivery failed
route ready for dispatch
```

Evitar spam.

Não notificar:

```text
check-in normal
movimento rotineiro
stop arrived sem problema
```

a menos que a lógica atual justifique.

---

# PARTE H — DATABASE

# 44. SCHEMA REVIEW

Antes de criar model:

inspecione o schema atual.

Possíveis necessidades:

```text
AssetReservation
AssetCustody / AssetCheckout
AssetMaintenance

RouteException
RouteProofOfDelivery
```

Mas NÃO crie todos automaticamente.

Reutilize:

```text
AssetMovement
AssetAssignment
Delivery
DeliveryItem
RouteHistory
```

se os models existentes já cobrirem parte do fluxo.

---

# 45. NORMALIZAÇÃO

Evite tabelas redundantes.

Pergunte para cada model novo:

```text
isso representa uma entidade real?
possui lifecycle próprio?
precisa ser consultado isoladamente?
precisa preservar histórico?
```

Se não:

considere estender model existente.

---

# 46. MIGRATION

Se o schema mudar:

criar UMA nova migration desta execução quando possível.

Nome conceitual:

```text
<next-id>_logistics_operations_improvements
```

O último ID conhecido anteriormente era:

```text
202610050002_operational_intelligence_improvements
```

mas descubra o próximo ID disponível.

NÃO renomear migrations existentes.

NÃO alterar migration histórica.

NÃO executar:

```text
migrate reset
db push
```

---

# 47. BANCO REMOTO

No início e final, pode verificar:

```bash
npx prisma migrate status --schema packages/database/prisma/schema.prisma
```

No estado inicial esperado:

```text
Database schema is up to date!
```

Se uma migration nova for criada nesta execução:

NÃO aplique ao banco remoto.

Entregue no handoff:

```text
migration created: yes
migration applied: no
```

A aplicação será decidida posteriormente pelo usuário.

---

# 48. INDEXES

Adicionar apenas índices necessários às queries criadas.

Possíveis:

```text
reservation(assetId, status)
reservation(startsAt, endsAt)
maintenance(assetId, status)
route(status, scheduledAt)
routeStop(routeId, status)
exception(routeId, createdAt)
```

Verifique os índices atuais antes.

---

# PARTE I — BACKEND

# 49. AVAILABLE ACTIONS

Quando útil, backend pode devolver:

```text
availableActions
```

para:

```text
Asset
Reservation
Maintenance
Route
Stop
```

Isso reduz duplicação de lógica no frontend.

Não criar se o projeto não utiliza esse padrão no módulo.

---

# 50. SERVER AUTHORITY

O servidor deve controlar:

```text
actor
transition timestamp
status invariants
permission
availability
conflicts
```

DTO não deve aceitar livremente:

```text
actorId
createdAt
updatedAt
completedAt
```

para operações normais.

---

# PARTE J — RBAC

# 51. PERMISSIONS

Inspecione permissões existentes.

Preferência:

reutilizar:

```text
inventory.read
inventory.manage
routes.read
routes.manage
```

ou equivalentes atuais.

Não criar dezenas de permissões granulares sem necessidade.

Qualquer permissão nova deve entrar em:

```text
@eops/security
```

e no catálogo oficial.

---

# PARTE K — FRONTEND

# 52. DESIGN

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

# 53. INVENTORY UI

Priorizar:

```text
dashboard
asset list
asset detail
reservations
maintenance
custody/movements
```

Não necessariamente criar uma página por conceito se tabs no detail forem melhores.

---

# 54. ROUTES UI

Priorizar:

```text
dashboard
route list
route detail
stops
load
exceptions
delivery
history
```

---

# 55. PAGE STATES

Cada tela nova deve prever:

```text
loading
error
empty
success
```

---

# 56. RESPONSIVIDADE

Validar conceitualmente:

```text
1440px
1024px
<=760px
```

Se o agente não tiver browser controlável:

registrar:

```text
VISUAL_QA = NOT_ACTIONABLE
```

Não bloquear implementação técnica.

---

# PARTE L — TESTES

# 57. TEST STRATEGY

Use risk-based testing.

Foque regras como:

Inventory:

```text
reservation conflict
availability
check-out
check-in
maintenance blocking
overdue return
```

Routes:

```text
valid transitions
capacity
load eligibility
stop transitions
delivery risk
exception handling
reordering
```

---

# 58. NÃO TESTAR EM EXCESSO

Evite testes específicos para:

```text
CSS
DTO trivial
constante
wrapper simples
renderização puramente visual
```

Orientação:

```text
10–20 testes novos
```

Não é limite rígido.

Ultrapasse apenas se houver regras críticas realmente distintas.

---

# 59. TESTES FOCADOS

Durante desenvolvimento:

```bash
npx vitest run <arquivo relacionado>
```

ou equivalente atual.

Não executar `npm test` repetidamente.

---

# PARTE M — BUILD

# 60. BUILD PIPELINE

Existe uma correção recente em:

```text
scripts/sync-server-workspace-dist.mjs
```

Ela:

```text
publica toda a árvore runtime necessária dos plugins
preserva dist/server/index.js
serializa sync em watch
evita artefatos incompletos
```

NÃO reverta.

Ao criar código compartilhado runtime em:

```text
src/shared/**
```

garanta que o build continue funcionando a partir de:

```text
dist limpo
```

Não crie scripts de copy específicos por plugin.

---

# PARTE N — FORA DO ESCOPO

# 61. NÃO IMPLEMENTAR

Não implementar nesta execução:

```text
GPS realtime
route optimization
Google Maps API nova
machine learning
vehicle telemetry
Kafka
Redis
WebSocket infrastructure
fleet maintenance completo
fuel management
procurement
purchase orders
warehouse/WMS completo
Shift Handover
Command Center
Resource Requests
Postmortem
Business Continuity
```

---

# PARTE O — LOC

# 62. BASELINE

Registrar:

```bash
npm run count:loc
```

antes da implementação.

No final:

```bash
npm run count:loc
```

Reportar:

```text
Antes
Depois
Delta
Arquivos antes/depois
```

Não perseguir delta mínimo.

---

# PARTE P — FINAL VALIDATION

# 63. FINAL GATES

Somente ao final:

```bash
npm run spec:check
npm run check:boundaries
npm run typecheck
npm run lint
```

Depois testes focados finais.

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

Também executar:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-ap1.ps1
```

O uso de:

```text
-ExecutionPolicy Bypass
```

está autorizado somente para:

```text
scripts/check-ap1.ps1
```

Se houver migration nova:

```bash
npx prisma migrate status --schema packages/database/prisma/schema.prisma
```

deve mostrar a migration local como pendente.

Isso é esperado.

NÃO aplique.

---

# 64. GATE FAILURE STRATEGY

Se um gate falhar:

```text
identificar causa
→ corrigir
→ repetir gate afetado
→ repetir somente dependentes necessários
```

Não rode tudo do zero automaticamente.

---

# PARTE Q — DOCUMENTAÇÃO

# 65. DOCS MODULES

Atualizar documentos existentes de:

```text
Inventory
Routes
```

Use paths reais.

Se necessário, criar:

```text
docs/modules/inventory.md
docs/modules/routes.md
```

somente se não houver documentação existente.

Lembrete:

```text
SPEC = normativo
docs/modules = descritivo
```

---

# PARTE R — EXECUTION ISSUES

# 66. EXECUTION ISSUE FILE

Registrar em:

```text
docs/execution-issues/2026-10-05-logistics-operations-improvements.md
```

Somente issues reais.

Não registrar debugging trivial.

---

# 67. RECONCILIATION

No final apresentar:

| Issue | Antes | Depois | Ação | Evidência | Bloqueia próxima fase? |

Estados:

```text
open
partially-resolved
resolved
accepted-risk
not-actionable
```

---

# PARTE S — CRITÉRIOS DE ACEITAÇÃO DA SPEC

# 68. ACs MÍNIMOS

A SPEC deve conter critérios verificáveis equivalentes a:

```text
AC-01 Inventory possui lifecycle operacional explícito.

AC-02 disponibilidade do ativo considera reservation/custody/maintenance.

AC-03 reservas possuem validação de conflito.

AC-04 check-out registra custódia e responsável.

AC-05 check-in registra condição de retorno.

AC-06 ativo com manutenção ativa não é tratado como disponível.

AC-07 manutenção possui lifecycle simples.

AC-08 Inventory informa custódia atual e histórico.

AC-09 Routes possui lifecycle operacional explícito.

AC-10 transições inválidas de Route são rejeitadas.

AC-11 capacidade/carga é validada quando aplicável.

AC-12 ativo incompatível não pode entrar silenciosamente em carga ativa.

AC-13 RouteStop possui lifecycle operacional.

AC-14 falha de entrega registra reason, actor e timestamp.

AC-15 proof of delivery possui registro mínimo verificável.

AC-16 reordenação de stops preserva consistência.

AC-17 estado ON_TIME/AT_RISK/DELAYED é derivado por regra objetiva.

AC-18 Inventory continua owner do Asset.

AC-19 Routes continua owner da Route.

AC-20 integração não utiliza imports internos cross-plugin.

AC-21 Event Bus recebe apenas eventos relevantes.

AC-22 Audit continua utilizando infraestrutura global existente.

AC-23 Notifications não geram spam para operações rotineiras.

AC-24 migrations históricas permanecem intactas.

AC-25 migration nova não é aplicada automaticamente ao banco remoto.

AC-26 regras críticas possuem testes focados.

AC-27 full suite passa ao final.

AC-28 build funciona a partir dos artefatos atuais sem depender de dist stale.

AC-29 LOC antes/depois é reportada sem crescimento artificial.
```

---

# PARTE T — HANDOFF

# 69. HANDOFF FINAL

Seja objetivo.

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
LOC
arquivos
última migration
migrate status inicial
```

## Inventory

Resumo:

```text
lifecycle
reservations
custody
check-out/check-in
maintenance
dashboard
```

## Routes

Resumo:

```text
lifecycle
capacity/load
stops
exceptions
proof of delivery
risk
dashboard
```

## Integration

Explique claramente ownership e integração.

## Database

```text
models adicionados
campos alterados
enums
índices
migration
aplicada? NÃO
```

## Events / Notifications

Somente novos itens.

## Tests

```text
focused
novos
full suite
```

## Validation

Tabela:

```text
spec:check
boundaries
typecheck
lint
focused tests
npm test
build
db:validate
check-ap1
git diff --check
```

## LOC

```text
Antes
Depois
Delta
```

## Execution Issues

Tabela de reconciliation.

## SPEC Compliance

```text
PASS
PARTIAL
BLOCKED
```

## Git

Mostrar:

```text
SPEC commit
working tree
```

NÃO fazer commits de implementação.

Sugerir divisão de commits.

---

# 70. SUGESTÃO DE COMMITS PARA O HANDOFF

Não executar, apenas sugerir algo próximo de:

```text
feat(logistics): add inventory and route domain contracts

feat(inventory): add reservations, custody and maintenance operations

feat(routes): add route execution, delivery lifecycle and logistics risk

docs(logistics): document inventory and routes improvements
```

Todos os commits funcionais devem usar:

```text
Agent: claude/deepseek-flash-1m
Spec: SPEC/2026-10-05-logistics-operations-improvements.md
```

---

# 71. CRITÉRIO FINAL DE SUCESSO

Ao fim desta execução, a plataforma deve conseguir responder:

```text
Inventory
→ quais ativos estão realmente disponíveis?
→ quem está com cada ativo?
→ quais estão reservados?
→ quais precisam voltar?
→ quais estão em manutenção?

Routes
→ quais rotas estão prontas?
→ quais estão em execução?
→ o que cada rota transporta?
→ quais entregas falharam?
→ quais rotas estão atrasadas?
→ onde estão os ativos em trânsito?
```

O fluxo final desejado é:

```text
Disponibilidade
→ Reserva
→ Custódia
→ Carga
→ Despacho
→ Transporte
→ Entrega
→ Retorno
```

com regras reais de negócio, histórico verificável, RBAC, Audit/Event Bus existentes, testes focados e sem duplicar ownership entre plugins.