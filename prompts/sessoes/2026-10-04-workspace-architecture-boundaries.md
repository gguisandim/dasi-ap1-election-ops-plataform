Você está trabalhando no monorepo **Election Ops Platform**.

Esta execução é uma etapa de saneamento arquitetural **antes de qualquer aprofundamento dos plugins existentes**.

O objetivo é corrigir problemas estruturais encontrados na auditoria do repositório para evitar que novas funcionalidades ampliem acoplamento, divergência documental ou violações de boundaries.

NÃO implemente novas funcionalidades de domínio eleitoral nesta execução.

O foco é:

```text
workspace boundaries
public package/plugin APIs
architecture enforcement
workspace hygiene
execution issues relacionados
validation
```

---

# 0. Registrar este prompt

Antes de iniciar implementação material, preserve uma cópia literal deste prompt em:

```text
prompts/sessoes/2026-10-04-workspace-architecture-boundaries.md
```

Regras:

- preservar o conteúdo literal;
- não resumir;
- não reescrever;
- não transformar em relatório;
- não sobrescrever silenciosamente um arquivo existente.

Se já existir arquivo com esse nome:

- escolha nome coerente alternativo;
- registre a ocorrência se houver impacto real na rastreabilidade.

---

# 1. Preflight obrigatório

Antes de editar qualquer arquivo:

```bash
git status --short
git log --oneline -10
npm run spec:check -- HEAD
```

Leia:

```text
AGENTS.md
plugins/AGENTS.md
SPEC/README.md
docs/AI-PLUGIN-GUIDE.md
docs/COMMIT-GUIDE.md
docs/execution-issues/README.md
prompts/templates/implementation.md
package.json
```

Leia também:

```text
scripts/check-boundaries.mjs
scripts/check-spec-traceability.mjs
scripts/check-ap1.ps1
```

ou os caminhos equivalentes existentes no repositório.

Não percorra indiscriminadamente todo o monorepo.

Faça buscas direcionadas para imports cross-workspace e apenas então abra os arquivos afetados.

---

# 2. SPEC Gate

Execute formalmente o SPEC Gate antes de alterar código.

Classificação esperada:

```text
NEW_SPEC
```

Motivo:

esta tarefa altera regras arquiteturais e tooling de enforcement que ainda não possuem contrato normativo específico.

Se existir uma SPEC já versionada cobrindo integralmente:

```text
workspace public boundaries
cross-workspace imports
server entrypoints
boundary enforcement
```

pode classificar de outra forma, mas deve justificar.

Não use automaticamente a SPEC de governança de agentes como substituto desta SPEC arquitetural.

---

# 3. Criar SPEC antes do código

Se a classificação for `NEW_SPEC`, crie:

```text
SPEC/2026-10-04-workspace-architecture-boundaries.md
```

A SPEC deve definir pelo menos:

```text
Título
Status
Contexto
Problema
Objetivos
Escopo
Fora de escopo
Arquitetura atual
Arquitetura alvo
Regras de imports
Package public APIs
Plugin server entrypoints
Apps composition rules
Boundary enforcement
Migration strategy
Backward compatibility
Critérios de aceite
Validação
```

---

# 4. Commit exclusivo da SPEC

Você está explicitamente autorizado a realizar SOMENTE o commit inicial da SPEC.

Antes:

```bash
git diff -- SPEC/2026-10-04-workspace-architecture-boundaries.md
git status --short
```

Faça stage exclusivamente da SPEC:

```bash
git add SPEC/2026-10-04-workspace-architecture-boundaries.md
```

Confirme:

```bash
git diff --cached --name-only
```

Deve aparecer somente:

```text
SPEC/2026-10-04-workspace-architecture-boundaries.md
```

Então faça:

```bash
git commit -m "docs(spec): define workspace architecture boundaries"
```

Não faça outro commit durante esta execução.

---

# 5. Problema arquitetural identificado

A auditoria anterior encontrou diversos imports equivalentes a:

```ts
../../../../../packages/database/src
../../../../../packages/event-bus/src
../../../../../packages/security/src/permissions
```

Também existem composições em `apps/api` equivalentes a:

```ts
../../../plugins/<categoria>/<plugin>/src/server/<module>
```

O problema não é o funcionamento imediato.

O problema é que um workspace está conhecendo a estrutura interna `src/` de outro workspace.

Isso cria:

```text
acoplamento físico
refactors frágeis
contrato público indefinido
dificuldade para agentes entenderem boundaries
check:boundaries incompleto
```

Esta execução deve reduzir ou eliminar esse padrão.

---

# 6. Arquitetura alvo

A regra desejada é:

> Nenhum workspace deve importar diretamente `src/` de outro workspace.

