# Workspace architecture boundaries

## Status

`approved`

## Contexto

A Election Ops Platform usa npm workspaces para `apps/*`, `packages/*` e `plugins/*/*`. Os packages compartilhados e plugins já possuem nomes públicos `@eops/*`, mas parte significativa do backend ignora essas superfícies e importa arquivos físicos `src/` de outros workspaces. O checker atual detecta apenas imports diretos entre plugins e não protege apps ou packages.

## Problema

A auditoria dirigida encontrou três padrões estruturais:

- `apps/api` importa `packages/*/src` e módulos internos de 21 plugins;
- plugins importam `packages/database/src`, `packages/event-bus/src` e `packages/security/src/permissions` por caminhos relativos;
- os packages de plugin expõem apenas `src/index.ts` e não possuem entrypoint público uniforme para composição server-side.

Esses imports tornam consumidores dependentes da organização física do produtor, dificultam refactors, enfraquecem a definição de API pública e deixam violações fora do alcance de `check:boundaries`.

## Objetivos

- eliminar imports relativos entre workspaces;
- eliminar imports cross-workspace contendo `/src`;
- consolidar consumo de packages compartilhados por nomes `@eops/*`;
- criar entrypoint público uniforme `@eops/plugin-<slug>/server` para plugins carregados por `apps/api`;
- manter a composição estática atual do NestJS;
- expandir o checker para apps, packages e plugins;
- cobrir regras permitidas e proibidas com fixtures automatizadas;
- preservar integralmente o comportamento de domínio.

## Escopo

- package metadata e entrypoints públicos de `database`, `event-bus`, `security` e plugins compostos por `apps/api`;
- imports cross-workspace em `apps/`, `packages/` e `plugins/`;
- `scripts/check-plugin-boundaries.mjs` ou substituto compatível;
- testes automatizados do checker;
- documentação arquitetural diretamente afetada;
- saneamento seguro dos artefatos locais detectados por `check-ap1.ps1`;
- execution issues de boundaries, validação e rastreabilidade encontrados nesta execução.

## Fora de escopo

- novas funcionalidades eleitorais ou mudanças de regra de negócio;
- microfrontends, plugin loader dinâmico, marketplace ou framework novo de DI;
- alterações de schema Prisma, migrations ou modelo de dados;
- mudança semântica do Event Bus, RBAC ou contratos compartilhados;
- reorganização interna ampla dos plugins;
- atualização de Prisma ou correção forçada de `deepmerge-ts`;
- enforcement heurístico de client/server com alta chance de falso positivo;
- meta de LOC, wrappers ou abstrações sem necessidade arquitetural;
- CI novo ou commit de implementação nesta execução.

## Arquitetura atual

- Packages compartilhados usam nomes como `@eops/database`, `@eops/event-bus` e `@eops/security`, com barrel público em `src/index.ts`.
- `database` já exporta `DatabaseModule` e `PrismaService`; `event-bus` já exporta módulo, serviço e contratos; `security` já exporta permissões, decorators e tipos.
- Apesar dessas APIs, consumidores usam caminhos relativos para os diretórios `src/`.
- Plugins possuem nomes públicos e `main: src/index.ts`, mas não declaram `exports` nem entrypoint server público.
- `apps/api/src/app.module.ts` conhece caminhos físicos `plugins/<categoria>/<plugin>/src/server/<arquivo>.module`.
- O checker atual percorre apenas `plugins/` e bloqueia somente plugin → outro plugin.

## Arquitetura alvo

```text
apps / plugins / packages
        │
        ├── @eops/database
        ├── @eops/event-bus
        ├── @eops/security
        ├── outros @eops/<package> públicos
        └── @eops/plugin-<slug>/server
```

Nenhum workspace consumidor pode conhecer `src/` de outro workspace. A composição continua estática e explícita; a mudança é de contrato de import, não de runtime.

## Regras de imports

1. Imports relativos podem permanecer dentro do mesmo workspace.
2. Um import relativo que resolva para outro workspace é proibido, mesmo sem `/src` no specifier.
3. Imports bare que contenham caminho interno `/src` de outro workspace são proibidos.
4. Packages compartilhados devem ser consumidos pelo nome declarado em `package.json` ou por subpath explicitamente declarado em `exports`.
5. Plugins não podem importar outro plugin, salvo um entrypoint público explicitamente permitido pela arquitetura; a V1 permite entrypoints públicos de plugin somente ao composition root `apps/api`.
6. `apps/api` pode importar `@eops/plugin-<slug>/server` para registrar módulos NestJS.
7. `apps/web` continua consumindo plugins pelo registry e entrypoint público existente, nunca pelo server entrypoint.
8. Imports internos do próprio workspace, inclusive `./src` quando aplicável, não são cross-workspace e ficam fora desta regra.

## Package public APIs

- `@eops/database` deve expor `DatabaseModule`, `PrismaService` e o client já público, sem expor arquivos internos adicionais.
- `@eops/event-bus` deve manter módulo, serviço e contratos já exportados pelo barrel.
- `@eops/security` deve manter permissões, decorators e tipos pelo root; subpaths existentes continuam válidos por compatibilidade, desde que declarados em `exports`.
- `@eops/shared`, `@eops/plugin-sdk` e `@eops/ui` permanecem APIs públicas existentes.
- Packages usados por outros workspaces devem declarar um root export coerente quando necessário; não serão criados subpaths sem consumidor real.

