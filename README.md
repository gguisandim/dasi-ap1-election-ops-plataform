# DSAI AP1 — Election Ops Platform

Plataforma acadêmica modular para gestão, acompanhamento e simulação de operações eleitorais, inspirada no domínio operacional de sistemas de logística eleitoral. O projeto é organizado como monorepo e cresce por plugins isolados.

## Entrega DSAI — AP1

- **Repositório recomendado:** `dsai-ap1-election-ops-platform` (ver `RENOMEAR-REPOSITORIO.md`).
- **Aplicação pública:** `PENDENTE — inserir URL antes da entrega/apresentação`.
- **Integrantes:** `PENDENTE — preencher nomes completos da dupla`.
- **Specs:** consulte [`SPEC/`](SPEC/README.md). As specs iniciais reconstruídas retroativamente são marcadas como tal; novas specs devem ser commitadas antes do código.
- **Commits:** siga [`docs/COMMIT-GUIDE.md`](docs/COMMIT-GUIDE.md) para formato, escopo e trailers de rastreabilidade.
- **Prompts/sessões:** consulte [`prompts/sessoes/`](prompts/sessoes/README.md).
- **Ferramentas de IA registradas:** ChatGPT (GPT-5.6 Sol, quando explicitamente identificado) e Codex (modelo registrado somente quando a ferramenta/registro o expôs). Não inferimos modelos/tokens ausentes.
- **Histórico:** execute `powershell -ExecutionPolicy Bypass -File scripts/exportar-historico-git.ps1` para gerar um snapshot literal do Git.

### Comando oficial de LOC da atividade

Execute em ambiente com `cloc` instalado:

```bash
cloc . --vcs=git \
  --exclude-dir=node_modules,vendor,dist,build,prompts \
  --exclude-lang=Markdown,JSON,YAML,CSV,Text,SVG \
  --not-match-f='(lock|\.min\.)'
```

> **Saída do `cloc`: PENDENTE.** Cole aqui a saída real imediatamente antes da entrega. Não substitua por `npm run count:loc`, porque a rubrica usa o comando acima.

### Fluxo SDD obrigatório a partir de agora

1. escrever/atualizar `SPEC/<data>-<feature>.md`;
2. commit da spec;
3. prompt para IA planejar tarefas;
4. implementação;
5. commit de implementação no formato `tipo(escopo): resumo`, com trailers `Agent:` e `Spec:`;
6. exportar a sessão literal para `prompts/sessoes/`;
7. não fazer rebase/squash/force-push para fabricar anterioridade.


## Estado atual

A cadeia funcional atual cobre:

```text
Autenticação + RBAC
        ↓
      Pleito
        ↓
       Zona
        ↓
 Local de votação ─── Mapa operacional
   │          │
 Seções     Ativos
              │
          Incidentes
              │
         Event Bus
        ↙         ↘
   Auditoria   Notificações
              ↑
          Simulador
```

## Stack

- React 19 + Vite + React Router;
- NestJS;
- PostgreSQL (local ou Neon) + Prisma ORM 6;
- Leaflet + OpenStreetMap;
- TypeScript;
- Playwright e Vitest;
- npm workspaces.

## Pré-requisitos

- Node.js 22.22.3 ou superior (22.23.3 recomendado no Windows);
- npm;
- PostgreSQL acessível por `DATABASE_URL` ou Docker Compose;
- navegador compatível com Playwright para E2E.

## Configuração

