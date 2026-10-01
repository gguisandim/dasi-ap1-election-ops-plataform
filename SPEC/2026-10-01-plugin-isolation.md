# Isolamento de fronteiras dos plugins

> **Nota de rastreabilidade:** esta especificação foi reconstruída retrospectivamente em 2026-10-01 a partir do código, request logs e histórico disponível. Ela documenta o estado/intenção real, mas **não deve ser apresentada como prova de que antecedeu o código**. Para novas funcionalidades, a spec deve ser criada e commitada antes da implementação.

## O quê e por quê

Reduzir dependências diretas entre plugins sem separar o banco central. Criar contratos neutros de segurança e regras verificáveis para permitir que Codex/IA trabalhe em um plugin com contexto limitado.

## Critérios de aceitação

- [x] Plugins não devem importar implementação interna de outro plugin.
- [x] RBAC/decorators/tipos autenticados devem vir de pacote neutro compartilhado.
- [x] Contratos compartilhados devem ser organizados por domínio.
- [x] Deve existir checagem automatizada de boundaries.
- [x] Guia para agentes deve indicar explicitamente quais arquivos globais podem ser alterados.

## Fora do escopo

- Separar Prisma em múltiplos bancos.
- Transformar o projeto em microserviços.

## Evidências usadas na reconstrução

- `docs/request-log/2026-10-01-chatgpt-plugin-boundary-refactor.md`
- `AGENTS.md`
- `docs/AI-PLUGIN-GUIDE.md`

## Rastreabilidade Git

Associe esta spec aos **commits futuros** que ainda alterarem este domínio usando trailer `Spec:`. Os commits já existentes permanecem como estão; não reescreva o histórico para simular anterioridade.
