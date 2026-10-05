# Execution issues — Workforce Operations Parte 2

## Contexto

- Data: 2026-10-04
- Prompt/sessão: `prompts/sessoes/2026-10-04-workforce-operations-part-2.md`
- SPEC: `SPEC/2026-10-04-workforce-operations-part-2.md`
- Agente: `claude-code/deepseek-flash-1m`
- Escopo: Field Teams (Dispatch), Tasks (execução em campo), shared workforce, Event Bus, schema/migration

---

## ISSUE-001

### Categoria

ENVIRONMENT

### Severidade

non-blocking

### Etapa

descoberta

### Problema observado

`plugins/operations/field-teams/src/client/pages/MemberDetailPage.tsx` estava corrompido por dupla codificação (`Ã£`, `â€¦`, `â†’`, `Ã³` no lugar de `ã`, `…`, `→`, `ó`). O arquivo é a tela de detalhe de membro, que precisou ser alterada nesta parte.

### Evidência

Antes da correção, 13 sequências de mojibake foram medidas no arquivo:

```text
"Carregando membroâ€¦"      (esperado: "Carregando membro…")
"PrÃ³ximos turnos"          (esperado: "Próximos turnos")
"Indisponibilidades" / "ObservaÃ§Ã£o" / "Especialidades e contato"
```

Nenhum outro arquivo do plugin apresentava o mesmo problema.

### O que era esperado

Arquivos TypeScript do repositório em UTF-8 válido, para que a interface não exiba texto corrompido e para que agentes seguintes não repliquem a codificação defeituosa.

### Impacto

Texto visível ao operador apareceria corrompido e uma edição incremental poderia propagar a corrupção para trechos novos.

### Contorno utilizado

O arquivo foi recodificado no local com um mapeamento CP1252 → UTF-8 aplicado somente a sequências não ASCII verificadas uma a uma. Depois da correção, a contagem de mojibake voltou a zero e `typecheck`, `lint`, `npm test` e `build` passaram.

### Correção estrutural sugerida

Verificar a ferramenta que originalmente escreveu o arquivo. Não há ação pendente no repositório: o artefato está corrigido.

### Estado

resolved

### Decisão e evidência de encerramento

A condição registrada deixou de existir de forma verificável: a contagem de sequências de mojibake no arquivo é zero e o texto restaurado aparece correto no diff. A causa de escrita original não pôde ser determinada a partir do repositório.

---

## ISSUE-002

### Categoria

DATA_OR_INFRA

### Severidade

non-blocking

### Etapa

descoberta

### Problema observado

`prisma migrate status` aponta divergência entre o histórico local de migrations e o banco configurado em `DATABASE_URL`, que é remoto.

### Evidência

```text
Datasource "db": PostgreSQL database "postgres", schema "public" at "<host remoto>"
The last common migration is: 202610040001_incident_response_observability
The migration have not yet been applied: 202610040002_workforce_operations_part_1
The migration from the database are not found locally in prisma/migrations: 202610010008_resource_planning
```

### O que era esperado

Um banco de desenvolvimento local (ou um banco remoto alinhado) que permitisse aplicar e verificar a nova migration.

### Impacto

A migration `202610040003_workforce_operations_part_2` foi criada por `prisma migrate diff` entre o schema versionado e o schema alterado, validada por `prisma validate` e pelo build, mas **não** foi aplicada a nenhum banco. Integração real do dispatch contra um banco com dados não pôde ser executada.

### Contorno utilizado

A migration foi gerada offline por diff de schema, sem aplicar em banco remoto, conforme a restrição da SPEC. A validação ficou limitada a schema válido, typecheck, testes focados de regra, suíte completa e build.

### Correção estrutural sugerida

Definir um banco de desenvolvimento local ou um banco sombra dedicado para o workflow de migrations, de modo que `prisma migrate dev` possa ser usado sem tocar em dados remotos.

### Estado

open

---

## ISSUE-003

### Categoria

TOOL_LIMITATION

### Severidade

non-blocking

### Etapa

validação

### Problema observado

Repetição do ISSUE-002 da Parte 1: não há superfície de browser disponível para inspeção visual runtime das rotas novas em 1440 px, 1024 px e até 760 px.

### Evidência

A Parte 1 registrou a mesma limitação como `not-actionable` em `docs/execution-issues/2026-10-04-workforce-operations-part-1.md`. Nesta execução nenhuma superfície de browser foi oferecida à sessão.

### O que era esperado

Superfície de browser para validar fila, board, detalhe de dispatch e o painel de execução em campo nos três viewports.

### Impacto

A validação visual das telas novas permanece pendente; o CSS responsivo foi aplicado por breakpoints existentes e o build de produção foi executado com sucesso.

### Contorno utilizado

Reuso dos padrões visuais e breakpoints do próprio plugin; nenhuma validação runtime de layout foi declarada como realizada.

### Correção estrutural sugerida

Disponibilizar uma superfície de browser na sessão de execução.

### Estado

not-actionable

### Decisão e evidência de encerramento

A limitação é externa ao repositório e já registrada na Parte 1. Permanece a condição de reavaliação: executar a inspeção manual quando um browser estiver conectado. Não bloqueia a próxima fase, conforme o próprio prompt da Parte 2.
