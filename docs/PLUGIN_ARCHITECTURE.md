# Arquitetura de plugins e workspaces

## Regra principal

Um plugin é uma unidade autônoma de domínio. Código específico não deve ser movido para `apps/web` ou `apps/api` por conveniência. Os apps são pontos de composição; implementação, services, estilos e rotas pertencem ao plugin.

Cada diretório registrado como npm workspace também é uma unidade arquitetural. Um consumidor conhece a API pública do produtor, nunca a organização física de seu diretório `src/`.

## Estrutura recomendada

```text
plugins/<categoria>/<plugin>/
  package.json
  src/
    client/
      components/
      pages/
      services/
      styles/
    server/
      dto/
      controllers ou controllers próximos do módulo
      services ou services próximos do módulo
      <dominio>.module.ts
      index.ts
    shared/
      types/
      schemas/
      constants/
    index.ts
    manifest.ts
  tests/
```

A estrutura pode ser simplificada em plugins pequenos, mas a fronteira client/server deve permanecer explícita.

## Manifest e rotas

O `PluginManifest` declara identidade, categoria, versão, permissões e `route`. O `PlatformPlugin` pode fornecer várias rotas:

```ts
export const examplePlugin: PlatformPlugin = {
  manifest,
  routes: [
    { path: "/examples", Component: ExampleList },
    { path: "/examples/:id", Component: ExampleDetail },
  ],
};
```

O shell compõe essas rotas com React Router e usa `manifest.route` para a sidebar e identificação do módulo ativo. A propriedade `View` permanece opcional para compatibilidade com plugins demonstrativos antigos.

## Backend modular

Plugins de domínio expõem módulos NestJS dentro de `src/server`. Regras de negócio, DTOs, services e controllers permanecem encapsulados no plugin. `apps/api/src/app.module.ts` é o composition root e registra cada módulo pelo entrypoint público uniforme:

```ts
import { IncidentsModule } from "@eops/plugin-incidents/server";
```

O subpath `/server` reexporta somente o módulo necessário à composição. `apps/api` é seu único consumidor cross-workspace autorizado. A composição continua estática; esta convenção não cria loader dinâmico, microfrontends ou marketplace de plugins.

## Dependências compartilhadas

- `@eops/api-client`: transporte HTTP tipado, JSON e `ApiError`;
- `@eops/database`: schema, migrations, seed e integração Prisma;
- `@eops/plugin-sdk`: contratos de manifest e rotas;
- `@eops/security`: decorators, tipos autenticados e catálogo de permissões;
- `@eops/shared/<dominio>`: tipos, enums e labels compartilhados por domínio;
- `@eops/event-bus`: comunicação tipada entre domínios sem import direto;
- `@eops/ui`: Button, Input, Select, Badge, Card, estados, breadcrumb e paginação.

Componentes que só fazem sentido em um módulo continuam no plugin. Plugins não importam implementação de outros plugins; comunicação transversal usa packages compartilhados, API pública ou Event Bus.

Um subpath só é contrato público quando aparece explicitamente em `exports` do package produtor. O fato de um arquivo existir em `src/` não o torna importável por outro workspace.

São proibidos:

- imports relativos que saiam de um workspace e entrem em outro;
- imports bare contendo caminhos físicos como `packages/<nome>/src` ou `plugins/<categoria>/<plugin>/src`;
- subpaths não declarados em `exports`;
- dependência direta de implementação entre plugins.

## Build e runtime

Durante desenvolvimento, TypeScript resolve os tipos pelos entrypoints fonte declarados. O build da API compila a árvore estática e `scripts/sync-server-workspace-dist.mjs` materializa os artefatos CommonJS nos `dist/` dos workspaces produtores. Assim, Node resolve os mesmos nomes públicos em produção sem depender de arquivos TypeScript ou caminhos físicos internos.

## Categorias

```text
operations/     núcleo da operação eleitoral
logistics/      movimentação de pessoas, equipamentos e materiais
monitoring/     mapa, eventos, incidentes e conectividade
analytics/      dashboards, BI e relatórios
system/         auditoria, administração e configurações
```

A interface lê `manifest.category` e cria os agrupamentos da sidebar automaticamente.

## CSS e comunicação com API

Plugins usam `*.module.css` para impedir colisões. O CSS global contém somente tema, reset e layout do shell. Chamadas ao backend ficam em `src/client/services` e usam `@eops/api-client`; componentes não devem chamar `fetch` diretamente.

## Enforcement

`npm run check:boundaries` descobre apps, packages e plugins e rejeita:

- qualquer import relativo que cruze workspaces;
- qualquer acesso físico cross-workspace a `src/`;
- subpaths públicos não declarados;
- plugin importando outro plugin;
- uso do entrypoint `/server` fora de `apps/api`.

As regras objetivas evitam heurísticas frágeis sobre nomes de arquivos client/server. Restrições sem contrato estrutural inequívoco permanecem para evolução futura.

## Checklist de novo plugin

1. Criar workspace e manifest.
2. Implementar e exportar as rotas próprias.
3. Separar páginas, componentes, services e estilos.
4. Se houver backend, criar módulo, controller, service e DTOs no plugin e expor somente o módulo em `./server`.
5. Registrar a exportação no shell (`apps/web/src/pluginRegistry.ts`) e o módulo público no bootstrap da API (`apps/api/src/app.module.ts`).
6. Se precisar de persistência, alterar o schema Prisma central e criar migration.
7. Se precisar de RBAC, declarar a permissão em `packages/security/src/permissions.ts` e no seed; consumidores usam `@eops/security`.
8. Se precisar comunicar outro domínio, declarar o evento em `packages/event-bus/src/contracts.ts`; consumidores usam `@eops/event-bus`.
9. Declarar no `package.json` as dependências públicas realmente consumidas.
10. Adicionar validação, estados de loading/erro/vazio e testes relevantes.
11. Executar `npm run check:boundaries`.

## Trabalho com agentes de IA

As regras de escopo para Codex/IA estão em `AGENTS.md`, `plugins/AGENTS.md` e `docs/AI-PLUGIN-GUIDE.md`. O objetivo é permitir que um agente trabalhe a partir da pasta do plugin e abra somente os contratos globais necessários.

Ao adicionar uma dependência cross-workspace:

1. confirme que a API pertence ao produtor;
2. exporte somente o símbolo ou subpath necessário;
3. declare a dependência npm no consumidor;
4. importe pelo nome público;
5. execute os testes do checker, `check:boundaries`, typecheck, lint, testes e build.

O contrato normativo desta política está em `SPEC/2026-10-04-workspace-architecture-boundaries.md`.
