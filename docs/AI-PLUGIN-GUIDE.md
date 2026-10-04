# Guia de implementação com IA

Este guia permite que Codex ou outro agente trabalhe na Election Ops Platform sem consumir todo o contexto do monorepo e sem romper as fronteiras dos plugins.

## 1. Princípio

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

O objetivo não é só modularidade de código: a arquitetura também deve permitir que um agente implemente uma funcionalidade lendo **somente o domínio relevante**.

## 2. Regra de orçamento de contexto

Não comece lendo o monorepo inteiro.

### Alteração em plugin existente

Leia, nesta ordem:

1. `SPEC/README.md`;
2. SPEC relacionada à tarefa;
3. `plugins/AGENTS.md`;
4. pasta do plugin alvo;
5. apenas os packages importados pelo plugin;
6. contratos globais que realmente precisarem ser alterados;
7. `docs/UI-DESIGN-GUIDE.md` somente se houver frontend/UI.

Se precisar de referência estrutural, abra **no máximo um** plugin semelhante. Não copie regra de negócio de outro domínio.

### Plugin novo

Além do fluxo acima:

1. consulte um plugin semelhante somente para estrutura;
2. defina manifest, rotas, permissões e contratos necessários;
3. registre o plugin nos pontos de composição;
4. não percorra todos os plugins para “entender o sistema”.

### Alteração no shell / home / navegação global

Leia:

1. SPEC da mudança;
2. `docs/UI-DESIGN-GUIDE.md`;
3. `apps/web/src/App.tsx`;
4. `apps/web/src/pluginRegistry.ts`;
5. componentes globais afetados em `apps/web/src/components/`;
6. `apps/web/src/styles/global.css`;
7. `@eops/plugin-sdk` e `@eops/ui` quando necessários.

Para montar a home, use manifests, APIs públicas e contratos compartilhados. **Não abra nem importe a implementação interna de todos os plugins.**

## 3. SPEC Gate antes de implementação

Antes da primeira alteração de código, classifique a tarefa conforme `SPEC/README.md`:

- `NEW_SPEC`: criar e commitar uma SPEC nova;
- `UPDATE_SPEC`: atualizar e commitar a SPEC existente;
- `EXISTING_SPEC_OK`: reutilizar uma SPEC que cobre integralmente a mudança;
- `SPEC_EXEMPT`: justificar por que não existe mudança funcional ou normativa.

`SPEC/README.md` é a referência canônica. Arquivos em `docs/modules/` são descritivos e não substituem a SPEC; prompts e código existente também não comprovam anterioridade normativa. Adaptadores de ferramentas devem apontar para estas regras, sem duplicá-las integralmente.

Para funcionalidade nova ou alteração material de comportamento:

1. criar/atualizar a spec;
2. fazer o commit da spec antes do código;
3. gerar plano/tarefas;
4. implementar;
5. validar;
6. usar o formato de `docs/COMMIT-GUIDE.md`;
7. usar trailers `Agent:` e `Spec:` no commit de implementação.

A ordem do histórico importa. Se o requisito mudar durante a implementação, atualize e commite a SPEC antes do próximo commit de código. Specs reconstruídas retrospectivamente não devem ser apresentadas como se tivessem antecedido código antigo.

Uma autorização para commitar a SPEC é limitada ao que o usuário autorizou. Ela não autoriza commit da implementação, push ou reescrita do histórico. A entrega deve incluir o bloco `SPEC COMPLIANCE` definido em `SPEC/README.md`.

Após existir um commit de implementação, valide seus trailers e a anterioridade da SPEC com `npm run spec:check` ou `npm run spec:check -- <base>..HEAD`. O checker é objetivo e não substitui a classificação humana do SPEC Gate.

## 4. Contrato visual obrigatório para frontend

Toda alteração de UI deve obedecer a:

`docs/UI-DESIGN-GUIDE.md`

Resumo das regras globais:

- contexto atual da plataforma: **Eleições 2026**;
- home é visão operacional, não catálogo de plugins;
- no máximo 4 KPIs principais na home;
- mapa/resumo geográfico é o foco dominante;
- alertas e ocorrências prioritárias ficam consolidados em “Atenção agora”;
- sidebar é derivada dos manifests e categorias, com accordion clicável;
- não duplicar a sidebar em grandes cards de módulos;
- usar cor forte para estado/ação, não como decoração em todos os cards;
- não inventar dados/percentuais para aproximar mockup;
- CSS específico de plugin continua no plugin via CSS Modules.

