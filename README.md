# Election Ops Platform

Plataforma acadêmica modular para gestão, acompanhamento e simulação de operações eleitorais, inspirada no domínio operacional de sistemas de logística eleitoral. O projeto é organizado como monorepo e cresce por plugins isolados.

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

### Operações

- Gestão de Pleitos;
- Zonas Eleitorais;
- Locais de Votação;
- Seções Eleitorais.

### Logística

- Inventário e Ativos;
- Rotas (placeholder para etapa futura).

### Monitoramento

- Mapa Operacional;
- Central de Incidentes;
- Transmissão (placeholder para etapa futura).

### Analytics

- Relatórios e BI (placeholder para etapa futura).

### Sistema

- Controle de Acesso;
- Auditoria;
- Notificações.

### Simulação

- Simulador Operacional.

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
npm run db:validate
npm run typecheck
npm run lint
npm test
npm run build
npm run count:loc
```

O contador ignora `node_modules`, locks, builds, cobertura, binários e código gerado.

## E2E

O E2E pressupõe que migrations e seed já tenham sido aplicados ao banco apontado por `DATABASE_URL`.

```bash
npm run e2e
```

O Playwright:

- carrega o `.env` da raiz;
- inicia a API em `127.0.0.1:3001`;
- inicia `vite preview` em `127.0.0.1:4173`;
- valida login;
- percorre Pleito → Zona → Local → Seções → Mapa;
- abre Incidentes, Inventário e Simulador;
- testa RBAC de mutação com usuário `VIEWER`.

O Vite usa a raiz do monorepo como `envDir` e possui proxy `/api` tanto em desenvolvimento quanto em preview.

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
