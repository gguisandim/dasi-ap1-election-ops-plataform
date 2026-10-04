# Instruções para agentes dentro de `plugins/`

Plugins são unidades autônomas de domínio. Trabalhe localmente e preserve a fronteira.

## Leia primeiro

1. classifique o SPEC Gate conforme `SPEC/README.md` e leia a SPEC relevante;
2. `docs/AI-PLUGIN-GUIDE.md`;
3. `docs/COMMIT-GUIDE.md`;
4. a pasta do plugin alvo;
5. `docs/UI-DESIGN-GUIDE.md` somente se houver frontend/UI;
6. packages compartilhados realmente importados pelo plugin.

Não percorra todos os plugins para “entender o sistema”. Se precisar de padrão estrutural, consulte apenas um plugin semelhante.

Documentação em `docs/modules/` não substitui a SPEC normativa. Se o gate resultar em `NEW_SPEC` ou `UPDATE_SPEC`, a SPEC deve ser commitada antes da alteração do plugin; a autorização desse commit não autoriza o commit da implementação.

## Regras

- implementação específica permanece no plugin;
- client/server devem permanecer separados;
- CSS do plugin usa CSS Modules;
- frontend usa `@eops/api-client` em services próprios;
- segurança usa `@eops/security`;
- contratos comuns usam `@eops/shared/<dominio>`;
- comunicação cross-domain usa API pública, Event Bus ou contrato neutro;
- nunca importe `plugins/<outra-categoria>/<outro-plugin>/src/...`;
- não mova regra de negócio para `apps/web` ou `apps/api`;
- não altere o shell para resolver problema estritamente interno do plugin.

## Pontos globais permitidos quando realmente necessários

- `packages/database/prisma/*` para persistência/migrations/seed;
- `packages/security/src/permissions.ts` para novas permissões;
- `packages/event-bus/src/contracts.ts` para eventos cross-domain;
- `packages/shared/src/<dominio>.ts` para contratos compartilhados;
- `apps/web/src/pluginRegistry.ts` para registrar plugin;
- `apps/api/src/app.module.ts` para registrar módulo NestJS.

Antes de finalizar, execute `npm run check:boundaries`.


## Commits de plugin

O escopo do commit deve preferir o slug do plugin, por exemplo `feat(shifts): ...` ou `fix(handover): ...`. Toda mudança funcional deve apontar para uma SPEC previamente commitada e usar os trailers definidos em `docs/COMMIT-GUIDE.md`. Não misture alterações independentes de outros plugins no mesmo commit.
