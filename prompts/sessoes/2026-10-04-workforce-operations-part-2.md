Você está trabalhando no monorepo **Election Ops Platform**.

Esta é a **Parte 2 da vertical Workforce Operations**.

A Parte 1 estabeleceu:

```text
Field Teams
= workforce, membros, skills, capabilities e disponibilidade

Shifts
= turnos, assignments, cobertura, conflitos e lifecycle
```

Nesta execução o objetivo é criar a camada de **execução operacional em campo**:

```text
planejamento
   ↓
turno
   ↓
disponibilidade
   ↓
demanda/tarefa/incidente
   ↓
despacho
   ↓
aceite
   ↓
deslocamento
   ↓
chegada
   ↓
execução
   ↓
conclusão
```

Plugins principais:

```text
plugins/operations/field-teams
plugins/operations/tasks
```

Shifts pode ser consultado através de seus contratos públicos, mas não deve ser novamente redesenhado nesta execução.

---

# 0. Otimização obrigatória para execução com DeepSeek

Esta tarefa deve priorizar:

```text
implementação
→ validação focada
→ implementação
→ validação focada
→ validação completa somente no final
```

NÃO execute a suíte completa repetidamente durante o desenvolvimento.

NÃO rode:

```text
npm test
npm run build
npm run typecheck
```

após cada arquivo ou pequena alteração.

Durante implementação use apenas:

```text
testes do serviço/regra alterada
typecheck somente quando necessário para integração
```

A suíte completa será executada UMA VEZ no Validation Gate final, salvo falha que exija uma segunda execução após correção.

Objetivo:

> reduzir tempo e tokens sem reduzir confiança nas regras críticas.

---

# 1. Política de testes desta execução

Use abordagem **risk-based testing**.

Crie testes somente para:

- regras de negócio;
- transições de estado;
- permissões;
- ownership;
- conflitos;
- cálculos;
- Event Bus;
- persistência importante;
- casos negativos relevantes.

NÃO criar teste unitário para:

- componente puramente visual;
- getter trivial;
- DTO sem lógica;
- wrapper simples;
- função que apenas encaminha chamada;
- constante;
- renderização estática sem comportamento;
- CSS.

Não duplicar a mesma regra em controller test + service test + helper test se uma camada já fornece cobertura suficiente.

Meta orientativa, NÃO obrigatória:

```text
8–15 novos testes focados
```

Pode ultrapassar somente quando houver regras críticas distintas.

Não perseguir quantidade de testes.

---

# 2. Estratégia de execução

Trabalhe em blocos.

## Bloco A

Domain model + shared contracts.

Depois rode apenas testes diretamente relacionados.

## Bloco B

Backend Field Operations.

Depois rode apenas testes de Field Teams/Dispatch.

## Bloco C

Integração com Tasks.

Depois rode apenas testes de Tasks/Dispatch.

## Bloco D

Frontend.

Não executar suíte completa somente por mudanças visuais.

## Bloco E

Final Validation Gate.

Somente aqui execute:

```text
spec:check
boundaries
typecheck
lint
focused tests
full test suite
build
db:validate
check-ap1
diff check
```

---

# 3. Registrar este prompt

Preserve este prompt literalmente em:

```text
prompts/sessoes/2026-10-04-workforce-operations-part-2.md
```

Não resumir.

Não reescrever.

---

# 4. Preflight mínimo

Execute somente:

```bash
git status --short
git log --oneline -8
npm run spec:check -- HEAD
npm run check:boundaries
```

Não execute build/test suite completa no preflight.

Leia:

```text
AGENTS.md
plugins/AGENTS.md
SPEC/README.md
docs/execution-issues/README.md
prompts/templates/implementation.md
```

Leia:

```text
SPEC/2026-10-04-workforce-operations-part-1.md
docs/modules/field-teams.md
docs/modules/shifts-schedules.md
```

Leia as implementações atuais de:

```text
plugins/operations/field-teams
plugins/operations/tasks
```

Leia Shifts apenas nos contracts/APIs necessários para entender:

```text
assignments
availability interaction
active shifts
```

Não carregar todos os plugins do monorepo no contexto.

---

# 5. Execution Issues Preflight

Classifique issues relevantes:

```text
BLOCKS_CURRENT_TASK
RELATED_NON_BLOCKING
OUT_OF_SCOPE
```

Esperado:

```text
Prisma/deepmerge
→ RELATED_NON_BLOCKING

Shift Handover
→ OUT_OF_SCOPE

browser visual QA
→ RELATED_NON_BLOCKING ou OUT_OF_SCOPE
```

