# Execution issues — Operational Coordination Suite

## Contexto

- Data: 2026-10-06
- Prompt/sessão: `prompts/sessoes/2026-10-06-operational-coordination-suite.md`
- SPEC: `SPEC/2026-10-06-operational-coordination-suite.md`
- Agente: Codex
- Escopo: três plugins novos (`command-center`, `resource-requests`, `postmortems`), contratos compartilhados, permissões, eventos, notificações, schema e migration.

---

## ISSUE-001

### Categoria

ENVIRONMENT

### Severidade

non-blocking

### Etapa

implementação

### Problema observado

O banco configurado em `DATABASE_URL` contém tabelas (`ResourcePlan`, `ResourceDemand`, `ResourceAlert`, `ResourceReservation`, `ResourceScenario`, `ResourceScenarioAdjustment`) e uma migration (`202610010008_resource_planning`) que não existem no repositório. Gerar a nova migration com `prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ...` produz um SQL que **derruba** essas seis tabelas e dois tipos, porque a diferença entre o banco real e o schema desejado inclui todo o drift.

Aceitar esse SQL significaria destruir dados de um ambiente compartilhado a partir de uma mudança de escopo totalmente diferente.

### Evidência

```text
$ npx prisma migrate diff --from-schema-datasource packages/database/prisma/schema.prisma \
    --to-schema-datamodel packages/database/prisma/schema.prisma --script | grep -c DROP
24   # inclui DROP TABLE "ResourcePlan", DROP TYPE "ResourcePriority", ...

$ npx prisma migrate status --schema packages/database/prisma/schema.prisma
The migration from the database are not found locally in prisma/migrations:
202610010008_resource_planning
```

### O que era esperado

Que a geração da migration fosse segura com o procedimento padrão, ou que um guide registrasse explicitamente o procedimento correto quando existe drift entre banco e histórico local.

### Impacto

O procedimento óbvio (`migrate diff` contra a datasource) gera uma migration destrutiva e silenciosamente correta do ponto de vista do banco. Um agente que aplicasse esse SQL removeria tabelas alheias ao escopo.

### Contorno utilizado

A migration foi gerada exclusivamente a partir do delta de schema, sem consultar o banco:

```bash
git show HEAD:packages/database/prisma/schema.prisma > /tmp/schema-before.prisma
npx prisma migrate diff \
  --from-schema-datamodel /tmp/schema-before.prisma \
  --to-schema-datamodel packages/database/prisma/schema.prisma \
  --script > packages/database/prisma/migrations/202610060001_operational_coordination_suite/migration.sql
```

Resultado verificado: 573 linhas, 15 `CREATE TABLE`, 13 `CREATE TYPE`, 46 `ADD CONSTRAINT`, **zero** `DROP`. A migration foi criada e não aplicada, e `migrate status` a reporta como pendente.

### Correção estrutural sugerida

Documentar em `docs/AI-PLUGIN-GUIDE.md` (ou em guia de banco dedicado) que, quando `prisma migrate status` reportar migration presente apenas no banco, a geração de migration deve partir de `--from-schema-datamodel` com a versão anterior do schema versionada, nunca de `--from-schema-datasource`. Complementar com um script de verificação que falhe se uma migration nova contiver `DROP TABLE` de tabela ausente no schema versionado.

### Estado

open

### Decisão e evidência de encerramento

Não aplicável. A correção estrutural é documental e não foi executada nesta sessão porque alteraria o guia de outro domínio sem decisão explícita. Enquanto o drift existir, qualquer execução que gere migration deve usar o contorno acima.

---

## ISSUE-002

### Categoria

SPEC_CONFLICT

### Severidade

non-blocking

### Etapa

implementação

### Problema observado

A SPEC desta execução descreve de forma incompatível o ponto de entrada do atendimento em Resource Requests.

A tabela normativa de transições (Parte 2.3) admite apenas:

```text
APPROVED → PARTIALLY_FULFILLED | FULFILLED | CANCELLED
PARTIALLY_FULFILLED → FULFILLED | CANCELLED
```

