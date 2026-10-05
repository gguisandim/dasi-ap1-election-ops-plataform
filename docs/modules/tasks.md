# Central de Tarefas

## 1. Objetivo

O módulo Central de Tarefas tem como objetivo permitir o planejamento, distribuição e acompanhamento das tarefas operacionais relacionadas a um pleito.

O módulo deve centralizar atividades que precisam ser realizadas pelas equipes, permitindo acompanhar responsáveis, prazos, prioridades, dependências e andamento das tarefas.

A interface principal deve possuir visualização em Kanban, facilitando o acompanhamento operacional.

---

## 2. Escopo

O módulo deve permitir:

- criar tarefas;
- editar tarefas;
- atribuir responsáveis;
- definir prioridade;
- definir prazo;
- acompanhar status;
- relacionar tarefas a um pleito;
- relacionar tarefas a zonas e locais eleitorais quando aplicável;
- criar dependências entre tarefas;
- adicionar comentários;
- visualizar histórico;
- filtrar tarefas;
- visualizar tarefas em Kanban;
- visualizar tarefas em lista;
- identificar tarefas atrasadas.

---

## 3. Entidade Tarefa

Uma tarefa deve possuir, no mínimo:

- identificador;
- título;
- descrição;
- status;
- prioridade;
- responsável;
- criador;
- pleito;
- zona eleitoral opcional;
- local eleitoral opcional;
- prazo;
- data de criação;
- data de atualização;
- data de conclusão.

### Status

Os status devem contemplar:

- PENDING
- IN_PROGRESS
- BLOCKED
- DONE
- CANCELLED

### Prioridades

As prioridades devem contemplar:

- LOW
- MEDIUM
- HIGH
- CRITICAL

---

## 4. Criação de tarefa

Usuários autorizados devem poder criar tarefas.

Na criação deve ser possível informar:

- título;
- descrição;
- pleito;
- zona;
- local;
- responsável;
- prioridade;
- prazo.

Título e pleito são obrigatórios.

A zona e o local são opcionais, pois algumas tarefas podem ser gerais para todo o pleito.

---

## 5. Responsáveis

Uma tarefa pode possuir um responsável.

O responsável deve utilizar os usuários já existentes na plataforma.

Não deve ser criada uma entidade paralela de usuários.

Deve ser possível alterar o responsável enquanto a tarefa estiver ativa.

---

## 6. Dependências

Uma tarefa pode depender de uma ou mais tarefas.

Exemplo:

Configurar equipamentos
↓
depende de
↓
Entregar equipamentos no local

Uma tarefa que possui dependências não concluídas deve apresentar visualmente que está bloqueada por dependências.

O sistema deve impedir dependência circular entre tarefas.

---

## 7. Kanban

O módulo deve possuir uma visualização Kanban.

As colunas devem representar:

- Pendente;
- Em andamento;
- Bloqueada;
- Concluída.

Tarefas canceladas não precisam aparecer no Kanban principal.

Cada card deve apresentar pelo menos:

- título;
- prioridade;
- responsável;
- prazo;
- local ou zona quando existir.

Sempre que possível, permitir movimentação entre colunas respeitando as regras de negócio do projeto.

---

## 8. Visualização em lista

Além do Kanban, deve existir uma visualização em lista.

A lista deve permitir filtros por:

- pleito;
- zona;
- local;
- responsável;
- status;
- prioridade.

Também deve ser possível identificar tarefas atrasadas.

---

## 9. Prazos

Uma tarefa deve ser considerada atrasada quando:

- possuir prazo anterior ao momento atual;
- e não estiver DONE;
- e não estiver CANCELLED.

O atraso deve ser calculado a partir dos dados existentes, evitando criar estado redundante quando não for necessário.

---

## 10. Comentários

Usuários autorizados podem adicionar comentários às tarefas.

Cada comentário deve possuir:

- autor;
- conteúdo;
- data de criação.

Comentários devem utilizar os usuários existentes da plataforma.

---

## 11. Histórico

Alterações relevantes devem gerar histórico.

Exemplos:

- tarefa criada;
- responsável alterado;
- status alterado;
- prioridade alterada;
- prazo alterado;
- dependência adicionada/removida;
- tarefa concluída;
- tarefa cancelada.

