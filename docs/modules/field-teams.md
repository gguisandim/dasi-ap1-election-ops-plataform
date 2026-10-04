# Equipes de Campo

## Responsabilidade

Field Teams owns workforce structure, capabilities and operational availability.

O módulo mantém equipes, membros, funções, especialidades, alocações operacionais e check-in/out. Também registra períodos de indisponibilidade com intervalo, motivo, observação e ator.

Field Teams não cria nem mantém turnos. Shifts owns schedules and shift operations. A rota legada `/field-teams/shifts` é somente uma visão read-only que consome a API pública de Shifts e direciona o operador ao calendário oficial.

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

- `/field-teams`: indicadores de equipes, disponibilidade, serviço, alocação e especialidades;
- `/field-teams/teams/:id`: detalhe da equipe;
- `/field-teams/members`: cadastro de membros, funções e especialidades;
- `/field-teams/members/:id`: detalhe, indisponibilidades e próximos turnos;
- `/field-teams/shifts`: ponte read-only para Shifts.

Mutações exigem `field-teams.manage`; consultas exigem `field-teams.read`.

