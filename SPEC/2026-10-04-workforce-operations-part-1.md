# Workforce Operations — Parte 1

- Status: Aprovada para implementação
- Data: 2026-10-04
- Escopo: `plugins/operations/field-teams`, `plugins/operations/shifts` e contratos compartilhados estritamente necessários
- Substitui/complementa: `SPEC/2026-10-01-field-teams.md` e `SPEC/2026-10-03-shifts-schedules.md` nos pontos explicitamente alterados

## Contexto

A plataforma possui dois plugins que atuam sobre a força de trabalho de campo. Field Teams mantém equipes, membros, funções, especialidades, alocações e checks, mas também expõe criação e listagem próprias de turnos. Shifts mantém o lifecycle operacional completo de turnos, assignments, presença, ausência, sobreaviso, substituição, conflitos e cobertura. A sobreposição torna permissões e regras de negócio ambíguas.

Esta parte encerra a ambiguidade no planejamento de workforce. Dispatch, missões, execução em campo, integração com Tasks, workload avançado e Shift Handover pertencem à Parte 2 e não são introduzidos aqui.

## Estado atual

- `POST /field-teams/shifts` cria `FieldShift` com `field-teams.manage`.
- `/field-teams/shifts` possui formulário próprio de criação.
- Shifts já cria e mantém `FieldShift` com `shifts.manage` e possui assignments, presença, ausência, sobreaviso, substituição, lifecycle, cobertura e conflitos.
- `FieldMember.status` representa uma disponibilidade base, mas não existem períodos operacionais persistidos de indisponibilidade.
- `FieldShift.requiredOperators` já representa headcount necessário.
- Não existem requisitos de especialidade por turno nem templates de turno.
- Audit observa o Event Bus global; Notifications possui catálogo e política RBAC próprios.

## Problemas

1. Dois contratos permitem criar turnos e usam permissões diferentes.
2. Disponibilidade não registra intervalo, motivo ou ator.
3. Especialidades existem, porém não participam da leitura de capabilities e cobertura.
4. A cobertura considera apenas headcount e não distingue lacuna crítica ou skill gap.
5. A operação não possui calendário semanal, matriz de cobertura, templates ou cópia segura.
6. Dashboards e detalhes não respondem suficientemente às perguntas operacionais.

## Objetivos

- estabelecer ownership único de turnos em Shifts;
- aprofundar disponibilidade e capabilities em Field Teams;
- tornar assignment e replacement conscientes de disponibilidade;
- representar e calcular headcount e cobertura de especialidades;
- oferecer calendário, cobertura, templates e cópia de turno;
- emitir Domain Events pequenos, tipados e atribuídos ao ator autenticado;
- manter boundaries, RBAC, Audit e Notifications existentes.

## Domain ownership

### Field Teams

Field Teams é o owner de:

- equipes, membros e funções;
- especialidades dos membros;
- disponibilidade operacional base;
- períodos de indisponibilidade;
- capabilities derivadas dos membros ativos;
- dados cadastrais e operacionais da equipe.

Field Teams não cria, edita, inicia, conclui ou cancela turnos. A rota legada de frontend `/field-teams/shifts` torna-se uma transição read-only para o calendário público de Shifts, sem formulário. O endpoint mutável `POST /field-teams/shifts` é removido. A leitura de próximos turnos em páginas de workforce usa a API HTTP pública de Shifts.

### Shifts

Shifts é o único owner de:

- criação, atualização e lifecycle de turnos;
- assignments, presença, ausência e sobreaviso;
- substituições e histórico;
- requisitos de headcount e especialidades;
- conflitos, cobertura, calendário, templates e cópia.

Toda mutação desse domínio exige `shifts.manage`. `field-teams.manage` não concede implicitamente qualquer mutação de turno.

## Disponibilidade

`FieldMember.status` permanece como estado base administrável: `AVAILABLE`, `ASSIGNED`, `ON_DUTY`, `UNAVAILABLE` ou `OFF_DUTY`. O estado efetivo para um intervalo é derivado, sem persistir duplicação desnecessária:

1. `UNAVAILABLE` se existir período de indisponibilidade sobreposto;
2. `ON_DUTY` se houver assignment presente ou turno ativo sobreposto;
3. `ASSIGNED` se houver assignment operacional sobreposto;
4. caso contrário, o estado base do membro.

