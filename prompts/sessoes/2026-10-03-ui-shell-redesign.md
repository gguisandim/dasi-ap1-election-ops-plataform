# Registro de execução planejada — redesign do shell/home

## Data

2026-10-03

## Objetivo

Redesenhar o shell e a home da Election Ops Platform seguindo a referência visual aprovada, com menor densidade, contexto Eleições 2026, sidebar em accordion e preservação estrita do isolamento dos plugins.

## SPEC

`SPEC/2026-10-03-operational-shell-ui.md`

## Prompt para o agente

Você está trabalhando no monorepo **Election Ops Platform**.

Sua tarefa é implementar o redesign do **shell global + home/visão geral** para o padrão visual operacional aprovado, sem quebrar a arquitetura modular nem fazer o agente depender do contexto de todos os plugins.

### 0. Regra de contexto: não leia o monorepo inteiro

Antes de alterar código, leia somente:

1. `SPEC/README.md`;
2. `SPEC/2026-10-03-operational-shell-ui.md`;
3. `AGENTS.md`;
4. `docs/AI-PLUGIN-GUIDE.md`;
5. `docs/UI-DESIGN-GUIDE.md`;
6. `docs/COMMIT-GUIDE.md`;
7. `apps/web/src/App.tsx`;
8. `apps/web/src/components/HomeDashboard.tsx`;
9. `apps/web/src/styles/global.css`;
10. `apps/web/src/pluginRegistry.ts`;
11. `packages/plugin-sdk/src/index.ts`;
12. `packages/ui/src/*` somente se for necessário reaproveitar/evoluir primitives.

Depois disso, abra apenas contratos compartilhados e controllers/services públicos estritamente necessários para descobrir o formato dos endpoints que a home irá consumir.

**Não abra todos os plugins.**

Se precisar entender um endpoint de um domínio, abra somente o plugin responsável por esse endpoint e apenas os arquivos necessários. Não use outros plugins como contexto geral.

### 1. Restrições arquiteturais obrigatórias

- Não recrie o projeto.
- Não centralize implementação de plugins em `apps/web`.
- Não importe nada de `plugins/**/src/**` para montar a home.
- Não crie dependência plugin → plugin.
- Preserve `apps/web/src/pluginRegistry.ts` como ponto de composição.
- Preserve `apps/api/src/app.module.ts` como bootstrap/registro, sem regra de negócio.
- Use `@eops/api-client` para chamadas HTTP.
- Use `@eops/shared/<dominio>` para tipos/contratos compartilhados.
- Use `@eops/ui` somente para primitives genuinamente compartilhadas.
- CSS específico de plugin continua no plugin via CSS Modules.
- O shell pode conter apenas layout, navegação, composição e síntese operacional.
- Execute `npm run check:boundaries` ao final.

### 2. Contexto visual

A plataforma deve parecer um **centro operacional eleitoral moderno**, com dark navy, superfícies discretas e acentos de status.

A referência visual aprovada possui:

- sidebar escura à esquerda;
- topo compacto;
- quatro KPIs;
- mapa operacional como maior bloco;
- painel “Atenção agora” à direita;
- uma faixa inferior compacta com timeline/status.

A referência é somente estética/hierárquica. **Não copie números, datas ou textos fictícios da imagem.**

O contexto do produto é **Eleições 2026**, não 2024.

### 3. Sidebar

A sidebar atual já é gerada por `manifest.category`. Evolua-a sem criar um catálogo manual.

Comportamento esperado:

- “Visão geral” continua como entrada principal;
- cada categoria é um cabeçalho clicável;
- clicar abre/fecha os plugins daquela categoria;
- usar accordion com `button` real e `aria-expanded`;
- a categoria que contém a rota ativa deve permanecer aberta automaticamente;
- o item/rota ativa deve ter destaque claro;
- não perder o filtro de permissões existente;
- não duplicar nomes/rotas dos plugins em um array paralelo;
- manter desktop estável e criar comportamento responsivo coerente para telas menores.

Se fizer sentido, permita que mais de uma categoria permaneça aberta; o requisito essencial é que a categoria ativa nunca fique escondida.

### 4. Topbar

Deixe a topbar mais próxima do painel aprovado, mas funcional.

Manter:

- contexto/título da página;
- descrição curta;
- `NotificationBell`;
- usuário/sessão;
- logout.

Pode mostrar status do pleito quando houver dado real.

Não crie uma busca falsa. Se adicionar busca, implemente comportamento útil (por exemplo, busca/navegação entre plugins acessíveis usando manifests). Caso contrário, não a inclua nesta execução.

### 5. Home — estrutura obrigatória

A home deve deixar de funcionar como catálogo de módulos.

#### 5.1 Cabeçalho/contexto

Usar o pleito retornado pela API quando disponível.

Fallback permitido:

`Eleições 2026`

Nunca introduzir `Eleições 2024`.

#### 5.2 KPIs

Exibir no máximo 4 cards principais.

Preferência:

1. ocorrências/incidentes críticos;
2. ocorrências/incidentes ativos;
3. locais monitorados/operacionais;
4. equipes em campo.

Use dados reais já disponíveis em endpoints existentes.

Se um indicador não estiver disponível para o usuário/permissão atual:

- substitua por outro indicador operacional real, ou
- mostre estado indisponível coerente.

**Não invente:**

- percentuais;
- +12%, +6% etc.;
- total de equipes;
- tendências;
- quantidade transmitida.

#### 5.3 Área principal

Desktop:

- coluna esquerda aproximadamente 60–70%: `Mapa Operacional`;
- coluna direita aproximadamente 30–40%: `Atenção agora`.

##### Mapa Operacional

A home não deve importar o componente interno do plugin de mapa.

Crie uma visão resumida shell-owned utilizando somente dados públicos/contratos necessários, ou uma síntese geográfica compatível com os dados já disponíveis.

O mapa completo continua em `/map` e deve haver CTA/link claro para ele.

Não copie regra de negócio interna do plugin de mapa.

##### Atenção agora

Unifique em um único painel poucos itens relevantes de domínios disponíveis, como:

- incidentes críticos;
- incidentes abertos/em tratamento;
- alertas/notificações operacionais.

A composição deve ocorrer por API pública e tipos compartilhados.

Não mostrar dezenas de linhas. Priorize escaneabilidade e link para o módulo responsável.

#### 5.4 Faixa inferior

Use somente 2 ou no máximo 3 painéis compactos.

Preferência:

- `Linha do tempo de eventos`;
- `Status da operação`.

Se os endpoints atuais não suportarem uma timeline real, não invente eventos: use um painel alternativo alimentado por dados existentes ou um empty state honesto.

O status operacional pode combinar métricas já obtidas, sem reimplementar lógica de negócio.

### 6. Remover redundâncias da home

Remover ou substituir:

- “Acesso rápido” que apenas lista plugins;
- contador “X plugins carregados” como elemento principal;
- cards que duplicam a sidebar;
- blocos que repetem os mesmos KPIs;
- decoração/gráficos sem fonte real.

A sidebar já é o mecanismo de acesso aos módulos.

### 7. Estética

Siga `docs/UI-DESIGN-GUIDE.md`.

Em especial:

- fundo `#07111F` ou token equivalente;
- shell/sidebar em navy escuro;
- superfícies `#0D1A2B`/equivalentes;
- bordas discretas;
- texto primário claro e secundário muted;
- azul/ciano para informação/interação;
- verde para normal/sucesso;
- âmbar para atenção;
- vermelho para crítico;
- brilho somente em pontos de estado importantes;
- maior espaço entre grupos;
- menos cards competindo visualmente;
- não colocar mini-gráfico em todo KPI sem necessidade.

Prefira criar variáveis/tokens CSS no shell a repetir cores.

### 8. Não redesenhar todos os plugins agora

Esta execução é para:

- shell;
- sidebar;
- topbar;
- home;
- primitives compartilhadas estritamente necessárias.

Não abra nem refatore todas as páginas internas dos plugins.

As regras de `docs/UI-DESIGN-GUIDE.md` servirão para agentes futuros adaptarem cada plugin gradualmente.

### 9. Dados e permissões

A home deve continuar permission-aware.

Se o usuário não tem acesso a um plugin, não faça chamadas desnecessárias ao endpoint daquele domínio apenas para preencher card.

Reaproveite o padrão atual de verificar plugins acessíveis antes de buscar dados opcionais.

Não exponha informação que a UI atual filtraria por permissão.

### 10. Responsividade e acessibilidade

- 4 KPIs → 2 colunas → 1 coluna conforme largura;
- mapa + atenção empilham em telas menores;
- sidebar precisa continuar navegável;
- foco visível;
- `aria-expanded` nos accordions;
- não usar apenas cor para estado;
- evitar overflow horizontal acidental.

### 11. Validação obrigatória

Ao final, execute:

```bash
npm run check:boundaries
npm run typecheck
npm run lint
npm test
npm run build
```

Se um comando não puder rodar por dependência externa/ambiente, informe exatamente qual e por quê.

### 12. Política obrigatória de commits e SPEC

Siga `docs/COMMIT-GUIDE.md`.

A implementação desta tarefa deve permanecer vinculada a:

`SPEC/2026-10-03-operational-shell-ui.md`

Regras:

- a SPEC deve estar commitada antes do primeiro commit de implementação;
- o commit funcional usa título `tipo(escopo): resumo`;
- para esta tarefa, o escopo principal deve ser `shell`;
- use `Agent:` com a ferramenta/modelo real, ou marque o modelo como indisponível sem inventá-lo;
- use `Spec: SPEC/2026-10-03-operational-shell-ui.md`;
- não misture correções independentes de plugins neste commit;
- se um plugin precisar de alteração funcional própria, pare, associe a uma SPEC apropriada e use commit separado com o slug do plugin como escopo;
- não use mensagens vagas como `update`, `final`, `ajustes` ou `wip`;
- não faça rebase/squash/force-push para fabricar anterioridade da SPEC.

Formato esperado quando houver pedido explícito para commitar:

```text
feat(shell): redesign home and collapsible sidebar

Agent: <ferramenta/modelo-real-ou-indisponivel>
Spec: SPEC/2026-10-03-operational-shell-ui.md
```

Se eu não pedir para criar o commit, NÃO execute `git commit`. Em vez disso, inclua essa mensagem de commit sugerida na resposta final.

### 13. Entrega

Ao concluir, responda com:

1. resumo das mudanças visuais;
2. arquivos alterados;
3. como a sidebar funciona agora;
4. quais endpoints reais alimentam cada bloco da home;
5. confirmação de que não existem imports internos entre plugins/shell;
6. resultado de cada comando de validação;
7. pontos ainda pendentes, se houver;
8. mensagem de commit sugerida no formato de `docs/COMMIT-GUIDE.md`.

Não faça commit automaticamente, a menos que eu peça. Se eu pedir, valide primeiro a ordem SPEC → implementação e use os trailers obrigatórios.
