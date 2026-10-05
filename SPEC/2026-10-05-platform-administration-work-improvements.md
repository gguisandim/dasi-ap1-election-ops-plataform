# Administração da plataforma e gestão de trabalho

**Data:** 2026-10-05
**Status:** proposed
**Plugins:** `plugins/system/access-control`, `plugins/operations/tasks`, `plugins/operations/preparation-checklists`

## 1. Contexto

Três domínios já implementados possuem a base funcional, mas não oferecem o nível de administração e de gestão de trabalho esperado para operação real:

- **Access Control** autentica e mantém usuários, porém não administra RBAC: não é possível criar ou ajustar perfis, inspecionar o catálogo de permissões, visualizar a matriz perfil × permissão nem entender as permissões efetivas de um usuário.
- **Tasks** cobre CRUD, Kanban, comentários e dependências simples, mas não possui hierarquia, rótulos, marcos, filtros salvos, ações em lote nem leitura de carga de trabalho.
- **Preparation Checklists** executa templates, itens, evidências e aprovação, mas não calcula prontidão, não separa bloqueadores críticos, não trabalha com prazo nem protege checklists já executados contra edições futuras de template.

Esta SPEC define a evolução desses três plugins sem alterar a propriedade de domínio já estabelecida.

## 2. Escopo e não escopo

### 2.1 Escopo

- administração de perfis (roles) e do catálogo de permissões em Access Control;
- permissões efetivas derivadas, proteção de perfis de sistema e ciclo de vida de conta;
- hierarquia simples de subtarefas, checklist interno, rótulos, marcos, filtros salvos, ações em lote, grafo de dependências e carga de trabalho em Tasks;
- readiness score, bloqueadores críticos, prazos, versionamento de template, visão consolidada de preparação e consistência de aprovação em Preparation Checklists;
- novas estruturas de persistência, eventos de domínio e páginas de frontend estritamente necessárias.

### 2.2 Não escopo

- recuperação de senha por e-mail ou qualquer fluxo de e-mail;
- redesign de Dispatch/operação de campo (`field-teams` permanece owner do Dispatch);
- scheduler automático, solver de alocação ou balanceamento automático de carga;
- alteração do plugin Audit;
- alteração de migrations históricas;
- realocação de regras de negócio para `apps/web` ou `apps/api`.

### 2.3 Propriedade de domínio preservada

```text
Access Control         → identidade, perfis e permissões
Tasks                  → Task, subtarefa, rótulo, marco, dependência
Preparation Checklists → preparação, readiness e aprovação
Field Teams            → Dispatch (não redesenhado nesta SPEC)
```

## 3. Access Control — administração de RBAC

### 3.1 Catálogo de permissões

As permissões continuam definidas exclusivamente em `packages/security/src/permissions.ts`.

Novas permissões:

```text
roles.read
roles.manage
```

Justificativa: `users.read`/`users.manage` governam contas de usuário; a definição de perfis e a atribuição de permissões têm raio de impacto distinto e precisam de autorização própria. Não são redundantes com `users.*`.

Regras:

- o backend nunca aceita uma string de permissão arbitrária; toda chave enviada precisa pertencer a `PLATFORM_PERMISSION_KEYS`;
- o catálogo exposto é derivado de `PERMISSIONS` de `@eops/security`, sem lista paralela mantida no plugin;
- o seed deve conceder `roles.*` de acordo com o perfil (ADMIN completo; SUPERVISOR sem `users.manage` e sem `roles.manage`; demais perfis recebem apenas as permissões `.read` conforme a regra vigente).

Endpoint:

```http
GET /api/permissions
```

Resposta: grupos por domínio com as chaves e a ação correspondente.

### 3.2 Perfis (roles)

Modelo `Role` passa a possuir `active Boolean @default(true)`.

Endpoints:

```http
GET    /api/roles
GET    /api/roles/:id
POST   /api/roles
PATCH  /api/roles/:id
DELETE /api/roles/:id
```

Regras:

- `POST` aceita `name`, `description?`, `key?`, `permissionKeys`. `key` é derivado do nome quando omitido, normalizado e único;
- `permissionKeys` é validado contra o catálogo; chave inexistente gera erro;
- `PATCH` aceita `name?`, `description?`, `permissionKeys?`, `active?`; substituir `permissionKeys` recalcula imediatamente as permissões efetivas dos usuários do perfil;
- `DELETE` só é permitido quando o perfil não é de sistema **e** não possui usuários vinculados; caso contrário o erro recomenda desativação;
- `PATCH { active: false }` é o caminho preferencial para retirar um perfil de circulação; perfis de sistema não podem ser desativados.