## Plugin server entrypoints

Todo plugin carregado por `apps/api` deve expor exatamente um subpath uniforme:

```text
@eops/plugin-<slug>/server
```

O contrato é implementado por:

- `exports["."]` apontando para o entrypoint público atual;
- `exports["./server"]` apontando para `src/server/index.ts`;
- `src/server/index.ts` exportando somente o módulo NestJS necessário à composição.

O entrypoint não deve reexportar services, repositories ou detalhes internos sem necessidade. Plugins exclusivamente client-side não precisam de `./server`.

## Apps composition rules

- `apps/api` é o único composition root autorizado a importar entrypoints server de plugins nesta V1.
- `apps/api` importa packages compartilhados por `@eops/*`.
- `apps/api` registra módulos estaticamente no `AppModule`; não haverá descoberta dinâmica.
- Apps não importam caminhos físicos sob `packages/*/src` ou `plugins/*/src`.

## Boundary enforcement

O checker deve descobrir workspaces a partir da estrutura `apps/*`, `packages/*` e `plugins/*/*`, analisar arquivos JavaScript/TypeScript e reportar arquivo, specifier e motivo.

Regras objetivas mínimas:

- bloquear plugin → outro plugin, inclusive package import não autorizado;
- bloquear plugin → `packages/*/src`;
- bloquear app → `packages/*/src`;
- bloquear app → `plugins/*/src`;
- bloquear package → outro `packages/*/src`;
- bloquear qualquer import relativo que escape do workspace produtor e entre em outro workspace;
- aceitar imports públicos `@eops/database`, `@eops/event-bus`, `@eops/security`, `@eops/shared`, `@eops/plugin-sdk` e `@eops/ui`;
- aceitar `@eops/plugin-<slug>/server` somente a partir de `apps/api`;
- continuar cobrindo import estático, side-effect import e dynamic import com literal.

O checker não deve tentar inferir client/server por nome de símbolo. A V1 pode bloquear subpaths `/src` e uso de `/server` fora do composition root, mas deixa análise semântica mais profunda documentada como limitação futura.

## Migration strategy

1. confirmar barrels existentes dos packages compartilhados;
2. adicionar somente exports públicos ausentes;
3. migrar imports relativos de packages para `@eops/*`;
4. criar `src/server/index.ts` nos plugins realmente compostos pela API;
5. declarar `./server` de forma uniforme nos respectivos `package.json`;
6. migrar `apps/api` para os novos subpaths;
7. expandir e testar o checker;
8. executar busca final para comprovar zero imports cross-workspace relativos ou contendo `/src`.

As mudanças podem ser mecânicas, mas cada produtor e símbolo devem ser verificados antes da migração. Não realizar replace cego de strings sem confirmar a API pública.

## Backward compatibility

- Os símbolos e módulos exportados mantêm os mesmos objetos JavaScript/TypeScript; apenas o caminho consumidor muda.
- Entry points root existentes dos plugins permanecem disponíveis para o frontend.
- Subpaths públicos existentes de `@eops/security` permanecem configurados.
- Nenhum endpoint, DTO, evento, permissão, schema ou comportamento funcional muda.
- Imports internos dentro do próprio workspace permanecem válidos.

## Workspace hygiene

Antes de remover `test-results/` ou `backup-security-runtime-*`, confirmar que não são versionados, estão ignorados, são artefatos gerados e não têm referências necessárias. A remoção deve usar alvos absolutos validados e somente ocorrer quando todos os critérios forem satisfeitos. O checker `check-ap1.ps1` não será enfraquecido para acomodar artefatos proibidos.

## Critérios de aceite

1. A busca dirigida retorna zero imports cross-workspace relativos.
2. A busca dirigida retorna zero imports cross-workspace contendo `/src`.
3. `apps/api` usa `@eops/database`, `@eops/event-bus` e `@eops/plugin-*/server`.
4. Plugins usam APIs públicas de database, event-bus e security.
5. Cada plugin server composto pela API expõe `./server` uniformemente e somente o módulo necessário.
6. O checker cobre apps, packages e plugins.
7. Fixtures rejeitam os quatro padrões proibidos solicitados.
8. Fixtures aceitam os três packages públicos e um plugin server entrypoint.
9. `npm run check:boundaries` passa no repositório real.
10. Client/server heurístico não é introduzido; a limitação fica documentada.
11. `check-ap1.ps1` passa após limpeza segura ou a impossibilidade é preservada como issue aberto.
12. O issue de boundaries registra evidência e estado final.
13. O issue de Prisma/deepmerge-ts permanece aberto se a cadeia vulnerável continuar.
14. Nenhuma funcionalidade de domínio, migration ou CI é alterada.

## Validação

- busca direcionada final por imports relativos cross-workspace e `/src`;
- testes focados do checker de boundaries;
- `npm run spec:check -- HEAD` e registro separado da divergência histórica encontrada;
- `npm run check:boundaries`;
- `npm run typecheck`;
- `npm run lint`;
- `npm test`;
- `npm run build`;
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-ap1.ps1`;
- `npm ls deepmerge-ts --all` e `npm audit --omit=dev` apenas para revalidar o issue conhecido;
- `git diff --check`;
- revisão de staging e histórico para confirmar que somente a SPEC recebeu commit.
