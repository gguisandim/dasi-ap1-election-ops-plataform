# Instruções para agentes de IA

Este repositório é um monorepo modular. Ao implementar ou alterar um plugin, **não carregue o repositório inteiro como contexto por padrão**.

## Escopo padrão

Comece lendo somente:

1. `plugins/<categoria>/<plugin>/`;
2. `packages/plugin-sdk/`;
3. `packages/api-client/` quando houver frontend consumindo API;
4. o submódulo relevante de `packages/shared/src/`;
5. `packages/security/` quando houver autenticação/RBAC;
6. `packages/event-bus/src/contracts.ts` somente quando o plugin publicar/consumir eventos.

Leia outros plugins apenas quando estiver investigando um comportamento compartilhado que não esteja documentado em `packages/`.

## Regra de fronteira

Plugins não devem importar implementação de outros plugins. Exemplos proibidos:

- `plugins/a/...` importando `plugins/b/src/server/...`;
- um pacote `@eops/plugin-*` importado por outro plugin;
- reutilizar service/controller/componente específico de outro domínio por conveniência.

Compartilhamento deve ocorrer por `packages/`, contratos HTTP ou Event Bus.

## Pontos globais que um plugin PODE alterar quando necessário

Uma tarefa de plugin pode tocar estes arquivos fora de sua pasta, mas somente quando a funcionalidade exigir:

- `packages/database/prisma/schema.prisma`: modelos/enums persistentes do plugin;
- `packages/database/prisma/migrations/`: migration correspondente;
- `packages/database/prisma/seed.ts`: seed, permissões ou dados demo necessários;
- `packages/security/src/permissions.ts`: novas permissões RBAC;
- `packages/shared/src/<dominio>.ts`: contratos realmente compartilhados;
- `packages/event-bus/src/contracts.ts`: eventos cross-plugin;
- `apps/api/src/app.module.ts`: registro do módulo NestJS;
- `apps/web/src/pluginRegistry.ts`: registro do plugin/rotas/sidebar;
- `tests/e2e/`: fluxo E2E que atravesse mais de um módulo;
- documentação em `docs/`.

Esses arquivos são **pontos de composição**, não autorização para mover regra de negócio para fora do plugin.

## Banco

O banco permanece centralizado por decisão arquitetural. Não tente criar um schema Prisma por plugin. Novos modelos ficam no `schema.prisma` central e devem ter migration versionada.

## Segurança

Use `@eops/security` para `Permissions`, `Public`, `AuthenticatedRequest` e catálogo de permissões. Nunca importe decorators/types de autenticação de `plugins/system/access-control`.

## Contratos compartilhados

`@eops/shared` é dividido por domínio. Para contexto reduzido, prefira ler/importar o submódulo correspondente, como `@eops/shared/incidents`, `@eops/shared/inventory` ou `@eops/shared/elections`. O barrel `@eops/shared` continua disponível por compatibilidade.

## Event Bus

Para efeitos entre domínios, prefira eventos a imports diretos. Contratos ficam em `packages/event-bus/src/contracts.ts`. O plugin publica algo que já ocorreu; não use o Event Bus para esconder uma transação crítica que deveria permanecer no service de domínio.

## Finalização obrigatória

Antes de concluir uma alteração relevante, rode quando o ambiente permitir:

```bash
npm run check:boundaries
npm run db:validate
npm run typecheck
npm run lint
npm test
npm run build
```

Se houver fluxo de integração afetado, rode também `npm run e2e`.
