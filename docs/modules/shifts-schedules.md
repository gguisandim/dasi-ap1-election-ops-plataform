# Escalas e Turnos

## Responsabilidade

Shifts owns schedules and shift operations. É o único módulo autorizado a criar, editar, iniciar, concluir ou cancelar turnos e a manter assignments, presença, ausência, sobreaviso, substituição, cobertura, conflitos, templates e cópia.

Field Teams fornece estrutura, especialidades e disponibilidade. A integração ocorre por banco/API pública, shared contracts e Event Bus, sem imports internos entre plugins.

## Cobertura

`requiredOperators` representa o headcount necessário. `FieldShiftSpecialtyRequirement` representa skills e quantidades mínimas. A cobertura é calculada, não persistida:

- `FULL`: headcount e skills atendidos;
- `PARTIAL`: pelo menos 50% do headcount, abaixo do total;
- `CRITICAL`: menos de 50% ou skill gap com headcount completo;
- `EMPTY`: nenhuma pessoa operacional.

Assignments ausentes/substituídos e sobreavisos não acionados não contam.

## Disponibilidade e conflitos

Assignment e replacement validam equipe ativa, membro pertencente à equipe, estado base, período de indisponibilidade e sobreposição temporal. Erros são explícitos e não criam assignment inválido silenciosamente.

## APIs e interface

- `/shifts`: dashboard;
- `/shifts/list`: lista e filtros;
- `/shifts/calendar`: semana/dia via intervalo;
- `/shifts/coverage`: matriz real por turno e localização;
- `/shifts/new`: criação com headcount e requirements;
- `/shifts/templates`: templates ativos/inativos e criação a partir de data;
- `/shifts/:id`: resumo, assignments, cobertura, conflitos e histórico.

APIs adicionais: `GET /shifts/calendar`, `GET /shifts/coverage`, CRUD mínimo de templates, `POST /shifts/from-template` e `POST /shifts/:id/copy`.

A cópia nunca transfere presença, ausência, sobreaviso acionado, replacements ou histórico. Assignments são opcionais e voltam como `SCHEDULED`.

## RBAC e eventos

Consultas exigem `shifts.read`; todas as mutações exigem `shifts.manage`. O ator vem da sessão autenticada.

Mutações publicam eventos tipados de criação/edição/lifecycle, assignment, presença, ausência, sobreaviso, replacement e templates. Audit observa todos pelo Event Bus global. Notifications mantém somente os candidatos operacionais catalogados e aplica preferences + RBAC.

## Persistência

A migration `202610040002_workforce_operations_part_1` adiciona indisponibilidade, requirements e templates. Migrations históricas não foram alteradas.
