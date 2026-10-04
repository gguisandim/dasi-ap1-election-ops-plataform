Você está trabalhando no monorepo **Election Ops Platform**.

O `PLUGIN DEVELOPMENT GATE` foi considerado `READY`.

Esta é a primeira execução funcional depois do saneamento arquitetural.

O objetivo é aprofundar três plugins existentes que formam uma mesma vertical operacional:

```text
Incidente ocorre
      ↓
Central de Incidentes
      ↓
Event Bus
   ↙       ↘
Auditoria   Notificações
```

Plugins principais:

```text
plugins/monitoring/incidents
plugins/system/audit
plugins/system/notifications
```

Esta tarefa NÃO deve criar novos plugins.

O objetivo é transformar esses três módulos de MVPs independentes em uma vertical operacional consistente, mantendo o desacoplamento entre plugins.

---

# 0. Regra principal

Não maximize LOC artificialmente.

A plataforma possui uma meta acadêmica futura de aproximadamente 100k LOC, mas todo crescimento nesta execução deve resultar de:

- funcionalidades reais;
- regras de domínio;
- interfaces úteis;
- testes;
- contratos;
- validações;
- documentação necessária.

É proibido:

- duplicar código para aumentar linhas;
- criar wrappers sem função arquitetural;
- criar mocks gigantes sem finalidade;
- adicionar arquivos artificiais;
- fragmentar funções apenas para aumentar LOC.

Ao final apenas MEÇA o impacto em LOC.

---

# 1. Registrar este prompt

Antes da implementação material, preserve uma cópia literal deste prompt em:

```text
prompts/sessoes/2026-10-04-incidents-audit-notifications-enhancement.md
```

Não resumir.

Não reescrever.

Não substituir pelo relatório da execução.

---

# 2. Preflight obrigatório

Execute:

```bash
git status --short
git log --oneline -10
npm run spec:check -- HEAD
npm run check:boundaries
```

Leia:

```text
AGENTS.md
plugins/AGENTS.md
SPEC/README.md
docs/AI-PLUGIN-GUIDE.md
docs/UI-DESIGN-GUIDE.md
docs/COMMIT-GUIDE.md
docs/execution-issues/README.md
prompts/templates/implementation.md
```

Leia as implementações atuais de:

```text
plugins/monitoring/incidents
plugins/system/audit
plugins/system/notifications
```

Leia também:

```text
packages/event-bus
packages/shared
packages/security
packages/database/prisma/schema.prisma
```

somente nas áreas necessárias para compreender os contratos desses três plugins.

Leia:

```text
docs/modules/INCIDENTS.md
SPEC/2026-10-01-incidents-inventory-rbac-events-simulator.md
```

A SPEC de 2026-10-01 é retrospectiva e documenta o MVP anterior.

Ela NÃO deve ser tratada automaticamente como contrato suficiente para as novas funcionalidades desta execução.

---

# 3. Execution Issues Preflight

Antes da implementação, revise os execution issues relevantes.

Classifique cada um como:

```text
BLOCKS_CURRENT_TASK
RELATED_NON_BLOCKING
OUT_OF_SCOPE
```

A situação esperada é aproximadamente:

```text
Prisma/deepmerge:
RELATED_NON_BLOCKING

Shift Handover sem SPEC:
OUT_OF_SCOPE

issues históricos de browser/tool:
OUT_OF_SCOPE
```

Mas confirme no repositório atual.

Se algum issue realmente impedir:

```text
schema
migration
build
Event Bus
SPEC
testes
```

classifique como `BLOCKS_CURRENT_TASK` e trate conforme o protocolo.

Não tente resolver incidentalmente issues sem relação com esses três plugins.

---

# 4. SPEC Gate

Execute formalmente o SPEC Gate.

Classificação esperada:

```text
NEW_SPEC
```

Motivo:

a SPEC anterior deste domínio é retrospectiva e cobre apenas o MVP existente.

Esta execução introduz comportamento material novo:

- triagem operacional ampliada;
- acknowledgement/escalation;
- novos eventos;
- auditoria detalhada;
- notification preferences;
- recipient policies;
- novas telas e endpoints.