Copie `.env.example` para `.env` e ajuste as variáveis.

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
JWT_SECRET="use-um-segredo-longo"
DEMO_ADMIN_PASSWORD="troque-a-senha-demo"
PORT=3001
VITE_API_URL="http://localhost:3001/api"
DATABASE_CONNECT_RETRIES=8
DATABASE_CONNECT_RETRY_BASE_MS=1000
```

Variáveis opcionais com defaults sensatos, documentadas em [`.env.example`](.env.example):

```text
DATABASE_CONNECTION_LIMIT            limite de conexões do pool do Prisma (default 5)
DATABASE_POOL_TIMEOUT_SECONDS        espera por conexão livre (default 20)
DATABASE_TRANSACTION_MAX_WAIT_MS     espera da transação pela conexão (default 10000)
DATABASE_TRANSACTION_TIMEOUT_MS      duração máxima da transação (default 15000)
EVIDENCE_STORAGE_DRIVER / _ROOT      armazenamento de evidências
PLAYWRIGHT_CHANNEL                   navegador do E2E (msedge local, chromium em CI)
```

O dimensionamento do pool existe porque o pool padrão do Prisma pode exceder o limite de sessões de um pooler e produzir `500` em endpoints de leitura comuns. A justificativa completa está em [`packages/database/README.md`](packages/database/README.md).

O `.env` é ignorado pelo Git. Nunca versione URLs com senha ou `JWT_SECRET` real.

O backend procura `.env` tanto no diretório atual quanto na raiz do monorepo, permitindo `npm run dev`, `npm run e2e` e os scripts dos workspaces sem exportar manualmente todas as variáveis.

## Banco local

```bash
npm install
docker compose up -d
npm run db:generate
npm run db:migrate
npm run db:seed
```

## Neon

Use a connection string **pooled** do Neon como `DATABASE_URL`. O histórico e o workaround da migration inicial estão documentados em [docs/database/NEON.md](docs/database/NEON.md).

```bash
npm run db:generate
npm run db:validate
npm run db:migrate:deploy
npm run db:seed
```

## Executar

```bash
npm run dev
```

- frontend: `http://localhost:5173`
- API: `http://localhost:3001/api`
- health check: `http://localhost:3001/api/health`

No Windows, use `npm.cmd` se a política do PowerShell bloquear `npm.ps1`.

## Usuários demo

O seed sincroniza usuários para os perfis `ADMIN`, `SUPERVISOR`, `OPERATOR`, `TECHNICIAN` e `VIEWER`. A senha utilizada é a variável `DEMO_ADMIN_PASSWORD`.

Exemplo de e-mail administrativo:

```text
admin@eops.local
```

Nunca mantenha a senha de demonstração padrão em um ambiente publicado.

## Plugins atuais

26 plugins, agrupados por categoria do manifest.

### Operações

- Gestão de Pleitos, Zonas Eleitorais, Locais de Votação, Seções Eleitorais;
- Equipes de Campo, Escalas e Turnos, Passagem de Turno, Checklists de Preparação;
- Tarefas, Comunicações, Documentos e Evidências, Conhecimento e Runbooks, Gestão de Riscos;
- [Solicitações de Recurso](docs/modules/resource-requests.md);
- [Postmortem e RCA](docs/modules/postmortems.md).

### Logística

- Inventário e Ativos;
- Rotas e Distribuição.

### Monitoramento

- Mapa Operacional;
- Central de Incidentes;
- [Monitor de Transmissão e NOC](docs/modules/transmission.md);
- [Central de Comando](docs/modules/command-center.md).

### Analytics

- [Relatórios e Analytics Operacional](docs/modules/reports.md).

### Sistema

- Controle de Acesso;
- [Auditoria e Observabilidade](docs/modules/AUDIT.md);
- Notificações.

### Simulação

- [Simulador Operacional](docs/modules/SIMULATOR.md).

## Estrutura

```text
apps/
  web/                     shell, dashboard e composição das rotas
  api/                     bootstrap NestJS e filtros HTTP
packages/
  api-client/              cliente HTTP tipado
  database/                Prisma, migrations, seed e retry de conexão
  event-bus/               barramento + contratos de eventos tipados
  plugin-sdk/              manifests/categorias/rotas
  security/                decorators, tipos e catálogo RBAC neutros
  shared/                  contratos compartilhados separados por domínio
  ui/                      componentes reutilizáveis
plugins/
  operations/
  logistics/
  monitoring/
  analytics/
  system/
  simulation/
tests/e2e/                 fluxos Playwright
docs/                      arquitetura, módulos e request logs
```

Cada plugin funcional mantém sua UI, services, CSS Modules, backend e testes na própria pasta sempre que possível.

## Rotas principais