Um período de indisponibilidade possui início, fim, motivo, observação opcional, ator autenticado e timestamps. O fim deve ser posterior ao início e intervalos sobrepostos do mesmo membro são rejeitados. O frontend nunca fornece um `actorId` arbitrário.

## Especialidades e capabilities

Especialidades continuam entidades persistidas, sem valores hardcoded. A capability de equipe é derivada dos membros pertencentes à equipe e das especialidades ativas relacionadas a eles. A resposta informa especialidade, quantidade de membros capazes e membros correspondentes. Nenhuma agregação adicional é persistida.

## Cobertura

Cada turno usa `requiredOperators` já existente. Assignments contados são apenas os estados operacionais `SCHEDULED`, `PRESENT` e `ON_CALL` ativado; ausentes e substituídos não contam. Requisitos por especialidade possuem `specialtyId` e `requiredCount`.

O estado calculado de cobertura é:

- `EMPTY`: nenhum membro operacional contado;
- `CRITICAL`: headcount abaixo de 50% do necessário, ou headcount suficiente com qualquer requisito de especialidade não atendido;
- `PARTIAL`: headcount entre 50% (inclusive) e o necessário, sem atingir o total;
- `FULL`: headcount suficiente e todos os requisitos de especialidade atendidos.

Além do estado, a resposta contém contagens de required, assigned, present, absent e on-call e o atendimento de cada especialidade. O estado não é persistido.

## Assignments, presença, ausência e sobreaviso

Ao criar assignment ou replacement, Shifts valida que:

- o membro pertence à equipe do turno;
- a equipe está ativa;
- o estado base não é `UNAVAILABLE` nem `OFF_DUTY`;
- não existe período de indisponibilidade sobreposto;
- não existe assignment/turno temporal conflitante.

Falhas retornam mensagem operacional explícita. Presença, ausência e sobreaviso preservam os estados e timestamps existentes. Sobreaviso informa quem, turno, ativação e status. Ausência mantém motivo. Nenhuma regra trabalhista adicional é criada.

## Substituição

A substituição preserva assignment original, cria assignment substituto e registra motivo, ator e timestamps no histórico existente. O substituto passa pelas mesmas validações de equipe, atividade, disponibilidade e conflito. Compatibilidade de especialidade é reportada na cobertura; a ausência de solver automático não bloqueia a substituição, salvo quando a própria API declarar validação estrita.

## Conflitos

O conflito temporal existente é preservado e ampliado com indisponibilidade registrada. Conflitos expostos pela API incluem tipo, membro, intervalo e mensagem. Não são introduzidas regras trabalhistas ou limites de jornada.

## Calendário

`GET /shifts/calendar` recebe intervalo limitado e filtros opcionais de equipe, zona, local e status. A resposta usa dados reais e inclui turno, horário, local/zona, equipe, required, assigned, coverage state e status. O frontend prioriza visão semanal e permite navegar entre semanas; a visão diária é um filtro do mesmo contrato.

## Matriz de cobertura

`GET /shifts/coverage` usa o mesmo intervalo e devolve células derivadas por zona/local e faixas horárias com os turnos e seus estados calculados. A matriz nunca inventa células cobertas onde não existe turno. Em telas pequenas, a tabela pode ter overflow horizontal controlado.

## Templates de turno

Um template não é turno ativo. Ele armazena nome, equipe e localização opcionais, horário inicial local, duração, headcount, notas, flag ativa e requisitos de especialidade. Templates podem ser listados, criados e atualizados por Shifts. Criar a partir de template exige data e os dados obrigatórios que o template não tiver; o resultado é um novo turno normal, sem assignments ou histórico copiado.

## Cópia de turno

`POST /shifts/:id/copy` recebe novo início/fim e opção `copyAssignments`, cujo default é `false`. A cópia inclui configuração, headcount e requisitos de especialidade. Nunca copia presença, ausência, ativação de sobreaviso, replacements ou histórico. Se assignments forem solicitados, todos são recriados como `SCHEDULED` e passam pelas validações normais; a operação falha atomicamente se algum deles for inválido.

## RBAC