Crie:

```text
SPEC/2026-10-04-incident-response-audit-notifications.md
```

---

# 5. Conteúdo mínimo da SPEC

A SPEC deve conter:

```text
Contexto
Estado atual
Problemas
Objetivos
Personas
Escopo
Fora de escopo

Central de Incidentes
Auditoria
Notificações
Event Bus
RBAC
Modelo de dados
APIs
Frontend
Integrações
Arquitetura
Critérios de aceite
Validação
```

A SPEC deve refletir o código real encontrado.

Não escreva critérios genéricos que não serão implementados.

---

# 6. Commit exclusivo da SPEC

Você está explicitamente autorizado a realizar SOMENTE o commit inicial da nova SPEC.

Faça stage apenas de:

```text
SPEC/2026-10-04-incident-response-audit-notifications.md
```

Confirme:

```bash
git diff --cached --name-only
```

Deve aparecer somente a SPEC.

Faça:

```bash
git commit -m "docs(spec): define incident response observability workflow"
```

Não faça nenhum outro commit durante esta execução.

---

# 7. Arquitetura obrigatória

Continuam proibidos:

```text
incidents → audit/src/**
incidents → notifications/src/**
audit → incidents/src/**
notifications → incidents/src/**
```

As integrações devem ocorrer através de:

```text
@eops/event-bus
@eops/shared
@eops/database
APIs públicas
contracts públicos
```

Não violar os workspace boundaries já implementados.

---

# 8. Vertical desejada

A arquitetura funcional deve se aproximar de:

```text
IncidentsService
      │
      │ typed domain events
      ▼
   Event Bus
   ┌────┴─────┐
   ▼          ▼
Audit      Notifications
Subscriber Subscriber
   │          │
   ▼          ▼
AuditEvent Notification
```

Incidentes não devem conhecer implementação de Auditoria ou Notificações.

---

# PARTE A — CENTRAL DE INCIDENTES

# 9. Problemas atuais observados em Incidentes

A implementação atual já possui:

- CRUD;
- categorias;
- severidade;
- status;
- SLA simples;
- atribuição;
- timeline;
- comentários;
- dashboard;
- vínculo com pleito/zona/local/ativo.

Preserve isso.

Os principais gaps atuais são:

1. poucas ações são emitidas pelo Event Bus;
2. `incidents.resolve` e `incidents.close` existem, mas não são efetivamente usados pelo workflow;
3. frontend oferece statuses que o backend pode rejeitar;
4. não existe acknowledgement explícito;
5. não existe escalation operacional explícita;
6. dashboard é muito superficial;
7. categorias possuem backend, mas praticamente nenhuma administração no frontend;
8. atribuição e mudança de dados não possuem rastreabilidade completa via Event Bus;
9. SLA só informa vencido/não vencido.

---

# 10. Shared incident lifecycle

Centralize o lifecycle de status em contrato compartilhado apropriado.

Hoje existe lógica equivalente a:

```text
NEW
→ TRIAGED
→ ASSIGNED
→ IN_PROGRESS
→ RESOLVED
→ CLOSED
```

com:

```text
CANCELLED
```

O frontend e o backend devem utilizar a mesma fonte de verdade para saber quais transições são possíveis.

Preferência:

```text
packages/shared/src/incidents.ts
```

ou equivalente coerente.

Expor algo como:

```text
INCIDENT_ALLOWED_TRANSITIONS
getAllowedIncidentTransitions(status)
```

Não duplique a transition matrix no frontend.

---

# 11. Permission-aware status workflow

As permissões já existentes incluem:

```text
incidents.update
incidents.resolve
incidents.close
```

Faça com que elas tenham efeito real.

Direção:

```text
mudança operacional normal
→ incidents.update

RESOLVED
→ incidents.resolve

CLOSED
→ incidents.close
```

Não mantenha `resolve` e `close` como permissões decorativas.

Pode criar endpoints semanticamente explícitos se essa for a abordagem mais limpa.

Exemplo:

```text
POST /incidents/:id/resolve
POST /incidents/:id/close
```

ou contrato equivalente.

Preserve transições válidas.

---

# 12. Acknowledgement

Adicione acknowledgement explícito.

Objetivo:

distinguir:

```text
incidente criado
```

de:

```text
alguém efetivamente tomou conhecimento
```

Persistir informação suficiente para responder:

```text
foi reconhecido?
quando?
por quem?
```

Exemplo de campos possíveis:

```text
acknowledgedAt
acknowledgedById
```

ou modelagem equivalente.

Criar endpoint operacional apropriado.

Registrar timeline.

Emitir Domain Event.

---

# 13. Escalation

Adicionar escalonamento manual de incidentes.

Persistir ao menos:

```text
nível de escalonamento
data
motivo
ator
```

Não é necessário criar uma engine automática/cron nesta fase.

Permitir algo equivalente a:

```text
Nível 0
Nível 1
Nível 2
Nível 3
```

ou modelagem definida na SPEC.

Registrar:

```text
IncidentEvent
Domain Event
Audit
Notification
```

Não inventar escalation automático sem infraestrutura adequada.

---

# 14. SLA operacional

Preserve `slaDeadline`.

Adicione uma visão calculada mais útil.

Exemplo conceitual:

```text
ON_TRACK
DUE_SOON
OVERDUE
COMPLETED
```

Defina limiares na SPEC.

Não persistir estado que possa ser calculado, salvo motivo justificado.

Mostrar:

```text
tempo restante
tempo vencido
percentual/estado visual quando aplicável
```

Não criar cron apenas para isso.

---

# 15. Dashboard de Incidentes

Expandir o endpoint/dashboard existente.

Além de:

```text
open
critical
inProgress
resolvedToday
slaOverdue
```

avaliar métricas reais como:

```text
untriaged
unassigned
acknowledgementPending
dueSoon
bySeverity
byStatus
meanResolutionMinutes
```

Só implementar métricas calculáveis de forma confiável com os dados existentes/novos.

Não inventar números.

---

# 16. Fila operacional

Criar uma visão de fila operacional.

Rota sugerida:

```text
/incidents/queue
```

Objetivo:

priorizar:

```text
críticos
S

Criar uma visão de fila operacional.
Rota sugerida:
```text
/incidents/queue
```
Objetivo:
priorizar:
```text
críticos
SLA vencido
SLA próximo
não reconhecidos
não atribuídos
escalados
```
A fila não deve ser apenas uma cópia da tabela atual.
Deve permitir ao operador identificar:
“qual incidente precisa de atenção primeiro?”
Backend pode possuir endpoint próprio ou uma ordenação/filtro formalizado.
Refinar a página de detalhe.
Organizar em seções/tabs coerentes, por exemplo:
```text
Resumo
Atendimento
Timeline
Atribuições
```
Mostrar claramente:
```text
status
severidade
SLA
acknowledgement
escalation
responsável
local
ativo
categoria
timestamps
```
As ações disponíveis devem respeitar o status atual.
Não mostrar botão que necessariamente será rejeitado pelo backend.
O backend já possui IncidentAssignment.
Exponha melhor esse histórico na página.
Mostrar:
```text
responsável
data de início
data de fim
motivo
```
Não sobrescrever histórico anterior.
O backend atual já permite criar/editar categorias.
Crie uma interface operacional/admin consistente.
Rota possível:
```text
/incidents/categories
```
Permitir:
```text
listar
criar
editar
ativar/desativar
```
Não permitir quebrar incidentes antigos quando categoria for desativada.
A cobertura atual de eventos é insuficiente.
Amplie o contrato com eventos tipados equivalentes a:
```text
incident.created
incident.updated
incident.acknowledged
incident.assigned
incident.status_changed
incident.severity_changed
incident.escalated
incident.comment_added
incident.resolved
incident.reopened
incident.closed
incident.cancelled
```
Não é obrigatório usar exatamente todos esses nomes se a SPEC justificar composição diferente.
Mas toda mutação operacional relevante deve poder chegar à Auditoria.
Payloads devem possuir dados suficientes, por exemplo:
```text
entityId
actorId
code
from
to
reason
severity
assignedToId
assignedToName
```
quando aplicável.
Não enviar objetos Prisma inteiros pelo Event Bus.
Todas as ações humanas relevantes devem receber ator da sessão autenticada.
Corrigir operações que atualmente perdem actorId.
Nunca aceitar actorId arbitrário vindo do frontend.
Hoje AuditSubscriber mantém sua própria lista manual de eventos.
Isso permite que novos Domain Events existam sem serem auditados.
Evolua @eops/event-bus com mecanismo público equivalente a:
```text
subscribeAll(handler)
```
ou solução igualmente simples.
Objetivo:
```text
todo Domain Event publicado
→ pode ser observado pela Auditoria
```
sem atualizar manualmente uma lista em audit.subscriber.ts.
Adicione testes para:
```text
subscribe(name)
subscribeAll()
múltiplos subscribers
unsubscribe quando aplicável
event name
payload
occurredAt
```
Não altere a arquitetura para Kafka/RabbitMQ/outbox nesta execução.
O Event Bus continua in-process.
Documente essa limitação se relevante.
Atualmente Auditoria possui essencialmente:
```text
GET /audit
uma tabela
subscriber com lista manual
```
Não possui profundidade compatível com um sistema operacional auditável.
Migrar Auditoria para observar todos os Domain Events através do mecanismo público criado no Event Bus.
Não depender de imports de plugins.
Cada AuditEvent criado a partir do Event Bus deve registrar informação suficiente para reconstruir:
```text
eventName
occurredAt
actor
entityType
entityId
action
payload relevante
```
Se necessário, evolua o Prisma model com:
```text
eventName
```
ou outro campo justificado.
Não inventar:
```text
IP
user-agent
requestId
correlationId
```
se o sistema atual não possui esses dados.
Quando o Domain Event possuir transição real:
```text
from
to
```
ou alterações equivalentes, preencher de forma útil:
```text
oldData
newData
```
Para eventos sem estado anterior conhecido:
usar newData/metadata de forma honesta.
Não fabricar estado anterior.
Antes de persistir payloads de auditoria, sanitize recursivamente campos sensíveis.
No mínimo considerar chaves equivalentes a:
```text
password
passwordHash
authorization
token
secret
apiKey
```
case-insensitive quando apropriado.
Substituir o valor por indicação de redacted.
Adicionar testes específicos.
Auditoria nunca deve se tornar vazamento de credenciais.
Expandir a API com capacidades como:
```text
GET /audit
GET /audit/summary
GET /audit/:id
```
A listagem deve permitir filtros úteis:
```text
action
eventName
entityType
entityId
actorId
from
to
search
page
pageSize
```
Implemente apenas filtros que possam ser feitos corretamente.
Criar overview real com indicadores como:
```text
eventos no período
eventos hoje
ações por tipo
recursos mais alterados
atores mais ativos
```
Não inventar analytics excessivo.
Adicionar rota:
```text
/audit/:id
```
A página deve apresentar:
```text
ator
data/hora
ação
event name
entidade
entity ID
metadata
before
after
```
Para before/after, criar apresentação legível.
Não mostrar apenas:
```text
JSON.stringify(...)
```
em uma célula minúscula.
Pode existir viewer estruturado e/ou diff por chave.
Melhorar /audit:
- summary compacto;
- filtros;
- busca;
- badges de ação;
- melhor leitura do recurso;
- link para detail;
- paginação;
- empty/error/loading states.
Manter o visual da plataforma.
Não criar:
```text
DELETE /audit
PATCH /audit
```
AuditEvent deve permanecer histórico.
Hoje o plugin possui cobertura muito pequena ou inexistente.
Adicionar testes para:
```text
query/filter/pagination
subscribeAll integration
action inference
entity inference
actor validation
old/new
eventName
redaction
detail
summary
```
Atualmente:
- o subscriber possui muitas regras de conteúdo;
- todos ou quase todos os usuários ativos recebem eventos;
- existe NotificationPreference no banco;
- não existe UI/API para gerenciar preferências;
- listagem pega até 100 itens sem paginação;
- Bell usa a listagem inteira para descobrir unread count;
- não existe filtro operacional;
- pouco direcionamento por permissão.
Preserve as notificações persistentes.
Criar DTO/listagem paginada.
Permitir filtros como:
```text
readState
type
eventName
from
to
page
pageSize
```
Resposta paginada consistente com a plataforma.
Criar endpoint leve:
```text
GET /notifications/unread-count
```
ou equivalente.
NotificationBell deve utilizar esse endpoint.
Não buscar até 100 notificações apenas para mostrar o badge.
Preservar:
```text
mark read
mark all read
```
Avaliar e implementar também:
```text
mark unread
```
se fizer sentido na SPEC.
Toda operação deve afetar apenas notificações do próprio usuário.
Usar o model existente:
```text
NotificationPreference
```
Criar APIs equivalentes a:
```text
GET /notifications/preferences
PUT /notifications/preferences
```
ou contrato mais apropriado.
Um usuário só altera as próprias preferências.
Ausência de preference explícita deve possuir default claro.
Preferência atual:
```text
enabled por padrão
```
se isso for consistente com comportamento existente.
O frontend precisa saber quais eventos são configuráveis.
Não copie manualmente uma lista diferente no frontend.
Crie fonte pública compartilhada apropriada no Event Bus ou em contrato compartilhado.
Ela pode conter:
```text
eventName
domínio
label
description
```
Exemplo conceitual:
```text
Incidentes
  Novo incidente
  Incidente atribuído
  Incidente escalado
  Incidente resolvido

