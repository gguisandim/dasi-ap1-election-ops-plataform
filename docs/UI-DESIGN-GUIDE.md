# Guia visual da Election Ops Platform

Este documento define o contrato visual do shell e das interfaces da **Election Ops Platform 2026**.

Ele deve ser lido por agentes que alterem frontend, shell, navegação ou UI de plugins. Agentes que trabalham somente em backend não precisam carregá-lo.

## 1. Objetivo de produto

A interface deve se comportar como um **centro operacional eleitoral**, não como uma vitrine de plugins.

A prioridade é permitir que o usuário responda rapidamente:

1. o que exige atenção agora;
2. onde está acontecendo;
3. qual é o estado geral da operação;
4. qual módulo deve ser aberto para agir.

A home deve sintetizar. Os plugins devem detalhar e permitir ação.

## 2. Identidade visual

Direção visual:

- dark mode como tema principal;
- fundo azul-marinho quase preto;
- superfícies em navy com bordas discretas;
- azul/ciano como cor de interação e informação;
- verde para normal/sucesso;
- âmbar para atenção;
- vermelho para crítico;
- roxo apenas quando houver significado real de governança/sistema, sem decorar a interface;
- brilho/neon somente como acento de estado, nunca em todos os elementos;
- tipografia sans-serif limpa, alta legibilidade e hierarquia clara;
- cards com raio moderado, bordas finas e pouca sombra;
- maior uso de espaço negativo para reduzir competição visual.

Tokens de referência compatíveis com o tema atual:

```text
background            #07111F
shell/sidebar          #091525 / #0A1627
surface                #0D1A2B
surface-elevated       #102239
border                 #1A2A41
text-primary           #E9EEF7
text-secondary         #8194AA
text-muted             #607892
info/interactive       #38BDF8
success                #34D399
warning                #FBBF24
danger                 #FB4D5B
```

Esses valores são referência visual; prefira tokens/variáveis CSS em vez de espalhar hexadecimais por componentes.

## 3. Shell global

O shell é responsabilidade de `apps/web`.

Ele contém:

- marca/produto;
- sidebar;
- topbar;
- composição das rotas dos plugins;
- home consolidada;
- elementos globais de sessão e notificação.

O shell **não deve absorver regras de negócio de plugins**.

### 3.1 Sidebar

A sidebar é gerada a partir dos manifests registrados em `apps/web/src/pluginRegistry.ts`.

Regras:

- não manter uma lista manual duplicada de módulos;
- respeitar `manifest.category`, `manifest.shortName`, `manifest.icon`, `manifest.route` e permissões;
- categorias funcionam como accordion;
- clicar no cabeçalho da categoria abre/fecha seus plugins;
- a categoria do plugin correspondente à rota ativa deve permanecer aberta;
- o item ativo deve ter destaque claro;
- usar `aria-expanded` e botão real para cabeçalhos recolhíveis;
- em desktop, sidebar fixa/estável;
- em telas menores, pode virar drawer/menu recolhível sem perder rotas;
- evitar que todas as categorias abertas ao mesmo tempo criem uma coluna excessivamente longa quando isso prejudicar a navegação.

Categorias são navegação. Não devem ser transformadas em grandes cards dentro da home.

### 3.2 Topbar

Deve ser compacta e funcional.

Pode conter:

- título/descrição do contexto atual;
- status do pleito quando houver informação real;
- notificações;
- usuário/sessão;
- busca global somente se houver comportamento funcional.

Não criar controles visuais que pareçam funcionais mas sejam placeholders sem ação.

## 4. Home / visão geral

A home deve ter menor densidade que os módulos operacionais.

### 4.1 Faixa superior

Exibir **no máximo quatro KPIs principais**.

Preferência para:

- ocorrências/incidentes críticos;
- ocorrências/incidentes ativos;
- locais monitorados/operacionais;
- equipes em campo.

Os nomes devem refletir exatamente os dados disponíveis. Não inventar percentuais, tendências ou totais sem fonte real.

### 4.2 Corpo principal

Layout preferencial em desktop:

```text
┌───────────────────────────────┬──────────────────────┐
│                               │                      │
│       MAPA OPERACIONAL        │    ATENÇÃO AGORA     │
│          ~65%                 │       ~35%           │
│                               │                      │
└───────────────────────────────┴──────────────────────┘
```

