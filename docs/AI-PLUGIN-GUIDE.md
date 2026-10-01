# Guia de implementação de plugins com IA

Este guia existe para permitir que Codex ou outro agente implemente módulos sem consumir todo o contexto do monorepo.

## Princípio

Um plugin possui sua implementação. O restante do monorepo fornece infraestrutura e pontos explícitos de composição.

```text
plugin
  ├─ client/
  ├─ server/
  ├─ manifest.ts
  └─ index.ts
       │
       ├── @eops/api-client
       ├── @eops/security
       ├── @eops/shared/<dominio>
       ├── @eops/event-bus
       └── @eops/database

Pontos de composição:
  apps/web/src/pluginRegistry.ts
  apps/api/src/app.module.ts
```

## O que ler antes de programar

### Alteração em plugin existente

Leia:

1. pasta do plugin;
2. `plugins/AGENTS.md`;
3. apenas os packages importados pelo plugin;
4. contratos globais afetados.

### Plugin novo

Além do acima, consulte um plugin semelhante como referência estrutural. Não copie regra de negócio de outro plugin.

## Pontos globais autorizados

### Banco

O Prisma continua centralizado:

- `packages/database/prisma/schema.prisma`;
- `packages/database/prisma/migrations/`;
- `packages/database/prisma/seed.ts`.

Um plugin persistente pode alterar esses arquivos. Isso é uma exceção intencional à fronteira do plugin.

### RBAC

Use:

- `packages/security/src/decorators.ts`;
- `packages/security/src/types.ts`;
- `packages/security/src/permissions.ts`.

Ao criar uma permissão, atualize o catálogo e o seed. Controllers importam de `@eops/security`, nunca do plugin `access-control`.

### Event Bus

Eventos compartilhados ficam em:

`packages/event-bus/src/contracts.ts`

Se o plugin só possui comportamento interno, não crie evento global. Se outro domínio precisa reagir ao acontecimento sem acoplamento direto, adicione um evento tipado.

### Sidebar e rotas

`apps/web/src/pluginRegistry.ts` é o ponto de composição do frontend. O manifest fornece nome, categoria, ícone, rota e permissões. Alterar o registry para registrar um plugin é esperado e não viola isolamento.

### Backend

`apps/api/src/app.module.ts` apenas registra módulos NestJS. Regras de negócio permanecem no plugin.

### Contratos

`packages/shared/src/` é separado por domínio:

- `elections.ts`;
- `incidents.ts`;
- `inventory.ts`;
- `simulation.ts`;
- `auth.ts`;
- `common.ts`;
- `format.ts`.

O barrel `@eops/shared` existe por compatibilidade, mas um agente pode abrir somente o arquivo do domínio em que está trabalhando.

## Proibição de dependência plugin → plugin

Exemplo incorreto:

```ts
import { IncidentsService } from "../../../../monitoring/incidents/src/server/incidents.service";
```

Alternativas:

- contrato compartilhado em `packages/shared`;
- chamada HTTP pela API pública;
- Event Bus;
- package genérico extraído quando a abstração for realmente transversal.

Execute `npm run check:boundaries` para detectar imports diretos entre plugins.

## Checklist de entrega de um plugin

- implementação específica dentro da pasta do plugin;
- CSS específico em CSS Modules;
- API consumida via `@eops/api-client`;
- segurança via `@eops/security`;
- modelos/migration quando necessário;
- permissões + seed quando necessário;
- eventos apenas quando houver integração cross-domain;
- registro no `pluginRegistry.ts`;
- módulo registrado no `AppModule` se houver backend;
- testes das regras críticas;
- sem import direto de outro plugin;
- `npm run check:boundaries` verde;
- typecheck, lint, testes e build verdes.
