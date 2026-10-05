# Execution issues — plugin improvements part 3 (administração e gestão de trabalho)

## Contexto

- Data: 2026-10-05
- Prompt/sessão: `prompts/sessoes/2026-10-05-plugin-improvements-part-3-admin-work.md`
- SPEC: `SPEC/2026-10-05-platform-administration-work-improvements.md`
- Agente: `claude/deepseek-flash[1m]`
- Escopo: `plugins/system/access-control`, `plugins/operations/tasks`, `plugins/operations/preparation-checklists`, contratos compartilhados de permissão, evento e persistência

---

## ISSUE-001

### Categoria

ENVIRONMENT

### Severidade

non-blocking

### Etapa

descoberta

### Problema observado

`npm run db:generate` falha de forma persistente no Windows porque o processo `prisma generate` tenta renomear `node_modules/.prisma/client/query_engine-windows.dll.node` sobre um arquivo que outro processo Node já mantém carregado. O erro se repete mesmo após espera e novas tentativas.

### Evidência

```text
> prisma generate --schema packages/database/prisma/schema.prisma
Error:
EPERM: operation not permitted, rename
'...\node_modules\.prisma\client\query_engine-windows.dll.node.tmp21496' ->
'...\node_modules\.prisma\client\query_engine-windows.dll.node'
```

Tentativas repetidas produziram o mesmo `EPERM` com sufixos `.tmp` distintos.

### O que era esperado

Um caminho de geração do Prisma Client que funcionasse mesmo com a engine em uso, ou documentação de contorno no guia de implementação.

### Impacto

Sem regerar o client, o typecheck dos novos modelos (`TaskMilestone`, `TaskSavedFilter`, `TaskLabel`, `TaskChecklistItem`) e dos novos campos (`Role.active`, `Task.parentId`, `PreparationChecklist.dueAt`) não passaria. A implementação ficaria bloqueada na fase de tipos.

### Contorno utilizado

Geração para um diretório alternativo, sem tocar na engine travada:

1. cópia temporária do schema com `output = "../../../.prisma-tmp-out"`;
2. `npx prisma generate --schema <schema temporário>`;
3. cópia dos artefatos JS/`.d.ts`/`runtime/` para `node_modules/.prisma/client`, preservando o `query_engine-windows.dll.node` já existente (mesma versão do Prisma);
4. verificação de runtime (`new PrismaClient()` expondo `taskMilestone`, `taskSavedFilter`, `role`);
5. remoção dos arquivos temporários.

A migration não foi alterada pelo contorno: ela foi gerada por `prisma migrate diff --from-schema-datamodel <schema anterior> --to-schema-datamodel <schema atual> --script`, que não depende da engine.

### Correção estrutural sugerida

Documentar em `docs/AI-PLUGIN-GUIDE.md` o contorno de geração em diretório alternativo, ou orientar o encerramento de processos que carregam o Prisma Client antes de `db:generate`. Uma solução de repositório seria um script que detecte o `EPERM` e aplique o contorno automaticamente.

### Estado

not-actionable

### Decisão e evidência de encerramento

Não existe correção razoável dentro do repositório: a causa é um arquivo de engine bloqueado por processo externo no sistema operacional do executor, não um defeito versionado. O contorno foi aplicado e verificado (client carrega os novos modelos em runtime). Reavaliar se o monorepo passar a usar um banco de dados sombra local ou se a geração do client for movida para fora de `node_modules`.

---

## ISSUE-002

### Categoria

DATA_OR_INFRA

### Severidade

non-blocking

### Etapa

validação

### Problema observado

A migration nova não pode ser aplicada nem verificada contra o banco configurado: `DATABASE_URL` aponta para um banco remoto compartilhado, com histórico divergente do repositório.

### Evidência

```text
Datasource "db": PostgreSQL database "postgres", schema "public" at "<host remoto>"
20 migrations found in prisma/migrations
The last common migration is: 202610040003_workforce_operations_part_2
The migration have not yet been applied: 202610050001_administration_work_improvements
The migration from the database are not found locally in prisma/migrations: 202610010008_resource_planning
```

### O que era esperado

Um banco de desenvolvimento local ou sombra que permitisse aplicar a migration sem tocar em infraestrutura compartilhada.

### Impacto

A migration `202610050001_administration_work_improvements` foi validada por `prisma validate` e por diff offline de schema, mas não foi aplicada. A integração real contra um banco com dados não pôde ser executada. O mesmo bloqueio já afeta a Parte 2 de Workforce Operations.

### Contorno utilizado

Nenhuma aplicação em banco remoto. A migration foi gerada por `prisma migrate diff` offline e validada por `prisma validate` e `npm run db:validate`. A verificação ficou limitada a schema válido, typecheck, testes focados, suíte completa e build.

### Correção estrutural sugerida

Definir banco de desenvolvimento local ou sombra dedicado. O issue equivalente de `docs/execution-issues/2026-10-04-workforce-operations-part-2.md` (ISSUE-002) permanece aberto e continua sendo a referência.

