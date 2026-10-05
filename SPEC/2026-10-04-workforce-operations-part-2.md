# Workforce Operations — Parte 2

- Status: Aprovada para implementação
- Data: 2026-10-04
- Escopo: `plugins/operations/field-teams`, `plugins/operations/tasks`, `packages/shared/src/workforce.ts`, `packages/database/prisma/*`, `packages/event-bus/src/contracts.ts`
- Complementa: `SPEC/2026-10-04-workforce-operations-part-1.md` sem alterar seus critérios

## Contexto

A Parte 1 separou planejamento de workforce: Field Teams owns equipes, membros, especialidades e disponibilidade; Shifts owns turnos, assignments, cobertura e conflitos. Tasks owns tarefas, dependências, comentários e histórico. Falta a camada de execução operacional em campo: transformar uma demanda em um envio operacional com responsável, estado, deslocamento e resultado.

Sem essa camada, a plataforma responde "quando a equipe trabalha" e "quem está disponível", mas não "quem foi enviado, onde está no lifecycle e qual foi o resultado".

## Estado atual

- `FieldMember.status` representa disponibilidade base; `FieldMemberUnavailability` representa indisponibilidade com intervalo e ator.
- Shifts persiste `FieldShift`, `FieldShiftAssignment`, presença, ausência, sobreaviso e histórico com `shifts.manage`.
- Tasks possui CRUD, dashboard, kanban, detalhe, comentários, dependências e histórico; `Task.assigneeId` referencia `User`.
- Não existe conceito persistido de envio operacional (dispatch), nem timeline operacional de campo.
- Tasks não distingue tarefa de escritório de tarefa de campo e não possui requisitos operacionais de campo.
- Audit observa o Event Bus por `subscribeAll`; Notifications usa catálogo público, permissão do evento, usuários ativos e preferências.

## Problemas

1. Não há registro de quem foi enviado para executar uma demanda nem do resultado do envio.
2. Não existe lifecycle verificável entre solicitação, aceite, deslocamento, chegada, execução e conclusão.
3. Disponibilidade, conflitos e capabilities não participam de nenhuma decisão de envio.
4. Tarefas de campo não podem originar execução operacional rastreável.
5. A operação não possui fila, timeline nem métricas de tempo por etapa.

## Objetivos

- criar `FieldDispatch` como conceito persistido, com owner único em Field Teams;
- definir lifecycle explícito, matriz de transição compartilhada e timestamps derivados;
- validar elegibilidade de equipe/membro antes do envio, sem solver automático;
- calcular capability match entre demanda e equipe, com override manual justificado;
- permitir que Task `FIELD` origine Dispatch sem criar dependência direta entre plugins;
- expor fila, detalhe, timeline, métricas derivadas e dashboard operacional;
- emitir Domain Events pequenos, tipados e atribuídos ao ator autenticado;
- preservar boundaries, RBAC, Audit, Notifications, Shifts e Tasks existentes.

## Domain ownership

### Field Teams

Field Teams é o owner de Dispatch: criação, atribuição de equipe/membro, lifecycle, timeline, cancelamento, conclusão, capability match, elegibilidade e métricas derivadas.

### Tasks

Tasks continua owner de Task, incluindo classificação de execução (`executionMode`), requisitos operacionais de campo, `assigneeId` (usuário), dependências, comentários e histórico. Tasks não muta `FieldDispatch` e não cria lifecycle paralelo.

### Shifts

Shifts continua owner de turnos, assignments, presença, ausência, sobreaviso, cobertura e conflitos. Esta SPEC apenas consulta esses dados para elegibilidade; não cria, edita nem encerra turnos.

### Conceitos que não podem ser confundidos

| Conceito | Pergunta que responde |
| --- | --- |
| Shift | quando alguém está escalado para trabalhar |
| Task | o que precisa ser realizado |
| Dispatch | quem foi enviado, onde está no lifecycle e qual foi o resultado |

## Dispatch model

`FieldDispatch` representa um envio operacional. Campos persistidos:

- `id`, `teamId`, `memberId?`, `taskId?`, `incidentId?`;
- `status`, `priority`;
- `title`, `notes?`, `locationLabel?`, `electoralZoneId?`, `pollingPlaceId?`;
- `capabilityMatch?`, `capabilityOverrideReason?`;
- `requestedAt`, `dispatchedAt?`, `acceptedAt?`, `rejectedAt?`, `departedAt?`, `arrivedAt?`, `startedAt?`, `completedAt?`, `cancelledAt?`;
- `rejectionReason?`, `cancellationReason?`, `completionSummary?`, `completionResult?`;
- `createdById?`.

Regras:

- `taskId` e `incidentId` são opcionais e mutuamente independentes; nenhum dos dois é obrigatório;
- demanda genérica sem `taskId` nem `incidentId` é permitida somente com `title` informado, justificada por apoio operacional pontual que ainda não foi formalizado como tarefa;
- o demandante não informa `status` nem timestamps; ambos são derivados pelo servidor;
- `memberId` é opcional: o dispatch pode ser de equipe inteira ou de um membro específico.

## Dispatch lifecycle

```text
REQUESTED → DISPATCHED → ACCEPTED → EN_ROUTE → ARRIVED → IN_PROGRESS → COMPLETED
```

Estados alternativos: `REJECTED` e `CANCELLED`. `COMPLETED`, `REJECTED` e `CANCELLED` são terminais.

Matriz de transição compartilhada:

| De | Para permitido |
| --- | --- |
| `REQUESTED` | `DISPATCHED`, `REJECTED`, `CANCELLED` |
| `DISPATCHED` | `ACCEPTED`, `REJECTED`, `CANCELLED` |
| `ACCEPTED` | `EN_ROUTE`, `CANCELLED` |
| `EN_ROUTE` | `ARRIVED`, `CANCELLED` |
| `ARRIVED` | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | `COMPLETED`, `CANCELLED` |
| `COMPLETED`, `REJECTED`, `CANCELLED` | nenhuma |

A matriz vive em `@eops/shared/workforce`. Servidor e frontend usam a mesma fonte; o frontend não inventa transições nem duplica a lista.

## Transition validation

Cada transição valida o estado atual antes de persistir. Estado de origem incompatível retorna erro operacional explícito com o estado atual e o alvo.

Exemplos normativos:

- `REQUESTED → COMPLETED` é inválido;
- `DISPATCHED → ACCEPTED` é válido;
- `ACCEPTED → EN_ROUTE` é válido;
- `COMPLETED → CANCELLED` é inválido.

Campos obrigatórios por transição:

- `→ REJECTED`: `reason` com pelo menos 3 caracteres;
- `→ CANCELLED`: `reason` com pelo menos 3 caracteres;
- `→ COMPLETED`: `summary` com pelo menos 3 caracteres (`result` é opcional);
- `→ DISPATCHED`: `memberId` opcional, permitido apenas nessa transição para definir ou alterar o responsável individual.

## Dispatch eligibility

A elegibilidade é avaliada no momento da operação, sem janela agendada e sem solver automático:

1. a equipe existe e está `ACTIVE`;
2. quando `memberId` é informado: o membro pertence à equipe e o estado base não é `UNAVAILABLE` nem `OFF_DUTY`;
3. quando `memberId` é informado: não existe `FieldMemberUnavailability` sobrepondo o instante da operação;
4. quando `memberId` é informado: não existe `FieldShiftAssignment` com status `ABSENT` em turno não cancelado cobrindo o instante da operação;
5. não existe outro dispatch não terminal para o mesmo membro, ou para a mesma equipe quando não há membro;
6. quando a demanda possui `requiredTeamSize`: a equipe possui ao menos esse número de membros disponíveis no instante da operação.

A elegibilidade é revalidada na transição para `DISPATCHED`. A leitura dos dados de turno usa o schema Prisma compartilhado, exatamente como `resolveAvailability` já faz; nenhum import entre workspaces é criado.

## Capability matching

Requisitos da demanda:

- quando `taskId` é informado, valem os requisitos de especialidade e o `requiredTeamSize` da Task;
- quando não há Task, o corpo da requisição pode informar `requiredSpecialtyIds`.

Cálculo:

- membro capaz = membro da equipe com estado base diferente de `UNAVAILABLE` e `OFF_DUTY`, sem indisponibilidade sobreposta;
- `MATCH`: todos os requisitos de especialidade e o tamanho mínimo (quando informado) foram atendidos;
- `NO_MATCH`: nenhum requisito foi atendido;
- `PARTIAL`: parte dos requisitos foi atendida;
- sem nenhum requisito aplicável, o campo permanece nulo e nenhum override é exigido.

Criar ou despachar com `PARTIAL` ou `NO_MATCH` exige `capabilityOverrideReason`; o motivo e o ator são registrados na timeline. O resultado calculado não bloqueia sozinho a operação.

## Dispatch priority