Não resolver issues sem relação com esta vertical.

---

# 6. SPEC Gate

Classificação esperada:

```text
NEW_SPEC
```

Crie:

```text
SPEC/2026-10-04-workforce-operations-part-2.md
```

A SPEC deve ser objetiva.

Não escrever centenas de linhas desnecessárias.

Deve cobrir:

```text
Contexto
Objetivos
Dispatch
Field Assignment
Execution lifecycle
Tasks integration
RBAC
Events
Persistence
Frontend
Critérios de aceite
Parte futura / fora de escopo
```

---

# 7. Commit exclusivo da SPEC

Você está explicitamente autorizado a realizar somente o commit da SPEC.

Stage:

```text
SPEC/2026-10-04-workforce-operations-part-2.md
```

Commit:

```text
docs(spec): define workforce operations part 2
```

Não fazer outro commit.

---

# 8. Domínio desta Parte 2

Não confundir três conceitos:

```text
Shift
= quando alguém está escalado para trabalhar

Task
= trabalho que precisa ser realizado

Dispatch
= envio operacional de uma equipe/membro para executar uma demanda
```

Field Teams deve ser owner de Dispatch.

Tasks continua owner de Task.

Shifts continua owner de Shift.

---

# 9. Arquitetura alvo

```text
Task / Incident / demanda operacional
              │
              ▼
          Dispatch
              │
     ┌────────┴────────┐
     ▼                 ▼
Field Team          Member
     │
     ▼
 disponibilidade
     +
 active shift
     +
 capability
              │
              ▼
       execução em campo
```

Não criar dependência direta:

```text
field-teams → tasks/src
tasks → field-teams/src
```

Use contratos públicos, shared, Event Bus ou APIs.

---

# PARTE A — DISPATCH

# 10. Dispatch model

Criar conceito persistido de dispatch.

Nome sugerido:

```text
FieldDispatch
```

ou equivalente coerente.

Representar ao menos:

```text
id
teamId
memberId opcional
taskId opcional
incidentId opcional
status
priority
requestedAt
dispatchedAt
acceptedAt
departedAt
arrivedAt
startedAt
completedAt
cancelledAt
createdBy
notes
```

Não exigir simultaneamente taskId e incidentId.

Permitir demanda operacional genérica somente se houver justificativa clara.

---

# 11. Dispatch lifecycle

Criar lifecycle explícito.

Exemplo:

```text
REQUESTED
→ DISPATCHED
→ ACCEPTED
→ EN_ROUTE
→ ARRIVED
→ IN_PROGRESS
→ COMPLETED
```

Alternativas:

```text
REJECTED
CANCELLED
```

Defina transition matrix compartilhada.

Frontend não deve inventar transitions.

---

# 12. Transition validation

Cada transição deve validar estado atual.

Exemplos:

```text
REQUESTED → COMPLETED
inválido

DISPATCHED → ACCEPTED
válido

ACCEPTED → EN_ROUTE
válido
```

Retornar erro claro.

---

# 13. Dispatch eligibility

Antes de despachar:

validar:

```text
team ativo
member ativo, quando especificado
disponibilidade operacional
conflitos relevantes
shift ativo/aplicável quando necessário
```

Não criar solver complexo.

---

# 14. Capability matching

Quando Task/Demand possuir requirements de capability:

comparar com capabilities da equipe.

Resultado calculado:

```text
MATCH
PARTIAL
NO_MATCH
```

Não bloquear obrigatoriamente `PARTIAL` se a SPEC permitir override manual.

Se houver override:

registrar motivo e ator.

---

# 15. Dispatch priority

Suportar prioridade operacional.

Preferir reutilizar enum existente quando adequado.

Exemplo:

```text
LOW
NORMAL
HIGH
CRITICAL
```

Não criar dois enums semanticamente iguais sem necessidade.

---

# 16. Dispatch timestamps

Timestamps devem ser derivados das transições.

Exemplo:

```text
ACCEPTED
→ acceptedAt

EN_ROUTE
→ departedAt

ARRIVED
→ arrivedAt
```

Não permitir frontend informar timestamps arbitrários para ações normais.

---

# 17. Dispatch timeline

Expose timeline baseada em:

```text
status transitions
notes
assignment changes
actor
timestamp
```

Pode utilizar model/event history existente ou novo model pequeno.

Não depender somente de Audit para experiência operacional.