- consultas Field Teams: `field-teams.read`;
- mutações de workforce/disponibilidade: `field-teams.manage`;
- consultas Shifts: `shifts.read`;
- mutações de turno, template, assignment e lifecycle: `shifts.manage`.

As APIs extraem o ator da sessão autenticada. Nenhum DTO aceita `actorId` como fonte de autoridade.

## Event Bus

Mutações relevantes publicam payloads pequenos, sem objetos Prisma inteiros:

- `field_member.availability_changed`;
- `field_member.unavailability_created` e `field_member.unavailability_removed`;
- `field_member.specialty_changed`;
- `shift.created`, `shift.updated`, `shift.started`, `shift.completed`, `shift.cancelled`;
- `shift.assignment_added`, `shift.presence_registered`, `shift.absence_registered`;
- `shift.on_call_activated`, `shift.replacement_created`;
- `shift.template_created` e `shift.template_updated`.

Payloads carregam `entityId`, `actorId` quando humano, identificadores relevantes e transições ou motivo quando aplicável. `shift.coverage_insufficient` permanece o evento notificável de cobertura; não é criado `coverage_changed` porque o valor é derivado e não possui transição persistida confiável.

## Audit

Audit continua usando `subscribeAll` da infraestrutura global. Nenhuma dependência direta de Audit é criada. Os eventos desta SPEC fornecem actor, entity e mudanças suficientes para a inferência e persistência já existentes.

## Notifications

Notifications não recebe lógica específica de workforce. O catálogo existente continua notificando `shift.coverage_insufficient`. Podem ser incluídos, quando operacionalmente úteis, `shift.absence_registered`, `shift.on_call_activated` e `shift.replacement_created`, sempre sob `shifts.read`, preferences e política RBAC existente. Eventos puramente cadastrais não geram broadcast.

## Frontend

### Field Teams

- dashboard com equipes ativas, membros disponíveis/indisponíveis, em turno, sem alocação e lacunas de capability calculáveis;
- detalhe de membro com dados básicos, equipe, função, especialidades, disponibilidade, períodos e próximos turnos via API pública de Shifts;
- detalhe de equipe com membros, capabilities, disponibilidade, próximos turnos e status;
- gestão de períodos de indisponibilidade;
- remoção do formulário paralelo de turnos e deep-link para Shifts.

### Shifts

- dashboard com turnos de hoje/ativos, estados de cobertura, conflitos, ausências e sobreavisos;
- calendário semanal/diário;
- matriz de cobertura;
- templates;
- detalhe organizado em Resumo, Assignments, Cobertura, Conflitos e Histórico;
- ações apresentadas apenas quando válidas para o status atual;
- loading, error, empty e success em toda página nova.

O design reutiliza `@eops/ui`, tokens e padrões globais. A validação responsiva cobre 1440 px, 1024 px e até 760 px.

## API

### Field Teams

- `GET /field-teams/members/:id`;
- `GET /field-teams/:id/capabilities`;
- `GET /field-teams/availability`;
- `POST /field-teams/members/:id/unavailability`;
- `PATCH /field-teams/members/:id/unavailability/:periodId`;
- `DELETE /field-teams/members/:id/unavailability/:periodId`.

`POST /field-teams/shifts` deixa de existir. Nenhum endpoint novo de Field Teams muta `FieldShift`.

### Shifts

- `GET /shifts/calendar`;
- `GET /shifts/coverage`;
- `GET /shifts/templates`;
- `POST /shifts/templates`;
- `PATCH /shifts/templates/:id`;
- `POST /shifts/from-template`;
- `POST /shifts/:id/copy`.

Rotas estáticas são declaradas antes de `GET /shifts/:id`. Paginação e limites de intervalo seguem convenções existentes quando aplicáveis.

## Persistência

Novos dados mínimos:

- `FieldMemberUnavailability` para intervalo, motivo, nota e ator;
- `FieldShiftSpecialtyRequirement` para requisito de especialidade do turno;
- `FieldShiftTemplate` para configuração reutilizável;
- `FieldShiftTemplateSpecialtyRequirement` para requisitos do template.

Relações são adicionadas aos modelos existentes. `requiredOperators` é reutilizado. Índices cobrem membro/intervalo, turno/especialidade, template/atividade e requisitos por especialidade. Uma migration nova é criada; migrations históricas não são alteradas. A migration é versionada, mas não aplicada automaticamente a banco remoto.

