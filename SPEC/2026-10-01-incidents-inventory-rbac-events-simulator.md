# Incidentes, inventário, segurança, eventos e simulador

> **Nota de rastreabilidade:** esta especificação foi reconstruída retrospectivamente em 2026-10-01 a partir do código, request logs e histórico disponível. Ela documenta o estado/intenção real, mas **não deve ser apresentada como prova de que antecedeu o código**. Para novas funcionalidades, a spec deve ser criada e commitada antes da implementação.

## O quê e por quê

Estabilizar a base das etapas iniciais e implementar verticais reais para incidentes, inventário/ativos, autenticação/RBAC/auditoria, Event Bus/notificações e simulador operacional.

## Critérios de aceitação

- [x] Incidentes com severidade, status, SLA, atribuição e timeline.
- [x] Ativos com tipo, condição, status, movimentações e vínculo com incidentes.
- [x] Usuários, roles e permissions persistidos com autorização real no backend.
- [x] Auditoria e notificações persistentes desacopladas por Event Bus.
- [x] Simulações e incidentes simulados devem ser distinguíveis da operação real.

## Fora do escopo

- Declarar E2E como aprovado sem execução real.
- Remover histórico/migrations existentes.

## Evidências usadas na reconstrução

- `docs/request-log/2026-10-01-codex-stabilization-incidents-inventory-rbac-events-simulator.md`
- `docs/request-log/2026-10-01-codex-raw-session.md`

## Rastreabilidade Git

Associe esta spec aos **commits futuros** que ainda alterarem este domínio usando trailer `Spec:`. Os commits já existentes permanecem como estão; não reescreva o histórico para simular anterioridade.
