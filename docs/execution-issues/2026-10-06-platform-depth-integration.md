# Execution issues — Platform Depth & Integration Phase

## Contexto

- Data: 2026-10-06
- Prompt/sessão: plataforma `election-ops-platform-base` — fase Platform Depth & Integration
- SPEC: `SPEC/2026-10-06-platform-depth-integration.md`
- Agente: Codex
- Escopo: Simulator 2.0, Reports/Analytics 2.0, Transmission/NOC 2.0, Audit/Observability 2.0, E2E cross-domain, CI.

---

## ISSUE-001

### Categoria

GUIDE_MISSING

### Severidade

blocking (para quem viola a regra); non-blocking para esta execução, que a respeitou

### Etapa

implementação

### Problema observado

Os contratos de `@eops/shared/<dominio>` são carregados **em runtime** pelo Node, sem build intermediário: os `exports` do pacote apontam para `./src/<dominio>.ts`. O Node 22.23 executa TypeScript em modo **strip-only**, que rejeita sintaxe não apagável. Um contrato compartilhado que use `enum`, `namespace`, property parameters ou `import =` faz a API falhar em tempo de carregamento de módulo, não em tempo de compilação.

Nenhum documento do repositório menciona essa restrição. `docs/AI-PLUGIN-GUIDE.md` fala em "contratos em `packages/shared/src/`" sem registrar a limitação, e o `tsconfig` da API não tem configuração que impeça a sintaxe problemática: o `tsc` compila `enum` sem reclamar, então o erro só aparece quando a API é executada.

### Evidência

```text
$ node -v
v22.23.3

$ node -e "require.resolve('@eops/shared/incidents')"
C:\Users\guisa\election-ops-platform-base\packages\shared\src\incidents.ts

$ node -e "const m = require('.../tstest/erasable.ts'); console.log(Object.keys(m))"
OK  [ 'K', 'f' ]

$ node -e "require('.../tstest/with-enum.ts')"
FALHA  ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX | TypeScript enum is not supported in strip-only mode
```

`packages/shared` não possui `dist` nem script de build. O `sync-server-workspace-dist.mjs` sincroniza apenas `packages/database` e `packages/event-bus`, confirmando que `shared` é consumido como fonte.

### O que era esperado

Que a restrição estivesse documentada onde um agente que escreve contratos compartilhados a encontraria — `docs/AI-PLUGIN-GUIDE.md` ou o próprio `packages/shared/README.md` — e, idealmente, que houvesse verificação automatizada.

### Impacto

Um contrato compartilhado com `enum` passa por `typecheck`, `lint`, `npm test` e `build` sem nenhum aviso, e quebra a API apenas em execução. Como todas as fases futuras tendem a adicionar contratos em `@eops/shared`, o risco é recorrente. Nesta execução a restrição foi identificada antes de escrever os contratos e respeitada em `packages/shared/src/{correlation,simulation,reports,transmission}.ts`, com comentário de cabeçalho registrando a regra.

### Contorno utilizado

Uso exclusivo de sintaxe apagável (`const ... as const` + `type` + `function`) nos contratos compartilhados, e comentário permanente no topo de cada arquivo novo. O padrão já era seguido pelos contratos existentes (`inventory.ts`, `workforce.ts`), o que indica que a restrição foi descoberta empiricamente antes, mas nunca documentada.

### Correção estrutural sugerida

1. Registrar a restrição em `docs/AI-PLUGIN-GUIDE.md` e em `packages/shared/README.md`.
2. Acrescentar verificação automatizada — por exemplo uma regra de lint restringindo `enum`/`namespace` em `packages/shared/src/**`, ou um teste que importe cada subpath exportado e falhe com a mensagem correta. O teste é barato e pega regressão no CI.

### Estado

open

### Decisão e evidência de encerramento

Não aplicável. A correção altera guia compartilhado e adiciona verificação global; nenhuma das duas foi executada nesta sessão para não ampliar o escopo além da SPEC. A regra está registrada no código (cabeçalho dos quatro contratos novos), o que reduz o risco imediato sem alterar documentos de governança.

---

## ISSUE-002

### Categoria

REPO_DIVERGENCE

### Severidade

non-blocking

### Etapa

descoberta

### Problema observado

O ambiente de demonstração criado por `npm run db:seed` não cobre vários domínios que a plataforma já implementa. Contagens no seed:

```text
fieldTeam               1
fieldMember             1
fieldShift              1
asset                   12+
incident                4
communication           3
knowledgeArticle        4
risk                    4
distributionRoute       0
vehicle                 0
transmissionPoint       0
task                    0
preparationChecklist    0
```

Ao mesmo tempo, `tests/e2e/api-integration.spec.ts` já dependia de dados semeados (`inventory total >= 12`), e a infraestrutura E2E do `playwright.config.ts` pressupõe banco migrado e semeado.

### Evidência

Contagem por `grep -c "prisma\.<model>\."` em `packages/database/prisma/seed.ts`; ausência de qualquer chamada a `prisma.distributionRoute`, `prisma.vehicle`, `prisma.transmissionPoint`, `prisma.task` e `prisma.preparationChecklist`.

### O que era esperado

Que o seed demonstrativo exercitasse os domínios que a suíte E2E precisa, ou que houvesse fixtures E2E explícitas documentadas.

### Impacto

Fluxos cross-domain que dependem de rota, veículo, ponto de transmissão, tarefa ou checklist não encontram nenhum dado existente. Um teste que assumisse dados fixos do seed falharia num clone limpo, e o caminho de menor esforço — "ajustar o teste até passar" — produziria cobertura fraca.

### Contorno utilizado

Os fluxos E2E desta fase são **auto-suficientes**: cada um cria os pré-requisitos que precisa pela API pública, com sufixo único no nome, e resolve entidades existentes por consulta (nunca por id fixo). O seed não foi alterado para não inflar dados de demonstração apenas para servir aos testes.

### Correção estrutural sugerida

Decidir explicitamente entre duas opções e documentar a escolha em `docs/modules/` ou no README de E2E: (a) ampliar o seed com uma fixture mínima por domínio, marcada como demonstrativa; ou (b) manter o seed enxuto e formalizar que a suíte E2E se auto-provisiona. A opção (b) é a adotada aqui e está descrita no relatório da fase.

### Estado

open

### Decisão e evidência de encerramento

Não aplicável. É uma decisão de produto sobre dados de demonstração, fora do escopo normativo da SPEC desta fase.

---

## ISSUE-003

### Categoria

TOOL_LIMITATION

### Severidade

non-blocking

### Etapa

implementação

### Problema observado

No Windows, `prisma generate` falha com `EPERM` ao renomear o motor de consulta quando algum processo mantém `node_modules/.prisma/client/query_engine-windows.dll.node` aberto:

```text
EPERM: operation not permitted, rename '...\query_engine-windows.dll.node.tmp32836'
  -> '...\query_engine-windows.dll.node'
```

O comando termina com erro, o que sugere que a geração não ocorreu. Na prática os arquivos de tipo **são** gravados: `node_modules/.prisma/client/index.d.ts` passa a conter os novos modelos. Apenas o binário do motor não é substituído — e ele permanece compatível porque a versão do Prisma não mudou.

### Evidência

```text
$ npx prisma generate --schema packages/database/prisma/schema.prisma
Error: EPERM: operation not permitted, rename '...query_engine-windows.dll.node.tmp32836' ...

$ grep -c "SimulationSnapshot" node_modules/.prisma/client/index.d.ts
526
```

### O que era esperado

Ou sucesso, ou falha que não deixe o estado ambíguo.

### Impacto

Um agente pode concluir que precisa reiniciar processos, mexer em `node_modules` ou reaplicar a migration, gastando tempo e arriscando intervenção desnecessária. Também pode concluir erroneamente que os tipos estão velhos e "consertar" algo que não está quebrado.

### Contorno utilizado

Verificação direta dos tipos gerados (`grep` pelos modelos novos em `index.d.ts`) em vez de confiar no código de saída, e prosseguimento sem intervir em processos.

### Correção estrutural sugerida

Documentar no guia de banco/ambiente: se `prisma generate` retornar `EPERM` sobre o motor no Windows, confirmar a geração pelos arquivos `.d.ts` antes de agir; encerrar processos Node que estejam usando o client é a correção real quando o binário também precisa mudar.

### Estado

open

### Decisão e evidência de encerramento

Não aplicável. É limitação de ambiente/tooling, sem correção no repositório além de documentação.

---

## ISSUE-004

### Categoria

REPO_DIVERGENCE

### Severidade

blocking

### Etapa

validação

### Problema observado

