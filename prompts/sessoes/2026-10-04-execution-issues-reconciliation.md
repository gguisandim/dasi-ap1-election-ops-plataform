Você está trabalhando no monorepo **Election Ops Platform**.

Esta execução é a última etapa de saneamento antes de voltar ao desenvolvimento funcional dos plugins existentes.

O objetivo é:

```text
1. reconciliar execution issues ainda relevantes;
2. corrigir artefatos versionados que fazem check-ap1 falhar;
3. verificar a inconsistência histórica do commit 10fe72b;
4. melhorar o handoff dos agentes para mostrar claramente quais execution issues foram resolvidos ou continuam abertos;
5. deixar os gates principais verdes antes da próxima fase funcional.
```

NÃO implemente novas funcionalidades de plugins nesta execução.

---

# 0. Registrar este prompt

Preserve uma cópia literal deste prompt em:

```text
prompts/sessoes/2026-10-04-execution-issues-reconciliation.md
```

Não resumir.

Não reescrever.

Não substituir por relatório.

Se o arquivo já existir, escolha nome coerente alternativo e informe no handoff.

---

# 1. Preflight obrigatório

Antes de alterar qualquer arquivo:

```bash
git status --short
git log --oneline -10
npm run spec:check -- HEAD
npm run check:boundaries
```

Leia:

```text
AGENTS.md
SPEC/README.md
docs/AI-PLUGIN-GUIDE.md
docs/COMMIT-GUIDE.md
docs/execution-issues/README.md
prompts/templates/implementation.md
scripts/check-ap1.ps1
scripts/check-spec-traceability.mjs
```

Leia também todos os execution issues com estado:

```text
open
partially-resolved
accepted-risk
not-actionable
```

Não percorra indiscriminadamente o monorepo.

---

# 2. SPEC Gate

Execute formalmente o SPEC Gate.

A classificação esperada é:

```text
UPDATE_SPEC
```

A SPEC candidata principal é:

```text
SPEC/2026-10-04-agent-governance-and-spec-enforcement.md
```

Motivo:

esta tarefa evolui o protocolo de execution issues, handoff e governança dos agentes, mas não cria uma nova feature de produto.

Se após leitura você concluir que outra SPEC é a correta, justifique explicitamente.

Não use `SPEC_EXEMPT` apenas porque a tarefa é majoritariamente documental/tooling.

---

# 3. Atualizar a SPEC antes da implementação

Se a classificação for `UPDATE_SPEC`, atualize a SPEC aplicável antes de qualquer outra alteração material.

A atualização deve incluir pelo menos:

## 3.1 Execution Issue Reconciliation

Toda execução material deve terminar com uma reconciliação explícita dos issues relevantes.

Formato conceitual:

```text
Issue
Estado antes
Estado depois
Ação executada
Evidência
Bloqueia próxima fase? sim/não
```

## 3.2 Classificação prévia

No início da execução, cada issue relevante deve ser classificado como:

```text
BLOCKS_CURRENT_TASK
RELATED_NON_BLOCKING
OUT_OF_SCOPE
```

## 3.3 Regra de honestidade

Um issue não deve ser marcado como resolvido apenas porque:

```text
não apareceu novamente
não foi reproduzido
não bloqueou a execução
```

`resolved` exige evidência de que a causa estrutural foi corrigida ou que o estado verificável atual elimina a condição registrada.

---

# 4. Commit exclusivo da atualização da SPEC

Você está explicitamente autorizado a realizar SOMENTE o commit da SPEC atualizada.

Antes:

```bash
git diff -- <SPEC>
git status --short
```

Faça stage exclusivamente da SPEC.

Confirme:

```bash
git diff --cached --name-only
```

Deve aparecer somente a SPEC.

Faça commit com mensagem coerente, por exemplo:

```text
docs(spec): require execution issue reconciliation
```

Não faça outro commit durante esta execução.

---

# 5. Auditoria dos execution issues

Monte internamente uma tabela com todos os issues relevantes.

Para cada um determine:

```text
estado atual
causa
evidência
reproduzível?
corrigível nesta execução?
bloqueia próxima fase?
```

Não altere issues sem relação com esta tarefa.

---

# 6. Issue de SPEC traceability / commit 10fe72b

Existe uma inconsistência histórica relacionada ao commit:

```text
10fe72b
```

Há registro indicando ausência de trailer `Agent:`.

Porém há evidência posterior de que o commit pode atualmente possuir:

```text
Agent: codex/model-unavailable
Spec: SPEC/2026-10-04-spec-traceability-enforcement.md
```

Não presuma qual informação está correta.

Execute:

```bash
git show -s --format=%B 10fe72b
npm run spec:check -- 10fe72b
```

---

# 7. Resultado possível A — checker passa

Se:

```text
npm run spec:check -- 10fe72b
```

PASSAR:

considere que o estado verificável atual não reproduz o problema.

Atualize o execution issue correspondente.

Preferência:

```text
state: resolved
```

com evidência:

```text
git show -s --format=%B 10fe72b
npm run spec:check -- 10fe72b
```

Explique que a condição histórica não representa mais o estado atual do commit.

Não apague a evidência histórica.

---

# 8. Resultado possível B — checker falha

Se o commit possuir trailers visualmente corretos mas:

```text
npm run spec:check -- 10fe72b
```

FALHAR:

isso indica possível defeito no checker.

Nesse caso:

1. reproduza;
2. identifique a causa;
3. corrija o checker;
4. adicione teste de regressão;
5. rode toda a suíte correspondente;
6. atualize o execution issue.

Não faça workaround manual apenas para fechar o issue.

---

# 9. Artefatos proibidos pelo check-ap1

Existem dois artefatos conhecidos:

```text
test-results/
backup-security-runtime-20261001-041211/
```

O `check-ap1.ps1` os considera inválidos.

Audite antes de remover:

```bash
git status --short
git ls-files test-results
git ls-files backup-security-runtime-20261001-041211
```

Leia também `.gitignore`.

---

# 10. Determinar se são descartáveis

Verifique se:

```text
test-results/
```

é somente saída gerada de testes.

Verifique se:

```text
backup-security-runtime-20261001-041211/
```

é backup local/temporário e não fonte necessária.

Procure referências no repositório apenas se necessário.

Se ambos forem artefatos descartáveis:

remova-os corretamente do repositório.

---

# 11. Remoção correta

Se estiverem versionados e forem descartáveis, remova do Git e do worktree de forma controlada.

Pode usar:

```bash
git rm -r test-results
git rm -r backup-security-runtime-20261001-041211
```

somente após confirmar que não contêm fonte necessária.

NÃO use:

```text
git clean -fdx
git reset --hard
```

Não apague arquivos de propósito incerto.

---

# 12. .gitignore

Se necessário, confirme regras equivalentes a:

```text
test-results/
backup-security-runtime-*/
```

Não adicione regras duplicadas.

Não altere `.gitignore` se ele já cobre corretamente esses caminhos.

---

# 13. check-ap1.ps1