Preferir imports públicos, por exemplo:

```ts
import { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import { requirePermission } from "@eops/security";
```

Para plugins com integração server-side, preferir entrypoint público equivalente a:

```ts
import { IncidentsModule } from "@eops/plugin-incidents/server";
```

ou outra convenção coerente com a arquitetura existente.

Não imponha exatamente esses nomes se os packages atuais já possuírem convenção melhor.

A regra é mais importante que a sintaxe exata.

---

# 7. Packages compartilhados

Audite os packages em:

```text
packages/
```

especialmente:

```text
database
event-bus
security
shared
plugin-sdk
ui
```

Verifique:

- `package.json`;
- `name`;
- `exports`;
- `main`;
- entrypoints atuais;
- `src/index.ts`.

Para packages utilizados por outros workspaces:

- disponibilize API pública suficiente;
- exporte somente o necessário;
- evite expor internals arbitrariamente;
- evite criar dezenas de entrypoints desnecessários.

Se já existe:

```ts
packages/database/src/index.ts
```

e ele fornece o contrato necessário, use-o através do package name.

Não duplique API.

---

# 8. Security package

Há imports conhecidos de caminhos internos como:

```text
packages/security/src/permissions
```

Avalie consolidar a API pública.

Exemplo conceitual:

```ts
export {
  PERMISSIONS,
  hasPermission,
  requirePermission,
} from "./permissions";
```

através de:

```ts
@eops/security
```

Se existir motivo real para subpath público:

```text
@eops/security/permissions
```

configure explicitamente em `exports`.

Não permita import relativo atravessando workspaces.

---

# 9. Database package

Plugins não devem conhecer:

```text
packages/database/src
```

Devem consumir:

```text
@eops/database
```

ou API pública equivalente.

Garanta que o package exporte apenas os elementos necessários.

Não altere schema Prisma ou migrations nesta execução salvo correção indispensável de build causada exclusivamente pela mudança de imports.

---

# 10. Event Bus

A mesma regra vale para:

```text
packages/event-bus/src
```

Consolide o uso através do package público:

```text
@eops/event-bus
```

ou equivalente.

Preserve contratos existentes.

Não mude semântica do Event Bus apenas para melhorar imports.

---

# 11. Plugin server entrypoints

O `apps/api` é composition root e legitimamente precisa carregar módulos server-side dos plugins.

Porém não deve depender de:

```text
plugins/.../src/server/...
```

Crie entrypoints públicos mínimos por plugin quando necessário.

Direção conceitual:

```text
plugin package
├── public/client entrypoint
├── manifest
└── server public entrypoint
```

Exemplo possível:

```text
@eops/plugin-incidents/server
@eops/plugin-tasks/server
@eops/plugin-inventory/server
```

Não crie aliases inconsistentes plugin a plugin.

Defina uma convenção única.

---

# 12. Não criar microfrontend ou runtime plugin loader

Esta tarefa NÃO é:

```text
microfrontend architecture
dynamic plugin loading
runtime dependency injection framework
plugin marketplace
```

Mantenha a composição estática atual.

Só formalize public entrypoints e boundaries.

---

# 13. Migrar imports afetados

Faça busca direcionada por padrões como:

```text
packages/*/src
plugins/*/src
../packages/
../../packages/
../../../packages/
```

e equivalentes.

Classifique os casos.

Não faça replace cego.

Para cada import:

1. identifique o workspace produtor;
2. identifique a API pública adequada;
3. crie/ajuste entrypoint quando necessário;
4. altere consumidor;
5. valide typecheck.

Objetivo:

```text
cross-workspace relative imports → 0
cross-workspace imports containing /src → 0
```

exceto casos explicitamente documentados e justificados pela SPEC.

---

# 14. Expandir check:boundaries

O checker atual não deve verificar apenas:

```text
plugin A -> plugin B
```

Expanda para detectar pelo menos:

```text
plugin → outro plugin /src
plugin → packages/*/src
app → packages/*/src
app → plugins/*/src
package → outro package /src
```

Também bloqueie imports relativos que escapem do workspace e entrem fisicamente em outro workspace.

---

# 15. Casos permitidos

Deve continuar permitido:

```text
@eops/database
@eops/event-bus
@eops/security
@eops/shared
@eops/plugin-sdk
@eops/ui
```

e entrypoints públicos explicitamente configurados.

Também pode ser permitido:

```text
@eops/plugin-x/server
```

quando fizer parte do contrato arquitetural definido nesta SPEC.

---

# 16. Client/server boundaries

Se a estrutura permitir validar com segurança, adicione regras que impeçam:

```text
client -> server internals
server -> client-only implementation
```

