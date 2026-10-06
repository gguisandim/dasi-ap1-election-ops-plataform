Você está trabalhando no monorepo **Election Ops Platform**.

Esta execução implementará um NOVO plugin:

```text
SHIFT HANDOVER / PASSAGEM DE TURNO
```

Plugin esperado:

```text
plugins/operations/shift-handovers
```

Package esperado:

```text
@eops/plugin-shift-handovers
```

Objetivo:

criar o domínio formal de transferência de contexto operacional entre turnos, operadores ou equipes, sem duplicar responsabilidades de:

```text
Shifts
Field Teams
Tasks
Incidents
Inventory
Access Control
Notifications
Audit
```

A passagem deve consolidar o contexto necessário para que a próxima pessoa responsável continue a operação sem perda de informação.

Fluxo principal:

```text
Turno em andamento
      ↓
criação do rascunho
      ↓
seleção do contexto operacional
      ↓
resumo / pendências
      ↓
envio
      ↓
PENDING_CONFIRMATION
      ↓
confirmação pelo destinatário
      ↓
CONFIRMED
```

---

# 0. ESTADO ATUAL DO REPOSITÓRIO

Considere exclusivamente o estado ATUAL do repositório como baseline.

O snapshot conhecido no início desta solicitação possui aproximadamente:

```text
62.741 LOC
643 arquivos
22 plugins
22 migrations
```

Esse valor de LOC é apenas referência.

Execute:

```bash
npm run count:loc
```

e use o resultado realmente encontrado.

As últimas evoluções já implementadas incluem:

```text
Administration / Work Improvements
Operational Intelligence Improvements
Logistics Operations Improvements
```

Ou seja, já existem versões aprofundadas de:

```text
Access Control
Tasks
Preparation Checklists
Transmission
Operational Map
Simulator
Reports
Inventory
Routes
```

NÃO reverta, simplifique ou redesenhe esses módulos.

---

# 1. CONTEXTO HISTÓRICO DO HANDOVER

Existe documentação descritiva em:

```text
docs/modules/shift-handover.md
```

Essa documentação NÃO é uma SPEC normativa.

Também existem diversas referências históricas indicando explicitamente que Shift Handover deve permanecer separado de Shifts.

Entre elas:

```text
SPEC/2026-10-03-shifts-schedules.md
SPEC/2026-10-04-workforce-operations-part-1.md
SPEC/2026-10-04-workforce-operations-part-2.md
SPEC/2026-10-04-agent-governance-and-spec-enforcement.md
```

A auditoria histórica já concluiu que:

```text
há documentação
há referências
NÃO há implementação atual
NÃO há SPEC normativa própria válida
```

Portanto:

```text
SPEC Gate = NEW_SPEC
```

NÃO tente recuperar implementação antiga.

NÃO crie SPEC retroativa.

Esta é a primeira implementação válida do domínio no estado atual.

---

# 2. PROMPT REGISTRATION

Salvar este prompt literalmente em:

```text
prompts/sessoes/2026-10-05-shift-handover.md
```

Não resumir.

Não substituir depois pelo handoff.

---

# 3. PREFLIGHT

Executar:

```bash
git status --short
git log --oneline -12
npm run spec:check -- HEAD
npm run check:boundaries
npm run count:loc
```

Também verificar:

```bash
npx prisma migrate status --schema packages/database/prisma/schema.prisma
```

Inspecionar:

```text
docs/modules/shift-handover.md

plugins/operations/shifts
plugins/operations/tasks
plugins/operations/field-teams
plugins/monitoring/incidents
plugins/logistics/inventory

packages/database/prisma/schema.prisma
packages/security/src/permissions.ts
packages/event-bus/src/contracts.ts
plugins/system/notifications
apps/api/src/app.module.ts
apps/web/src/pluginRegistry.ts
```

Não carregar módulos grandes não relacionados.

---

# 4. EXECUTION ISSUES

Revise issues existentes apenas se forem relevantes.

Classifique:

```text
BLOCKS_CURRENT_TASK
RELATED_NON_BLOCKING
OUT_OF_SCOPE
```