O cliente Prisma era construído sem dimensionar o pool de conexões (`new PrismaClient()`), então o pool padrão (`núcleos × 2 + 1`) excedia o limite de sessões do PostgreSQL atrás de pooler. Com o pool esgotado, consultas paralelas falhavam e o erro chegava ao cliente como `500 INTERNAL_ERROR` sem contexto, em endpoints de leitura comuns:

- `GET /resource-requests/references` (9 consultas em `Promise.all`)
- `GET /command-center/summary` (até 10 consultas concorrentes entre as seções)

O sintoma era enganoso: parecia defeito de endpoint, e só aparecia sob carga concorrente real. Foi descoberto durante a execução da suíte E2E, que não conseguia nem sair da fase de resolução de contexto.

### Evidência

```text
FATAL: (EMAXCONNSESSION) max clients reached in session mode
  - max clients are limited to pool_size: 15

Invalid `this.prisma.preparationChecklist.findMany()` invocation
Invalid `this.prisma.resourceRequest.findMany()` invocation
GET /api/command-center/summary → 500
GET /api/resource-requests/references → 500
```

`grep -c EMAXCONNSESSION` no log da API: 6 ocorrências antes da correção, 0 depois.

### O que era esperado

Que o cliente Prisma respeitasse a capacidade do banco configurado, enfileirando consultas em vez de estourar sessões — e que o defeito não ficasse invisível até uma suíte concorrente rodar.

### Impacto

Bloqueava a validação E2E inteira, e em produção produzia 500 intermitentes em endpoints de leitura sempre que a concorrência subia. Como o erro é genérico, o diagnóstico exigia ler o log do servidor.

### Contorno utilizado

Novo `packages/database/src/pool.ts` aplicando `connection_limit` (default 5) e `pool_timeout` (default 20s) à URL do banco, respeitando uma URL que já declare `connection_limit`. `packages/database/src/client.ts` e `PrismaService` passaram a construir o cliente com essas opções. Sobrescrevível por `DATABASE_CONNECTION_LIMIT` e `DATABASE_POOL_TIMEOUT_SECONDS`.

Verificação: `summary` e `references` respondem 200 em execuções repetidas e o log não registra mais `EMAXCONNSESSION`.

### Correção estrutural sugerida

1. Manter o limite explícito no cliente e documentá-lo em `docs/modules/` ou no guia de banco, porque a causa (pool padrão maior que o pooler) não é visível no código.
2. Considerar o pooler em modo transaction para cargas com muitas conexões curtas.
3. O mesmo cuidado vale para qualquer cliente de banco criado fora de `packages/database`.

### Estado

resolved

### Decisão e evidência de encerramento

Corrigido nesta execução. Evidência: `packages/database/src/pool.ts`, uso em `client.ts` e `nest.ts`, e verificação direta — `GET /command-center/summary` e `GET /resource-requests/references` retornam 200 de forma repetida e `grep -c EMAXCONNSESSION` no log da API é 0. Reavaliar se o ambiente migrar para um pooler com limite maior ou modo transaction.

---

## ISSUE-005

### Categoria

TOOL_LIMITATION

### Severidade

non-blocking

### Etapa

validação

### Problema observado

O comando oficial de medição usa `--vcs=git`. Nesse modo o cloc enumera apenas arquivos rastreáveis pelo Git, então **arquivos novos e ainda não commitados não entram na contagem**. Uma execução que cria arquivos e mede antes de commitar subestima o próprio resultado; o número salta quando os arquivos entram no índice.

Medição desta fase, com o mesmo comando e o mesmo conjunto de arquivos:

```text
cloc --vcs=git ...              → 709 arquivos / 77.859 linhas  (só rastreáveis)
cloc (sem --vcs, mesmas exclusões) → 747 arquivos / 82.720 linhas  (árvore de trabalho)
```

A diferença de 4.861 linhas e 38 arquivos é exatamente o trabalho novo não commitado (novas páginas, novos testes, a migration e o workflow de CI).

### Evidência

`cloc . --vcs=git --exclude-dir=node_modules,vendor,dist,build,prompts --exclude-lang=Markdown,JSON,YAML,CSV,Text,SVG --not-match-f='(lock|\.min\.)'` → 709/77.859.
`cloc . --exclude-dir=node_modules,vendor,dist,build,prompts,test-results,.git --exclude-lang=... --not-match-f=...` → 747/82.720.

### O que era esperado

Que a instrução de medição registrasse que o número depende do estado do índice, ou que a medição fosse feita após o commit.

### Impacto