Dispatch reutiliza `TaskPriority` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`). Nenhum enum de prioridade novo é criado, porque um enum próprio seria semanticamente idêntico e exigiria tradução na criação a partir de Task. O default é `MEDIUM`.

## Dispatch timestamps

Timestamps são derivados das transições e nunca informados pelo cliente:

| Transição | Campo |
| --- | --- |
| criação | `requestedAt` |
| `→ DISPATCHED` | `dispatchedAt` |
| `→ ACCEPTED` | `acceptedAt` |
| `→ REJECTED` | `rejectedAt` |
| `→ EN_ROUTE` | `departedAt` |
| `→ ARRIVED` | `arrivedAt` |
| `→ IN_PROGRESS` | `startedAt` |
| `→ COMPLETED` | `completedAt` |
| `→ CANCELLED` | `cancelledAt` |

## Dispatch timeline

`FieldDispatchEvent` é um modelo pequeno e próprio, com tipo, mensagem, estado de origem, estado de destino, ator, metadados e timestamp. Ele registra criação, cada transição, mudança de responsável e observações operacionais. Audit continua sendo a trilha global; a timeline existe para a experiência operacional e não depende de Audit.

## Dispatch API

- `GET /field-teams/dispatches` — fila com filtros `status`, `teamId`, `memberId`, `taskId`, `incidentId`, `priority` e `active`;
- `GET /field-teams/dispatches/:id` — detalhe com timeline e métricas derivadas;
- `POST /field-teams/dispatches` — cria em `REQUESTED`;
- `PATCH /field-teams/dispatches/:id/status` — única rota de transição.

A transição é uma única abordagem: não existem endpoints semânticos paralelos (`/accept`, `/complete` etc.) duplicando a mesma regra. O corpo da transição aceita `status`, `reason`, `summary`, `result` e `memberId`, e cada campo é validado conforme a transição alvo.

## Dispatch queue

A fila ordena por prioridade (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) e, dentro da prioridade, pela idade da solicitação. Cada item expõe demanda, prioridade, equipe, especialidades da equipe, status, membro quando houver e tempo desde a solicitação. O filtro `active` retorna apenas estados não terminais.

## Dispatch detail

O detalhe apresenta resumo, equipe, demanda, timeline e ações. As ações disponíveis dependem do status atual (matriz compartilhada) e da permissão do ator.

## Tasks — execução em campo

### Execution mode

`Task.executionMode` é opcional com default `OFFICE` e valores `OFFICE`, `FIELD`, `MIXED`. Ele apenas identifica tarefas que podem originar Dispatch; nenhuma tarefa é convertida automaticamente em operação de campo.

### Requisitos operacionais

- `Task.requiredTeamSize` (inteiro opcional);
- `TaskSpecialtyRequirement` (`taskId`, `specialtyId`, `requiredCount`), reaproveitando a entidade `FieldSpecialty` existente, no mesmo padrão de `FieldShiftSpecialtyRequirement`.

Localização e prioridade já existem em Task e não são duplicadas. Nenhum rótulo de especialidade é armazenado como texto.

### Atribuição operacional

`Task.assigneeId` continua sendo o responsável usuário. O responsável operacional de campo é o Dispatch, que carrega `teamId` e `memberId`. Não é criado um segundo eixo de assignment em Task, porque isso produziria duas fontes de verdade para a mesma responsabilidade.

### Task → Dispatch

Uma Task `FIELD` pode originar Dispatch. A relação é persistida por `FieldDispatch.taskId`. A Task continua existindo e sendo controlada pelo domínio Tasks. A descrição completa da Task não é copiada para o Dispatch.

### Task ↔ Dispatch state

Não existe sincronização bidirecional. `Dispatch COMPLETED` registra a transição, a timeline e o evento com `taskId`; a Task permanece inalterada. Não há conclusão automática de Task nesta parte.

### Task field overview

O detalhe da Task mostra, quando existir dispatch vinculado, equipe, status, tempo decorrido e link para o dispatch. A UI não duplica as telas de Field Teams.

## Field execution

- **Aceite/rejeição:** `ACCEPTED` ou `REJECTED`; a rejeição exige motivo, ator e timestamp.
- **Deslocamento:** `EN_ROUTE` registra início de deslocamento. Não há GPS nem rastreamento de rota.
- **Chegada:** `ARRIVED` registra horário e permite derivar a duração do deslocamento.
- **Execução:** `IN_PROGRESS` registra o início do atendimento.
- **Conclusão:** `COMPLETED` aceita `summary`, `result` e observação, com timestamp automático. Integração com Evidence fica para parte futura.
- **Cancelamento:** `CANCELLED` exige motivo e ator e respeita a matriz de transição.

## Operational metrics

Métricas são derivadas, nunca persistidas:

| Métrica | Derivação |
| --- | --- |
| tempo até aceite | `acceptedAt - (dispatchedAt ?? requestedAt)` |
| tempo de deslocamento | `arrivedAt - departedAt` |
| tempo até chegada | `arrivedAt - acceptedAt` |
| tempo de execução | `completedAt - startedAt` |
| tempo total | `completedAt - requestedAt` |

Cada métrica é nula quando os timestamps de origem não existem.

## Workforce dashboard

O dashboard de Field Teams recebe uma seção operacional com dados reais:

- dispatches aguardando (`REQUESTED`);
- dispatches ativos (não terminais);
- em deslocamento (`EN_ROUTE`);
- no local ou em atendimento (`ARRIVED`, `IN_PROGRESS`);
- concluídos hoje;
- tempo médio até aceite e tempo médio até chegada, calculados sobre dispatches dos últimos 30 dias que possuem o timestamp correspondente.

### Estado operacional da equipe

O detalhe da equipe mostra o estado operacional derivado do dispatch ativo, quando existir: `AVAILABLE`, `DISPATCHED`, `EN_ROUTE`, `ON_SITE` ou `IN_PROGRESS`. Esse estado é calculado e não substitui nem altera a disponibilidade base.

### Trabalho atual do membro

O detalhe do membro mostra o dispatch atual e a próxima escala. A próxima escala continua vindo da API pública de Shifts, já consumida pela tela; nenhuma nova fonte de verdade é criada.

## Domain Events

Mutações relevantes publicam payloads pequenos com `entityId`, `actorId` quando humano, `teamId`, `memberId`/`taskId`/`incidentId` quando existirem, `priority` e transição ou motivo quando aplicável:

- `field_dispatch.created`;
- `field_dispatch.dispatched`;
- `field_dispatch.accepted`;
- `field_dispatch.rejected`;
- `field_dispatch.departed`;
- `field_dispatch.arrived`;
- `field_dispatch.started`;
- `field_dispatch.completed`;
- `field_dispatch.cancelled`.

Nenhum evento `task.*` novo é criado: nenhum comportamento novo do domínio Tasks é introduzido nesta parte.

## Audit

Audit continua observando o Event Bus global por `subscribeAll`. Nenhuma dependência direta de Audit é criada e o plugin não é alterado.

## Notifications

Entram no catálogo público apenas eventos com valor operacional claro:

- `field_dispatch.created` — dispatch solicitado;
- `field_dispatch.dispatched` — dispatch atribuído a uma equipe;
- `field_dispatch.rejected` — dispatch rejeitado.

`field_dispatch.accepted`, `departed`, `arrived`, `started`, `completed` e `cancelled` não entram no catálogo por serem mudanças de rotina. O envio respeita permissão do evento (`field-teams.read`), preferências do usuário e usuários ativos, conforme a política existente de Notifications.

## RBAC

- consultas de dispatch: `field-teams.read`;
- criação, transição, override de capability e cancelamento: `field-teams.manage`;
- Tasks continua sob `tasks.read` e `tasks.manage`.

Nenhuma permissão nova é criada: `field-teams.dispatch` não se justifica porque o conjunto de atores que administra workforce é o mesmo que opera o envio, e a criação de outra chave exigiria alterar o catálogo e o seed sem ganho operacional.

O ator é extraído da sessão autenticada. Nenhum DTO aceita `actorId` como fonte de autoridade.

## Persistência

Novos dados mínimos:

- `FieldDispatch`;
- `FieldDispatchEvent`;
- `TaskSpecialtyRequirement`;
- campos `Task.executionMode` e `Task.requiredTeamSize`;
- relações reversas necessárias em `FieldTeam`, `FieldMember`, `Task`, `User`, `ElectoralZone` e `PollingPlace`.

Índices: `FieldDispatch(status, priority)`, `FieldDispatch(teamId, status)`, `FieldDispatch(taskId)`, `FieldDispatch(incidentId)`, `FieldDispatch(memberId, status)`, `FieldDispatchEvent(dispatchId, createdAt)`, `TaskSpecialtyRequirement(taskId)`. Somente índices úteis para fila, detalhe e elegibilidade.

Uma migration nova é criada (`202610040003_workforce_operations_part_2`). Migrations históricas não são alteradas e a migration não é aplicada a banco remoto.

## Shared contracts

`@eops/shared/workforce` ganha apenas o que os dois plugins realmente compartilham: estado e prioridade de dispatch, resultado de capability match, matriz de transição com `canTransitionDispatch`, resumo público de dispatch, métricas derivadas e o tipo de estado operacional de campo. Implementações e services permanecem nos respectivos plugins.

## Frontend

### Field Teams

- `/field-teams/dispatch`: fila operacional com prioridade, status, equipe, demanda e tempo desde a solicitação, com filtros e formulário de solicitação;
- `/field-teams/dispatch/:id`: detalhe com resumo, equipe, demanda, timeline e ações apresentadas apenas quando válidas para o status e a permissão;
- seção operacional no dashboard;
- dispatch atual no detalhe da equipe e no detalhe do membro;
- item de navegação "Despachos".

### Tasks

- `executionMode` e `requiredTeamSize` na criação e no detalhe;
- requisitos de especialidade administrados no detalhe da Task, usando o catálogo existente de especialidades por API pública;
- resumo do dispatch vinculado no detalhe da Task, com link para Field Teams e ação que conduz à solicitação de dispatch com a Task pré-selecionada.

O design reutiliza `@eops/ui`, tokens e padrões globais, com loading, error, empty e success. Não há drag-and-drop: botões semânticos são suficientes. A validação responsiva cobre 1440 px, 1024 px e até 760 px; se não houver browser disponível, a inspeção visual é registrada como `NOT_ACTIONABLE` sem bloquear a entrega, desde que typecheck, testes e build passem.

## Compatibilidade

- dados atuais de equipes, membros, turnos, assignments e tarefas permanecem válidos;
- `Task.executionMode` possui default `OFFICE`, preservando tarefas existentes;
- dispatch sem Task ou Incident é permitido somente com `title`;
- nenhum endpoint existente muda de contrato; as adições são novas rotas;
- não há import `plugins/**/src` entre plugins.

## Fora de escopo / partes futuras

- Shift Handover;
- GPS, rastreamento em tempo real, ETA e otimização de rota;
- integração com Inventory e Evidence;
- solver automático de dispatch e dispatcher com IA;
- SMS, e-mail, WebSocket e aplicativo móvel;
- conclusão automática de Task a partir do dispatch;
- sincronização bidirecional Task ↔ Dispatch.

## Estratégia de implementação

1. versionar esta SPEC em commit exclusivo;
2. estender `@eops/shared/workforce` com o contrato de dispatch;
3. criar models, enum e migration nova;
4. implementar Dispatch em Field Teams (model, elegibilidade, lifecycle, timeline, API, métricas);
5. estender Tasks com `executionMode`, `requiredTeamSize` e requisitos de especialidade;
6. emitir Domain Events e registrar apenas as entradas notificáveis justificadas;
7. implementar frontend de fila, detalhe, dashboard e resumo em Task;
8. atualizar documentação e testes focados;
9. executar os gates finais e reconciliar execution issues.

## Critérios de aceite

- **AC-01** Dispatch tem owner claro em Field Teams.
- **AC-02** Tasks continua owner de Task.
- **AC-03** Shifts continua owner de Shift.
- **AC-04** o lifecycle de Dispatch é validado por matriz compartilhada.
- **AC-05** disponibilidade influencia a elegibilidade do dispatch.
- **AC-06** conflitos de escala continuam respeitados e não são reimplementados.
- **AC-07** capabilities podem ser verificadas contra os requisitos da demanda.
- **AC-08** rejeição exige motivo, ator e timestamp.
- **AC-09** timestamps vêm das transições e o cliente não os informa.
- **AC-10** a timeline operacional é preservada em `FieldDispatchEvent`.
- **AC-11** Task `FIELD` pode originar Dispatch.
- **AC-12** a relação Task ↔ Dispatch é persistida por `FieldDispatch.taskId`.
- **AC-13** `Dispatch COMPLETED` não altera a Task sem regra explícita.
- **AC-14** métricas operacionais são derivadas, não persistidas.
- **AC-15** o dashboard mostra execução de campo com dados reais.
- **AC-16** Domain Events de dispatch são emitidos nas transições.
- **AC-17** Audit recebe esses eventos pela infraestrutura existente.
- **AC-18** Notifications recebe apenas os eventos catalogados como operacionais.
- **AC-19** RBAC protege consultas e mutações de dispatch.
- **AC-20** nenhum import interno cross-plugin existe e `check:boundaries` passa.
- **AC-21** a migration nova preserva o histórico e não altera migrations anteriores.
- **AC-22** regras críticas possuem testes focados.
- **AC-23** a suíte completa passa no final.
- **AC-24** LOC antes/depois é reportada sem meta artificial.

## Validação

Obrigatória, na ordem:

```bash
npm run spec:check
npm run check:boundaries
npm run typecheck
npm run lint
npm test
npm run build
npm run db:validate
powershell -ExecutionPolicy Bypass -File scripts/check-ap1.ps1
git diff --check
```

Também devem ser executados testes focados de Field Teams, Tasks e shared contracts. Schema válido não implica migration aplicada; o handoff registra explicitamente o estado do banco.
