# Execution issues — governança de agentes e enforcement de SPEC

## Contexto

- Data: 2026-10-04
- Prompt/sessão: governança de agentes, SPEC Gate e auditoria de rastreabilidade
- SPEC: `SPEC/2026-10-04-agent-governance-and-spec-enforcement.md`
- Agente: `codex/model-unavailable`
- Escopo: documentação normativa, protocolos de execução e auditoria histórica

---

## ISSUE-001

### Categoria

SPEC_MISSING

### Severidade

non-blocking

### Etapa

auditoria de rastreabilidade

### Problema observado

O módulo Passagem de Turno foi solicitado com base em `docs/modules/shift-handover.md`, mas não possui uma SPEC normativa própria em `SPEC/`. A sessão histórica relata alterações durante a tentativa, porém o tree e o histórico atuais não contêm implementação do plugin.

### Evidência

- `git show d3a6b5c` registra o commit `spec: define passagem de turno`, porém o único arquivo criado foi `docs/modules/shift-handover.md`;
- `rg` em `SPEC/` encontra apenas menções relacionais em `SPEC/2026-10-03-shifts-schedules.md`, que exclui a implementação completa de Passagem de Turno;
- `prompts/sessoes/2026-10-01-githubcopilot-escalas-e-turnos.md:880` solicita a implementação integral usando o documento de módulo como especificação;
- a mesma sessão registra alterações durante a tentativa, sem apontar uma SPEC em `SPEC/`;
- buscas por `handover`, `shift-handovers`, `shiftHandovers` e `shift_handover` em `apps/`, `packages/` e `plugins/`, além do histórico do caminho esperado do plugin, não retornam implementação no repositório atual.

### O que era esperado

Uma mudança funcional desse porte deveria possuir SPEC normativa própria e rastreabilidade cronológica antes da implementação.

### Impacto

O histórico preserva a origem do pedido, mas o nome do commit e o prompt podem levar uma execução futura a interpretar o documento de módulo como SPEC aprovada. Como não há implementação atual, não existe base para marcar a funcionalidade como implementada nem para reconstruir automaticamente uma SPEC retroativa.

### Contorno utilizado

O documento de módulo e a sessão literal foram preservados como fontes históricas. A ausência de implementação foi verificada sem abrir outros plugins. Nenhuma mudança foi feita em produto ou no histórico Git.

### Correção estrutural sugerida

Antes de qualquer implementação futura, classificar a tarefa como `NEW_SPEC` e criar uma SPEC normativa usando o documento de módulo apenas como insumo. Uma SPEC `retroactive` só será adequada se uma implementação histórica real for posteriormente localizada ou restaurada; nesse caso, ela deverá citar as fontes e declarar que não antecedeu o código.

### Estado

open

### Decisão e reavaliação

Esta tarefa apenas auditou a lacuna. Não há justificativa atual para criar uma SPEC retroativa, pois não foi localizada implementação no repositório. Reavaliar antes da primeira implementação futura de Passagem de Turno ou se novos artefatos históricos forem recuperados.

---

## ISSUE-002

### Categoria

VALIDATION

### Severidade

non-blocking

### Etapa

validação estrutural

### Problema observado

O script existente `scripts/check-ap1.ps1` falha porque o workspace contém `test-results/` e `backup-security-runtime-20261001-041211/`.

### Evidência

Em 2026-10-04, `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-ap1.ps1` retornou código 1 e listou:

- `test-results/ presente`;
- `backup de runtime presente`.

Os diretórios já existiam antes das alterações desta tarefa. A inspeção posterior com `git ls-files` confirmou que `test-results/.last-run.json` e os arquivos de `backup-security-runtime-20261001-041211/` estão versionados, apesar de os dois padrões também constarem no `.gitignore`.

### O que era esperado

O workspace deveria satisfazer a verificação estrutural básica da AP1 sem artefatos temporários ou backups de runtime na raiz.

### Impacto

Não invalida as mudanças documentais nem o `check:boundaries`, mas impede declarar `check-ap1.ps1` como aprovado.

### Contorno utilizado

Nenhum arquivo foi removido: a política desta execução proíbe apagar arquivos versionados, e o `.gitignore` não deixa de rastrear conteúdo já presente no índice.

### Correção estrutural sugerida

Decidir explicitamente se esses artefatos devem sair do histórico corrente. Se a remoção for autorizada, removê-los do índice e do worktree em mudança versionada própria; depois, executar novamente `scripts/check-ap1.ps1`.

### Estado

open

### Decisão e reavaliação

Reavaliar após limpeza autorizada do workspace. Esta falha deve continuar explícita no handoff atual.
