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