#### Mapa Operacional

- é uma visão resumida da situação geográfica;
- deve ocupar a maior área visual da home;
- o módulo completo continua pertencendo ao plugin de mapa em `/map`;
- a home não deve importar arquivos internos do plugin de mapa;
- se a home precisar de dados geográficos, consuma APIs/contratos públicos;
- deve existir caminho claro para abrir o mapa completo.

#### Atenção agora

Consolidar em um único painel o que exige leitura imediata, por exemplo:

- incidentes críticos;
- incidentes em tratamento;
- alertas técnicos;
- notificações operacionais importantes.

Evitar três ou quatro listas paralelas com informação semelhante.

Mostrar poucos itens e fornecer navegação para os módulos responsáveis.

### 4.3 Faixa inferior

Usar apenas 2 ou, no máximo, 3 painéis compactos, por exemplo:

- linha do tempo de eventos;
- status da operação;
- resumo operacional pequeno, somente se trouxer informação nova.

Não repetir os mesmos números dos KPIs em outro card chamado “Destaques do dia”.

Não criar “Acesso rápido aos módulos” se a sidebar já cumpre esse papel.

## 5. Interfaces dos plugins

Plugins continuam donos de suas próprias telas.

Padrão preferido:

```text
Título + contexto + ação principal
↓
Filtros / busca
↓
Conteúdo principal: tabela, lista, mapa ou cards necessários
↓
Paginação / detalhes / ações
```

Regras:

- CSS específico em `*.module.css`;
- usar `@eops/ui` para primitives realmente compartilhadas;
- evitar CSS global para resolver aparência de um plugin;
- não importar implementação de outro plugin;
- usar breadcrumb quando houver hierarquia de detalhe;
- loading, erro e empty state explícitos;
- tabelas e listas devem priorizar escaneabilidade sobre decoração;
- cards grandes só quando a informação realmente exigir destaque;
- ações destrutivas nunca devem competir visualmente com ações primárias.

## 6. Densidade e hierarquia

A interface pode conter muita informação, mas nem toda informação deve ter o mesmo peso.

Regras de composição:

- um foco principal por região da tela;
- no máximo um grande painel dominante por eixo visual;
- reduzir bordas, badges e gráficos decorativos sem função;
- não colocar gráfico pequeno em todo KPI apenas para preencher espaço;
- usar cor forte principalmente para estado/ação;
- informações secundárias usam texto muted;
- separar blocos com espaço antes de adicionar mais caixas.

## 7. Ano e contexto eleitoral

A referência atual da plataforma é **Eleições 2026**.

- não introduzir “Eleições 2024” em novos componentes;
- quando possível, obter nome, ano e turno a partir do pleito persistido;
- fallback textual pode usar “Eleições 2026” quando ainda não houver dado carregado;
- datas e números mostrados na UI devem vir do domínio ou de dados de demonstração existentes, nunca da imagem de referência.

A imagem de referência é somente direção estética e de hierarquia.

## 8. Responsividade e acessibilidade

- desktop é o cenário principal de operação, mas a interface não pode quebrar abaixo de 900 px;
- KPIs devem passar de 4 colunas para 2 e depois 1 quando necessário;
- mapa e painel de atenção empilham em telas menores;
- sidebar pode virar drawer em mobile;
- foco visível para teclado;
- contraste suficiente;
- elementos clicáveis com semântica correta;
- accordions com `aria-expanded`;
- não depender apenas de cor para diferenciar estados.

## 9. O que evitar

Não fazer:

- home como catálogo de todos os plugins;
- duplicar sidebar em cards de acesso rápido;
- importar `plugins/<...>/src/...` a partir do shell;
- mover services ou regras de plugins para `apps/web`;
- hardcode de 2024;
- percentuais fake para aproximar a mockup;
- grids com dezenas de cards de mesmo peso;
- CSS de plugin no `global.css`;
- controles falsos sem comportamento;
- reescrever a aplicação inteira só para mudar estética.

## 10. Critério de decisão

Quando houver dúvida entre duas soluções visuais, prefira a que:

1. expõe menos informação redundante;
2. mantém a ação operacional evidente;
3. preserva a fronteira dos plugins;
4. exige menos contexto cruzado para manutenção futura;
5. reaproveita contratos e primitives compartilhadas em vez de acoplamento direto.