Cada registro deve indicar:

- ação;
- usuário;
- data;
- descrição.

---

## 12. Dashboard

O módulo deve apresentar indicadores operacionais.

No mínimo:

- total de tarefas;
- pendentes;
- em andamento;
- bloqueadas;
- concluídas;
- atrasadas;
- críticas.

Também deve apresentar uma área destacando tarefas que exigem atenção, principalmente:

- tarefas CRITICAL;
- tarefas atrasadas;
- tarefas bloqueadas.

---

## 13. Integração com entidades existentes

O módulo deve reutilizar:

- Election;
- ElectoralZone;
- PollingPlace;
- User.

Não criar versões próprias dessas entidades.

---

## 14. RBAC

O módulo deve possuir permissões equivalentes a:

- tasks.read
- tasks.manage

`tasks.read` permite consultar tarefas.

`tasks.manage` permite criar, editar, atribuir responsáveis, comentar e alterar status.

Administradores devem possuir todas as permissões.

As demais roles devem seguir o padrão de distribuição de permissões existente no projeto.

---

## 15. Event Bus

Eventos relevantes devem ser publicados utilizando o Event Bus existente.

Eventos recomendados:

- task.created
- task.assigned
- task.status_changed
- task.completed
- task.blocked

Outros módulos devem poder reagir a esses eventos sem importar diretamente a implementação interna da Central de Tarefas.

---

## 16. Backend

Implementar utilizando o padrão arquitetural existente no projeto.

Quando aplicável:

- NestJS Module;
- Controller;
- Service;
- DTOs;
- class-validator;
- Prisma;
- RBAC;
- Event Bus.

Os endpoints devem seguir as convenções existentes da API.

---

## 17. Frontend

Criar um plugin seguindo o padrão visual e arquitetural dos demais módulos.

O módulo deve possuir pelo menos:

### Dashboard

Indicadores e tarefas que exigem atenção.

### Kanban

Visualização das tarefas por status.

### Lista

Tabela/listagem com filtros.

### Nova tarefa

Formulário para criação.

### Detalhes da tarefa

Deve apresentar:

- informações gerais;
- responsável;
- prazo;
- prioridade;
- dependências;
- comentários;
- histórico.

---

## 18. Regras arquiteturais

A implementação deve:

- seguir o AGENTS.md;
- respeitar os limites entre plugins;
- reutilizar entidades e serviços compartilhados;
- não importar implementações internas de outros plugins;
- evitar duplicação de domínio;
- utilizar RBAC existente;
- utilizar Event Bus para comunicação entre módulos;
- preservar funcionalidades existentes;
- seguir o design system existente.

---

## 19. Execução em campo

Tarefas podem ser classificadas por modo de execução: `OFFICE` (padrão), `FIELD` ou `MIXED`. A classificação apenas identifica tarefas que podem originar uma operação de campo; nenhuma tarefa é convertida automaticamente.

Tarefas de campo podem possuir requisitos operacionais:

- `requiredTeamSize`, o tamanho mínimo da equipe;
- especialidades exigidas, armazenadas em `TaskSpecialtyRequirement` e referenciando a entidade `FieldSpecialty` existente, sem rótulos duplicados.

Localização e prioridade já existem na tarefa e não são duplicadas.

O responsável operacional de campo não é um segundo eixo de assignment na tarefa: ele vive no Dispatch, que carrega equipe e membro. `assigneeId` continua sendo o responsável usuário.

Uma tarefa em modo `FIELD` pode originar um Dispatch. A relação é persistida por `FieldDispatch.taskId` e a tarefa continua sendo controlada pelo domínio Tasks: `Dispatch COMPLETED` registra evento e timeline, mas não altera o status da tarefa. O detalhe da tarefa mostra os despachos vinculados com equipe, status, tempo e link para Field Teams, sem duplicar a interface do outro plugin.

A UI consulta `GET /field-teams/specialties` e `GET /field-teams/dispatches?taskId=` por HTTP público; não há import de implementação entre plugins.

## 21. Gestão de trabalho (subtarefas, checklist, rótulos, marcos, filtros, lote, grafo e carga)