Não reabra automaticamente problemas históricos já resolvidos.

Se:

```text
prisma migrate status
```

mostrar banco atualizado:

não registrar novamente a antiga divergência de Resource Planning.

Se houver falha transitória do datasource:

registrar apenas se impedir validação necessária.

---

# 5. SPEC

Criar:

```text
SPEC/2026-10-05-shift-handover.md
```

A SPEC deve ser derivada de:

```text
docs/modules/shift-handover.md
+
arquitetura atual
+
modelos atuais
+
regras atuais dos plugins integrados
```

A SPEC é normativa.

O documento em `docs/modules/` permanece descritivo.

---

# 6. COMMIT OBRIGATÓRIO DA SPEC

Este prompt autoriza explicitamente SOMENTE:

```text
git add SPEC/2026-10-05-shift-handover.md
```

e o commit exclusivo dessa SPEC.

Mensagem:

```text
docs(spec): define shift handover operations
```

Trailers:

```text
Agent: Codex
Spec: SPEC/2026-10-05-shift-handover.md
```

Se estiver executando com outro agente, use seu identificador real desde que compatível com:

```text
[A-Za-z0-9._-]
```

Antes do commit:

```bash
git diff --cached --name-only
```

deve mostrar SOMENTE:

```text
SPEC/2026-10-05-shift-handover.md
```

Se o ambiente exigir execução escalada para o Git:

esta mensagem autoriza execução escalada SOMENTE para o `git add` da SPEC e esse commit exclusivo.

Nenhum outro commit está autorizado.

Depois do commit da SPEC:

prossiga diretamente com a implementação.

---

# 7. OWNERSHIP

Defina explicitamente:

```text
Shifts
→ owner do turno, assignments, presença, ausência, cobertura e lifecycle do turno

Shift Handover
→ owner da transferência formal de contexto entre responsáveis

Tasks
→ owner de Task

Incidents
→ owner de Incident

Inventory
→ owner de Asset

Field Teams
→ owner de equipes e membros

Users / Access Control
→ owner da identidade autenticada
```

Shift Handover NÃO deve:

```text
criar turno
editar turno
concluir turno
alterar Task
resolver Incident
alterar Asset
alterar disponibilidade de FieldMember
```

Ele apenas referencia essas entidades.

---

# 8. PLUGIN

Criar um plugin real e isolado:

```text
plugins/operations/shift-handovers/
```

Estrutura seguindo os plugins atuais:

```text
package.json
src/
  index.ts
  manifest.ts
  types.ts ou shared/
  client/
  server/
```

Exports públicos:

```text
.
./server
```

seguindo o mesmo padrão de Shifts, Tasks e demais plugins.

Não importar:

```text
@eops/plugin-x/src/**
```

de nenhum outro workspace.

---

# 9. MANIFEST

Sugestão:

```text
id: shift-handovers
name: Passagem de Turno
shortName: Passagens
category: operations
navigationGroup: planning
navigationIcon: scroll-text
route: /shift-handovers
permissions:
  shift-handovers.read
```

Use uma `navigationOrder` coerente após Shifts.

Não reorganize todo o menu.

---

# 10. REGISTRO DO PLUGIN

Registrar:

```text
apps/web/src/pluginRegistry.ts
```

e módulo server em:

```text
apps/api/src/app.module.ts
```

usando apenas entrypoints públicos:

```text
@eops/plugin-shift-handovers
@eops/plugin-shift-handovers/server
```

---

# 11. MODELO PRINCIPAL

Criar entidade equivalente a:

```text
ShiftHandover
```

Campos conceituais:

```text
id

shiftId

senderUserId
recipientUserId

summary
pendingNotes
observations

status

submittedAt
confirmedAt
cancelledAt
cancellationReason

createdAt
updatedAt
```

O naming final deve seguir os padrões atuais.

Não persistir:

```text
electionId
zoneId
pollingPlaceId
teamId
```

se puderem ser obtidos de maneira confiável através do turno.

O turno atual já possui:

```text
team
team.electionId
electoralZoneId
pollingPlaceId
```

