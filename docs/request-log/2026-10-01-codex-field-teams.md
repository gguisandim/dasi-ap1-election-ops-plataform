# Equipes de Campo — 2026-10-01

## Prompt resumido

Criar um plugin persistente de Equipes de Campo para equipes, membros, funções, especialidades, escalas, turnos, alocações, check-in/out, disponibilidade, contatos e dashboard, sem dependência direta entre plugins.

## Implementado

- Novo plugin `plugins/operations/field-teams`.
- Equipes por pleito com código, responsável, status e observações.
- Membros com contatos, função cadastrável, especialidades cadastráveis, status e equipe.
- Funções e especialidades persistentes, com dados iniciais idempotentes.
- Escalas/turnos por equipe, membro opcional, zona/local, início, fim e observação.
- Alocações para zona, local, rota por ID opaco ou atividade operacional.
- Check-in/check-out com horário, membro, zona/local e observações, sem GPS.
- Atualização automática de disponibilidade em alocação e presença.
- Dashboard com equipes ativas, pessoas disponíveis/em serviço, zonas e locais sem cobertura e próximos turnos.
- Páginas de dashboard, equipes, detalhe, membros, escala, alocações e check-in/out.
- Eventos de alocação, check-in e check-out consumidos por auditoria e notificações.
- Integração concluída com Relatórios e BI por consulta ao banco central, sem import entre plugins.

## Arquivos principais alterados

- `plugins/operations/field-teams/`: package, manifest, frontend, backend, DTOs, service, controller, módulo, tipos, estilos e testes.
- `packages/database/prisma/schema.prisma`.
- `packages/database/prisma/migrations/202610010003_field_teams/migration.sql`.
- `packages/database/prisma/seed.ts`.
- `packages/security/src/permissions.ts`.
- `packages/event-bus/src/contracts.ts`.
- `apps/api/src/app.module.ts`.
- `apps/web/src/pluginRegistry.ts`.
- `plugins/analytics/reports/src/server/reports.service.ts` para métricas de equipes.

## Banco

Enums adicionados:

- `FieldTeamStatus`.
- `MemberAvailability`.
- `FieldAllocationStatus`.
- `FieldCheckType`.

Models adicionados:

- `FieldTeam`.
- `FieldRole`.
- `FieldSpecialty`.
- `FieldMember`.
- `FieldMemberSpecialty`.
- `FieldShift`.
- `FieldAllocation`.
- `FieldCheckEvent`.

Migration aditiva `202610010003_field_teams` criada e aplicada sem perda de dados.

## Integrações globais

- AppModule: `FieldTeamsModule` registrado.
- pluginRegistry/sidebar: `fieldTeamsPlugin` registrado na categoria Operações.
- Event Bus: `field_team.allocated`, `field_member.checked_in` e `field_member.checked_out`.
- Segurança: `field-teams.read` e `field-teams.manage`.
- Shared contracts: nenhuma alteração necessária.
- Seed: funções, especialidades, equipe, membros, turno e alocação demonstrativos idempotentes; permissões adicionadas aos perfis apropriados.
- Relatórios: equipes ativas e cobertura por zona passaram a usar dados persistidos do novo domínio.

## Testes e validação

- `npm run db:generate`: passou.
- `npm run db:validate`: passou.
- `npm run check:boundaries`: passou.
- `npm run typecheck`: passou.
- `npm run lint`: passou após corrigir um alias de tipo apontado na primeira passagem.
- `npm test`: passou, 13 arquivos e 29 testes.
- `npm run build`: passou; Vite manteve apenas alerta de tamanho de chunk.
- `npm run db:migrate:deploy`: passou e aplicou a migration.
- `npm run db:seed`: passou.
- Teste funcional autenticado: passou; equipe, membro, turno, alocação `ACTIVE` e `CHECK_IN` persistidos; dashboard retornou 2 equipes ativas e 1 pessoa em serviço; BI retornou `teamsAvailable: true` e 2 equipes.
- `npm run e2e`: passou, 4 testes Playwright.

## Pendências

- GPS real não foi implementado, conforme permitido pelo escopo.

## IA utilizada

Codex, agente principal baseado em GPT-5.

## Tokens

Tokens: indisponível
