# Servidor MCP da Central de Tarefas

Servidor stdio que encaminha operações para a API NestJS existente. Não acessa o banco nem implementa regras de negócio. A API continua responsável por autenticação, RBAC, isolamento por eleição e transições permitidas.

## Configuração local e no VS Code

1. Instale as dependências na raiz do repositório com `npm install`.
2. Copie `.env.mcp.example` para `.env.mcp` e configure `EOPS_API_URL` (incluindo `/api`) e um token Bearer válido. O `.env.mcp` é ignorado pelo Git.
3. Compile com `npm run build:mcp:tasks`.
4. Em VS Code, aprove a confiança do servidor `election-ops-tasks` quando solicitado. A configuração compartilhada está em `.vscode/mcp.json`; não contém tokens.
5. Use **Chat: Manage Tool Approval** após carregar o servidor para conceder pré-aprovação somente a `listar_tarefas` e `consultar_tarefa`. Não aprove automaticamente `criar_tarefa` nem `atualizar_tarefa`: deixe ambas exigirem confirmação manual.

O arquivo MCP configura o processo e o `envFile`, mas a política de aprovação de tools não é um campo suportado pelo formato `.vscode/mcp.json`. `.vscode/settings.json` torna somente as duas tools de leitura elegíveis à autoaprovação e impede a autoaprovação das escritas (`false`). A elegibilidade não concede aprovação por si só: conceda pré-aprovação de leitura em **Chat: Manage Tool Approval**. Não aprove automaticamente as escritas e não use aprovação global/“Allow all”.

O servidor publica hints MCP `readOnlyHint: true` nas tools de leitura e `readOnlyHint: false` nas tools de escrita. Esses hints descrevem a operação ao cliente, mas não substituem as aprovações do VS Code.

`EOPS_API_URL` pode apontar para a origem da API (por exemplo, `http://localhost:3001`) ou já incluir o prefixo `/api`. O servidor acrescenta `/api` quando ele não estiver presente.

## Tools

- `listar_tarefas`: filtros do `TasksQueryDto` da API.
- `consultar_tarefa`: detalhes por identificador.
- `criar_tarefa`: campos permitidos por `CreateTaskDto`.
- `atualizar_tarefa`: identificador e pelo menos um campo de `UpdateTaskDto`.

## Scripts

- `npm run build:mcp:tasks`
- `npm run dev:mcp:tasks`
- `npm run start:mcp:tasks`
- `npm run test -w @eops/mcp-task-server`

Diagnósticos de inicialização usam stderr; stdout fica reservado ao protocolo MCP. Erros HTTP e de conexão são devolvidos como resultados de erro MCP sem registrar o token.