Evite redundância sem justificativa.

---

# 12. STATUS

Criar lifecycle:

```text
DRAFT
PENDING_CONFIRMATION
CONFIRMED
CANCELLED
```

Transições válidas:

```text
DRAFT
→ PENDING_CONFIRMATION
→ CONFIRMED
```

e:

```text
DRAFT
→ CANCELLED

PENDING_CONFIRMATION
→ CANCELLED
```

Não permitir:

```text
CONFIRMED → DRAFT
CONFIRMED → PENDING_CONFIRMATION
CONFIRMED → CANCELLED
CANCELLED → qualquer outro estado
```

salvo se a SPEC justificar explicitamente comportamento diferente.

---

# 13. RELAÇÃO COM SHIFT

Toda passagem deve estar vinculada a:

```text
FieldShift
```

O turno é o contexto operacional de origem.

Não criar cópia do turno.

A criação de uma passagem NÃO altera o status do turno.

A confirmação da passagem NÃO conclui automaticamente o turno.

A conclusão do turno NÃO confirma automaticamente uma passagem.

Esses lifecycles são independentes.

---

# 14. PRISMA — RELAÇÕES REVERSAS

Há histórico no projeto de problemas com relações reversas de Handover.

Portanto, ao adicionar relações Prisma:

garanta explicitamente os dois lados.

Exemplo conceitual:

```text
FieldShift
  handovers ShiftHandover[]
```

ou relações nomeadas adequadamente.

Mesma regra para:

```text
User sender
User recipient
User confirmer, se houver relação separada
```

Não deixe relação Prisma unilateral/incompleta.

---

# 15. SENDER

O usuário autenticado deve ser a fonte autoritativa do ator.

DTO NÃO deve aceitar livremente:

```text
senderUserId
actorId
createdAt
submittedAt
confirmedAt
```

Na criação:

```text
sender = usuário autenticado
```

O servidor define os timestamps.

---

# 16. RECIPIENT

A passagem formal deve possuir um destinatário:

```text
recipientUserId
```

O destinatário deve:

```text
existir
estar ACTIVE
```

Não aceitar usuário:

```text
INACTIVE
LOCKED
```

para uma nova entrega.

Não criar uma entidade de operador paralela.

---

# 17. FIELD MEMBERS / TEAMS

FieldTeam e FieldMember podem ser exibidos como contexto do turno.

Não é obrigatório transformar FieldMember em User.

O modelo atual não possui equivalência direta obrigatória:

```text
FieldMember ↔ User
```

Portanto não invente essa associação.

O destinatário formal da confirmação deve utilizar:

```text
User
```

porque é a identidade autenticada.

---

# 18. INCIDENT REFERENCES

Uma passagem pode relacionar vários:

```text
Incident
```

Criar uma relação normalizada, por exemplo:

```text
ShiftHandoverIncident
```

com:

```text
handoverId
incidentId
createdAt
```

Usar unique constraint:

```text
handoverId + incidentId
```

Não duplicar dados completos do incidente.

---

# 19. TASK REFERENCES

Mesma abordagem:

```text
ShiftHandoverTask
```

com referência a:

```text
Task
```

Sem duplicar Task.

Unique:

```text
handoverId + taskId
```

---

# 20. ASSET REFERENCES

Mesma abordagem para ativos:

```text
ShiftHandoverAsset
```

referenciando:

```text
Asset
```

Unique:

```text
handoverId + assetId
```

Não duplicar Inventory.

---

# 21. CONTEXTO AUTOMÁTICO

Criar endpoint de contexto para auxiliar a criação da passagem.

Exemplo:

```text
GET /shift-handovers/context?shiftId=<id>
```

Ele deve carregar candidatos baseados no turno.

Determinar:

```text
election
zone
polling place
team
```

a partir de:

```text
FieldShift
→ FieldTeam
→ Election
```

e dos IDs de zone/place existentes no Shift.

---

# 22. INCIDENTES SUGERIDOS

Priorizar incidentes:

```text
mesmo pleito
mesma zona/local quando aplicável
não encerrados
```

Excluir normalmente:

