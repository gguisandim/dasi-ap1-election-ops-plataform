# Instruções para agentes de IA — Election Ops Platform

Este repositório foi estruturado para permitir trabalho com contexto limitado. Não carregue o monorepo inteiro por padrão.

## Ordem de trabalho

1. Leia `SPEC/README.md`.
2. Identifique e leia apenas a SPEC relacionada à tarefa.
3. Leia `docs/AI-PLUGIN-GUIDE.md`.
4. Leia `docs/COMMIT-GUIDE.md` antes de sugerir ou criar commits.
5. Se houver alteração de frontend/UI, leia `docs/UI-DESIGN-GUIDE.md`.
6. Abra somente os arquivos diretamente necessários ao escopo.
7. Para funcionalidade nova ou mudança material de comportamento, crie/atualize a SPEC e faça o commit da SPEC antes do código.
8. Preserve arquitetura, rotas, permissões e funcionalidades existentes, salvo quando a SPEC determinar mudança.

## Contexto mínimo

### Tarefa em um plugin

Leia:

- `plugins/AGENTS.md`;
- pasta do plugin afetado;
- manifest do plugin;
- packages efetivamente importados por ele;
- contratos globais que precisar alterar.

Não abra todos os outros plugins. Consulte no máximo um plugin semelhante quando precisar de referência estrutural.

### Tarefa no shell/global UI

Leia:

- `apps/web/src/App.tsx`;
- `apps/web/src/pluginRegistry.ts`;
- componentes do shell diretamente afetados;
- `apps/web/src/styles/global.css`;
- `@eops/plugin-sdk` e `@eops/ui` quando necessários;
- manifests por meio do registry, sem abrir implementação interna de todos os plugins.

Para dados agregados na home, use APIs públicas e contratos compartilhados. Não importe services/components internos de plugins.

## Validação

Após implementar, execute o conjunto compatível com a mudança:

```bash
npm run check:boundaries
npm run typecheck
npm run lint
npm test
npm run build
```

Se algum comando depender de infraestrutura indisponível, registre exatamente o que não pôde ser validado; não invente sucesso.

## Feedback de execução

Problemas estruturais encontrados durante uma tarefa devem seguir `docs/execution-issues/README.md`. Registre divergências relevantes de prompt, SPEC, guides, repositório, ambiente, dependências ou validação; não esconda falhas. Não registre debugging trivial ou erros intermediários corrigidos na própria execução.


## Commits e rastreabilidade

Siga `docs/COMMIT-GUIDE.md`. Mudanças funcionais devem usar título `tipo(escopo): resumo`, possuir uma SPEC previamente commitada e incluir trailers `Agent:` e `Spec:`. Commits devem permanecer atômicos por plugin/domínio; não misture plugins independentes nem shell com mudanças não relacionadas.

Não execute commit, push, rebase, squash ou force-push sem pedido explícito. Se o usuário não pedir o commit, sugira ao final uma mensagem pronta no formato oficial.