Mas não implemente heurística frágil.

A V1 dessa expansão deve preferir regras objetivas.

Se não houver contrato suficientemente explícito para detectar isso com baixa taxa de falso positivo:

documente como limitação futura.

---

# 17. Testes do boundary checker

Adicione ou expanda testes automatizados.

Cobrir pelo menos:

```text
plugin -> plugin/src rejeitado
plugin -> packages/*/src rejeitado
app -> plugin/src rejeitado
app -> package/src rejeitado
import @eops/database aceito
import @eops/event-bus aceito
import @eops/security aceito
plugin server public entrypoint aceito
```

Use fixtures ou arquivos temporários quando possível.

Não dependa de deixar violações reais no repositório para testar.

---

# 18. Falha atual do check-ap1.ps1

A auditoria anterior encontrou falha relacionada a artefatos locais:

```text
test-results/
backup-security-runtime-20261001-041211/
```

Antes de apagar qualquer coisa:

```bash
git status --short
git ls-files test-results
git ls-files backup-security-runtime-20261001-041211
```

Verifique também `.gitignore`.

---

# 19. Política para artefatos locais

Se esses diretórios:

- não estiverem versionados;
- forem claramente gerados/local backup;
- já estiverem ignorados;
- não forem usados por código ou documentação;

pode removê-los localmente para permitir a validação.

Mas:

- não use `git clean -fdx`;
- não remova arquivos versionados;
- não remova arquivos cujo propósito seja incerto;
- não altere backup do usuário sem evidência de que é artefato descartável.

Se não houver segurança para remover:

registre o problema e preserve.

---

# 20. Melhorar check-ap1 se necessário

Se `scripts/check-ap1.ps1` estiver correto ao detectar esses diretórios:

não enfraqueça o script apenas para fazê-lo passar.

Se encontrar falso positivo objetivo:

corrija o checker e adicione teste/documentação.

Não transforme:

```text
"artefato proibido existe"
```

em:

```text
"ignore sempre"
```

só para obter PASS.

---

# 21. Execution issues existentes

Revise:

```text
docs/execution-issues/
```

principalmente issues relacionados a:

```text
workspace architecture
validation
SPEC traceability
test-results
backup artifacts
dependency
```

Se esta execução resolver estruturalmente um issue:

```text
state: resolved
```

com evidência.

Se apenas reduzir impacto:

```text
state: partially-resolved
```

Não altere issues sem relação com esta tarefa.

---

# 22. Novo execution issue de boundaries

Se ainda não existir registro para o problema de imports cross-workspace, crie um issue nesta execução.

Categoria adequada, conforme taxonomia atual, por exemplo:

```text
REPO_DIVERGENCE
GUIDE_CONFLICT
VALIDATION
```

ou outra já prevista.

Registre:

```text
problema
evidência
impacto
correção estrutural
estado final
```

Se corrigido completamente:

```text
resolved
```

Isso preserva a memória de que o problema existiu.

---

# 23. Vulnerabilidade Prisma / deepmerge-ts

Existe issue aberto relacionado a:

```text
Prisma
deepmerge-ts
3 vulnerabilidades altas
```

NÃO transforme esta execução em atualização de Prisma.

Apenas execute novamente, se necessário:

```bash
npm audit --omit=dev
npm ls deepmerge-ts --all
```

Se o problema continuar igual:

mantenha o issue aberto.

Se desaparecer por mudanças externas de lockfile:

verifique antes de resolver.

Não force major upgrade.

---

# 24. Não aprofundar plugins

É explicitamente fora de escopo:

```text
novas features de Incidentes
novos workflows de Tarefas
novos recursos de Inventário
novas telas de Auditoria
novos dashboards
novas regras de Transmissão
novo Simulador
```

Alterações em plugins nesta execução devem ocorrer somente para:

```text
imports
exports
package metadata
entrypoints
tests de arquitetura
```

Preserve comportamento funcional.

---

# 25. Não perseguir LOC nesta execução

O projeto possui meta acadêmica futura de aproximadamente:

```text
100k LOC
```

Essa meta NÃO deve influenciar este saneamento.

Não crie abstrações, wrappers, arquivos ou testes redundantes apenas para aumentar linhas.

Nesta etapa:

```text
menos código correto > mais código artificial
```

O crescimento de LOC ocorrerá depois, aprofundando funcionalidades reais.

---

# 26. Atualizar documentação arquitetural

Se as novas regras de public entrypoints mudarem o contrato oficial, atualize apenas os documentos necessários.

Possíveis arquivos:

```text
AGENTS.md
plugins/AGENTS.md
docs/AI-PLUGIN-GUIDE.md
docs/PLUGIN_ARCHITECTURE.md