Transmissão
  Falha
  Conectividade alterada

Escalas
  Cobertura insuficiente
```
Não acople a UI a implementação dos outros plugins.
Criar rota:
```text
/notifications/preferences
```
Agrupar por domínio.
Exemplo:
```text
INCIDENTES

[✓] Novo incidente
[✓] Incidente atribuído
[✓] Incidente escalado
[ ] Comentários

TRANSMISSÃO

[✓] Falha de transmissão
[✓] Mudança de conectividade
```
Salvar de forma persistente.
Dar feedback de sucesso/erro.
O subscriber atual não deve simplesmente notificar qualquer usuário ativo sobre qualquer evento.
Introduza política de audiência baseada em permissões.
Exemplo conceitual:
```text
incident.*
→ usuários com incidents.read

asset.*
→ usuários com inventory.read

transmission.*
→ usuários com transmission.read

task.*
→ usuários com tasks.read

shift.*
→ usuários com shifts.read
```
Utilize RBAC persistido.
Não importe implementação do plugin de Access Control.
Consultar as relações de roles/permissions via @eops/database é permitido dentro do plugin de Notificações.
Para:
```text
incident.assigned
```
se houver:
```text
assignedToId
```
garanta que o usuário atribuído possa ser destinatário apropriado, respeitando usuário ativo e a política definida na SPEC.
Não dependa somente de assignedToName.
Atualize o Domain Event para carregar assignedToId quando disponível.
A seleção final deve conceitualmente ser:
```text
usuário ativo
AND
usuário elegível para aquele domínio/evento
AND
preferência != disabled
```
Evite N+1 queries grosseiras.
Use queries Prisma adequadas.
Melhorar /notifications.
Adicionar:
```text
Todos
Não lidos
Críticos
```
ou filtros equivalentes.
Mostrar:
```text
tipo
título
mensagem
horário
origem/evento
estado lido
```
Paginar.
Quando uma notificação possuir:
```text
entityType = Incident
entityId
```
permitir navegar para:
```text
/incidents/:entityId
```
sem importar código interno de Incidentes.
Para outras entidades, só criar navegação quando existir contrato/rota pública confiável.
Não inventar links quebrados.
Melhorar NotificationBell.
Requisitos:
- endpoint de unread count;
- badge acessível;
- aria-label;
- atualização após operações de leitura;
- polling moderado se necessário.
Se implementar polling:
- intervalo razoável;
- cleanup correto;
- nada agressivo.
Não introduzir WebSocket só por isso.
Adicionar cobertura para:
```text
list pagination
filters
unread count
read
read all
read/unread ownership
preferences
disabled preference
recipient permission policy
inactive user
assigned incident recipient
notification content
```
Se novas colunas forem necessárias:
crie NOVA migration.
Não altere migrations históricas.
Possíveis áreas:
```text
Incident acknowledgement/escalation
AuditEvent eventName
índices adicionais
```
Não criar tabela se um campo calculado for suficiente.
Ao adicionar filtros frequentes, revisar índices.
Exemplos:
```text
Incident(status, severity)
Incident(slaDeadline)
AuditEvent(eventName, createdAt)
Notification(userId, readAt, createdAt)
NotificationPreference(userId, eventName)
```
Não duplicar índice que já existe.
Seguir:
```text
docs/UI-DESIGN-GUIDE.md
```
Não redesenhar shell.
Não criar linguagem visual isolada por plugin.
Reutilizar:
```text
@eops/ui
tokens globais
Badge
Card
Button
Field
Input
Select
Pagination
Loading
ErrorState
EmptyState
Breadcrumb
```
quando apropriado.
Validar pelo menos:
```text
1440px
1024px
<= 760px
```
Tabelas podem usar overflow horizontal quando inevitável, mas ações principais precisam continuar acessíveis.
Preservar:
- labels;
- foco;
- teclado;
- botões reais;
- semântica;
- contraste;
- status não dependente exclusivamente de cor.
Depois de implementar:
atualize:
```text
docs/modules/INCIDENTS.md
```
Crie, se ainda não existirem:
```text
docs/modules/AUDIT.md
docs/modules/NOTIFICATIONS.md
```
Esses documentos são DESCRITIVOS.
Eles não substituem a SPEC.
Se surgir problema estrutural:
```text
registrar em docs/execution-issues/
```
Não registrar:
- teste esperado falhando durante TDD;
- typo;
- erro intermediário corrigido;
- bug criado e corrigido na mesma execução sem relevância futura.
No final, produzir:
```text
EXECUTION ISSUES RECONCILIATION
```
com:
| Issue | Antes | Depois | Ação | Evidência | Bloqueia próxima fase? |
Issues existentes sem relação devem aparecer apenas se forem open e relevantes ao gate.
Não fingir que Prisma/deepmerge foi resolvido se não foi.
A expansão deve possuir testes proporcionais ao novo domínio.
Não considerar apenas happy path.
Cobrir:
- transições válidas;
- transições inválidas;
- permission-specific workflow quando aplicável;
- acknowledgement;
- acknowledgement duplicado;
- escalation;
- assignment;
- SLA state;
- metrics;
- domain events;
- actor attribution;
- categories.
- subscribe all;
- redaction;
- before/after;
- filtering;
- summary;
- detail;
- actor;
- event metadata.
- audience;
- permissions;
- preferences;
- unread count;
- filters;
- ownership;
- assigned user;
- inactive user.
Se a infraestrutura atual permitir sem inventar configuração complexa, adicione testes de controller/API relevantes.
Não declare E2E como PASS se banco/ambiente não permitirem execução.
Antes da implementação, registre a contagem disponível usando o mecanismo existente, por exemplo:
```bash
npm run count:loc
```
se existir.
Ao final execute novamente.
Se cloc estiver instalado e disponível sem modificar dependências, use também:
```bash
cloc ...
```
considerando principalmente código real:
```text
.ts
.tsx
.js
.mjs
```
e outras linguagens de implementação realmente usadas.
Não contar documentação/configuração como justificativa para a meta acadêmica.
No handoff informe:
```text
LOC antes
LOC depois
Delta
```
e explique aproximadamente onde o crescimento ocorreu:
```text
Incidents
Audit
Notifications
Event Bus/shared
Tests
```
Não crie código adicional para atingir um delta arbitrário.
NÃO:
- criar novos plugins;
- implementar Shift Handover;
- atualizar Prisma major;
- executar npm audit fix --force;
- criar Kafka/RabbitMQ;
- criar WebSocket infrastructure completa;
- redesenhar a aplicação;
- alterar outros plugins funcionalmente;
- criar sistema de email real;
- criar push/mobile;
- implementar SMS;
- refatorar todo Event Bus além do necessário;
- mexer novamente nos workspace boundaries sem blocker real;
- perseguir LOC artificialmente.
Execute obrigatoriamente:
```bash
npm run spec:check
npm run check:boundaries
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
```
Se existir e estiver aplicável:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-ap1.ps1
```
Também execute testes focados dos três plugins e Event Bus.
Se houver migration/schema:
execute validações Prisma apropriadas existentes no projeto.
Exemplo:
```bash
npx prisma validate
```
usando o schema correto.
Não aplique migration destrutiva em banco remoto sem necessidade.
Antes do handoff, percorra TODOS os critérios de aceite da nova SPEC.
Formato:
```text
AC-01 PASS
Evidence: ...

AC-02 PASS
Evidence: ...

AC-03 PARTIAL
Reason: ...
```
Não declarar:
```text
SPEC COMPLIANCE: PASS
```
se existir requisito obrigatório FAIL, PARTIAL ou BLOCKED.
Ao final declare:
```text
NEXT PLUGIN DEVELOPMENT GATE: READY
```
ou:
```text
NEXT PLUGIN DEVELOPMENT GATE: BLOCKED
```
Baseado nos resultados reais.
Um issue conhecido e não relacionado pode continuar aberto sem bloquear.
Execute:
```bash
git status --short
git diff --stat
git diff --check
git log --oneline -5
```
Esperado:
```text
SPEC já commitada
implementação sem commit
prompt registrado
docs atualizados
migrations novas quando necessárias
```
Não faça commit da implementação.
A resposta final deve conter:
```text
prompts/sessoes/2026-10-04-incidents-audit-notifications-enhancement.md
```
```text
Classification:
SPEC:
SPEC commit:
```
Resuma o que existia antes nos três plugins.
Liste funcionalidades adicionadas.
Liste funcionalidades adicionadas.
Liste funcionalidades adicionadas.
Liste apenas mudanças necessárias à integração.
Liste:
```text
models alterados
campos novos
migration criada
índices
```
Confirme:
```text
nenhum plugin importa implementação de outro plugin
check:boundaries PASS/FAIL
```
Tabela:
| Issue | Antes | Depois | Ação | Evidência | Bloqueia próxima fase? |
Informe testes novos e total da suíte.
```text
Antes:
Depois:
Delta:
```
Critério por critério.
Declare:
```text
NEXT PLUGIN DEVELOPMENT GATE: READY/BLOCKED
```
```text
SPEC commit:
working tree:
```
Não faça commits.
Sugira divisão lógica.
Uma divisão aceitável pode ser:
```text
feat(incidents): expand operational response workflow

feat(audit): add comprehensive domain event auditing

feat(notifications): add preferences and recipient policies
```
Todos utilizando:
```text
Agent: <agente real>
Spec: SPEC/2026-10-04-incident-response-audit-notifications.md
```
Se mudanças compartilhadas em Event Bus forem suficientemente independentes, pode sugerir um commit adicional:
```text
feat(events): support platform-wide audit subscriptions
```
Não crie dezenas de commits pequenos.
A execução deve transformar a situação atual:
```text
Incidents
  bom CRUD operacional
  poucos Domain Events

Audit
  tabela simples
  cobertura parcial de eventos

Notifications
  broadcast amplo
  preferences sem UI/API
```
em:
```text
Incidents
  fila operacional
  lifecycle consistente
  acknowledgement
  escalation
  SLA melhor
  eventos completos

          ↓ Event Bus

Audit
  cobertura geral
  histórico detalhado
  before/after
  redaction
  busca/detail/summary

Notifications
  recipients por permissão
  preferências reais
  listagem paginada
  unread count eficiente
  navegação operacional
```
sem criar dependências diretas entre os três plugins.
O resultado deve aumentar tanto a profundidade funcional quanto a rastreabilidade da plataforma, e não apenas o número de arquivos.

