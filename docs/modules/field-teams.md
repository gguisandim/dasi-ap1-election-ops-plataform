# Equipes de Campo

## Responsabilidade

Field Teams owns workforce structure, capabilities, operational availability and field dispatch.

O módulo mantém equipes, membros, funções, especialidades, alocações operacionais e check-in/out. Também registra períodos de indisponibilidade com intervalo, motivo, observação e ator.

Field Teams não cria nem mantém turnos. Shifts owns schedules and shift operations. A rota legada `/field-teams/shifts` é somente uma visão read-only que consome a API pública de Shifts e direciona o operador ao calendário oficial.

Field Teams também é owner de Dispatch: quem foi enviado, em que ponto do lifecycle está e qual foi o resultado. Tasks continua owner de Task e Shifts continua owner de Shift.

## Dispatch

Dispatch é o envio operacional de uma equipe ou membro para executar uma demanda que pode ter origem em uma Task, em um Incident ou em uma demanda operacional genérica com título próprio.

Lifecycle: `REQUESTED`, `DISPATCHED`, `ACCEPTED`, `EN_ROUTE`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED`, com `REJECTED` e `CANCELLED` como estados alternativos terminais. A matriz de transição vive em `@eops/shared/workforce` e é a mesma fonte usada pelo servidor e pelo frontend.

Timestamps (`requestedAt`, `dispatchedAt`, `acceptedAt`, `rejectedAt`, `departedAt`, `arrivedAt`, `startedAt`, `completedAt`, `cancelledAt`) são derivados das transições; o cliente nunca os informa.

Antes de criar ou despachar, a API valida equipe ativa, pertencimento e disponibilidade do membro, indisponibilidade sobreposta, ausência em turno ativo e ausência de outro dispatch ativo para o mesmo destino. Nenhum solver automático é usado.

Quando a demanda possui requisitos de especialidade ou tamanho mínimo de equipe, o resultado do capability match é `MATCH`, `PARTIAL` ou `NO_MATCH`. `PARTIAL` e `NO_MATCH` exigem justificativa de override, registrada com o ator.

Endpoint e rotas:

- `GET /field-teams/dispatches`;
- `GET /field-teams/dispatches/:id`;
- `POST /field-teams/dispatches`;
- `PATCH /field-teams/dispatches/:id/status`;
- `/field-teams/dispatch` (fila operacional);
- `/field-teams/dispatch/:id` (detalhe com timeline e ações).

Métricas operacionais (tempo até aceite, deslocamento, tempo até chegada, execução e tempo total) são derivadas dos timestamps e não persistidas. `FieldDispatchEvent` guarda a timeline operacional; Audit continua sendo a trilha global.

## Disponibilidade

O estado base do membro continua sendo `AVAILABLE`, `ASSIGNED`, `ON_DUTY`, `UNAVAILABLE` ou `OFF_DUTY`. A API `GET /field-teams/availability` combina esse estado com períodos sobrepostos e assignments para devolver o estado efetivo.

Períodos são administrados em:

- `POST /field-teams/members/:id/unavailability`;
- `PATCH /field-teams/members/:id/unavailability/:periodId`;
- `DELETE /field-teams/members/:id/unavailability/:periodId`.

Intervalos inválidos e sobrepostos são rejeitados.

## Capabilities

`GET /field-teams/:id/capabilities` calcula cobertura de especialidades a partir dos membros atuais e das relações persistidas com `FieldSpecialty`. O agregado não é persistido.

## Interface

- `/field-teams`: indicadores de equipes, disponibilidade, serviço, alocação, especialidades e a seção operacional de despachos;
- `/field-teams/teams/:id`: detalhe da equipe com estado operacional e despacho atual;
- `/field-teams/members`: cadastro de membros, funções e especialidades;
- `/field-teams/members/:id`: detalhe, indisponibilidades, despacho atual e próximos turnos;
- `/field-teams/dispatch`: fila de despachos com filtros e solicitação;
- `/field-teams/dispatch/:id`: resumo, demanda, timeline e ações por status;
- `/field-teams/shifts`: ponte read-only para Shifts.

Mutações exigem `field-teams.manage`; consultas exigem `field-teams.read`. Não foi criada uma permissão `field-teams.dispatch` própria: o conjunto de atores que administra workforce é o mesmo que opera o envio.

