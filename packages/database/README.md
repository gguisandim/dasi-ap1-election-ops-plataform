# Database

Camada PostgreSQL compartilhada da Election Ops Platform. O schema Prisma modela pleitos, turnos, zonas, locais e seções; a migration inicial fica versionada em `prisma/migrations`.

Na raiz do repositório:

```bash
docker compose up -d
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
```

O PostgreSQL de desenvolvimento usa a porta `5432`, banco `election_ops`, usuário `eops` e uma senha exclusivamente local documentada no compose. Nunca use essas credenciais fora do desenvolvimento.

## Geração do client

`npm install` na raiz executa `postinstall: npm run db:generate`, então o client Prisma é gerado automaticamente a partir de `prisma/schema.prisma`. Isso existe porque o `postinstall` do `@prisma/client` não encontra o schema em um monorepo e grava um stub sem modelos — o que derruba `apps/api` com dezenas de erros de tipo.

Se o ambiente instalar com `--ignore-scripts`, rode `npm run db:generate` explicitamente antes de `typecheck` ou `build`.

## Dimensionamento de conexões

`src/pool.ts` aplica limites à URL do banco antes de construir o client:

```text
connection_limit   5      (DATABASE_CONNECTION_LIMIT)
pool_timeout       20s    (DATABASE_POOL_TIMEOUT_SECONDS)
transaction maxWait 10s   (DATABASE_TRANSACTION_MAX_WAIT_MS)
transaction timeout 15s   (DATABASE_TRANSACTION_TIMEOUT_MS)
```

Motivo: o pool padrão do Prisma é dimensionado por núcleos da máquina e pode exceder o limite de sessões de um pooler (por exemplo, 15 em modo session). Com o pool esgotado, consultas paralelas falham com `EMAXCONNSESSION` e o cliente recebe `500 INTERNAL_ERROR` em endpoints de leitura comuns. Limitado o pool, o Prisma enfileira em vez de estourar; as transações esperam na fila, por isso os tetos de tempo acompanham.

Uma URL que já declare `connection_limit` é respeitada como está.

## Migrations

Toda migration deve ser **aditiva**: sem `DROP` de tabela existente, sem `ALTER` destrutivo, sem alterar migration histórica. `prisma migrate reset` e `prisma db push` não são utilizados.

Para gerar a diferença de schema com segurança:

```bash
git show HEAD:packages/database/prisma/schema.prisma > /tmp/schema-before.prisma
npx prisma migrate diff \
  --from-schema-datamodel /tmp/schema-before.prisma \
  --to-schema-datamodel packages/database/prisma/schema.prisma \
  --script
```

**Não** gere a migration com `--from-schema-datasource` quando `prisma migrate status` indicar migration presente apenas no banco: nesse caso o `diff` inclui o drift e o SQL passa a derrubar tabelas que não pertencem à mudança. Revise o resultado e confirme `grep -c DROP` antes de aplicar.
