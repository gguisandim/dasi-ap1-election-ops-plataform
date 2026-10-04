# Execution issues — resposta a incidentes, auditoria e notificações

## Contexto

- Data: 2026-10-04
- Prompt/sessão: `prompts/sessoes/2026-10-04-incidents-audit-notifications-enhancement.md`
- SPEC: `SPEC/2026-10-04-incident-response-audit-notifications.md`
- Agente: Codex
- Escopo: Incidentes, Auditoria, Notificações e contratos compartilhados de eventos

---

## ISSUE-001

### Categoria

VALIDATION

### Severidade

blocking

### Etapa

validação

### Problema observado

O package `@eops/event-bus` publicava runtime por `dist/`, mas não possuía script ou configuração própria de build. Testes de plugins carregavam uma cópia gerada antiga, na qual `subscribeAll`, o catálogo de eventos configuráveis e a política pública de permissões ainda não existiam.

### Evidência

Os testes focados falharam com `this.bus.subscribeAll is not a function`, `requiredPermissionForEvent is not a function` e catálogo `undefined`, enquanto `packages/event-bus/src` já continha os contratos. `packages/event-bus/package.json` não declarava script `build` nem havia `tsconfig.json` no workspace.

### O que era esperado

O runtime público de um package deve ser reproduzido antes de testes e builds que o consomem pelo package name.

### Impacto

Auditoria e Notificações não podiam ser validadas de forma confiável em processo limpo; o resultado dependia de artefato local pré-existente.

### Contorno utilizado

Foi executada uma sincronização intermediária para confirmar o diagnóstico, seguida da correção estrutural do pipeline.

### Correção estrutural sugerida

Fornecer build próprio do Event Bus e executá-lo no `pretest` e antes do build da API.

### Estado

resolved

### Decisão e evidência de encerramento

Foram adicionados `packages/event-bus/tsconfig.json`, o script `build` do workspace e `build:event-bus` no pipeline raiz. `pretest` e `build:api` passaram a gerar o runtime público antes dos consumidores. Evidência: testes focados 25/25, suíte completa 311/311 e build global concluídos em 2026-10-04.