```text
CLOSED
CANCELLED
```

e avaliar conforme semântica atual se:

```text
RESOLVED
```

ainda deve aparecer ou não.

Ordenar por relevância operacional:

```text
CRITICAL
HIGH
MEDIUM
LOW
```

e antiguidade/SLA quando aplicável.

---

# 23. TASKS SUGERIDAS

Priorizar:

```text
PENDING
IN_PROGRESS
BLOCKED
```

do mesmo contexto operacional.

Dar maior destaque a:

```text
CRITICAL
HIGH
overdue
BLOCKED
```

Não incluir automaticamente tarefas concluídas/canceladas.

---

# 24. ASSETS SUGERIDOS

Priorizar ativos que exijam atenção.

Exemplos atuais:

```text
status:
MAINTENANCE
LOST

condition:
DAMAGED
UNAVAILABLE
ATTENTION
```

Também considerar manutenção ativa ou custody problemática quando os dados atuais permitirem.

Não incluir todo o inventário indiscriminadamente.

---

# 25. ASSOCIAÇÃO MANUAL

O contexto automático apenas SUGERE.

O usuário decide quais entidades serão relacionadas à passagem.

Não associe automaticamente todos os incidentes/tasks/assets retornados.

---

# 26. DRAFT

Enquanto:

```text
status = DRAFT
```

permitir alteração de:

```text
summary
pendingNotes
observations
recipient
incident references
task references
asset references
```

Registrar alterações relevantes em histórico.

---

# 27. SUBMIT

Endpoint conceitual:

```text
POST /shift-handovers/:id/submit
```

Para enviar, validar no servidor:

```text
handover existe
status = DRAFT
sender autorizado
shift existe
shift não está CANCELLED
recipient existe e está ACTIVE
summary não vazio
referências ainda existem
```

Além disso:

permitir envio apenas quando o turno estiver em estado operacional compatível.

Preferência:

```text
IN_PROGRESS
COMPLETED
```

Não enviar formalmente handover de turno:

```text
SCHEDULED
CANCELLED
```

sem justificativa explícita na SPEC.

Ao enviar:

```text
status = PENDING_CONFIRMATION
submittedAt = server time
```

Depois do envio:

bloquear edição do conteúdo principal.

---

# 28. CONFIRMATION

Endpoint:

```text
POST /shift-handovers/:id/confirm
```

Requisitos:

```text
status = PENDING_CONFIRMATION
usuário autenticado possui shift-handovers.confirm
usuário autenticado = recipientUserId
```

Não permitir:

```text
confirmação duplicada
confirmação de CANCELLED
confirmação de CONFIRMED
confirmação por usuário arbitrário
```

Não crie bypass administrativo artificial se o projeto ainda não possui semântica clara para isso.

Se não houver regra administrativa existente:

somente o destinatário confirma.

Ao confirmar:

```text
status = CONFIRMED
confirmedAt = server time
```

Se persistir `confirmedById`:

ele deve vir da sessão.

---

# 29. CANCEL

Endpoint:

```text
POST /shift-handovers/:id/cancel
```

Permitir somente quando:

```text
DRAFT
PENDING_CONFIRMATION
```

Motivo obrigatório para passagem já enviada.

Não cancelar `CONFIRMED`.

Registrar ator e timestamp.

---

# 30. HISTORY

Criar:

```text
ShiftHandoverHistory
```

ou estrutura equivalente.

Registrar ações relevantes:

```text
CREATED
UPDATED
INCIDENT_ADDED
INCIDENT_REMOVED
TASK_ADDED
TASK_REMOVED
ASSET_ADDED
ASSET_REMOVED
SUBMITTED
CONFIRMED
CANCELLED
```

Campos:

```text
handoverId
actorId
action
description
metadata?
createdAt
```

Não usar history como substituto do Event Bus.

---

# 31. AVAILABLE ACTIONS

No detalhe backend, derivar:

```text
availableActions
```

considerando:

```text
status
RBAC
sender
recipient
```

Exemplos:

```text
edit
submit
confirm
cancel
```

O frontend não deve reconstruir sozinho toda a regra.