Ou seja, não existe `TRIAGED → FULFILLED`. Porém a Parte 2.7 afirma que `FULFILLED` é permitido a partir de `APPROVED`, `PARTIALLY_FULFILLED` **ou `TRIAGED`** quando o pedido é atendido diretamente.

### Evidência

`SPEC/2026-10-06-operational-coordination-suite.md`, Parte 2.3 (tabela de transições) versus Parte 2.7 (segundo parágrafo).

### O que era esperado

Que a SPEC definisse uma única origem possível para o atendimento.

### Impacto

Um agente poderia liberar fulfillment em `TRIAGED` e produzir um status derivado (`FULFILLED`) que a própria tabela normativa proíbe, gerando um estado alcançável apenas por caminho não tabelado.

### Contorno utilizado

A implementação seguiu a tabela normativa da Parte 2.3, que é explícita e exaustiva: `allowedFulfillmentSourceStatus` aceita somente `APPROVED` e `PARTIALLY_FULFILLED`, e a execução fica registrada em testes (`fulfillment-rules.test.ts`).

### Correção estrutural sugerida

Remover a menção a `TRIAGED` na Parte 2.7 da SPEC, ou acrescentar `TRIAGED → FULFILLED` à tabela da Parte 2.3 se o atendimento direto sem aprovação for realmente desejado. A correção exige um novo commit de SPEC, que não estava autorizado nesta execução.

### Estado

open

### Decisão e evidência de encerramento

Não aplicável. A documentação normativa não foi alterada porque a autorização de commit desta execução cobria exclusivamente o commit inicial da SPEC.

---

## Reconciliação com issues anteriores

| Issue | Arquivo | Antes | Depois | Ação | Evidência | Bloqueia próxima fase? |
| --- | --- | --- | --- | --- | --- | --- |
| Migration órfã `202610010008_resource_planning` só no banco | `2026-10-05-operational-intelligence-improvements.md` (ISSUE-002) | open | open | Nenhuma. O issue não foi reescrito nem duplicado. | `prisma migrate status` continua listando a migration como ausente do repositório. | Não — a migration nova foi gerada por delta de schema e o contorno está registrado em ISSUE-001. |
| Ausência de banco local/sombra que permita aplicar migrations | `2026-10-05-operational-intelligence-improvements.md` (ISSUE-002, recomendação) | open | open | Nenhuma. A migration desta execução também não foi aplicada. | `prisma migrate status` reporta `202610060001_operational_coordination_suite` como pendente e nenhuma verificação de integração real contra banco foi executada. | Não — a SPEC exige explicitamente que a migration não seja aplicada. |

Nenhum guide foi alterado nesta execução.

---

## EXECUTION ISSUES PREFLIGHT

```text
| Issue | Estado inicial | Classificação |
| ISSUE-001 (drift entre banco e histórico local) | pré-existente, não registrado como issue próprio | RELATED_NON_BLOCKING |
| ISSUE-002 (SPEC conflita transição de fulfillment) | não registrado | RELATED_NON_BLOCKING |
| Migration órfã 202610010008_resource_planning | open | RELATED_NON_BLOCKING |
| Ausência de banco local/sombra | open | RELATED_NON_BLOCKING |
```

## EXECUTION ISSUES RECONCILIATION

```text
| Issue | Antes | Depois | Ação | Evidência | Bloqueia próxima fase? |
| ISSUE-001 | não registrado | open | registrado com contorno reproduzível | SPEC/2026-10-06-operational-coordination-suite.md; migration gerada por --from-schema-datamodel, sem DROP | Não |
| ISSUE-002 | não registrado | open | registrado; implementação seguiu a tabela normativa 2.3 | plugins/operations/resource-requests/src/server/fulfillment-rules.test.ts | Não |
| Migration órfã | open | open | preservado | prisma migrate status | Não |
| Banco local/sombra | open | open | preservado | migration não aplicada | Não |
```