Depois da limpeza, execute:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-ap1.ps1
```

O objetivo desta execução é deixar esse gate:

```text
PASS
```

Se continuar falhando:

não enfraqueça o checker automaticamente.

Investigue a nova causa.

---

# 14. Execution issue do check-ap1

Atualize o issue relacionado aos artefatos.

Se os diretórios forem removidos corretamente e:

```text
check-ap1.ps1
```

passar:

```text
state: resolved
```

Inclua evidência.

Se continuar falhando por outro motivo:

```text
state: partially-resolved
```

ou `open`, conforme evidência.

---

# 15. Prisma / deepmerge-ts

Existe issue conhecido:

```text
deepmerge-ts@7.1.5
via Prisma
3 vulnerabilidades altas
```

Esta execução NÃO deve atualizar Prisma automaticamente.

Execute apenas para confirmar estado:

```bash
npm ls deepmerge-ts --all
npm audit --omit=dev
```

Se continuar igual:

```text
state: open
Blocks next phase: no
```

Explique no issue/handoff que:

```text
é uma dependência transitiva conhecida;
a correção pode exigir mudança de Prisma;
não bloqueia o desenvolvimento funcional atual.
```

Não use:

```text
npm audit fix --force
```

---

# 16. Shift Handover

Existe dívida conhecida:

```text
Passagem de Turno não possui SPEC normativa.
```

Não implemente o módulo.

Não crie a SPEC agora.

Classifique:

```text
OUT_OF_SCOPE
Blocks next phase: no
```

com ressalva:

```text
bloqueia somente uma futura implementação de Shift Handover.
```

---

# 17. Browser/tool limitation

Issues históricos relacionados à ausência de browser controlado devem permanecer históricos.

Se já estão:

```text
not-actionable
```

não reabra sem nova evidência.

Classifique:

```text
OUT_OF_SCOPE
Blocks next phase: no
```

---

# 18. Prompt truncado

O execution issue relacionado a prompt truncado também deve permanecer histórico se não houver correção de repositório aplicável.

Não o use para bloquear os plugins.

---

# 19. Melhorar o protocolo de handoff

Atualize a documentação canônica necessária para tornar obrigatória esta seção:

```text
EXECUTION ISSUES RECONCILIATION
```

Todo handoff de execução material deve conter tabela equivalente a:

```text
| Issue | Antes | Depois | Ação | Evidência | Bloqueia próxima fase |
```

Exemplo:

```text
| Prisma dependency | open | open | none | npm audit | no |
| AP1 artifacts | open | resolved | removed tracked artifacts | check-ap1 PASS | no |
```

---

# 20. Preflight de issues para futuros agentes

Atualize:

```text
prompts/templates/implementation.md
```

e apenas os guides canônicos necessários para exigir:

antes da implementação:

```text
EXECUTION ISSUES PREFLIGHT

BLOCKS_CURRENT_TASK
RELATED_NON_BLOCKING
OUT_OF_SCOPE
```

Não duplique regras extensas em todos os documentos.

---

# 21. Regra de bloqueio

Documente claramente:

## BLOCKS_CURRENT_TASK

O agente não deve prosseguir com implementação material até resolver ou obter orientação.

## RELATED_NON_BLOCKING

Issue relacionado, mas não impede a tarefa.

Deve aparecer no handoff.

## OUT_OF_SCOPE

Issue real conhecido, porém não relacionado à execução atual.

Preservar sem tentar resolver incidentalmente.

---

# 22. Não transformar todo issue em blocker

O objetivo do protocolo NÃO é deixar o desenvolvimento impossível.

Issues só devem bloquear quando afetam:

```text
correção
segurança relevante para a tarefa
integridade arquitetural
validação necessária
SPEC aplicável
dados necessários
```

Um issue de dependência transitiva que não afeta a feature atual não deve automaticamente bloquear tudo.

---

# 23. Não aprofundar plugins

NÃO altere funcionalidades de:

```text
incidents
audit
notifications
tasks
inventory
transmission
simulator
reports
field-teams
shifts
```

ou qualquer outro plugin, exceto se necessário para corrigir uma falha estrutural diretamente causada por esta tarefa.

---

# 24. Não perseguir LOC

A meta acadêmica de 100k LOC não deve influenciar esta execução.

Não crie código redundante.

Esta é uma execução de saneamento.

---

# 25. Não fazer nesta execução

NÃO:

- atualizar Prisma major;
- usar audit fix --force;
- criar plugins;
- aprofundar funcionalidades;
- refatorar boundaries novamente;
- alterar banco;
- alterar migrations;
- implementar Handover;
- reescrever histórico Git;
- modificar commits antigos;
- esconder issues ainda abertos.

---

# 26. Validação completa

Execute:

```bash
npm run spec:check
npm run check:boundaries
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
```

Execute também:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-ap1.ps1
```

E:

```bash
npm run spec:check -- 10fe72b
```

Classifique cada resultado:

```text
PASS
FAIL
BLOCKED
NOT RUN
```

---

# 27. Gate para começar plugins

Ao final, determine explicitamente:

