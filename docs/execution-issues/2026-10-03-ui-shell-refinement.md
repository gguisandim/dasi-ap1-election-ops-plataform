# Execution issues — refinamento do shell operacional

## Contexto

- Data: 2026-10-03
- Prompt/sessão: refinamento visual do shell e protocolo de feedback de execução
- SPEC: `SPEC/2026-10-03-operational-shell-ui.md`
- Agente: `codex/model-unavailable`
- Escopo: shell, home, metadata pública de navegação e documentação de alinhamento

---

## ISSUE-001

### Categoria

DEPENDENCY

### Severidade

non-blocking

### Etapa

implementação / validação de dependências

### Problema observado

O npm reporta três vulnerabilidades de severidade alta em `deepmerge-ts`, trazido pela cadeia `prisma` → `@prisma/config`.

### Evidência

`npm audit --omit=dev` aponta `GHSA-ggr8-5vv4-36mx` e informa que `npm audit fix --force` instalaria `prisma@6.12.0`, uma alteração potencialmente incompatível.

Reprodução em 2026-10-04:

- `npm ls deepmerge-ts --all`: `prisma@6.19.3` → `@prisma/config@6.19.3` → `deepmerge-ts@7.1.5`;
- `npm audit --omit=dev`: três vulnerabilidades altas associadas a `GHSA-ggr8-5vv4-36mx`;
- a correção oferecida continua sendo `npm audit fix --force`, com instalação indicada de `prisma@6.12.0` e aviso de breaking change.

### O que era esperado

A árvore de dependências de produção deveria possuir um caminho de atualização não destrutivo ou uma decisão registrada sobre a versão afetada do Prisma.

### Impacto

Não bloqueia o refinamento do frontend, mas mantém vulnerabilidades altas conhecidas na árvore do monorepo.

### Contorno utilizado

Nenhuma alteração automática foi aplicada. O shell usa versões já existentes de Leaflet e adiciona apenas `lucide-react`; a cadeia vulnerável não pertence a essas dependências.

### Correção estrutural sugerida

Planejar uma atualização compatível de Prisma e validar migrations, geração do client, API, testes e build em tarefa própria. Não executar `npm audit fix --force` sem revisão da mudança de versão.

### Estado

open

### Decisão e reavaliação

O issue permanece `open`: não houve aceitação explícita do risco e a correção sugerida pelo npm é destrutiva/incompatível para esta tarefa. Reavaliar em uma tarefa própria de dependências quando houver versão compatível do Prisma/@prisma/config ou plano de validação de migrations, geração do client, API, testes e build.

---

## ISSUE-002

### Categoria

TOOL_LIMITATION

### Severidade

non-blocking

### Etapa

validação visual

### Problema observado

O frontend e a API locais iniciaram, mas a superfície de browser da ferramenta não estava disponível para abrir o preview e inspecionar a home.

### Evidência

Ao tentar abrir `http://127.0.0.1:5173/`, a ferramenta de computer use retornou `Browser is not available: iab`.

### O que era esperado

Uma superfície de browser habilitada permitiria validar o layout em desktop, notebook e mobile, além do comportamento visual do minimapa.

### Impacto

Typecheck, lint, testes e build validam a implementação, mas a entrega não pode afirmar inspeção visual ou pixel-level nesta execução.

### Contorno utilizado

Foram verificadas regras responsivas em CSS, semântica/ARIA no código e compilação completa. Os servidores temporários foram encerrados após a tentativa.

### Correção estrutural sugerida

Disponibilizar browser controlado ou um harness de screenshots autenticadas para tarefas de frontend.

### Estado

not-actionable

### Decisão e evidência de encerramento

A limitação pertenceu à superfície de browser daquela execução, não ao código do repositório. Não há correção documental ou de produto que torne retroativamente possível a inspeção visual. O erro original (`Browser is not available: iab`) e o contorno por análise de CSS, semântica/ARIA e build permanecem registrados. Uma execução futura com browser disponível pode realizar nova validação visual, sem alterar este diagnóstico histórico.
