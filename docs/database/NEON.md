# Neon PostgreSQL

## Connection string

Use no `.env` a connection string pooled fornecida pelo Neon:

```env
DATABASE_URL="postgresql://USER:PASSWORD@POOLER_HOST/neondb?sslmode=require"
```

Não versione o `.env`. Se uma URL real aparecer em logs ou commits, rotacione a credencial.

O projeto usa somente `DATABASE_URL` no `schema.prisma`. Uma `DIRECT_URL` pode ser mantida localmente para diagnóstico, mas não é necessária no schema atual.

## Prisma

```bash
npm run db:generate
npm run db:validate
npx prisma migrate status --schema packages/database/prisma/schema.prisma
```

O backend também possui retry limitado para `P1001`, útil em cold start ou indisponibilidade transitória do compute:

```env
DATABASE_CONNECT_RETRIES=8
DATABASE_CONNECT_RETRY_BASE_MS=1000
```

O backoff é limitado a cinco segundos por tentativa e não mascara outros tipos de erro.

## Histórico deste projeto

A migration inicial `202609300001_initial_operations` encontrou `P1001` intermitente na conexão direta. Ela foi aplicada pela conexão pooled com:

```bash
npx prisma db execute \
  --schema packages/database/prisma/schema.prisma \
  --file packages/database/prisma/migrations/202609300001_initial_operations/migration.sql

npx prisma migrate resolve \
  --applied 202609300001_initial_operations \
  --schema packages/database/prisma/schema.prisma
```

Depois disso, o banco foi validado com:

```text
1 pleito
4 zonas
32 locais
208 seções
Database schema is up to date
```

Na execução posterior do Codex, `migrate deploy` conseguiu aplicar as migrations aditivas de Incidentes, Inventário, Auth/RBAC/Auditoria, Notificações e Simulador pela conexão pooled. O seed também foi alterado para preservar a estrutura 4/32/208 existente e reduzir rajadas paralelas que haviam provocado timeout `P2024`.

## Seed

```bash
npm run db:seed
```

O seed atual é voltado a desenvolvimento/demonstração e sincroniza:

- perfis, permissões e usuários demo;
- notificações iniciais;
- pleito/turnos;
- estrutura eleitoral (preservada quando já existe 4/32/208);
- categorias e incidentes;
- tipos e ativos;
- cenário de simulação.

Não execute o seed em um banco produtivo sem revisar o comportamento e o alvo.

## Diagnóstico

Teste a conexão Prisma sem alterar o banco:

```cmd
echo SELECT 1; | npx prisma db execute --schema packages/database/prisma/schema.prisma --stdin
```

Status de migrations:

```bash
npx prisma migrate status --schema packages/database/prisma/schema.prisma
```

Problemas comuns observados no desenvolvimento:

- `P1001`: conexão PostgreSQL não concluída; pode ser transitório mesmo com TCP 5432 acessível;
- `P2024`: timeout ao obter conexão do pool durante seed com muitas operações concorrentes;
- pooled funcionando e direct falhando: mantenha a pooled enquanto o ambiente estiver em desenvolvimento e documente qualquer workaround de migration.

## E2E

`playwright.config.ts` carrega o `.env` da raiz antes de iniciar a API, portanto `DATABASE_URL`, `DEMO_ADMIN_PASSWORD` e demais variáveis ficam disponíveis aos processos de teste. A API também carrega explicitamente o `.env` da raiz quando executada como workspace.
