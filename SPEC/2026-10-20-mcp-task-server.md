# SPEC — Integração MCP da Central de Tarefas

**Data:** 2026-10-20  
**Classificação:** NEW_SPEC  
**Projeto:** Election Ops Platform  
**Escopo:** Servidor MCP integrado à API da Central de Tarefas.

## 1. Objetivo

Implementar um servidor Model Context Protocol (MCP) em TypeScript que permita a agentes de IA consultar, criar e atualizar tarefas operacionais do Election Ops Platform utilizando a API HTTP existente.

O servidor deve operar como adaptador da aplicação, sem acessar diretamente o banco de dados ou duplicar regras de negócio.

## 2. Arquitetura

O servidor MCP utilizará transporte stdio e o SDK oficial do Model Context Protocol.

Fluxo:

Agente de IA → MCP Server → API NestJS → serviços da Central de Tarefas → PostgreSQL.

O servidor deverá:

- Utilizar endpoints existentes sob `/api/tasks`.
- Validar entradas antes de chamar a API.
- Encaminhar autenticação Bearer.
- Respeitar permissões e regras de negócio.
- Retornar resultados estruturados e erros compreensíveis.
- Utilizar stderr para diagnósticos, preservando stdout para o protocolo MCP.

## 3. Ferramentas MCP

### 3.1 listar_tarefas

**Tipo:** Leitura.

**Quando usar:** Quando o agente precisar consultar tarefas operacionais, identificar pendências ou pesquisar tarefas por filtros.

Endpoint: `GET /api/tasks`.

A ferramenta deve aceitar somente filtros efetivamente suportados pela API, incluindo eleição, status e prioridade quando disponíveis.

Permissão exigida: `tasks.read`.

### 3.2 consultar_tarefa

**Tipo:** Leitura.

**Quando usar:** Quando o agente precisar verificar detalhes ou confirmar o estado de uma tarefa identificada.

Endpoint: `GET /api/tasks/:id`.

Entrada obrigatória: identificador da tarefa.

Permissão exigida: `tasks.read`.

### 3.3 criar_tarefa

**Tipo:** Escrita.

**Quando usar:** Quando o usuário solicitar explicitamente o cadastro de uma nova tarefa operacional.

Endpoint: `POST /api/tasks`.

Entradas obrigatórias: `title` e `electionId`.

O título deve respeitar a validação da API, incluindo comprimento de 2 a 180 caracteres.

Outros campos devem seguir o DTO existente, sem inventar propriedades.

Permissão exigida: `tasks.manage`.

### 3.4 atualizar_tarefa

**Tipo:** Escrita.

**Quando usar:** Quando o usuário solicitar alteração de uma tarefa existente, como status, prioridade ou responsável.

Endpoint: `PATCH /api/tasks/:id`.

Entrada obrigatória: identificador da tarefa e pelo menos um campo alterável.

As alterações devem seguir os DTOs e transições permitidas pela API.

Permissão exigida: `tasks.manage`.

## 4. Autenticação e segurança

- A API deverá ser acessada com `Authorization: Bearer <token>`.
- Tokens e credenciais não poderão ser versionados.
- A URL da API e o token deverão ser configuráveis por variáveis de ambiente.
- O MCP não poderá contornar autenticação ou RBAC.
- Erros HTTP 401, 403, 404 e de validação deverão ser tratados adequadamente.
- Não serão implementadas operações destrutivas.
- Dados sensíveis não deverão ser incluídos em logs.

## 5. Configuração do agente

A configuração do servidor deverá ser versionada no formato suportado pelo agente utilizado.

Para GitHub Copilot no VS Code, utilizar a configuração de workspace apropriada, como `.vscode/mcp.json`.

Se for utilizado Claude Code, poderá ser necessário `.mcp.json`.

A política de execução deverá distinguir:

- Leitura: aprovação automática (`allow`).
- Escrita: aprovação explícita (`ask`).

As permissões devem utilizar os mecanismos reais do agente. Não deverão ser simuladas no servidor nem declaradas em campos incompatíveis.

## 6. Requisitos de integração

- Reutilizar a API NestJS existente.
- Não acessar Prisma diretamente.
- Não modificar migrations.
- Não duplicar entidades ou DTOs de domínio.
- Não criar endpoints alternativos.
- Não executar escritas sem solicitação e autorização.
- Respeitar o isolamento entre eleições implementado pela aplicação.

## 7. Testes

Deverão existir testes para:

1. Registro e descoberta das quatro tools.
2. Validação dos parâmetros obrigatórios.
3. Requisições HTTP correspondentes.
4. Encaminhamento da autenticação.
5. Tratamento de falhas HTTP e de conexão.
6. Comportamento de leitura e escrita.
7. Integração real com a API, quando o ambiente estiver disponível.

## 8. Critérios de aceite

A implementação será considerada concluída quando:

- O servidor MCP iniciar corretamente.
- O agente descobrir pelo menos três tools.
- Existir pelo menos uma tool de leitura e uma de escrita.
- As quatro ferramentas previstas estiverem disponíveis.
- O agente conseguir consultar dados reais da aplicação.
- O agente conseguir criar uma tarefa mediante aprovação.
- O agente conseguir consultar a tarefa criada.
- As permissões de leitura e escrita forem verificadas.
- O diário da atividade registrar a execução observada.

## 9. Demonstração

Solicitar ao agente:

"Consulte as tarefas da eleição, identifique pendências e crie uma tarefa de verificação de conectividade com prioridade alta. Depois consulte a tarefa criada para confirmar o cadastro."

A demonstração deverá registrar as tools efetivamente utilizadas, seus resultados e eventuais erros.

## 10. Diário e tríade

Registrar a atividade em `diario/2026-10-08.md`.

O diário deverá documentar as ferramentas escolhidas pelo agente, erros encontrados, correções e evidências.

O MCP amplia a perna de **ferramentas** da tríade modelo–ferramentas–contexto, permitindo ao agente executar operações reais na aplicação.