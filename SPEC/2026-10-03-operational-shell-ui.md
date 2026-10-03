# Shell operacional e home consolidada — Eleições 2026

## O quê e por quê

Redesenhar o shell e a home da Election Ops Platform para reduzir densidade visual, melhorar a hierarquia operacional e consolidar o padrão estético da plataforma em **Eleições 2026**, sem quebrar o isolamento dos plugins.

A home atual funciona, mas ainda se comporta parcialmente como ponto de acesso a módulos. O novo desenho deve priorizar situação operacional: o que exige atenção, onde está acontecendo e qual é o estado geral.

Esta spec é criada **antes da implementação** e deve ser usada como contrato para o próximo agente.

## Arquivos/áreas primárias de escopo

- `apps/web/src/App.tsx`;
- `apps/web/src/components/HomeDashboard.tsx`;
- `apps/web/src/styles/global.css`;
- componentes novos de shell/home dentro de `apps/web/src/components/`, se necessários;
- `packages/ui` somente para primitives genuinamente reutilizáveis;
- `apps/web/src/pluginRegistry.ts` apenas se composição/metadata precisar de ajuste.

A implementação não deve exigir alteração interna em todos os plugins.

## Critérios de aceitação

### Identidade e contexto

- [ ] A interface usa o padrão visual documentado em `docs/UI-DESIGN-GUIDE.md`.
- [ ] Novos textos e fallbacks usam Eleições 2026, nunca Eleições 2024.
- [ ] Quando disponível, nome/ano/turno devem vir do pleito persistido em vez de hardcode.
- [ ] A estética permanece dark navy, com azul/ciano informacional, verde normal, âmbar atenção e vermelho crítico.

### Home

- [ ] A home exibe no máximo 4 KPIs prioritários.
- [ ] KPIs preferenciais: críticos, ativos, locais monitorados/operacionais e equipes em campo, respeitando dados realmente disponíveis.
- [ ] Não inventar percentuais, tendências ou totais para imitar a mockup.
- [ ] O corpo principal usa layout dominante de mapa/resumo geográfico + painel único “Atenção agora”.
- [ ] “Atenção agora” consolida poucos eventos/alertas relevantes em vez de múltiplas listas concorrentes.
- [ ] A faixa inferior possui apenas 2 ou no máximo 3 painéis compactos, como timeline e status da operação.
- [ ] Remover/evitar “Acesso rápido aos módulos” se ele apenas duplicar a sidebar.
- [ ] Remover/evitar blocos que repitam os mesmos KPIs sob outro título.
- [ ] Estados loading, error e empty continuam explícitos.

### Mapa na home

- [ ] A home não importa arquivos internos do plugin `operational-map`.
- [ ] O mapa completo continua pertencendo ao plugin e rota `/map`.
- [ ] Qualquer visão geográfica resumida da home consome APIs/contratos públicos ou usa apresentação shell-owned sem regra de negócio do plugin.
- [ ] Deve existir navegação clara para abrir o mapa completo.

### Sidebar

- [ ] A sidebar continua derivada dos manifests em `pluginRegistry.ts`.
- [ ] Não criar lista manual duplicada de plugins.
- [ ] Categorias funcionam como accordion clicável.
- [ ] Clique no cabeçalho abre/fecha os plugins daquela categoria.
- [ ] Categoria da rota ativa permanece aberta.
- [ ] Item ativo possui destaque visual claro.
- [ ] Cabeçalhos usam `button` e `aria-expanded`.
- [ ] Permissões continuam filtrando plugins antes da renderização.
- [ ] Responsividade não deve quebrar a navegação.

### Isolamento e contexto de IA

- [ ] Nenhum import direto entre implementações internas de plugins.
- [ ] O shell não importa `plugins/**/src/**` para compor dashboard.
- [ ] Dados agregados usam `@eops/api-client` + contratos compartilhados.
- [ ] Regras de negócio permanecem nos plugins.
- [ ] A implementação deve poder ser feita lendo `apps/web`, contracts/APIs necessários e, no máximo, metadata pública dos plugins.
- [ ] `npm run check:boundaries` permanece verde.

### Qualidade

- [ ] `npm run typecheck` verde.
- [ ] `npm run lint` verde.
- [ ] testes relevantes verdes.
- [ ] `npm run build` verde.
- [ ] Nenhuma funcionalidade existente removida sem substituição/justificativa da spec.

## Fora do escopo

- Redesenhar todas as páginas internas dos plugins nesta execução.
- Reescrever arquitetura de plugins.
- Migrar para microfrontends.
- Alterar o banco apenas por estética.
- Criar dados fake adicionais somente para preencher o dashboard.
- Implementar busca global falsa ou controles sem comportamento.

## Referência visual

A mockup aprovada serve como referência de hierarquia:

1. sidebar à esquerda;
2. cabeçalho compacto;
3. quatro KPIs;
4. mapa operacional dominante;
5. painel “Atenção agora” à direita;
6. timeline/status na base.

A mockup não é fonte de dados, datas ou regras de negócio.

## Rastreabilidade

Prompt de implementação:

`prompts/sessoes/2026-10-03-ui-shell-redesign.md`

Os commits desta mudança devem seguir `docs/COMMIT-GUIDE.md`. A SPEC deve ser commitada antes do código. O commit de implementação deve manter escopo `shell` e usar, por exemplo:

```text
feat(shell): redesign home and collapsible sidebar

Agent: <ferramenta/modelo real ou indisponível>
Spec: SPEC/2026-10-03-operational-shell-ui.md
```

Não misture neste commit alterações independentes de plugins. Se um plugin precisar de mudança funcional própria, use sua SPEC e um commit separado com o slug do plugin como escopo.