### 3.3 Proteção de perfis de sistema

Perfis com `system = true` (semeados pela plataforma):

- não podem ser excluídos;
- não podem ser desativados;
- mantêm `key` imutável;
- podem ter `name`, `description` e `permissionKeys` ajustados.

Invariantes globais de administração, validadas no backend:

```text
I1  pelo menos um perfil ativo precisa conceder users.manage
I2  pelo menos um usuário ACTIVE precisa possuir, por perfil ativo, users.manage
I3  um usuário não pode alterar o próprio status para um valor não-ACTIVE
I4  um usuário não pode remover de si a atribuição de perfil que garantiria I2
```

As invariantes são verificadas em: alteração de status de usuário, atribuição/remoção de perfil, edição de `permissionKeys` de perfil e desativação de perfil.

### 3.4 Usuários, múltiplos perfis e permissões efetivas

Endpoints preservados:

```http
GET   /api/users
GET   /api/users/:id
POST  /api/users
PATCH /api/users/:id
GET   /api/users/roles
```

Novos endpoints explícitos de atribuição:

```http
POST   /api/users/:id/roles          { roleIds }   (aditivo)
DELETE /api/users/:id/roles/:roleId  (remocão)
PATCH  /api/users/:id/roles          { roleIds }   (substituição do conjunto)
```

`PATCH /api/users/:id` com `roleIds` permanece suportado para compatibilidade e delega à mesma validação.

O detalhe do usuário passa a retornar:

```text
roles                   perfis vinculados
permissionsByRole       permissões herdadas de cada perfil
effectivePermissions    união ordenada das permissões dos perfis ativos
```

`effectivePermissions` é derivado e **não é persistido**.

### 3.5 Permissões efetivas na autorização

`AuthenticationGuard` deixa de confiar exclusivamente nas permissões gravadas no token e passa a resolver, por requisição, o usuário e suas permissões a partir da persistência:

- token válido + usuário inexistente ou não `ACTIVE` ⇒ 401;
- `roles` e `permissions` do request passam a refletir o estado atual de perfis ativos;
- alterações administrativas (perfil, permissões, status) passam a valer imediatamente, sem aguardar novo login.

Motivação: desativar uma conta ou revogar um perfil precisa ter efeito real; sem isso o ciclo de vida de conta seria apenas cosmético durante a validade de 8 horas do token.

### 3.6 Ciclo de vida de conta

Estados existentes do enum `UserStatus`: `ACTIVE`, `INACTIVE`, `LOCKED`.

Endpoint:

```http
PATCH /api/users/:id/status  { status }
```

Regras: aplicam-se I2 e I3; nenhuma transição é proibida por si só, exceto as que violem as invariantes. Não existe desbloqueio automático nem recuperação de senha.

## 4. Tasks — gestão de trabalho

### 4.1 Subtarefas

`Task` recebe `parentId String?` (auto-relacionamento).

Regras:

- profundidade máxima 2 (uma tarefa com `parentId` não pode receber subtarefas);
- subtarefa não pode ser pai de si mesma nem criar ciclo;
- subtarefa precisa pertencer ao mesmo pleito do pai;
- localização (zona/local) é herdada do pai quando omitida;
- uma tarefa com subtarefas não concluídas (`status` diferente de `DONE`/`CANCELLED`) não pode ser concluída;
- o pai não é removido de forma cascata ao alterar subtarefas.

Endpoints:

```http
GET  /api/tasks/:id/subtasks
POST /api/tasks/:id/subtasks
```

`POST /api/tasks` com `parentId` também é aceito.

Evento: `task.subtask_created`.

### 4.2 Checklist interno da tarefa

Modelo novo `TaskChecklistItem` (`taskId`, `title`, `order`, `done`, `doneAt`, `doneById`).

- é um conjunto plano de pequenos passos internos da tarefa;
- não se confunde com Preparation Checklist e não possui evidência nem aprovação;
- **não bloqueia** transições de status;
- ordenação única por tarefa.

Endpoints:

```http
POST   /api/tasks/:id/checklist-items
PATCH  /api/tasks/checklist-items/:itemId
DELETE /api/tasks/checklist-items/:itemId
```

### 4.3 Rótulos

Modelos novos `TaskLabel` (`name` único) e `TaskLabelAssignment`.