O shell pode cuidar de layout, navegação e síntese de dados, mas não deve receber regra de negócio de um plugin.

## 5. Pontos globais autorizados

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

A sidebar deve consumir metadata pública dos manifests. Não criar um segundo catálogo manual de plugins no shell.

### Backend

`apps/api/src/app.module.ts` apenas registra módulos NestJS. Regras de negócio permanecem no plugin.

### Contratos

`packages/shared/src/` é separado por domínio.

Exemplos existentes:

- `elections.ts`;
- `incidents.ts`;
- `inventory.ts`;
- `simulation.ts`;
- `auth.ts`;
- `common.ts`;
- `format.ts`.

O barrel `@eops/shared` existe por compatibilidade, mas um agente deve preferir abrir/importar somente o domínio em que está trabalhando.

## 6. Proibição de dependência plugin → plugin

Exemplo incorreto:

```ts
import { IncidentsService } from "../../../../monitoring/incidents/src/server/incidents.service";
```

Alternativas:

- contrato compartilhado em `packages/shared`;
- chamada HTTP pela API pública;
- Event Bus;
- package genérico extraído quando a abstração for realmente transversal.

Execute:

```bash
npm run check:boundaries
```

para detectar imports diretos entre plugins.

## 7. Home e agregação sem quebrar isolamento

A home pode mostrar informação de vários domínios, mas isso **não autoriza** acoplamento de implementação.

Permitido:

- `@eops/api-client` chamando endpoints públicos;
- tipos de `@eops/shared/<dominio>`;
- metadata de manifests já registrada no shell;
- Event Bus quando houver necessidade arquitetural real.

Evite:

- importar componentes/services de `plugins/**/src/**` na home;
- copiar lógica de SLA, cobertura, transmissão ou incidente para `apps/web`;
- abrir dezenas de plugins só para montar um dashboard;
- criar endpoints duplicados se já existe API pública suficiente.

Se um dado necessário não existe, prefira um estado neutro/indisponível ou um contrato agregado bem definido. Não preencha a lacuna com números hardcoded.

## 8. CSS e UI

### Shell

O CSS global contém apenas:

- tema/tokens;
- reset;
- layout do shell;
- navegação global;
- home global quando ela pertence ao shell.

### Plugin

Código visual específico de um plugin usa `*.module.css` dentro do próprio plugin.

Primitives reutilizáveis podem evoluir em `@eops/ui` quando forem realmente transversais. Não mover um componente específico para `@eops/ui` somente para “reutilizar” uma vez.

## 9. Checklist de entrega de um plugin

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

## 10. Checklist de entrega do shell/UI global

- spec da alteração existe antes da implementação;
- `docs/UI-DESIGN-GUIDE.md` foi respeitado;
- sidebar continua baseada em manifests/permissões;
- nenhuma implementação interna de plugin foi importada pelo shell;
- home usa somente dados reais/publicamente disponíveis;
- estados de loading/error/empty existem;
- navegação por teclado e `aria-expanded` em accordions;
- responsividade preservada;
- `npm run check:boundaries` verde;
- typecheck, lint, testes e build verdes.


## 11. Política de commits para agentes

Leia `docs/COMMIT-GUIDE.md` antes de sugerir ou executar qualquer commit.

Regras resumidas:

- título no formato `tipo(escopo): resumo`;
- escopo preferencial = plugin/domínio afetado, ou `shell`, `security`, `database`, etc.;
- SPEC commitada antes da implementação;
- `Agent:` e `Spec:` obrigatórios nos commits funcionais;
- um commit por unidade lógica revisável;
- não misturar plugins independentes;
- não usar commits genéricos como `update`, `final` ou `ajustes`;
- não criar commit/push/rebase/squash/force-push sem pedido explícito;
- se não houver pedido de commit, entregar uma mensagem de commit sugerida no formato oficial.

Exemplo:

```text
feat(shell): redesign home and collapsible sidebar

Agent: codex/model-unavailable
Spec: SPEC/2026-10-03-operational-shell-ui.md
```

## 12. Feedback de execução

Quando uma execução revelar uma deficiência estrutural de prompt, SPEC, guide, ambiente, dependência, ferramenta ou validação, siga `docs/execution-issues/README.md`. Registre somente problemas com valor para execuções futuras, aplique correções documentais claras quando forem seguras e nunca silencie divergências. Debugging trivial corrigido durante a própria tarefa não deve virar execution issue.
