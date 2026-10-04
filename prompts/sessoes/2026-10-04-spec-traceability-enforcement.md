Você está trabalhando no monorepo **Election Ops Platform**.

Esta execução implementa a segunda fase da governança de agentes.

A fase anterior definiu documentalmente:

```text
request
→ SPEC Gate
→ SPEC
→ implementation
→ validation
→ SPEC Compliance
→ execution issues
→ handoff
```

Agora o objetivo é criar **enforcement técnico mínimo e confiável** para impedir que essas regras dependam exclusivamente da boa vontade do agente.

Esta tarefa NÃO deve alterar funcionalidades eleitorais.

---

# 0. Registrar este prompt

Antes de iniciar a implementação material, preserve uma cópia literal deste prompt em:

```text
prompts/sessoes/2026-10-04-spec-traceability-enforcement.md
```

Regras:

- preservar o conteúdo literal do prompt;
- não resumir;
- não reescrever;
- não substituir por relatório da execução;
- `prompts/sessoes/` continua sendo a fonte histórica dos prompts efetivamente utilizados.

Se já existir arquivo com esse nome, não sobrescreva silenciosamente.

Escolha nome coerente alternativo ou registre a situação como execution issue.

---

# 1. Preflight

Execute:

```bash
git status --short
git log --oneline -10
```

Leia:

```text
AGENTS.md
SPEC/README.md
docs/AI-PLUGIN-GUIDE.md
docs/COMMIT-GUIDE.md
docs/execution-issues/README.md
prompts/templates/implementation.md
package.json
```

Leia também a SPEC da fase anterior:

```text
SPEC/2026-10-04-agent-governance-and-spec-enforcement.md
```

e os execution issues atualmente abertos relacionados a:

```text
SPEC
traceability
agents
validation
```

Não percorra o monorepo inteiro sem necessidade.

---

# 2. SPEC Gate desta execução

Esta tarefa introduz comportamento material no tooling do repositório.

Portanto, execute formalmente o SPEC Gate.

A classificação esperada é:

```text
NEW_SPEC
```

a menos que exista uma SPEC já versionada que cubra explicitamente enforcement automatizado de traceabilidade.

Não trate:

```text
SPEC/2026-10-04-agent-governance-and-spec-enforcement.md
```

automaticamente como suficiente.

Ela definiu principalmente o modelo/processo.

Esta execução adiciona enforcement técnico.

Se após leitura você concluir que a SPEC anterior cobre integralmente o checker automatizado, justifique objetivamente a classificação alternativa.

---

# 3. Criar a SPEC antes do código

Se a classificação for `NEW_SPEC`, crie:

```text
SPEC/2026-10-04-spec-traceability-enforcement.md
```

A SPEC deve definir no mínimo:

```text
Contexto
Problema
Objetivos
Escopo
Fora de escopo
Modelo de traceabilidade
Formato dos trailers
SPEC_EXEMPT
Regras do checker
Limitações
Critérios de aceite
Validação
```

---

# 4. Commit exclusivo da SPEC

Você está explicitamente autorizado a realizar SOMENTE o commit inicial da SPEC desta execução.

Antes do commit:

```bash
git diff -- SPEC/2026-10-04-spec-traceability-enforcement.md
git status --short
```

Faça stage exclusivamente da SPEC:

```bash
git add SPEC/2026-10-04-spec-traceability-enforcement.md
```

Confirme:

```bash
git diff --cached --name-only
```

Deve aparecer apenas:

```text
SPEC/2026-10-04-spec-traceability-enforcement.md
```

Então:

```bash
git commit -m "docs(spec): define spec traceability enforcement"
```

Não faça outro commit durante a execução.

---

# 5. Objetivo técnico

Criar um checker, preferencialmente:

```text
scripts/check-spec-traceability.mjs
```

e expô-lo via:

```text
npm run spec:check
```

O checker deve ser:

- determinístico;
- rápido;
- explicável;
- conservador;
- independente de LLM;
- útil localmente e futuramente em CI.

Não tente construir um analisador inteligente demais nesta primeira versão.

---

# 6. Escopo da V1

A primeira versão deve validar regras objetivas.

## Regra 1 — referência de SPEC

Quando um commit que exige SPEC declarar:

```text
Spec: SPEC/arquivo.md
```

o arquivo precisa:

- existir;
- estar dentro de `SPEC/`;
- estar versionado pelo Git.

Não aceitar:

```text
docs/modules/foo.md
```

como SPEC.

---

# 7. Regra 2 — Agent trailer

Commits sujeitos à política devem permitir identificar o agente responsável.

Formato:

```text
Agent: <identificador>
```

Exemplos válidos:

```text
Agent: codex/gpt-5
Agent: claude/sonnet
Agent: opencode/deepseek
Agent: human
```

Não imponha uma lista fechada de vendors.

Valide estrutura, não fornecedor.

---

# 8. Regra 3 — Spec trailer

Formato:

```text
Spec: SPEC/<arquivo>.md
```

O checker deve validar:

```text
formato
existência
versionamento
localização
```

---

# 9. Regra 4 — SPEC_EXEMPT

Nem todo commit precisa de SPEC.

Defina um mecanismo explícito.

Preferência:

```text
Spec: EXEMPT
```

e trailer adicional:

```text
Spec-Exempt-Reason: <justificativa curta>
```

ou formato equivalente definido na SPEC.

O checker deve rejeitar:

```text
Spec: EXEMPT
```

sem justificativa.

Não tente decidir semanticamente se a justificativa é “boa”.

A V1 só deve exigir que ela exista.

---

# 10. Commits que exigem SPEC

Defina comportamento conservador.

Sugestão inicial:

```text
feat:
fix:
refactor:
perf:
```

devem possuir:

```text
Agent:
Spec:
```

Commits como:

```text
docs:
chore:
test:
build:
ci:
style:
```

podem:

- referenciar SPEC;
- usar EXEMPT;
- ou ser isentos conforme regra explícita.

Não crie uma política confusa.

A decisão final deve estar documentada na nova SPEC.

---

# 11. Não inferir intenção demais

Não tente nesta V1 descobrir automaticamente:

```text
"este diff deveria ter tido SPEC"
```

com base em conteúdo de código.

O checker deve trabalhar sobre sinais objetivos:

```text
tipo do commit
trailers
arquivo SPEC
ordem no histórico
```

---

# 12. Anterioridade da SPEC

O checker deve conseguir detectar pelo menos o caso simples:

```text
commit de implementação referencia SPEC
```

mas a SPEC:

```text
não existia em nenhum commit anterior
```

Isso deve falhar.

Aceite se a SPEC existir em um ancestral do commit analisado.

O objetivo é garantir:

```text
SPEC commit
    ↓
implementation commit
```

e impedir:

```text
implementation + SPEC criadas juntas
```

para mudanças classificadas como `NEW_SPEC` ou `UPDATE_SPEC`.

---

# 13. Atualização de SPEC

A V1 NÃO precisa tentar provar automaticamente toda situação de `UPDATE_SPEC`.

Mas document
