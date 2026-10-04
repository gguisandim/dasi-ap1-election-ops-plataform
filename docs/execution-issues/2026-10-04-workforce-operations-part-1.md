# Execution issues — Workforce Operations Parte 1

## Contexto

- Data: 2026-10-04
- Prompt/sessão: `prompts/sessoes/2026-10-04-workforce-operations-part-1.md`
- SPEC: `SPEC/2026-10-04-workforce-operations-part-1.md`
- Agente: `codex/gpt-5`
- Escopo: Field Teams, Shifts e validação de rastreabilidade

---

## ISSUE-001

### Categoria

GUIDE_CONFLICT

### Severidade

blocking

### Etapa

validação

### Problema observado

O guia autoriza o trailer `Spec:` no commit que introduz a própria SPEC, mas `npm run spec:check` rejeitava sempre uma SPEC ausente no primeiro pai, inclusive para commits `docs(spec)`.

### Evidência

O commit `40a5740 docs(spec): define workforce operations part 1` contém somente a nova SPEC e os trailers normativos. O checker retornou:

```text
referenced SPEC did not exist in the first parent: SPEC/2026-10-04-workforce-operations-part-1.md
```

`docs/COMMIT-GUIDE.md` afirma que o trailer do commit da própria SPEC pode apontar para o arquivo introduzido.

### O que era esperado

Commits `docs(spec)` devem poder referenciar a SPEC que introduzem, enquanto commits de implementação continuam exigindo que a SPEC exista no primeiro pai.

### Impacto

O gate `spec:check` falhava para um commit criado conforme o guia e impedia a conclusão da validação sem reescrever histórico já autorizado.

### Contorno utilizado

Nenhum histórico foi reescrito. O checker foi alinhado ao contrato documental.

### Correção estrutural sugerida

Permitir a exceção somente para commit `docs(spec)` que contenha o caminho referenciado no próprio commit e manter a regra do primeiro pai para `feat`, `fix`, `refactor` e `perf`.

### Estado

resolved

### Decisão e evidência de encerramento

`scripts/check-spec-traceability.mjs` reconhece o caso de introdução pela própria SPEC e `scripts/check-spec-traceability.test.mjs` cobre explicitamente o cenário. A proteção contra SPEC criada junto do commit de implementação permanece testada.

---

## ISSUE-002

### Categoria

TOOL_LIMITATION

### Severidade

non-blocking

### Etapa

validação

### Problema observado

A validação visual solicitada em 1440 px, 1024 px e até 760 px não pôde ser executada porque nenhuma superfície de browser estava disponível para automação.

### Evidência

As tentativas de abrir o app local retornaram `No browser is available` e `Browser is not available: iab`. O servidor Vite iniciou normalmente e foi encerrado após a falha da superfície visual.

### O que era esperado

Uma superfície Chrome, Edge ou in-app browser disponível para inspecionar as rotas novas nos três viewports.

### Impacto

Build, typecheck e CSS responsivo foram validados, mas a inspeção visual runtime permanece pendente.

### Contorno utilizado

Foram mantidos overflow horizontal controlado para calendário/matriz e breakpoints existentes; o build de produção foi executado com sucesso.

### Correção estrutural sugerida

Disponibilizar uma superfície de browser na sessão ou executar a inspeção manual antes de liberar a Parte 2.

### Estado

not-actionable

### Decisão e evidência de encerramento

A limitação é externa ao repositório e não há alternativa de UI autorizada nesta sessão. Reavaliar quando um browser estiver conectado.