```text
PLUGIN DEVELOPMENT GATE: READY
```

ou:

```text
PLUGIN DEVELOPMENT GATE: BLOCKED
```

Pode marcar `READY` se:

```text
spec:check       PASS
check:boundaries PASS
typecheck        PASS
lint             PASS
tests            PASS
build            PASS
check-ap1        PASS
```

e nenhum execution issue restante for classificado como:

```text
BLOCKS_CURRENT_TASK
```

Issues `open` podem coexistir com:

```text
PLUGIN DEVELOPMENT GATE: READY
```

desde que estejam explicitamente:

```text
RELATED_NON_BLOCKING
```

ou:

```text
OUT_OF_SCOPE
```

---

# 28. SPEC Compliance

Revise os critérios da SPEC atualizada.

Formato:

```text
AC-01 PASS
Evidence: ...

AC-02 PASS
Evidence: ...
```

Não misture SPEC Compliance com Validation.

---

# 29. Git final

Execute:

```bash
git status --short
git diff --stat
git diff --check
git log --oneline -5
```

Esperado:

```text
SPEC update commitada;
alterações restantes sem commit;
prompt registrado;
issues atualizados;
artefatos proibidos removidos se confirmados como descartáveis.
```

Não faça commit da implementação restante.

---

# 30. Entrega final obrigatória

A resposta deve conter exatamente estas seções principais.

## Prompt registration

```text
Prompt:
prompts/sessoes/2026-10-04-execution-issues-reconciliation.md
```

## SPEC Gate

```text
Classification:
SPEC:
SPEC commit:
```

## Execution Issues Preflight

Tabela:

```text
| Issue | Estado inicial | Classificação |
```

Usar:

```text
BLOCKS_CURRENT_TASK
RELATED_NON_BLOCKING
OUT_OF_SCOPE
```

## Reconciliation

Tabela obrigatória:

```text
| Issue | Antes | Depois | Ação | Evidência | Bloqueia plugins? |
```

## Commit 10fe72b

Informe:

```text
Trailers encontrados:
spec:check:
Conclusão:
```

## Repository hygiene

Informe:

```text
test-results:
backup-security-runtime:
.gitignore:
check-ap1:
```

## Dependency security

Informe:

```text
deepmerge-ts:
Prisma:
npm audit:
estado do issue:
bloqueia plugins: sim/não
```

## Plugin Development Gate

Declare explicitamente:

```text
PLUGIN DEVELOPMENT GATE: READY
```

ou:

```text
PLUGIN DEVELOPMENT GATE: BLOCKED
```

e explique a razão.

## Validation

Tabela:

```text
spec:check             PASS/FAIL/BLOCKED
spec:check 10fe72b     PASS/FAIL/BLOCKED
check:boundaries       PASS/FAIL/BLOCKED
typecheck              PASS/FAIL/BLOCKED
lint                   PASS/FAIL/BLOCKED
tests                  PASS/FAIL/BLOCKED
build                  PASS/FAIL/BLOCKED
check-ap1              PASS/FAIL/BLOCKED
git diff --check       PASS/FAIL
```

## SPEC Compliance

Critério por critério.

## Git

Informe:

```text
SPEC commit:
working tree:
```

## Commit sugerido

Sugira um único commit coerente para as alterações restantes.

Exemplo:

```text
chore(governance): reconcile execution issues and repository hygiene

Agent: <agente real>
Spec: <SPEC aplicável>
```

Não execute o commit.

---

# 31. Critério principal de sucesso

Esta execução deve terminar com uma resposta objetiva para:

> A base está pronta para aprofundar os plugins existentes?

O resultado ideal é:

```text
PLUGIN DEVELOPMENT GATE: READY

Resolved:
- tracked AP1 artifacts
- stale SPEC traceability issue

Open but non-blocking:
- Prisma/deepmerge dependency

Out of scope:
- Shift Handover SPEC
- historical tool limitations
```

Depois disso, não continue refinando infraestrutura sem evidência de um novo blocker real.

A próxima fase deve ser desenvolvimento funcional dos plugins existentes.

