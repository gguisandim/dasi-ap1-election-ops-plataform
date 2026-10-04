# Execution issues — workspace architecture boundaries

## Contexto

- Data: 2026-10-04
- Prompt/sessão: saneamento de arquitetura e boundaries de workspaces
- SPEC: `SPEC/2026-10-04-workspace-architecture-boundaries.md`
- Agente: `codex/model-unavailable`
- Escopo: APIs públicas, entrypoints server, enforcement e validação

---

## ISSUE-001

### Categoria

REPO_DIVERGENCE

### Severidade

high

### Etapa

auditoria arquitetural

### Problema observado

Apps e plugins importavam diretamente arquivos em `packages/*/src` e `plugins/*/src`, tornando a composição dependente da estrutura interna de outros workspaces. O checker existente cobria essencialmente dependências plugin para plugin e não detectava toda a classe de violações.

### Evidência

- `apps/api/src/app.module.ts` carregava packages e 21 módulos de plugins por caminhos físicos internos;
- 57 arquivos de implementação ou teste em plugins atravessavam o workspace para acessar database, Event Bus ou security;
- os packages de plugins não declaravam o subpath server público;
- a suíte adicionada reproduz violações de plugin, app e package sem mantê-las no repositório real.

### Impacto

Refactors internos podiam quebrar consumidores silenciosamente, o contrato público era ambíguo e agentes não dispunham de enforcement objetivo para preservar a arquitetura.

### Correção estrutural

- dependências migradas para packages `@eops/*`;
- entrypoint uniforme `@eops/plugin-<slug>/server` criado para plugins server-side;
- composição estática da API migrada para esses entrypoints;
- checker expandido para todos os tipos de workspace, exports públicos e caminhos relativos;
- testes automatizados adicionados para imports permitidos e rejeitados;
- contrato operacional documentado em `docs/PLUGIN_ARCHITECTURE.md`.

### Estado

resolved

### Evidência de resolução

`npm run check:boundaries` inspeciona 31 workspaces e não encontra violações; `node --test scripts/check-plugin-boundaries.test.mjs` cobre dez cenários objetivos; build e smoke test da API resolvem os entrypoints públicos em runtime.

---

## ISSUE-002

### Categoria

SPEC_TRACEABILITY

### Severidade

non-blocking

### Etapa

preflight

### Problema observado

`npm run spec:check -- HEAD` falha no commit preexistente `10fe72b` porque ele não contém o trailer `Agent:` exigido pelo próprio enforcement que introduziu.

### Evidência

O checker reporta `expected exactly one Agent trailer, found 0` para `10fe72b feat(tooling): enforce spec traceability`.

### Impacto

O preflight obrigatório não pode ser declarado aprovado, embora a SPEC arquitetural desta execução tenha sido criada e commitada antes do código.

### Contorno utilizado

A falha foi preservada e não bloqueou alterações não commitadas. Nenhum amend, rebase ou outro tipo de reescrita de histórico foi executado.

### Estado

not-actionable

### Decisão e reavaliação

Corrigir o trailer do commit existente exigiria reescrever histórico publicado, ação fora do escopo e explicitamente não autorizada. O checker deve continuar reportando a divergência; reavaliar somente se houver política e autorização específicas para migração do histórico.

### Reconciliação em 2026-10-04

`git show -s --format=%B 10fe72b` mostra as linhas `Agent: codex/model-unavailable` e `Spec: SPEC/2026-10-04-spec-traceability-enforcement.md`, mas elas estão separadas por uma linha em branco. Pelas regras do Git, somente o bloco terminal é interpretado como trailers; `git interpret-trailers --parse` retorna apenas `Spec:`. Por isso, `npm run spec:check -- 10fe72b` continua falhando com `expected exactly one Agent trailer, found 0`.

A SPEC do checker exige extração do bloco final segundo as regras do Git, portanto não há defeito no checker a corrigir. O estado permanece `not-actionable`: a condição é histórica, sua correção exigiria reescrita não autorizada e ela não bloqueia novos commits ou o desenvolvimento dos plugins.
