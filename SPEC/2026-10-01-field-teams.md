# Equipes de Campo

> **Nota de rastreabilidade:** esta especificação foi reconstruída retrospectivamente em 2026-10-01 a partir do código, request logs e histórico disponível. Ela documenta o estado/intenção real, mas **não deve ser apresentada como prova de que antecedeu o código**. Para novas funcionalidades, a spec deve ser criada e commitada antes da implementação.

## O quê e por quê

Gerenciar equipes e pessoas operacionais por pleito, incluindo funções, especialidades, escalas, alocação, check-in/out e cobertura.

## Critérios de aceitação

- [x] Equipes e membros persistidos.
- [x] Funções/especialidades cadastráveis.
- [x] Escalas e turnos por período.
- [x] Alocações por zona/local/rota/atividade sem import direto entre plugins.
- [x] Check-in/check-out persistido.
- [x] Dashboard de cobertura e disponibilidade.
- [x] Eventos e permissões específicas.

## Fora do escopo

- GPS real obrigatório.
- Dependência direta do plugin Rotas.

## Evidências usadas na reconstrução

- `docs/request-log/2026-10-01-codex-field-teams.md`

## Rastreabilidade Git

Associe esta spec aos **commits futuros** que ainda alterarem este domínio usando trailer `Spec:`. Os commits já existentes permanecem como estão; não reescreva o histórico para simular anterioridade.
