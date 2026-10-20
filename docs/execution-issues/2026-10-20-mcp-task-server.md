# Execution issues — MCP Task Server

## Contexto

- Data: 2026-10-20
- Prompt/sessão: implementação da atividade AP2 de integração MCP
- SPEC: `SPEC/2026-10-20-mcp-task-server.md` (a ausência registrada no ISSUE-001 pertence à execução anterior)
- Agente: Copilot SDK / modelo indisponível
- Escopo: servidor MCP stdio para operação da Central de Tarefas

---

## ISSUE-001

### Categoria

SPEC_MISSING

### Severidade

blocking

### Etapa

preflight

### Problema observado

A nova integração MCP altera a superfície de ferramentas e a forma de interação de um agente com a API, mas não há SPEC normativa para esse contrato. A SPEC existente `SPEC/2026-10-03-tasks.md` especifica os endpoints e o domínio da Central, não a integração MCP. O gate do repositório exige uma SPEC nova commitada antes da implementação. O pedido desta execução proíbe commits.

### Evidência

- `SPEC/README.md`: `NEW_SPEC` exige criação e commit da SPEC antes da implementação.
- `docs/AI-PLUGIN-GUIDE.md`: funcionalidade nova deve ter SPEC commitada antes do código.
- `docs/COMMIT-GUIDE.md`: a SPEC deve ser commitada antes do código correspondente.
- Instrução do solicitante: não executar `git commit`.
- A busca em `SPEC/` não encontrou outra especificação para MCP.

### O que era esperado

Uma SPEC normativa para o servidor MCP, seus quatro tools, autenticação, permissões do harness, testes e critérios de demonstração, autorizada e commitada antes da implementação.

### Impacto

Não é seguro iniciar a implementação nem criar `.mcp.json`, testes ou diário como se os requisitos estivessem aprovados. Nenhuma demonstração integrada pode ser preparada até a SPEC preceder o código conforme o gate.

### Contorno utilizado

Inspeção somente leitura dos controllers, DTOs, service, autenticação, permissões, workspaces e configuração MCP oficial do VS Code. A implementação foi interrompida; não foram criados servidor, SPEC ou diário, e nenhum resultado de demonstração foi inventado.

### Correção estrutural sugerida

Autorizar a criação e o commit isolado da SPEC MCP conforme `docs/COMMIT-GUIDE.md`; depois, retomar a implementação sem commitar código, respeitando a restrição atual.

### Estado

resolved

### Decisão e evidência de encerramento

O solicitante informou que `SPEC/2026-10-20-mcp-task-server.md` foi criada e commitada manualmente. A SPEC está presente no workspace e cobre o servidor MCP, as quatro tools, autenticação, permissões, testes e demonstração; o gate desta execução foi classificado `EXISTING_SPEC_OK`. Nenhum comando Git foi executado nesta execução, conforme solicitado. Reabrir somente se a verificação futura do histórico contrariar essa evidência fornecida.

---

## ISSUE-002

### Categoria

TOOL_LIMITATION

### Severidade

non-blocking

### Etapa

preflight

### Problema observado

A ferramenta PowerShell disponibilizada para comandos locais não iniciou; tanto `pwsh.exe` quanto `powershell.exe` falharam ao abrir. Assim, não foi possível verificar localmente a branch, o estado do working tree ou executar comandos npm nesta sessão.

### Evidência

A chamada `git status --short --branch; git branch --show-current` retornou erro de indisponibilidade/acesso do PowerShell antes de executar o comando.

### O que era esperado

Um shell local funcional para confirmar o estado do Git e executar as validações compatíveis.

### Impacto

O estado local do Git, build/typecheck, testes e sincronização do `package-lock.json` permanecem não verificados. Esta limitação não impede a implementação, mas impede declarar a validação como concluída.

### Contorno utilizado

O código e os manifests foram criados sem terminal. A ferramenta de testes disponível não encontrou testes para o novo arquivo, e nenhuma validação de build ou instalação foi declarada como executada. O `package-lock.json` precisa ser atualizado pelo `npm install` manual.

### Correção estrutural sugerida

Restabelecer acesso a `pwsh.exe` ou `powershell.exe` e repetir a verificação do Git e as validações na próxima execução.

### Estado

open

### Decisão e evidência de encerramento

O PowerShell continua indisponível nesta execução (`pwsh.exe` não encontrado e `powershell.exe` com acesso negado); a tentativa de invocar CMD não chegou a executar porque a ferramenta de terminal não iniciou. A implementação prosseguiu sem comandos Git ou terminal. A validação local por terminal permanece para execução manual pelo solicitante.