A evolução definida em `SPEC/2026-10-05-platform-administration-work-improvements.md` (seção 4) adiciona capacidades de gestão de trabalho sem alterar a propriedade de domínio de Tasks sobre a entidade `Task`.

### Subtarefas

- `Task.parentId` forma hierarquia de profundidade máxima 2: uma tarefa com pai não pode receber subtarefas.
- `GET/POST /api/tasks/:id/subtasks`; `POST /api/tasks` também aceita `parentId`.
- A subtarefa herda o pleito do pai e, quando zona/local são omitidos, herda a localização do pai.
- Uma tarefa com subtarefas não terminais (`status` diferente de `DONE`/`CANCELLED`) não pode ser concluída.
- Emite `task.subtask_created`.

### Checklist interno

- Modelo `TaskChecklistItem` (`title`, `order` único por tarefa, `done`, `doneAt`, `doneById`).
- `POST /api/tasks/:id/checklist-items`, `PATCH/DELETE /api/tasks/checklist-items/:itemId`.
- `done`/`doneAt`/`doneById` são definidos pelo servidor; o cliente nunca envia timestamps.
- Não bloqueia transições de status e não se confunde com Preparation Checklists.

### Rótulos

- `TaskLabel` (`name` único) e `TaskLabelAssignment`.
- `GET/POST /api/tasks/labels`, `DELETE /api/tasks/labels/:id`.
- `PATCH /api/tasks/:id` aceita `labelIds` (substituição do conjunto); `GET /api/tasks` aceita `labelId`.

### Marcos

- `TaskMilestone` (`electionId`, `name`, `description?`, `dueAt?`) e `Task.milestoneId` opcional.
- `GET/POST /api/tasks/milestones`, `PATCH /api/tasks/milestones/:id`.
- O marco precisa pertencer ao mesmo pleito da tarefa; `GET /api/tasks` aceita `milestoneId`.

### Filtros salvos

- `TaskSavedFilter` privado por usuário, único por `(userId, name)`.
- `GET/POST /api/tasks/saved-filters`, `DELETE /api/tasks/saved-filters/:id`; filtro de outro usuário responde 404.
- As rotas são declaradas antes de `GET /api/tasks/:id` para não serem capturadas como identificador.

### Ações em lote

- `PATCH /api/tasks/bulk` com `ids` (1 a 100) e ao menos um de `status`, `priority`, `assigneeId`, `addLabelIds`, `removeLabelIds`.
- Exige `tasks.manage`; é atômico (valida todas as tarefas antes de aplicar) e registra histórico por tarefa.
- Emite um único evento `task.bulk_updated` com `count` e `fields`.

### Grafo de dependências

- `GET /api/tasks/:id` inclui `dependents`; `GET /api/tasks/:id/dependencies` retorna `blockedBy`, `blocks` e `blockedByDependencies`.
- `blockedByDependencies` continua derivado (dependência obrigatória não concluída) e nunca persistido; ciclos seguem rejeitados na criação.

### Carga de trabalho

- `GET /api/tasks/workload` com filtros `electionId`, `electoralZoneId`, `pollingPlaceId`.
- Resposta derivada (sem persistência): `byAssignee` (total/pending/inProgress/blocked/overdue/critical), `byStatus`, `byPriority` e `byTeam`.
- `byTeam` usa o `Task.dispatches` → `FieldDispatch.teamId` existente; tarefas sem despacho ativo aparecem em "Sem equipe". Não há balanceamento automático.

### Eventos e RBAC

- Eventos novos: `task.subtask_created` e `task.bulk_updated`; eventos existentes são reutilizados.
- Nenhuma permissão nova: `tasks.read`/`tasks.manage` continuam governando; lote exige `tasks.manage` validado no backend.

## 20. Critérios de aceite

O módulo será considerado funcional quando for possível:

1. criar uma tarefa;
2. atribuir responsável;
3. definir prioridade e prazo;
4. visualizar a tarefa no Kanban;
5. alterar seu status;
6. criar dependência entre tarefas;
7. identificar tarefa bloqueada por dependência;
8. adicionar comentários;
9. consultar histórico;
10. filtrar tarefas;
11. identificar tarefas atrasadas;
12. visualizar indicadores no dashboard.