```text
/login
/elections
/elections/:id
/electoral-zones
/electoral-zones/:id
/polling-places
/polling-places/:id
/polling-sections
/polling-sections/:id
/map
/incidents
/incidents/:id
/inventory
/inventory/:id
/routes
/routes/:id
/transmission
/transmission/:id
/reports
/field-teams
/field-teams/teams/:id
/audit
/notifications
/simulator
/simulator/:id
/users
```

## RBAC

A autenticação é validada no backend por guards globais. Rotas de estrutura eleitoral usam `elections.read` e `elections.manage`; Incidentes, Inventário, Usuários, Auditoria e Simulação possuem permissões específicas.

Detalhes: [docs/architecture/RBAC.md](docs/architecture/RBAC.md).

## Event Bus

Incidentes, ativos, usuários e pleitos publicam eventos tipados consumidos por Auditoria e Notificações.

Detalhes: [docs/architecture/EVENT_BUS.md](docs/architecture/EVENT_BUS.md).

## Qualidade

```bash
npm run spec:check        # valida a SPEC e os trailers de rastreabilidade
npm run check:boundaries  # fronteiras entre workspaces
npm run db:validate       # schema Prisma
npm run typecheck
npm run lint
npm test                  # unitários (Vitest)
npm run build
```

`npm run spec:check` valida `HEAD` por padrão; para uma sequência de commits, use `npm run spec:check -- <base>..HEAD`. `check:boundaries` recusa import físico de `src/` de outro workspace e import relativo que escape do workspace produtor — a convenção está em [docs/PLUGIN_ARCHITECTURE.md](docs/PLUGIN_ARCHITECTURE.md).

`npm install` na raiz já executa `postinstall: npm run db:generate`, porque o `postinstall` do `@prisma/client` não encontra o schema em um monorepo e grava um stub sem modelos — o que derruba `apps/api` com dezenas de erros de tipo. Com `--ignore-scripts`, rode `npm run db:generate` explicitamente. Detalhes em [`packages/database/README.md`](packages/database/README.md).

### Contagem de LOC (uso interno)

`npm run count:loc` é um contador interno e **não** substitui o comando oficial da atividade. O contador interno ignora `node_modules`, locks, builds, cobertura, binários e código gerado.

## E2E

O E2E pressupõe que migrations e seed já tenham sido aplicados ao banco apontado por `DATABASE_URL`. Ele cria os próprios dados via API (sufixo único por execução) e não depende de dados pré-existentes do seed além de usuários e catálogos básicos.

```bash
npm run e2e                       # suíte completa
npx playwright test tests/e2e/flows/coordination.spec.ts --reporter=line
```

O Playwright:

- carrega o `.env` da raiz;
- inicia a API em `127.0.0.1:3001`;
- inicia `vite preview` em `127.0.0.1:4173`;
- reutiliza servidores já ativos localmente (`reuseExistingServer`);
- usa `PLAYWRIGHT_CHANNEL` para escolher o navegador (`msedge` local, `chromium` em CI).

Os helpers ficam em `tests/e2e/helpers/`:

- [`api.ts`](tests/e2e/helpers/api.ts) — sessões por perfil, wrappers HTTP e criação de dados;
- [`ui.ts`](tests/e2e/helpers/ui.ts) — login e navegação.

### Fluxos cross-domain

`tests/e2e/` cobre o encadeamento entre domínios, não apenas telas isoladas:

| Arquivo | Fluxo |
| --- | --- |
| `flows/coordination.spec.ts` | Incidente → solicitação de recurso → aprovação → cumprimento |
| `flows/logistics-custody.spec.ts` | Inventário → rota → entrega → custódia |
| `flows/transmission-analytics.spec.ts` | Transição de transmissão → failover → relatório |
| `flows/postmortem-lifecycle.spec.ts` | Incidente encerrado → postmortem → revisões → aprovação |
| `flows/workforce-continuity.spec.ts` | Turno → passagem → substituição → continuidade |
| `rbac-matrix.spec.ts` | Matriz categoria → permissão por perfil |

