# Neon PostgreSQL

## Projeto e conexão

Crie um projeto no [Neon](https://neon.tech), mantenha o banco em uma região adequada ao ambiente de demonstração e copie a connection string pooled para o `.env` local:

```env
DATABASE_URL="postgresql://USER:PASSWORD@POOLER_HOST/neondb?sslmode=require"
```

O `.env` é ignorado pelo Git e nunca deve ser versionado. Use `.env.example` apenas com valores fictícios. Rotacione imediatamente qualquer credencial que apareça em logs, commits ou capturas de tela.

## Prisma Client

```bash
npm install
npm run db:generate
npm run db:validate
```

O schema atual usa somente `DATABASE_URL` no datasource. A variável `DIRECT_URL` pode permanecer no ambiente para diagnóstico, mas não deve ser adicionada ao schema sem validar previamente a conectividade direta.

## Migrations

Fluxo preferencial:

```bash
npm run db:migrate:deploy
```

Neste projeto, a conexão pooled aceita consultas do Prisma Client, porém alguns comandos do Prisma Migrate apresentaram `P1001` ou erro genérico do schema engine quando tentaram a conexão direta. A migration inicial foi aplicada manualmente e então registrada:

```bash
npx prisma db execute --file packages/database/prisma/migrations/202609300001_initial_operations/migration.sql --schema packages/database/prisma/schema.prisma
npx prisma migrate resolve --applied 202609300001_initial_operations --schema packages/database/prisma/schema.prisma
```

Esse workaround não substitui migrations versionadas: toda mudança continua exigindo um diretório novo em `prisma/migrations`. Antes de repetir o procedimento, confira se as tabelas ainda não existem e faça backup. Nunca execute novamente SQL não idempotente às cegas.

## Seed

```bash
npm run db:seed
```

O seed é destrutivo para os dados de demonstração das entidades que gerencia. Use somente em banco de desenvolvimento e confirme o alvo antes da execução.

## Diagnóstico

```bash
npm run db:validate
npx prisma migrate status --schema packages/database/prisma/schema.prisma
npx prisma db execute --stdin --schema packages/database/prisma/schema.prisma
```

Para diferenciar problemas:

- Prisma Client funcionando e Migrate falhando: verifique limitações da conexão pooled/direct e o histórico `_prisma_migrations`.
- `P1001`: valide host, porta, branch ativa, allowlist/rede e connection string.
- TLS: mantenha `sslmode=require` conforme a string fornecida pelo Neon.
- Timeout intermitente: confirme se a branch está ativa e repita uma consulta somente leitura antes de qualquer operação DDL.

## Estado observado

Em 2026-09-30, a conexão pooled respondeu a consultas do Prisma Client e retornou 1 pleito, 4 zonas, 32 locais e 208 seções. `_prisma_migrations` registrava `202609300001_initial_operations` como concluída. No mesmo ambiente, `prisma migrate status` retornou erro do schema engine; nenhuma alteração destrutiva foi feita para contornar isso.