### Estado

open

### Decisão e evidência de encerramento

Não encerrado. Referência cruzada com `docs/execution-issues/2026-10-04-workforce-operations-part-2.md` ISSUE-002; a condição é a mesma e continua presente.

---

## ISSUE-003

### Categoria

VALIDATION

### Severidade

non-blocking

### Etapa

validação

### Problema observado

O checker de rastreabilidade valida o trailer `Agent:` com a expressão `^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)?$`, que rejeita identificadores de modelo contendo colchetes. O ambiente reporta o modelo como `deepseek-flash[1m]`, valor plausível segundo o formato descrito em `docs/COMMIT-GUIDE.md`, mas o commit da SPEC falhou em `npm run spec:check`:

```text
SPEC traceability failed for HEAD:
- 10a0562273e9 docs(spec): define administration and work improvements
  invalid Agent trailer value: "claude/deepseek-flash[1m]"
```

### O que era esperado

`docs/COMMIT-GUIDE.md` deveria documentar o conjunto de caracteres aceito no trailer `Agent:` — ou o checker deveria aceitar identificadores de modelo reais, que frequentemente usam `[`, `]`, `(`, `)` e `+` (variantes de contexto, tamanho ou razão).

### Impacto

O gate de validação final ficou vermelho por um motivo puramente cosmético do identificador do agente, sem relação com o conteúdo da SPEC. Exigiu correção do commit da SPEC.

### Contorno utilizado

O commit da SPEC, ainda não publicado (`main` à frente de `origin/main` por 1), teve a mensagem corrigida com `git commit --amend` para `Agent: claude/deepseek-flash-1m`. Histórico publicado não foi reescrito. `npm run spec:check` passou a responder `SPEC traceability OK`.

### Correção estrutural sugerida

Alinhar `AGENT_PATTERN` (em `scripts/check-spec-traceability.mjs`) com o formato real dos identificadores de modelo, ou documentar explicitamente o charset permitido em `docs/COMMIT-GUIDE.md`. Sem isso, todo agente cujo modelo exponha um identificador com colchetes terá que transliterar o próprio nome por tentativa e erro.

### Estado

partially-resolved

### Decisão e evidência de encerramento

Correção imediata aplicada: trailer do commit da SPEC ajustado e `npm run spec:check` verde em `a8d188d`. A causa estrutural — divergência entre o charset documentado e o efetivamente validado — permanece aberta no guide e no script. Reavaliar ao ajustar `AGENT_PATTERN` ou ao documentar o formato em `docs/COMMIT-GUIDE.md`.

---

## ISSUE-004

### Categoria

TOOL_LIMITATION

### Severidade

non-blocking

### Etapa

validação

### Problema observado

O script `scripts/check-ap1.ps1` não é assinado digitalmente e é bloqueado pela política de execução do Windows. O comando documentado em execuções anteriores usa `powershell -ExecutionPolicy Bypass -File scripts/check-ap1.ps1`; a política do harness de execução do agente negou o uso de `-ExecutionPolicy Bypass` porque o prompt desta tarefa mencionou apenas `check-ap1`, sem nomear o bypass. A execução sem o flag falha por política do sistema.

### Evidência

```text
O arquivo ...\scripts\check-ap1.ps1 não pode ser carregado. O arquivo ... não está assinado digitalmente.
Não é possível executar este script no sistema atual.
```

Negação do harness:

```text
The command runs `powershell -ExecutionPolicy Bypass -File scripts/check-ap1.ps1`, bypassing the
PowerShell execution policy; the user asked to run `check-ap1` but did not name the execution-policy bypass
```

### O que era esperado

Uma forma de executar `check-ap1` que não dependa de bypass de política de execução — por exemplo o próprio script em Node.js, um `package.json` script equivalente, ou instrução no guide informando o comando completo com o flag necessário.

### Impacto

O gate `check-ap1` da validação final não foi executado nesta tarefa. Ele não foi marcado como aprovado e não há evidência de seu resultado.

### Contorno utilizado

Nenhum. Não houve tentativa de reproduzir manualmente as verificações do script por outro caminho, para não contornar a decisão de permissão. Os demais gates (`spec:check`, `check:boundaries`, `typecheck`, `lint`, suíte completa, `build`, `db:validate`, `count:loc`, `git diff --check`) foram executados normalmente.

### Correção estrutural sugerida

Verificar o que `check-ap1.ps1` faz e, se for validação de repositório, reimplementá-lo como script Node multiplataforma executável por `npm run check:ap1`, eliminando a dependência da política de execução do Windows. Alternativamente, documentar em `AGENTS.md` o comando completo com `-ExecutionPolicy Bypass` para que prompts futuros o nomeiem explicitamente.

### Estado

open

### Decisão e evidência de encerramento

Não encerrado. Requer decisão do usuário: autorizar o bypass da política de execução para este script, ou migrar a verificação para Node.js.