```http
GET    /api/tasks/labels
POST   /api/tasks/labels
DELETE /api/tasks/labels/:id
```

`PATCH /api/tasks/:id` aceita `labelIds` (substituição do conjunto). `GET /api/tasks` aceita `labelId` como filtro.

### 4.4 Marcos

Modelo novo `TaskMilestone` (`electionId`, `name`, `description?`, `dueAt?`). `Task` recebe `milestoneId String?` opcional.

```http
GET   /api/tasks/milestones?electionId=
POST  /api/tasks/milestones
PATCH /api/tasks/milestones/:id
```

`PATCH /api/tasks/:id` aceita `milestoneId` (ou `null`). `GET /api/tasks` aceita `milestoneId` como filtro. O marco precisa pertencer ao mesmo pleito da tarefa.

### 4.5 Filtros salvos

Modelo novo `TaskSavedFilter` (`userId`, `name`, `filters Json`), único por `(userId, name)`.

```http
GET    /api/tasks/saved-filters
POST   /api/tasks/saved-filters
DELETE /api/tasks/saved-filters/:id
```

- leitura, criação e remoção são restritas ao próprio usuário; um filtro de outro usuário responde 404;
- `filters` é persistido como snapshot do contrato `TaskFilters`, sem validação semântica de cada chave além de objeto simples.

### 4.6 Ações em lote

```http
PATCH /api/tasks/bulk
```

Payload: `ids: string[]` (1 a 100) e ao menos um de `status`, `priority`, `assigneeId`, `addLabelIds`, `removeLabelIds`.

Regras:

- exige `tasks.manage` no backend;
- a operação é atômica: se qualquer tarefa falhar em qualquer validação (dependências não concluídas, subtarefas pendentes, responsável inativo, transição inválida), nada é aplicado;
- identificador inexistente invalida o lote;
- histórico por tarefa é registrado individualmente;
- evento único `task.bulk_updated` com a contagem e os campos alterados.

### 4.7 Grafo de dependências

A detecção de ciclo existente é preservada e passa a ser exercitada também na leitura.

- `GET /api/tasks/:id` inclui `dependents` (tarefas que dependem desta);
- `GET /api/tasks/:id/dependencies` retorna `blockedBy`, `blocks`, `blockedByDependencies`;
- `blockedByDependencies` permanece calculado (dependência obrigatória não concluída) e nunca persistido;
- o ciclo continua sendo rejeitado na criação da dependência.

### 4.8 Carga de trabalho

```http
GET /api/tasks/workload
```

Filtros: `electionId`, `electoralZoneId`, `pollingPlaceId`.

Resposta derivada, sem persistência:

```text
byAssignee   tarefas por responsável (total, pending, inProgress, blocked, overdue, critical)
byStatus     contagem por status
byPriority   contagem por prioridade
byTeam       contagem por equipe de campo vinculada via dispatch existente; tarefas sem dispatch ativo ficam em "sem equipe"
```

Não há balanceamento, sugestão ou redistribuição automática.

## 5. Preparation Checklists — readiness

### 5.1 Readiness score

Cálculo puro e derivado:

```text
readiness = concluídos obrigatórios / total de obrigatórios
```

- sem itens obrigatórios: usa concluídos / total;
- sem itens: 0.

Não há ponderação por criticidade: a SPEC não identifica justificativa de domínio para pesos e introduzi-los criaria um número sem significado acordado.

### 5.2 Bloqueadores críticos

Lista derivada, exposta separadamente dos demais itens:

```text
item obrigatório não concluído
item com evidência obrigatória sem evidência registrada
item com status BLOCKED
```

### 5.3 Prazo

`PreparationChecklist` e `PreparationChecklistItem` recebem `dueAt DateTime?`.

Estados derivados (somente para checklist não aprovado; aprovado é sempre `ON_TRACK`):

```text
OVERDUE   dueAt anterior a agora
AT_RISK   dueAt dentro da janela de 24 horas
ON_TRACK  demais casos, inclusive sem dueAt
```

A janela de 24 horas é constante exportada, não configurável nesta parte.

### 5.4 Versionamento de template

`PreparationChecklistTemplate` recebe `version Int @default(1)`.

- a versão é incrementada quando a alteração muda a semântica do template: `description`, `locationType` ou qualquer mutação de itens (adição de item);
- alteração apenas de `name` não incrementa;
- o checklist grava `templateVersion` no momento da criação;
- os itens do checklist continuam sendo cópias dos itens do template, garantindo que edições futuras do template não alterem checklists já executados;
- o detalhe expõe `templateVersion` e a versão atual do template, tornando a divergência visível.

