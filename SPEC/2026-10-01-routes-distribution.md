# Rotas e Distribuição

> **Nota de rastreabilidade:** esta especificação foi reconstruída retrospectivamente em 2026-10-01 a partir do código, request logs e histórico disponível. Ela documenta o estado/intenção real, mas **não deve ser apresentada como prova de que antecedeu o código**. Para novas funcionalidades, a spec deve ser criada e commitada antes da implementação.

## O quê e por quê

Planejar e acompanhar distribuição logística eleitoral por rotas, paradas, veículos, entregas e lotes, incluindo atraso, mapa e histórico.

## Critérios de aceitação

- [x] CRUD/listagem/filtros de rotas.
- [x] Paradas ordenadas com ETA e horário real.
- [x] Veículos e responsáveis persistidos.
- [x] Entregas/lotes com status e comprovante por URL.
- [x] Atrasos calculados.
- [x] Mapa com sequência de pontos.
- [x] Eventos/histórico e RBAC.

## Fora do escopo

- Algoritmo externo de roteamento viário.
- Upload binário obrigatório de comprovantes.

## Evidências usadas na reconstrução

- `docs/request-log/2026-10-01-codex-routes-distribution.md`

## Rastreabilidade Git

Associe esta spec aos **commits futuros** que ainda alterarem este domínio usando trailer `Spec:`. Os commits já existentes permanecem como estão; não reescreva o histórico para simular anterioridade.