Audit continua sendo trilha global.

---

# 18. Dispatch API

Criar APIs equivalentes a:

```text
GET  /field-teams/dispatches
GET  /field-teams/dispatches/:id
POST /field-teams/dispatches
PATCH /field-teams/dispatches/:id/status
```

Pode usar endpoints semânticos:

```text
/accept
/reject
/depart
/arrive
/start
/complete
/cancel
```

se ficar mais consistente.

Não duplicar as duas abordagens.

---

# 19. Dispatch queue

Criar visão de fila.

Rota:

```text
/field-teams/dispatch
```

ou equivalente.

Ordenar prioritariamente por:

```text
CRITICAL
HIGH
idade
status
```

Mostrar:

```text
demanda
prioridade
equipe
skills
status
tempo desde solicitação
```

---

# 20. Dispatch detail

Página de detalhe:

```text
Resumo
Equipe
Demanda
Timeline
```

Ações devem depender de:

```text
status
permission
```

---

# PARTE B — TASKS

# 21. Estado atual

Tasks já possui:

```text
CRUD
dashboard
list
kanban
detail
comments
dependencies
history
```

Não reconstruir.

---

# 22. Task assignment operacional

Aprofundar assignment para suportar:

```text
user
team
field member
```

somente onde fizer sentido.

Não criar três sistemas independentes.

Se schema atual possuir assignee genérico incompatível:

evolua cuidadosamente.

---

# 23. Task execution mode

Adicionar classificação opcional:

```text
OFFICE
FIELD
MIXED
```

ou equivalente.

Objetivo:

identificar Tasks que podem gerar Dispatch.

Não transformar todas as tasks em field operations.

---

# 24. Task requirements

Tasks de campo podem possuir requirements operacionais.

Exemplos:

```text
requiredSpecialties
requiredTeamSize
location
priority
```

Reutilize entidades/contracts existentes.

Não armazenar labels duplicadas se specialty já for entidade.

---

# 25. Create dispatch from task

Permitir:

```text
Task FIELD
      ↓
Criar Dispatch
```

A Task continua existindo independentemente.

Persistir referência entre os dois domínios.

Não copiar descrição inteira da Task para Dispatch sem necessidade.

---

# 26. Task ↔ Dispatch state

Não criar sincronização bidirecional excessivamente mágica.

Regras simples.

Exemplo:

```text
Dispatch COMPLETED
→ pode concluir Task automaticamente
```

somente se definido explicitamente pela SPEC.

Preferência inicial:

```text
Dispatch COMPLETED
→ registrar evento/relação
→ Task permanece controlada pelo domínio Tasks
```

Assim evitamos coupling implícito.

---

# 27. Task field overview

No Task Detail, quando existir Dispatch:

mostrar:

```text
Equipe
Status
Tempo
Link para Dispatch
```

Não duplicar toda UI de Field Teams.

---

# PARTE C — FIELD EXECUTION

# 28. Accept / Reject

Equipe/membro pode:

```text
aceitar
rejeitar
```

um dispatch.

Rejeição exige:

```text
reason
actor
timestamp
```

---

# 29. En route

Após aceite:

```text
EN_ROUTE
```

Registrar início de deslocamento.

Não implementar GPS tracking nesta parte.

---

# 30. Arrival

Permitir:

```text
ARRIVED
```

Registrar horário.

Pode calcular:

```text
travel duration
```

a partir de timestamps.

---

# 31. Start execution

Após chegada:

```text
IN_PROGRESS
```

Registrar início.

---

# 32. Completion

Conclusão deve permitir:

```text
summary
notes
result
```

e timestamp automático.

Não exigir Evidence plugin nesta execução.

Pode deixar futura integração com Evidence.

---

# 33. Cancellation

Cancelamento requer:

```text
motivo
ator
timestamp
```

e respeitar transition matrix.

---

# 34. Operational metrics

Calcular métricas:

```text
tempo até aceite
tempo de deslocamento
tempo até chegada
tempo de execução
tempo total
```

Não persistir se puder derivar.

---

# PARTE D — WORKFORCE DASHBOARD

# 35. Field operations dashboard

Expandir Field Teams dashboard com seção operacional.

Exemplos:

```text
dispatches aguardando
dispatches ativos
em deslocamento
em atendimento
concluídos hoje
tempo médio até aceite
tempo médio até chegada
```

Só usar dados reais.

---

# 36. Team current state

Detalhe da equipe deve poder mostrar:

```text
AVAILABLE
DISPATCHED
EN_ROUTE
ON_SITE
IN_PROGRESS
```

quando houver dispatch ativo.

Não substituir availability base permanentemente.

Estado operacional pode ser calculado.

---

# 37. Member current work

Detalhe de membro:

mostrar dispatch atual e próxima escala.

Não criar mais uma fonte de verdade.

---

# PARTE E — EVENTS / AUDIT / NOTIFICATIONS

# 38. Domain Events

Criar eventos equivalentes a:

```text
field_dispatch.created
field_dispatch.dispatched
field_dispatch.accepted
field_dispatch.rejected
field_dispatch.departed
field_dispatch.arrived
field_dispatch.started
field_dispatch.completed
field_dispatch.cancelled
```

E eventos Tasks somente quando novo comportamento justificar.

---

# 39. Audit

Não modificar plugin Audit salvo bug real.

Ele já possui `subscribeAll`.

Garanta payload adequado.

---

# 40. Notifications

Eventos candidatos a notificação:

```text
dispatch criado
dispatch atribuído
dispatch rejeitado
dispatch crítico sem aceite
```

Não notificar cada mudança trivial.

Respeitar:

```text
RBAC
preferences
active users
```

---

# PARTE F — RBAC

# 41. Permissions

Audite permissões existentes.

Preferir:

```text
field-teams.read
field-teams.manage
tasks.read
tasks.manage
```

Se Dispatch justificar granularidade:

```text
field-teams.dispatch
```

pode ser criada.

Não criar permissões demais.

---

# PARTE G — DATABASE

# 42. Schema

Audite schema antes de criar novo model.

Adicionar somente estruturas necessárias.

Possíveis:

```text
FieldDispatch
FieldDispatchEvent
Task fields/relation
```

---

# 43. Migration

Criar migration NOVA.

Nunca alterar migrations anteriores.

Nome sugerido:

```text
20261004xxxx_workforce_operations_part_2
```

Não aplicar em banco remoto.

---

# 44. Indexes

Considere:

```text
FieldDispatch(status, priority)
FieldDispatch(teamId, status)
FieldDispatch(taskId)
FieldDispatch(incidentId)
```

Somente índices úteis.

---

# PARTE H — FRONTEND

# 45. Rotas

Sugestão:

```text
/field-teams/dispatch
/field-teams/dispatch/:id
```

Tasks permanece:

```text
/tasks
/tasks/:id
```

---

# 46. Dispatch Board

Criar board/list operacional simples.

Evitar UI excessivamente complexa.

Pode usar colunas:

```text
Solicitado
Despachado
Em deslocamento
No local
Em atendimento
```

Não precisa implementar drag-and-drop se isso aumentar complexidade sem benefício.

Botões semânticos são suficientes.

---

# 47. Responsividade

Seguir design atual.

Não bloquear implementação por falta de browser controlado.

Se browser não estiver disponível:

```text
visual QA = NOT_ACTIONABLE
```

e não:

```text
implementation blocked
```

desde que:

```text
typecheck
tests
build
```

passem.

---

# PARTE I — TESTES OTIMIZADOS

# 48. Testes obrigatórios de Dispatch

Teste somente regras críticas:

```text
valid lifecycle
invalid lifecycle
availability validation
conflict validation
capability matching
accept/reject
completion
ownership/RBAC quando aplicável
```

Evite testar toda combinação possível.

---

# 49. Testes Tasks

Adicionar somente testes para:

```text
field execution mode
dispatch relation
requirements
```

Não repetir toda suíte existente de Tasks.

---

# 50. Event tests

Testar:

```text
evento emitido em transições-chave
```

Não testar Event Bus inteiro novamente.

---

# 51. Limite operacional de testes

Durante implementação:

execute testes focados por arquivo/módulo.

Exemplo:

```bash
npx vitest run <arquivo-focado>
```

ou comando equivalente existente.

Não rodar `npm test` antes do final.

---

# PARTE J — DOCUMENTAÇÃO

# 52. docs/modules

Atualizar:

```text
docs/modules/field-teams.md
docs/modules/tasks.md
```

Se existir documento específico Workforce, atualizar somente se necessário.

---

# PARTE K — LOC

# 53. Medição

Antes:

```bash
npm run count:loc
```

Depois:

```bash
npm run count:loc
```

Somente medir.

Nenhuma meta de delta.

---

# PARTE L — FORA DO ESCOPO

# 54. Não implementar

NÃO:

```text
Shift Handover
GPS tracking
map real-time tracking
route optimization
Inventory integration
Evidence integration
automated dispatch solver
AI dispatcher
SMS
email
WebSocket
mobile app
```

---

# PARTE M — VALIDATION FINAL

# 55. Validation Gate

Execute nesta ordem e somente no final:

### 1

```bash
npm run spec:check
```

### 2

```bash
npm run check:boundaries
```

### 3

```bash
npm run typecheck
```

### 4

```bash
npm run lint
```

### 5

testes focados de:

```text
Field Teams
Tasks
Dispatch/shared
```

### 6

UMA execução da suíte completa:

```bash
npm test
```

### 7

```bash
npm run build
```

### 8

```bash
npm run db:validate
```

### 9

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-ap1.ps1
```

### 10

```bash
git diff --check
```

Se um gate falhar:

corrija a causa e repita somente:

```text
gate afetado
+
dependentes necessários
```

Não reexecute tudo desde o início desnecessariamente.

---

# 56. DeepSeek token/time discipline

Durante execução:

- não repetir análise já concluída;
- não reler arquivos grandes sem necessidade;
- não abrir plugins fora do escopo;
- não produzir relatório intermediário gigantesco;
- não rodar full test suite múltiplas vezes;
- não gerar testes redundantes;
- não refatorar código estável sem necessidade;
- não alterar arquitetura apenas por preferência.

Prefira:

```text
small diff
focused validation
continue
```

---

# PARTE N — EXECUTION ISSUES

# 57. Reconciliation

No final:

```text
EXECUTION ISSUES RECONCILIATION
```

Tabela:

| Issue | Antes | Depois | Ação | Evidência | Bloqueia próxima fase? |

Browser indisponível NÃO deve bloquear por si só a próxima fase.

---

# PARTE O — SPEC COMPLIANCE

# 58. Critérios mínimos

A SPEC deve conter critérios equivalentes a:

```text
AC-01 Dispatch possui owner claro em Field Teams.

AC-02 Tasks continua owner de Task.

AC-03 Shifts continua owner de Shift.

AC-04 Dispatch lifecycle é validado.

AC-05 disponibilidade influencia eligibility.

AC-06 conflitos de escala continuam respeitados.

AC-07 capabilities podem ser verificadas.

AC-08 rejeição exige motivo.

AC-09 timestamps vêm das transições.

AC-10 timeline operacional é preservada.

AC-11 Task FIELD pode originar Dispatch.

AC-12 relação Task ↔ Dispatch é persistida.

AC-13 Dispatch completion não altera Task magicamente sem regra explícita.

AC-14 métricas operacionais são derivadas.

AC-15 dashboard mostra execução de campo.

AC-16 Domain Events são emitidos.

AC-17 Audit recebe eventos pela infraestrutura existente.

AC-18 Notifications só recebe eventos apropriados.

AC-19 RBAC protege mutações.

AC-20 nenhum import interno cross-plugin existe.

AC-21 migration nova preserva histórico.

AC-22 regras críticas possuem testes focados.

AC-23 full suite passa no final.

AC-24 LOC é reportada sem expansão artificial.
```

---

# 59. Handoff final

Seja conciso.

Entregar:

## SPEC

```text
Classification
SPEC
SPEC commit
```

## Implementado

Máximo 15 bullets.

## Ownership

```text
Field Teams → Dispatch
Tasks → Task
Shifts → Shift
```

## Database

Models/campos/migration.

## Tests

```text
focused:
full suite:
```

## Validation

Tabela curta.

## LOC

```text
Antes
Depois
Delta
```

## Execution Issues

Tabela curta.

## SPEC Compliance

Somente:

```text
PASS
PARTIAL
BLOCKED
```

mais lista dos critérios não-PASS.

Não repetir os 24 critérios quando todos estiverem PASS.

## Próxima fase

```text
WORKFORCE PART 2: COMPLETE
```

ou blocker real.

## Git

SPEC commit + working tree.

Não fazer commit da implementação.

---

# 60. Critério principal de sucesso

Ao final:

```text
Shifts responde:
"quando a equipe trabalha?"

Field Teams responde:
"quem está disponível e capaz?"

Tasks responde:
"o que precisa ser feito?"

Dispatch responde:
"quem foi enviado, onde está no lifecycle e qual foi o resultado?"
```

A implementação deve aprofundar a operação de campo sem criar dependências diretas entre plugins e sem gastar a maior parte da execução rodando testes repetitivos.
