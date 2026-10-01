# Infraestrutura, pleitos, estrutura eleitoral e mapa

> **Nota de rastreabilidade:** esta especificação foi reconstruída retrospectivamente em 2026-10-01 a partir do código, request logs e histórico disponível. Ela documenta o estado/intenção real, mas **não deve ser apresentada como prova de que antecedeu o código**. Para novas funcionalidades, a spec deve ser criada e commitada antes da implementação.

## O quê e por quê

Transformar a base em aplicação persistente e navegável, implementando PostgreSQL/Prisma, roteamento real e a cadeia Pleito → Zona → Local → Seção, além de mapa operacional.

## Critérios de aceitação

- [x] Prisma/PostgreSQL com migrations e seed.
- [x] Pleitos persistidos e navegáveis.
- [x] Zonas, locais e seções relacionados corretamente.
- [x] Mapa operacional deve exibir locais e permitir navegação.
- [x] Build/typecheck/testes devem permanecer executáveis.

## Fora do escopo

- Roteamento viário externo.
- Monitoramento de rede real.

## Evidências usadas na reconstrução

- `docs/request-log/2026-09-30-codex-infrastructure-elections-structure-map.md`

## Rastreabilidade Git

Associe esta spec aos **commits futuros** que ainda alterarem este domínio usando trailer `Spec:`. Os commits já existentes permanecem como estão; não reescreva o histórico para simular anterioridade.