---

# 32. API

Estrutura mínima sugerida:

```text
GET    /shift-handovers/dashboard
GET    /shift-handovers
GET    /shift-handovers/context
POST   /shift-handovers

GET    /shift-handovers/:id
PATCH  /shift-handovers/:id

POST   /shift-handovers/:id/submit
POST   /shift-handovers/:id/confirm
POST   /shift-handovers/:id/cancel
```

Referências podem ser atualizadas:

```text
via PATCH transacional
```

ou endpoints específicos.

Escolha a abordagem mais consistente com o código atual.

Evite dezenas de endpoints triviais.

---

# 33. DASHBOARD

Criar indicadores derivados:

```text
drafts
pending confirmation
confirmed today
recent handovers
pending for current user
```

Destacar:

```text
passagens aguardando MINHA confirmação
```

Não inventar SLA arbitrário de handover.

Pode mostrar idade:

```text
submittedAt → now
```

sem transformar automaticamente em overdue.

---

# 34. LIST

Criar filtros:

```text
shift
status
sender
recipient
election
period
```

Pleito pode ser filtrado através da relação:

```text
handover
→ shift
→ team
→ election
```

Não persistir electionId apenas para facilitar filtro se não for necessário.

---

# 35. DETAIL

Página de detalhes deve apresentar:

```text
turno
equipe
período do turno
remetente
destinatário
status
summary
pending notes
observations

incidents
tasks
assets

submittedAt
confirmedAt

history
available actions
```

Cada entidade relacionada deve possuir deep link para sua página atual quando houver rota disponível.

---

# 36. CREATE / EDIT UI

Criar fluxo que facilite:

```text
selecionar turno
definir destinatário
escrever resumo
ver contexto sugerido
selecionar incidents
selecionar tasks
selecionar assets
registrar pendências
revisar
salvar draft
enviar
```

Não criar uma tela gigantesca sem organização.

Use seções/cards/tabs conforme UI atual.

---

# 37. ROTAS FRONTEND

Sugestão:

```text
/shift-handovers
/shift-handovers/list
/shift-handovers/new
/shift-handovers/:id
/shift-handovers/:id/edit
```

Se uma rota separada de edição não for necessária:

usar detail/edit coerente com padrão existente.

---

# 38. DEEP LINK COM SHIFTS

Shift Handover deve sempre fornecer link para:

```text
/shifts/:id
```

Não é necessário modificar Shifts para implementar essa integração.

Se adicionar algum link pequeno no detalhe de Shift:

faça somente por rota pública, sem importar código interno do plugin Handover.

Essa alteração é opcional.

---

# 39. RBAC

Adicionar:

```text
shift-handovers.read
shift-handovers.manage
shift-handovers.confirm
```

em:

```text
packages/security/src/permissions.ts
```

e no catálogo oficial:

```text
PLATFORM_PERMISSION_KEYS
```

Sem strings arbitrárias paralelas.

Sem inventar dezenas de permissões.

---

# 40. SEMÂNTICA RBAC

```text
read
→ dashboard/list/detail/context

manage
→ create/edit/submit/cancel/references

confirm
→ confirmação
```

Confirmação exige simultaneamente:

```text
permission
+
recipient identity
```

quando não houver override administrativo existente.

---

# 41. SEED / ROLES

Verifique como permissões atuais são distribuídas no seed.

Admin deve receber as novas permissões conforme padrão existente.

Não reestruture RBAC.

Não criar role específica de Handover sem necessidade.

---

# 42. EVENT BUS

Adicionar contratos tipados:

```text
shift_handover.created
shift_handover.submitted
shift_handover.confirmed
shift_handover.cancelled
```

Payload mínimo deve carregar:

```text
entityId
actorId
shiftId
senderUserId
recipientUserId
```

Conforme evento, incluir:

```text
submittedAt
confirmedAt
reason
```

quando útil.

Não publicar evento por:

```text
page view
filtro
draft keystroke
context query
```

---

# 43. AUDIT

NÃO alterar arquitetura de Audit.

Audit já utiliza:

```text
EventBus subscribeAll
```

Eventos relevantes devem ser suficientes para rastreabilidade global.

O histórico interno do Handover complementa Audit.

Não duplicar gravação manual em:

```text
AuditEvent
```

---

# 44. NOTIFICATIONS

Handover é um caso em que notificação DEVE ser direcionada.

Principal evento:

```text
shift_handover.submitted
```

deve notificar:

```text
recipientUserId
```

e NÃO todos os usuários que possuem `shift-handovers.read`.

Ao confirmar:

```text
shift_handover.confirmed
```

pode notificar:

```text
senderUserId
```

Cancelamento pode notificar a contraparte quando relevante.

---

# 45. TARGETED NOTIFICATION

O NotificationSubscriber atual normalmente resolve público por permissão.

Para Handover:

faça a menor extensão possível para suportar o destinatário explícito presente no payload.

Preservar:

```text
User ACTIVE
notification preferences
required permission
```

Não redesenhar Notifications.

Não criar novo sistema paralelo de notificações.

Adicionar os eventos relevantes ao catálogo existente.

---

# 46. REQUIRED PERMISSION FOR EVENT

Como o prefixo novo será:

```text
shift_handover.
```

garanta que:

```text
requiredPermissionForEvent(...)
```

resolva corretamente para:

```text
shift-handovers.read
```

Não confundir com:

```text
shift.
→ shifts.read
```

São domínios diferentes.

---

# 47. DATABASE

Modelos conceituais esperados:

```text
ShiftHandover
ShiftHandoverIncident
ShiftHandoverTask
ShiftHandoverAsset
ShiftHandoverHistory
```

Pode ajustar a modelagem se houver solução mais simples e equivalente.

Não criar entidades redundantes.

---

# 48. ENUMS

Prováveis:

```text
ShiftHandoverStatus

ShiftHandoverHistoryAction
```

Use enum somente onde houver valor de domínio real.

---

# 49. MIGRATION

Última migration conhecida no snapshot:

```text
202610050003_logistics_operations_improvements
```

NÃO presuma que o próximo número esteja livre.

Inspecione o diretório primeiro.

Se estiver livre, o nome natural é:

```text
202610050004_shift_handover
```

ou equivalente.

Criar migration NOVA.

Nunca alterar migration histórica.

---

# 50. MIGRATION REMOTA

NÃO aplicar a migration automaticamente ao banco remoto.

Entregar:

```text
Migration criada: sim
Migration aplicada: não
```

O usuário decide posteriormente quando executar deploy.

---

# 51. PRISMA GENERATE

Pode gerar Prisma Client para validação local.

Se ocorrer o `EPERM` histórico no Windows:

usar apenas o contorno já adotado pelo projeto.

Não alterar schema por causa de file lock.

---

# 52. INTEGRITY RULES

Validar no servidor:

```text
shift existe
recipient existe
recipient ativo
summary obrigatório para submit
handover em status adequado
reference ids existentes
sem referências duplicadas
incident/task/asset compatíveis com election context quando aplicável
```

Não permitir associar silenciosamente entidade de outro pleito quando isso for incompatível com o turno.

---

# 53. CONTEXT COMPATIBILITY

Para Incident e Task:

validar pelo menos:

```text
entity.electionId == shift.team.electionId
```

Para zone/place:

quando a referência possui contexto incompatível com o turno:

rejeitar associação ou exigir regra explicitamente documentada.

Não aplicar comparação de contexto impossível para Asset sem verificar seu modelo real.

---

# 54. TRANSACTIONS

Usar transação em operações que envolvam:

```text
state transition
history
reference changes
events após persistência
```

Não deixar:

```text
status alterado
history ausente
```

por falha parcial.

EventBus deve ser emitido após persistência bem-sucedida.

---

# 55. FRONTEND STATES

Todas as novas páginas devem tratar:

```text
loading
error
empty
success
```

A confirmação deve possuir feedback claro.

Não ocultar erro de regra de negócio.

---

# 56. DESIGN

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

# 57. RESPONSIVIDADE

Considerar:

```text
1440px
1024px
<=760px
```

