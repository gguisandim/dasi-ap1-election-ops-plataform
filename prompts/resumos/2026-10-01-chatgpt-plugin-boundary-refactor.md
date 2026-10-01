# Refatoração de fronteiras de plugins

**Data:** 2026-10-01  
**IA:** ChatGPT — GPT-5.6 Sol  
**Tokens:** indisponível nesta interface

## Solicitação

Aumentar o isolamento entre plugins sem separar o banco Prisma, e documentar quais pontos globais Codex/IA pode alterar durante a implementação de um plugin.

## Alterações

- criado `@eops/security` para decorators, tipos autenticados e catálogo de permissões;
- removidos imports de implementação do plugin `access-control` pelos demais plugins;
- mantidos reexports de compatibilidade em `access-control`;
- catálogo de permissões centralizado e seed conectado ao catálogo;
- `@eops/shared` dividido em contratos por domínio e imports atuais migrados para subpaths;
- Event Bus dividido em contrato, implementação e módulo NestJS;
- criado `npm run check:boundaries` para impedir dependência direta plugin → plugin;
- criado `AGENTS.md`, `plugins/AGENTS.md` e `docs/AI-PLUGIN-GUIDE.md`;
- documentação de arquitetura, RBAC e Event Bus atualizada;
- banco Prisma mantido centralizado conforme solicitado.

## Pontos globais autorizados para um agente de plugin

- schema/migrations/seed do Prisma;
- catálogo de permissões;
- contratos compartilhados do domínio;
- contratos do Event Bus;
- `apps/api/src/app.module.ts`;
- `apps/web/src/pluginRegistry.ts`;
- testes E2E e documentação quando o fluxo for transversal.

## Validação executada

- `npm run check:boundaries`: aprovado;
- package-lock atualizado para o novo workspace `@eops/security`;
- parse sintático de arquivos TypeScript/TSX: aprovado;
- validação completa de dependências não pôde ser concluída no container porque `npm ci` excedeu o limite de execução do ambiente. Rodar localmente `npm ci`, `npm run db:generate`, `npm run typecheck`, `npm run lint`, `npm test` e `npm run build`.
