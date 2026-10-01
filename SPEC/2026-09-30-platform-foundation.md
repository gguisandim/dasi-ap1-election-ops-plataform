# Fundação da plataforma modular

> **Nota de rastreabilidade:** esta especificação foi reconstruída retrospectivamente em 2026-10-01 a partir do código, request logs e histórico disponível. Ela documenta o estado/intenção real, mas **não deve ser apresentada como prova de que antecedeu o código**. Para novas funcionalidades, a spec deve ser criada e commitada antes da implementação.

## O quê e por quê

Criar uma plataforma acadêmica modular para gestão de operações eleitorais, com frontend React/Vite, backend NestJS, PostgreSQL/Prisma e plugins isolados por domínio. A motivação é permitir evolução incremental por agentes de programação sem exigir contexto completo do monorepo.

## Critérios de aceitação

- [x] O projeto deve funcionar como monorepo npm workspaces.
- [x] Plugins devem ter pasta própria e manter UI/backend/estilos localmente quando possível.
- [x] Deve existir configuração por `.env.example` sem segredos reais.
- [x] Frontend e backend devem iniciar por comandos documentados.
- [x] Deve existir mecanismo de registro/composição de plugins.

## Fora do escopo

- Microserviços independentes por plugin.
- Duplicar banco/schema por plugin.
- Inflar LOC com código morto ou gerado.

## Evidências usadas na reconstrução

- `docs/request-log/2026-09-30-initial-request.md`
- `README.md`

## Rastreabilidade Git

Associe esta spec aos **commits futuros** que ainda alterarem este domínio usando trailer `Spec:`. Os commits já existentes permanecem como estão; não reescreva o histórico para simular anterioridade.