Um agente pode concluir que entregou menos do que entregou — ou, pior, pode ser induzido a commitar só para "melhorar a métrica". Nesta execução, a medição com `--vcs=git` mostrou TypeScript com exatamente 644 arquivos, o mesmo do baseline, apesar de dezenas de arquivos novos: foi o sinal que revelou o comportamento.

### Contorno utilizado

As duas medições foram feitas e reportadas separadamente, sem tocar no índice do Git (nenhum `git add` foi executado), justamente para não sugerir que a métrica foi inflada por staging.

### Correção estrutural sugerida

Registrar na instrução de medição: o `cloc` oficial reflete o que o Git rastreia, portanto deve ser executado **depois** do commit da fase; para medir trabalho ainda não commitado, rodar sem `--vcs` com as mesmas exclusões e declarar a diferença.

### Estado

open

### Decisão e evidência de encerramento

Não aplicável. É ajuste de instrução de medição, fora do escopo de código desta fase.

---

## Reconciliação com issues anteriores

| Issue | Arquivo | Antes | Depois | Ação | Evidência | Bloqueia próxima fase? |
| --- | --- | --- | --- | --- | --- | --- |
| Drift entre banco e histórico local (migration diff destrutivo) | `2026-10-06-operational-coordination-suite.md` (ISSUE-001) | open | condição **deixou de existir** | Nenhuma alteração no arquivo original; registro da mudança de estado aqui. A migration desta fase foi gerada por delta de schema (`--from-schema-datamodel`), nunca contra a datasource. | `npx prisma migrate status` → `25 migrations found` + `Database schema is up to date!`, sem migration órfã | Não |
| Migration órfã `202610010008_resource_planning` | `2026-10-06-operational-coordination-suite.md` (reconciliação) | open | resolvida | Histórico Prisma reconciliado fora desta sessão; nenhuma ação minha | `migrate status` não lista mais migration ausente do repositório | Não |
| Conflito interno da SPEC de coordenação (2.3 vs 2.7) | `2026-10-06-operational-coordination-suite.md` (ISSUE-002) | open | open | Preservado. Não toquei em `resource-requests` nesta fase. | `plugins/operations/resource-requests/src/server/fulfillment-rules.test.ts` | Não |
| `@prisma/client` não gerado em install limpo | `2026-10-06-operational-coordination-suite.md` (ISSUE-001 daquela fase, resolvido por `postinstall`) | resolved | resolved | `postinstall: npm run db:generate` segue ativo e foi exercitado | `npm ci` em clone limpo gerou os tipos e o build passou | Não |

---

## EXECUTION ISSUES PREFLIGHT

```text
| Issue | Estado inicial | Classificação |
| ISSUE-001 restrição de sintaxe apagável em @eops/shared | não registrado | RELATED_NON_BLOCKING |
| ISSUE-002 seed não cobre rotas/veículos/transmissão/tarefas/checklists | não registrado | RELATED_NON_BLOCKING |
| ISSUE-003 prisma generate EPERM no Windows | não registrado | RELATED_NON_BLOCKING |
| ISSUE-004 pool de conexões excede o pooler | não registrado | BLOCKS_CURRENT_TASK |
| ISSUE-005 cloc --vcs=git ignora arquivos não commitados | não registrado | RELATED_NON_BLOCKING |
| Drift banco ↔ histórico (issue da fase anterior) | open | OUT_OF_SCOPE (já reconciliado fora desta sessão) |
```

## EXECUTION ISSUES RECONCILIATION

```text
| Issue | Antes | Depois | Ação | Evidência | Bloqueia próxima fase? |
| ISSUE-001 | não registrado | open | registrado; regra respeitada e anotada nos 4 contratos novos | cabeçalhos de packages/shared/src/{correlation,simulation,reports,transmission}.ts | Não |
| ISSUE-002 | não registrado | open | registrado; E2E auto-provisiona seus dados | tests/e2e/** | Não |
| ISSUE-003 | não registrado | open | registrado; tipos verificados diretamente | node_modules/.prisma/client/index.d.ts | Não |
| ISSUE-004 | não registrado | resolvido | pool limitado em packages/database | pool.ts + verificação 200/0 EMAXCONNSESSION | Não |
| ISSUE-005 | não registrado | open | registrado; duas medições reportadas sem tocar no índice | cloc 709/77.859 vs 747/82.720 | Não |
| Drift/migration órfã | open | resolvido | preservado no arquivo original, estado atualizado aqui | prisma migrate status | Não |
```

Nenhum guide foi alterado nesta sessão.