### 5.5 Visão consolidada

```http
GET /api/preparation-checklists/overview
```

Filtros equivalentes aos da listagem. Cada linha:

```text
local (zona + local de votação)
readiness (%)
criticalBlockers (quantidade)
owner (responsável)
dueAt + deadlineState
status de aprovação
```

### 5.6 Consistência de aprovação

A aprovação passa a falhar quando:

- o checklist já está aprovado;
- não há responsável atribuído ou o responsável não está ativo;
- algum item obrigatório não está concluído;
- algum item exige evidência e não possui nenhuma registrada;
- algum item de checklist está `BLOCKED`;
- o checklist está `BLOCKED`.

Prazo vencido **não** bloqueia aprovação: o deadline é informativo e não substitui a decisão do aprovador.

### 5.7 Itens atualizados e eventos de readiness

`readiness` e `deadlineState` são recalculados e devolvidos em qualquer resposta de checklist, item, evidência, responsável ou aprovação.

## 6. Persistência

Migration nova, sem alterar migrations históricas:

```text
packages/database/prisma/migrations/202610050001_administration_work_improvements/migration.sql
```

Alterações:

```text
Role                                + active
Task                                + parentId, + milestoneId
TaskChecklistItem                   novo
TaskLabel                           novo
TaskLabelAssignment                 novo
TaskMilestone                       novo
TaskSavedFilter                     novo
PreparationChecklistTemplate        + version
PreparationChecklist                + dueAt, + templateVersion
PreparationChecklistItem            + dueAt
```

Índices mínimos esperados:

```text
Task(parentId)
Task(milestoneId)
TaskChecklistItem(taskId, order)
TaskSavedFilter(userId, name) único
TaskLabel(name) único
TaskMilestone(electionId)
PreparationChecklist(dueAt)
```

O seed é atualizado apenas para conceder as novas permissões conforme a regra de perfil descrita em 3.1.

## 7. Eventos

Namespace existente é preservado; não se cria um segundo esquema de nomes.

Novos eventos:

```text
access.role_created
access.role_updated
access.role_deactivated
access.user_roles_changed
access.user_status_changed
task.subtask_created
task.bulk_updated
preparation_checklist.readiness_changed
preparation_checklist.blocker_detected
```

Eventos existentes reutilizados: `task.blocked`, `preparation_checklist.approved`, `preparation_checklist.blocked`.

Regras:

- nenhum evento por item individual de checklist ou por campo trivial;
- `preparation_checklist.readiness_changed` é emitido somente quando o readiness calculado muda de fato;
- `preparation_checklist.blocker_detected` é emitido somente quando surge um bloqueador crítico que antes não existia;
- `task.bulk_updated` é único por operação em lote.

Observação: o pedido original citava `preparation.*`; adota-se `preparation_checklist.*` para não duplicar namespace já existente.

## 8. Auditoria

- eventos administrativos passam a ser auditados pelo `AuditSubscriber` existente, que já usa `subscribeAll`;
- para evitar registro duplicado, a escrita direta de `auditEvent` hoje existente em `users.update` é substituída pela emissão dos eventos correspondentes;
- `inferEntityType` não é alterado: eventos `access.*` são registrados com `entityType = "access"` e `entityId` do registro afetado;
- o plugin Audit não é modificado.

## 9. RBAC

```text
Access Control    roles.read  → consultar perfis, catálogo e matriz
Access Control    roles.manage → criar, editar, desativar e excluir perfis
Access Control    users.read / users.manage → preservados
Tasks             tasks.read / tasks.manage → preservados; lote exige tasks.manage
Preparation       preparation-checklists.read/manage/approve → preservados
```

Nenhuma permissão nova é criada para Tasks ou Preparation Checklists.

A autorização é sempre validada no backend; esconder a ação no frontend não substitui a validação.

## 10. Frontend

Access Control:

```text
/users        lista de usuários com status e perfis
/users/:id    detalhe com perfis, permissões herdadas e permissões efetivas, atribuição/remoção de perfil e mudança de status
/roles        lista de perfis com origem (sistema/custom) e estado
/roles/:id    detalhe do perfil
/roles/matrix matriz perfil × permissão
```

Tasks (melhoria das páginas existentes):

