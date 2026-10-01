# Relatórios e BI

> **Nota de rastreabilidade:** esta especificação foi reconstruída retrospectivamente em 2026-10-01 a partir do código, request logs e histórico disponível. Ela documenta o estado/intenção real, mas **não deve ser apresentada como prova de que antecedeu o código**. Para novas funcionalidades, a spec deve ser criada e commitada antes da implementação.

## O quê e por quê

Consolidar dados reais dos módulos existentes em dashboards, relatórios e exportações sem duplicação analítica desnecessária.

## Critérios de aceitação

- [x] Dashboard executivo com dados persistidos.
- [x] Filtros por período/pleito/zona/local/status/categoria.
- [x] Métricas de incidentes, SLA, inventário, disponibilidade, rotas e transmissão.
- [x] Exportação CSV real.
- [x] Relatório PDF real.
- [x] Comparação histórica quando houver período suficiente.

## Fora do escopo

- Inventar valores quando dados estiverem ausentes.
- Criar cópia paralela de todo o banco apenas para BI.

## Evidências usadas na reconstrução

- `docs/request-log/2026-10-01-codex-reports-bi.md`

## Rastreabilidade Git

Associe esta spec aos **commits futuros** que ainda alterarem este domínio usando trailer `Spec:`. Os commits já existentes permanecem como estão; não reescreva o histórico para simular anterioridade.