Se browser controlável não estiver disponível:

```text
VISUAL_QA = NOT_ACTIONABLE
```

Não bloquear implementação técnica por isso.

---

# 58. TEST STRATEGY

Use risk-based testing.

Não criar testes apenas por quantidade.

Orientação:

```text
12–20 novos testes
```

pode ultrapassar apenas se houver regras críticas distintas.

---

# 59. TESTES CRÍTICOS

Cobrir principalmente:

### Creation

```text
criação usa sender da sessão
recipient inválido/inativo rejeitado
```

### Submit

```text
draft válido → pending
sem summary → reject
sem recipient → reject
shift cancelado/scheduled incompatível → reject
```

### Confirmation

```text
recipient + permission → confirmed
outro usuário → reject
segunda confirmação → reject
cancelled → reject
```

### References

```text
duplicata → reject/prevent
entidade de outro election → reject
```

### Cancellation

```text
draft/pending permitido
confirmed proibido
```

### Context

```text
incidents ativos corretos
tasks pendentes corretas
assets problemáticos corretos
```

### Notification

```text
submitted notifica destinatário
não broadcast para todos
preference disabled respeitada
```

---

# 60. NÃO TESTAR EM EXCESSO

Evitar testes para:

```text
CSS
DTO simples
constantes
wrapper
ícone
texto estático
```

Durante implementação:

```bash
npx vitest run <focused files>
```

NÃO rodar `npm test` após cada mudança.

---

# 61. BUILD PIPELINE

Preservar a correção atual de:

```text
scripts/sync-server-workspace-dist.mjs
```

O build atual publica runtime compartilhado corretamente.

Não reverta.

Não crie copy script exclusivo para Handover.

---

# 62. FORA DO ESCOPO

NÃO implementar nesta execução:

```text
Command Center
Situation Room
Resource Requests
Postmortem / RCA
Business Continuity
On-call Management novo
chat realtime
WebSockets
Redis
Kafka
AI summary
LLM-generated handover
speech-to-text
GPS
```

Também NÃO redesenhar:

```text
Shifts
Tasks
Incidents
Inventory
Field Teams
Access Control
```

---

# 63. LOC

Antes:

```bash
npm run count:loc
```

Depois:

```bash
npm run count:loc
```

Reportar:

```text
Arquivos antes
Arquivos depois
LOC antes
LOC depois
Delta
```

Não perseguir delta mínimo.

Não criar padding.

---

# 64. FINAL VALIDATION

Somente no final:

```bash
npm run spec:check
npm run check:boundaries
npm run typecheck
npm run lint
```

Depois testes focados finais.

Depois UMA vez:

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

E:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-ap1.ps1
```

Este prompt autoriza `-ExecutionPolicy Bypass` SOMENTE para:

```text
scripts/check-ap1.ps1
```

---

# 65. MIGRATE STATUS FINAL

Se foi criada migration nova:

executar:

```bash
npx prisma migrate status --schema packages/database/prisma/schema.prisma
```

O estado esperado é a migration nova aparecer como ainda não aplicada.

Isso NÃO é falha.

Não executar:

```text
migrate deploy
migrate reset
db push
```

---

# 66. GATE FAILURE STRATEGY

Se um gate falhar:

```text
identificar causa
→ corrigir
→ repetir somente o gate afetado
→ executar dependentes necessários
```

Não rodar toda a sequência repetidamente.

---

# 67. DOCUMENTAÇÃO

Atualizar:

```text
docs/modules/shift-handover.md
```

somente onde necessário para refletir a implementação real.

Não transformar o documento descritivo em segunda SPEC.

A SPEC é a fonte normativa.

---

# 68. EXECUTION ISSUES

Criar:

```text
docs/execution-issues/2026-10-05-shift-handover.md
```

somente se existirem issues reais.

Não registrar debugging trivial.

No handoff:

| Issue | Antes | Depois | Ação | Evidência | Bloqueia próxima fase? |

---

# 69. CRITÉRIOS DE ACEITAÇÃO DA SPEC

A SPEC deve possuir critérios verificáveis equivalentes a:

```text
AC-01 Existe plugin independente Shift Handover.

