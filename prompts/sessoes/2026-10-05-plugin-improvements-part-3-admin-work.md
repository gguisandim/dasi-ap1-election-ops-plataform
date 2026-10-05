Você está trabalhando no monorepo **Election Ops Platform**.

Execução:

```text
PLUGIN IMPROVEMENTS — PART 3
PLATFORM ADMINISTRATION & WORK MANAGEMENT
```

Plugins:

```text
Access Control
Tasks
Preparation Checklists
```

---

# 0. EXECUÇÃO EFICIENTE

Não executar suíte completa durante desenvolvimento.

Testes focados.

`npm test` somente no final.

---

# 1. REGISTRAR

```text
prompts/sessoes/2026-10-05-plugin-improvements-part-3-admin-work.md
```

---

# 2. SPEC GATE

Esperado:

```text
NEW_SPEC
```

Criar:

```text
SPEC/2026-10-05-platform-administration-work-improvements.md
```

Commit exclusivo:

```text
docs(spec): define administration and work improvements
```

---

# ACCESS CONTROL

# 3. Objetivo

Transformar Access Control de:

```text
auth + users básicos
```

em administração real de RBAC.

---

# 4. Roles

Criar gestão:

```text
GET roles
GET role detail
POST role
PATCH role
```

Excluir somente se seguro.

Preferir desativação quando role estiver em uso.

---

# 5. Permissions

Criar catálogo navegável de permissões.

Não permitir criar strings arbitrárias quando as permissions são definidas em `@eops/security`.

---

# 6. Permission Matrix

Criar UI:

```text
              Admin  NOC  Coord  Campo
incidents.read   ✓    ✓     ✓      ✓
incidents.close  ✓    ✓     ✓      -
users.manage     ✓    -     -      -
```

---

# 7. User roles

Permitir:

```text
múltiplas roles
atribuir
remover
```

---

# 8. Effective permissions

Detalhe do usuário deve mostrar:

```text
roles
permissions herdadas
effective permissions
```

Não persistir effective permissions se deriváveis.

---

# 9. System roles

Roles de sistema devem possuir proteção.

Evitar:

```text
excluir Admin
remover última role administrativa
```

quando aplicável.

---

# 10. Account lifecycle

Adicionar gestão segura:

```text
ACTIVE
INACTIVE
```

e demais estados existentes.

Não implementar recuperação de senha por email.

---

# TASKS

# 11. Preserve Workforce integration

Não redesenhar Dispatch.

Tasks continua owner de Task.

---

# 12. Subtasks

Adicionar hierarquia simples:

```text
Task
├── Subtask
├── Subtask
└── Subtask
```

Limitar profundidade se necessário.

---

# 13. Checklist interno

Task pode possuir checklist leve.

Não confundir com Preparation Checklist.

Task checklist = pequenos passos internos da tarefa.

---

# 14. Labels

Adicionar labels/tags.

Permitir filtros.

---

# 15. Milestone

Adicionar milestone opcional ou grouping equivalente.

---

# 16. Saved filters

Permitir filtros salvos do próprio usuário quando simples de implementar.

---

# 17. Bulk actions

Permitir ações seguras:

```text
status
priority
assignee
label
```

em múltiplas tasks.

RBAC obrigatório.

---

# 18. Dependency graph

Melhorar dependências.

Detectar ciclo.

Calcular:

```text
BLOCKED
```

quando dependência obrigatória não estiver concluída.

---

# 19. Workload

Dashboard pode mostrar carga por:

```text
user
team
priority
status
```

Sem criar scheduler automático.

---

# PREPARATION CHECKLISTS

# 20. Objetivo

Transformar checklists em instrumento mais forte de readiness.

Preservar:

```text
templates
items
evidence
approval
dashboard
```

---

# 21. Readiness score

Criar score calculado de preparação.

Exemplo:

```text
completed required items
/
total required items
```

Ponderação por criticidade somente se justificada na SPEC.

---

# 22. Critical blockers

Itens críticos pendentes devem aparecer separadamente.

---

# 23. Deadline

Permitir prazo por checklist/item quando necessário.

Estados calculados:

```text
ON_TRACK
AT_RISK
OVERDUE
```

---

# 24. Template versioning

Evitar que edição futura de template modifique semanticamente checklists já executados.

Implementar versionamento ou snapshot seguro.

---

# 25. Bulk preparation view

Criar visão:

```text
local
readiness %
critical blockers
owner
deadline
approval
```

---

# 26. Approval consistency

Aprovação deve validar pré-condições importantes.

Não permitir aprovação inconsistente.

---

# 27. RBAC

Access Control:

```text
users/roles permissions
```

Tasks:

permissões existentes.

Preparation:

permissões existentes.

Não criar permissões redundantes.

---

# 28. EVENTS

Exemplos:

```text
access.role_created
access.role_updated
access.user_roles_changed

task.subtask_created
task.blocked
task.bulk_updated

preparation.blocker_detected
preparation.approved
preparation.readiness_changed
```

Não emitir eventos excessivos.

---

# 29. AUDIT

Mudanças administrativas críticas devem ser auditáveis.

Audit já usa `subscribeAll`.

Não modificar Audit salvo necessidade real.

---

# 30. TESTES

Access Control:

```text
role permissions
effective permission
system role protection
account state
```

Tasks:

```text
subtask
cycle detection
blocked calculation
bulk update
```

Preparation:

```text
readiness
critical blockers
deadline
approval
template immutability/versioning
```

Orientação:

```text
12–24 novos testes
```

Não perseguir número.

---

# 31. DATABASE

Adicionar apenas estruturas necessárias.

Migration nova.

Não alterar migrations históricas.

---

# 32. FRONTEND

Access:

```text
/users
/users/:id
/roles
/roles/:id
```

Tasks:

melhorar páginas existentes.

Preparation:

adicionar overview de readiness quando necessário.

---

# 33. FINAL VALIDATION

Somente no final:

```bash
npm run spec:check
npm run check:boundaries
npm run typecheck
npm run lint
```

testes focados,

UMA vez:

```bash
npm test
```

depois:

```bash
npm run build
npm run db:validate
npm run count:loc
git diff --check
```

e `check-ap1`.

---

# 34. HANDOFF

Entregar:

```text
SPEC
Access Control
Tasks
Preparation
Database
Tests
Validation
LOC
Execution Issues
SPEC Compliance
Git
```

Sem commit da implementação.

---

# 35. SUCESSO

Ao final:

```text
Access Control
→ quem pode fazer o quê?

Tasks
→ qual trabalho existe, do que depende e quem está sobrecarregado?

Preparation
→ estamos prontos para operar e o que ainda bloqueia a prontidão?
```
