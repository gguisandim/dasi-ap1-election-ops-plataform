# Execution issues — operational intelligence improvements

## Contexto

- Data: 2026-10-05
- Prompt/sessão: `prompts/sessoes/2026-10-05-operational-intelligence-improvements.md`
- SPEC: `SPEC/2026-10-05-operational-intelligence-improvements.md`
- Agente: `claude/deepseek-flash-1m`
- Escopo: `plugins/monitoring/transmission`, `plugins/monitoring/operational-map`, `plugins/simulation/operational-simulator`, `plugins/analytics/reports`, contratos compartilhados de schema e evento

---

## ISSUE-001

### Categoria

ENVIRONMENT

### Severidade

non-blocking

### Etapa

descoberta

### Problema observado

O bloqueio de `npm run db:generate` já registrado em `docs/execution-issues/2026-10-05-plugin-improvements-part-3.md` (ISSUE-001) voltou a ocorrer de forma idêntica nesta execução. `prisma generate` falha ao renomear a engine sobre um arquivo mantido carregado por outro processo Node.

### Evidência

```text
Error:
EPERM: operation not permitted, rename
'...\node_modules\.prisma\client\query_engine-windows.dll.node.tmp21496' ->
'...\node_modules\.prisma\client\query_engine-windows.dll.node'
```

### O que era esperado

Um caminho de geração que funcione com a engine em uso, ou o contorno documentado no guia de implementação.

### Impacto

Sem regerar o client, nenhum código que use `SimulationScenarioEvent` ou os novos campos de `TransmissionAlert` compilaria. A execução ficaria bloqueada na fase de tipos.

### Contorno utilizado

Mesmo contorno da execução anterior: cópia do schema com `output` apontando para um diretório temporário, `prisma generate` nesse schema, cópia dos artefatos JS/`.d.ts`/`runtime/` para `node_modules/.prisma/client` preservando a engine já existente, verificação de runtime (`prisma.simulationScenarioEvent` disponível) e remoção dos arquivos temporários. A migration foi gerada por `prisma migrate diff` offline, que não depende da engine.

### Correção estrutural sugerida

Documentar o contorno em `docs/AI-PLUGIN-GUIDE.md` ou criar um script que detecte o `EPERM` e aplique o contorno automaticamente. A recorrência em duas execuções consecutivas mostra que o problema não é incidental.

### Estado

not-actionable

### Decisão e evidência de encerramento

A causa é um arquivo de engine bloqueado por processo externo ao repositório; não há correção versionada razoável. Contorno aplicado e verificado. Reavaliar se o monorepo adotar banco sombra local ou mover a geração do client para fora de `node_modules`. Referência cruzada: `2026-10-05-plugin-improvements-part-3.md` ISSUE-001.

---

## ISSUE-002

### Categoria

DATA_OR_INFRA

### Severidade

non-blocking

### Etapa

validação

### Problema observado

O banco configurado em `DATABASE_URL` é remoto e está atrás do histórico local de migrations. Com esta execução, a distância passou a ser de **duas** migrations, e o banco ainda contém uma migration que não existe no repositório.

### Evidência

```text
Datasource "db": PostgreSQL database "postgres", schema "public" at "<host remoto>"
The last common migration is: 202610040003_workforce_operations_part_2

The migrations have not yet been applied:
202610050001_administration_work_improvements
202610050002_operational_intelligence_improvements

The migration from the database are not found locally in prisma/migrations:
202610010008_resource_planning
```

### O que era esperado

Um banco de desenvolvimento local ou sombra que permitisse aplicar e verificar migrations sem tocar em infraestrutura compartilhada.

### Impacto

A migration `202610050002_operational_intelligence_improvements` foi validada por `prisma validate` e por diff offline de schema, mas não foi aplicada. Nenhuma verificação de integração real contra banco com dados foi executada.

### Contorno utilizado

Nenhuma aplicação em banco remoto. Migration gerada por `prisma migrate diff --from-schema-datamodel <schema HEAD> --to-schema-datamodel <schema atual> --script`, validada por `npm run db:validate`.

### Correção estrutural sugerida

Definir banco de desenvolvimento local ou sombra dedicado. A dívida acumulou: três migrations (`202610040002`, `202610050001`, `202610050002`) estão pendentes e uma migration órfã existe só no banco. Recomenda-se resolver antes da próxima execução que dependa de dados reais.