AC-02 Handover referencia FieldShift existente e não duplica turno.

AC-03 sender é derivado da sessão autenticada.

AC-04 recipient deve existir e estar ACTIVE.

AC-05 lifecycle é DRAFT → PENDING_CONFIRMATION → CONFIRMED.

AC-06 estados terminais não admitem transições inválidas.

AC-07 envio exige summary e recipient.

AC-08 confirmação exige permission + identidade do destinatário.

AC-09 confirmação duplicada é rejeitada.

AC-10 passagem confirmada não pode ser cancelada.

AC-11 incidents são referências, não cópias.

AC-12 tasks são referências, não cópias.

AC-13 assets são referências, não cópias.

AC-14 referências duplicadas são impedidas.

AC-15 contexto automático sugere entities compatíveis com o turno.

AC-16 usuário decide quais sugestões associar.

AC-17 histórico registra alterações operacionais relevantes.

AC-18 dashboard mostra pendências destinadas ao usuário atual.

AC-19 listagem suporta filtros operacionais.

AC-20 detalhe expõe availableActions calculadas no backend.

AC-21 Shift Handover não altera lifecycle de Shift automaticamente.

AC-22 Shift Handover não altera Task/Incident/Asset.

AC-23 permissões read/manage/confirm pertencem ao catálogo oficial.

AC-24 Event Bus possui eventos tipados do domínio.

AC-25 submitted gera notificação direcionada ao recipient.

AC-26 submitted NÃO gera broadcast geral para todos os usuários com read.

AC-27 Audit continua utilizando subscriber global.

AC-28 nenhum import interno cross-plugin é introduzido.

AC-29 relações Prisma possuem lados reversos válidos.

AC-30 migration histórica não é alterada.

AC-31 migration nova não é aplicada automaticamente ao banco remoto.

AC-32 regras críticas possuem testes focados.

AC-33 full suite passa no final.

AC-34 build funciona a partir do estado atual.

AC-35 LOC antes/depois é reportado sem crescimento artificial.
```

---

# 70. HANDOFF FINAL

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

## Plugin

```text
package
manifest
frontend routes
backend routes
```

## Domain

```text
model
lifecycle
sender
recipient
submit
confirm
cancel
```

## Operational Context

```text
incidents
tasks
assets
automatic suggestions
```

## RBAC

```text
read
manage
confirm
```

## Event Bus

Listar apenas novos eventos.

## Notifications

Explicar explicitamente:

```text
quem recebe submitted
quem recebe confirmed
como preferences/RBAC são respeitados
```

## Database

```text
models
enums
relations
indexes
migration
migration applied? NÃO
```

## Tests

```text
focused
new tests
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

Tabela.

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

NÃO fazer commits adicionais.

---

# 71. SUGESTÃO DE COMMITS

No handoff, apenas sugerir.

Provável divisão:

```text
feat(handover): add shift handover domain contracts and persistence

feat(handover): add draft submission confirmation and history workflow

feat(handover): add operational context dashboard and user interface

feat(notifications): add targeted shift handover notifications

docs(handover): document shift handover implementation
```

Todos os commits funcionais:

```text
Agent: Codex
Spec: SPEC/2026-10-05-shift-handover.md
```

NÃO executá-los.

---

# 72. CRITÉRIO FINAL DE SUCESSO

Ao final, a plataforma deve conseguir responder claramente:

```text
Qual turno está sendo entregue?

Quem está entregando?

Quem precisa receber?

Qual é o estado atual da operação?

Quais incidentes continuam relevantes?

Quais tarefas continuam pendentes?

Quais equipamentos precisam de atenção?

Quais pendências textuais precisam continuar sendo acompanhadas?

A passagem já foi formalmente enviada?

Quem confirmou o recebimento?

Quando confirmou?

Qual foi o histórico da transferência?
```

O resultado deve representar uma passagem operacional formal, auditável e integrada ao restante da plataforma, sem transformar Shift Handover em uma cópia de Shifts, Tasks, Incidents ou Inventory.