```text
detalhe        subtarefas, checklist interno, rótulos, marco, grafo de dependências
lista          filtros por rótulo/marco, filtros salvos, seleção múltipla e ações em lote
dashboard      carga de trabalho por responsável, equipe, prioridade e status
```

Preparation Checklists:

```text
/preparation-checklists/overview   visão consolidada de readiness, bloqueadores, responsável, prazo e aprovação
detalhe                            readiness, bloqueadores críticos, prazo e versão de template
```

Regras visuais:

- `docs/UI-DESIGN-GUIDE.md` é obrigatório;
- CSS específico em CSS Modules do próprio plugin;
- estados de loading, erro e vazio explícitos;
- ações destrutivas (excluir perfil, desativar conta) não competem com a ação primária;
- nenhuma implementação interna de outro plugin é importada pelo shell.

## 11. Limitações declaradas

- não há paginação nova; os endpoints mantêm o padrão vigente de retorno completo com filtros;
- `task.bulk_updated` não é transacional em relação a eventos externos, apenas à persistência;
- o versionamento de template cobre as mutações existentes (edição do template e adição de item); edição e remoção individual de item de template não existem nesta parte;
- a resolução de permissões por requisição adiciona uma consulta ao banco por requisição autenticada.

## 12. Critérios de aceite

```text
AC-01  permissões roles.read e roles.manage existem no catálogo e no seed
AC-02  perfil pode ser criado, consultado, atualizado e desativado via API
AC-03  perfil de sistema não pode ser excluído nem desativado
AC-04  perfil com usuários vinculados não pode ser excluído
AC-05  permissionKeys fora do catálogo são rejeitadas
AC-06  usuário pode receber múltiplos perfis, com atribuição e remoção explícitas
AC-07  detalhe do usuário expõe roles, permissionsByRole e effectivePermissions derivados
AC-08  effectivePermissions não é persistido
AC-09  invariantes I1–I4 são validadas no backend
AC-10  ciclo de vida de conta permite ACTIVE/INACTIVE/LOCKED respeitando I2 e I3
AC-11  AuthenticationGuard resolve permissões atuais e rejeita usuário inativo
AC-12  autenticação ausente/ inválida continua respondendo 401 e permissão insuficiente 403
AC-13  catálogo de permissões é exposto por endpoint derivado de @eops/security
AC-14  matriz perfil × permissão é renderizada a partir de dados reais
AC-15  subtarefa respeita profundidade 2, mesmo pleito e ausência de ciclo
AC-16  tarefa com subtarefas pendentes não pode ser concluída
AC-17  checklist interno não bloqueia status e é ordenado por tarefa
AC-18  rótulos podem ser criados, atribuídos e usados como filtro
AC-19  marco é opcional, pertence ao pleito e filtra tarefas
AC-20  filtros salvos são privados do usuário
AC-21  ação em lote exige tasks.manage e é atômica
AC-22  ciclo de dependência continua sendo rejeitado
AC-23  blockedByDependencies é calculado e não persistido
AC-24  carga de trabalho é derivada por responsável, equipe, prioridade e status
AC-25  readiness é calculado por itens obrigatórios concluídos
AC-26  bloqueadores críticos são listados separadamente
AC-27  deadlineState é calculado (ON_TRACK/AT_RISK/OVERDUE) sem persistência
AC-28  template possui version e checklist registra templateVersion de criação
AC-29  edição futura de template não altera checklist já executado
AC-30  visão consolidada de preparação expõe local, readiness, bloqueadores, responsável, prazo e aprovação
AC-31  aprovação é rejeitada nas condições de inconsistência definidas
AC-32  eventos novos são emitidos apenas nos casos previstos e sem excesso
AC-33  mudanças administrativas são auditáveis pelo subscriber existente sem duplicidade
AC-34  nenhum import interno cross-plugin é introduzido
AC-35  migration nova preserva migrations históricas
AC-36  regras críticas possuem testes focados
AC-37  typecheck, lint, testes, build, boundaries, db:validate e spec:check passam
```

## 13. Arquivos principais

```text
plugins/system/access-control/**
plugins/operations/tasks/**
plugins/operations/preparation-checklists/**
packages/security/src/permissions.ts
packages/event-bus/src/contracts.ts
packages/database/prisma/schema.prisma
packages/database/prisma/migrations/202610050001_administration_work_improvements/migration.sql
packages/database/prisma/seed.ts
docs/modules/tasks.md
docs/modules/preparation-checklist.md
```

Alterações em arquivos compartilhados limitam-se ao necessário para catálogo, eventos, persistência e registro.