**Limitação conhecida:** os fluxos de maior duração (`workforce-continuity`, e em menor grau os demais fluxos cross-domain) foram validados contra banco remoto e medidos acima de 300 s por execução, com timeouts intermitentes. Eles estão registrados como **E2E PARTIAL/PENDENTE** — os cenários e asserções existem e a lógica é executável, mas a estabilidade contra banco remoto com latência alta não foi confirmada ponta a ponta. Em CI, com PostgreSQL como serviço local e `chromium`, a expectativa é de execução dentro do timeout.

O Vite usa a raiz do monorepo como `envDir` e possui proxy `/api` tanto em desenvolvimento quanto em preview.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda em push para `main` e em pull request, com quatro jobs:

| Job | Conteúdo |
| --- | --- |
| `static` | `spec:check`, `check:boundaries`, `db:validate`, `lint` |
| `unit` | `npm test` |
| `build` | `npm run build` |
| `e2e` | PostgreSQL 16, `db:migrate:deploy`, `db:seed`, build, Playwright |

O job `e2e` sobe um serviço PostgreSQL e usa `PLAYWRIGHT_CHANNEL=chromium`.

## Deploy

**Frontend (Vercel):** `apps/web` é publicado como site estático; `vercel.json` mantém o rewrite de `/api` para a API hospedada. Defina `VITE_API_URL` no projeto da Vercel.

**API (Render):** serviço Node a partir da raiz do monorepo, com `npm run build` e start pela API publicada. Variáveis obrigatórias: `DATABASE_URL`, `JWT_SECRET`, `DEMO_ADMIN_PASSWORD`, `PORT`. As variáveis opcionais de pool (`DATABASE_CONNECTION_LIMIT`, `DATABASE_POOL_TIMEOUT_SECONDS`, `DATABASE_TRANSACTION_MAX_WAIT_MS`, `DATABASE_TRANSACTION_TIMEOUT_MS`) devem ser ajustadas ao limite de sessões do pooler em uso — sem isso, a API responde `500` em endpoints de leitura sob concorrência.

O build da Vercel depende de todos os workspaces importados estarem declarados como dependência. Um `@eops/*` importado mas não declarado resolve localmente pelo link do workspace e **falha apenas no build remoto** com `TS2307`.

## Limitações conhecidas

- `workforce-continuity` e os fluxos cross-domain longos: E2E PARTIAL/PENDENTE contra banco remoto (ver acima);
- o seed cobre pleitos, zonas, locais, seções, ativos, incidentes, usuários e permissões, mas não todas as entidades novas (rotas, veículos, tarefas, checklists, transmissão): os fluxos E2E criam o que precisam pela API;
- arquivos de `@eops/shared` são executados em *strip-only* pelo Node: `enum`, `namespace` e property parameters quebram **em execução**, não em `typecheck`. Ver [`packages/shared/README.md`](packages/shared/README.md);
- `npm run count:loc` é interno e não substitui o comando oficial do `cloc`.

## Desenvolver um plugin

1. crie `plugins/<categoria>/<plugin>` como workspace;
2. defina `src/manifest.ts`;
3. exporte suas rotas em `src/index.ts`;
4. mantenha UI em `src/client` e backend em `src/server`;
5. use `@eops/api-client` em vez de `fetch` espalhado;
6. use `@eops/ui` para componentes realmente genéricos;
7. mantenha estilos específicos em CSS Modules;
8. registre o plugin no shell e o módulo no `AppModule`;
9. adicione permissões em `@eops/security` e no seed quando houver dados/mutações protegidas;
10. altere `packages/event-bus/src/contracts.ts` apenas se houver integração cross-domain;
11. adicione testes das regras críticas;
12. rode `npm run check:boundaries` para garantir que nenhum plugin importou implementação de outro.

Para Codex/IA, consulte primeiro [AGENTS.md](AGENTS.md), [plugins/AGENTS.md](plugins/AGENTS.md) e [docs/AI-PLUGIN-GUIDE.md](docs/AI-PLUGIN-GUIDE.md).

Consulte também [docs/PLUGIN_ARCHITECTURE.md](docs/PLUGIN_ARCHITECTURE.md).