### Estado

open

### Decisão e evidência de encerramento

Não encerrado. Referência cruzada: `2026-10-04-workforce-operations-part-2.md` ISSUE-002 e `2026-10-05-plugin-improvements-part-3.md` ISSUE-002.

---

## ISSUE-003

### Categoria

VALIDATION

### Severidade

blocking

### Etapa

build

### Problema observado

`npm run build` não era reproduzível a partir de um estado limpo. O passo `build:server-exports` (`scripts/sync-server-workspace-dist.mjs`) exige que `apps/api/dist/plugins/<categoria>/<plugin>/src/server` exista para cada plugin com `exports["./server"]` e também `apps/api/dist/packages/{database,event-bus}/src`. Porém `nest build` emitia **apenas** os cinco arquivos de `apps/api/src/**`.

O pipeline só funcionava enquanto `apps/api/dist/plugins/**` e `apps/api/dist/packages/**` ainda existissem como artefatos antigos (mtime 2026-10-04). Ao remover `apps/api/dist` para investigar uma falha nova, o build quebrou imediatamente.

### Evidência

```text
Server workspace export sync failed: ENOENT: no such file or directory, access
'C:\Users\guisa\election-ops-platform-base\apps\api\dist\plugins\monitoring\operational-map\src\server'
```

```text
$ npx tsc -p tsconfig.json --listEmittedFiles | grep -c '\.js$'
5                     # apenas apps/api/src/**: main, app.module, health.controller, load-env, api-exception.filter
```

Os arquivos dos plugins estavam no programa (apareciam em `--listEmittedFiles --listFiles`), mas não eram emitidos. Reprodução mínima confirmou que o TypeScript emite imports fora do projeto quando alcançados por caminho relativo, mas não quando alcançados por resolução de pacote em `node_modules` — que é exatamente o caso de `@eops/plugin-<slug>/server`.

Consequência mais grave que o build: **alterações de servidor de plugin nunca chegavam ao artefato de runtime**. O sync copiava arquivos datados de 2026-10-04 para `plugins/*/dist/server`, ou seja, o servidor da API executava código de plugin desatualizado.

### O que era esperado

Um `nest build` reproduzível a partir de um clone limpo, emitindo o servidor dos plugins e os pacotes compartilhados que o sync consome.

### Impacto

Bloqueava o gate `npm run build`. Além disso, mascarava divergência entre o código-fonte do plugin e o artefato executado pela API.

### Contorno utilizado

Criado `apps/api/tsconfig.build.json` — que é o caminho de configuração padrão do Nest CLI para build — estendendo `tsconfig.json` com um `include` explícito:

```json
"include": [
  "src/**/*.ts",
  "../../plugins/*/*/src/server/**/*.ts",
  "../../packages/database/src/**/*.ts",
  "../../packages/event-bus/src/**/*.ts"
],
"exclude": ["dist", "node_modules", "../../**/*.test.ts"]
```

O `exclude` de testes foi necessário porque `*.test.ts` de plugins usam mocks que não satisfazem o `strict` do projeto da API.

Resultado verificado:

```text
$ npx nest build && ls dist/plugins
analytics logistics monitoring operations simulation system

$ node scripts/sync-server-workspace-dist.mjs
Server workspace exports synchronized: 24 target(s).
```

`npm run build` completo passou. `npm run typecheck` permaneceu inalterado porque usa `tsconfig.json`, não o `tsconfig.build.json`.

### Correção estrutural sugerida

Manter o `tsconfig.build.json` — sem ele o build não é reproduzível. Vale avaliar se o `include` deve cobrir futuros pacotes compartilhados consumidos por plugins no servidor, ou se o sync deve derivar os alvos de alguma fonte única para não repetir a lista.

### Estado

resolved

### Decisão e evidência de encerramento

Causa estrutural corrigida e verificada: `nest build` passa a emitir as 22 árvores de servidor de plugin e os pacotes `database`/`event-bus`; `build:server-exports` sincroniza 24 alvos; `npm run build`, `npm run typecheck`, `npm run build -w @eops/web` e a suíte completa passam. Reavaliar se novos pacotes compartilhados passarem a ser consumidos por servidores de plugin, pois exigirão entrada no `include`.