## Shared contracts

`@eops/shared/workforce` contém apenas tipos semânticos usados pelos dois plugins: availability efetiva, estado/resultado de cobertura, resumo de especialidade e resumo público de turno. Implementações e services permanecem nos respectivos plugins.

## Compatibilidade e migração

- dados atuais de turnos e assignments permanecem válidos;
- `requiredOperators` existente é preservado;
- turnos sem requisitos de especialidade calculam cobertura somente por headcount;
- consumidores do formulário Field Teams são direcionados à UI de Shifts;
- a remoção do endpoint mutável legado é intencional e protegida por teste de regressão;
- não há import `plugins/**/src` entre os plugins.

## Fora de escopo / Parte 2

- Tasks e integração de task assignment;
- dispatch de incidente, missões e aceitar/recusar missão;
- GPS, deslocamento, ETA e otimização de rota;
- workflow avançado Field Team ↔ Incidents;
- Shift Handover;
- planejamento avançado de workload;
- solver automático de escala/especialidades;
- regras trabalhistas completas.

## Estratégia de implementação

1. versionar esta SPEC em commit exclusivo;
2. adicionar shared contracts e migration nova;
3. remover o ownership mutável legado de Field Teams;
4. implementar disponibilidade/capabilities e suas APIs/UI;
5. implementar coverage, calendário, templates, cópia e validações em Shifts;
6. ampliar eventos e somente as entradas notificáveis justificadas;
7. atualizar documentação e testes;
8. executar todos os gates e reconciliar issues.

## Critérios de aceite

- **AC-01** Field Teams não possui endpoint nem formulário de criação de turno.
- **AC-02** Shifts é o único owner do lifecycle de turnos.
- **AC-03** mutações de turno exigem permissões de Shifts.
- **AC-04** membros expõem disponibilidade operacional efetiva consistente.
- **AC-05** períodos de indisponibilidade são persistidos e validados.
- **AC-06** especialidades continuam administráveis sem lista hardcoded.
- **AC-07** capabilities de equipe são calculadas a partir dos membros.
- **AC-08** Shifts possui calendário semanal e filtro diário funcional.
- **AC-09** cobertura retorna `FULL`, `PARTIAL`, `CRITICAL` ou `EMPTY` conforme regras desta SPEC.
- **AC-10** required staffing existente é representado em API e UI.
- **AC-11** requisitos de especialidade são persistidos e entram no cálculo.
- **AC-12** assignments rejeitam membros indisponíveis/inativos.
- **AC-13** assignments continuam rejeitando conflitos temporais.
- **AC-14** replacements preservam histórico e validam substituto.
- **AC-15** templates de turno podem ser administrados e usados para criar turno.
- **AC-16** turno pode ser copiado sem dados operacionais/históricos indevidos.
- **AC-17** dashboard de Field Teams apresenta métricas calculadas e úteis.
- **AC-18** dashboard de Shifts apresenta cobertura, conflitos, ausências e sobreaviso.
- **AC-19** mutações relevantes publicam Domain Events tipados e atribuídos.
- **AC-20** Audit recebe esses eventos pela infraestrutura global, sem import de plugin.
- **AC-21** Notifications observa apenas eventos de workforce catalogados como operacionais.
- **AC-22** não há import interno cross-plugin e `check:boundaries` passa.
- **AC-23** migrations históricas permanecem inalteradas e há migration nova quando necessária.
- **AC-24** regras críticas possuem testes de sucesso, erro, permissão e regressão de ownership.
- **AC-25** documentação registra Field Teams como workforce e Shifts como schedules.
- **AC-26** LOC antes/depois é reportada sem meta artificial.

## Validação

Obrigatória:

```bash
npm run spec:check
npm run check:boundaries
npm run typecheck
npm run lint
npm test
npm run build
npm run db:validate
git diff --check
powershell -ExecutionPolicy Bypass -File scripts/check-ap1.ps1
```

Também devem ser executados testes focados de Field Teams, Shifts e shared contracts relevantes. A interface deve ser verificada em 1440 px, 1024 px e até 760 px. Schema válido não implica migration aplicada; o handoff registra explicitamente o estado do banco.
