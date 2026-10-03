# Preparation Checklists

**Data:** 2026-10-03
**Status:** Implementado
**Plugin:** `plugins/operations/preparation-checklists`

## 1. Objetivo

Disponibilizar um módulo operacional para criação, acompanhamento e validação de checklists de preparação da operação eleitoral.

O módulo deve permitir que a coordenação acompanhe o nível de preparação antes e durante a operação, mantendo histórico, responsáveis, evidências e estados de execução sem acoplar sua implementação aos demais plugins.

## 2. Escopo

O módulo contempla:

- dashboard de preparação;
- criação e gerenciamento de templates;
- criação de checklists a partir de templates;
- itens de checklist;
- atribuição de responsáveis;
- atualização do estado dos itens;
- anexação/vinculação de evidências;
- aprovação do checklist;
- revogação de aprovação;
- visualização detalhada;
- acompanhamento de status e progresso;
- navegação própria do plugin;
- integração com RBAC, auditoria e notificações quando aplicável.

## 3. Estrutura

Frontend:

```text
plugins/operations/preparation-checklists/src/client
```

Backend:

```text
plugins/operations/preparation-checklists/src/server
```

Contratos e tipos:

```text
plugins/operations/preparation-checklists/src/types.ts
```

Manifest:

```text
plugins/operations/preparation-checklists/src/manifest.ts
```

Migration:

```text
packages/database/prisma/migrations/
202610010004_preparation_checklists/migration.sql
```

## 4. Funcionalidades

### 4.1 Dashboard

O módulo deve possuir uma visão resumida da preparação operacional.

A página deve permitir visualizar indicadores derivados dos checklists existentes sem depender de dados hardcoded.

Endpoint:

```http
GET /api/preparation-checklists/dashboard
```

### 4.2 Templates

Deve ser possível:

- listar templates;
- visualizar template;
- criar template;
- atualizar template;
- adicionar itens.

Endpoints:

```http
GET   /api/preparation-checklists/templates
GET   /api/preparation-checklists/templates/:id
POST  /api/preparation-checklists/templates
PATCH /api/preparation-checklists/templates/:id
POST  /api/preparation-checklists/templates/:id/items
```

### 4.3 Checklists

Deve ser possível:

- listar checklists;
- abrir detalhes;
- criar checklist;
- definir ou alterar responsável;
- atualizar itens individualmente.

Endpoints:

```http
GET   /api/preparation-checklists
GET   /api/preparation-checklists/:id
POST  /api/preparation-checklists
PATCH /api/preparation-checklists/:id/assignee
PATCH /api/preparation-checklists/items/:itemId
```

### 4.4 Evidências

Itens devem poder receber evidências quando necessário.

Endpoint:

```http
POST /api/preparation-checklists/items/:itemId/evidences
```

O módulo não deve implementar armazenamento de evidências internamente caso essa responsabilidade pertença a outro domínio.

A integração deve ocorrer por contrato público.

### 4.5 Aprovação

Um checklist deve poder ser aprovado quando cumprir as condições definidas pelo domínio.

Também deve existir possibilidade de revogação de aprovação.

Endpoints:

```http
POST /api/preparation-checklists/:id/approve
POST /api/preparation-checklists/:id/revoke-approval
```

## 5. Referências

O módulo pode consumir dados de referência necessários através de endpoint próprio:

```http
GET /api/preparation-checklists/references
```

Isso evita que o frontend precise importar implementações internas de outros plugins.

## 6. Isolamento

É proibido:

```text
preparation-checklists → outro-plugin/src/**
```

Integrações devem ocorrer por:

- API;
- contratos compartilhados;
- Event Bus;
- identificadores persistidos.

O módulo deve continuar registrável através de seu manifest e dos pontos centrais de composição da plataforma.

## 7. RBAC

A visualização e as ações do módulo devem respeitar as permissões cadastradas em:

```text
packages/security
```

A interface não deve apenas esconder ações: o backend também deve validar autorização.

## 8. Auditoria

Operações relevantes devem poder gerar eventos auditáveis, especialmente:

- criação;
- atualização;
- atribuição;
- alteração de item;
- aprovação;
- revogação.

A integração deve utilizar a infraestrutura compartilhada da plataforma, sem import direto do plugin de auditoria.

## 9. Notificações e eventos

Eventos relevantes podem ser publicados no Event Bus para consumo por notificações ou outros módulos.

Não criar dependência direta entre:

```text
preparation-checklists
notifications
audit
```

## 10. Interface

O módulo deve utilizar sua própria navegação e CSS Module.

Arquivos visuais permanecem dentro de:

```text
plugins/operations/preparation-checklists/src/client
```

O shell global não deve receber regras de UI específicas do checklist.

## 11. Critérios de aceite

A implementação é considerada válida quando:

- dashboard carrega através de API real;
- templates podem ser listados e manipulados;
- checklists podem ser criados e visualizados;
- itens podem ser atualizados;
- responsável pode ser atribuído;
- evidências podem ser relacionadas;
- aprovação e revogação funcionam;
- RBAC é respeitado;
- o plugin permanece isolado;
- testes do serviço passam;
- typecheck passa;
- build passa;
- `check:boundaries` passa.

## 12. Fora de escopo

Esta SPEC não exige:

- redesign completo do shell;
- implementação interna de evidências;
- alterações em plugins sem relação direta;
- centralização das regras do checklist em `apps/web` ou `apps/api`.

## 13. Arquivos principais

```text
plugins/operations/preparation-checklists/**
docs/modules/preparation-checklist.md
packages/database/prisma/migrations/202610010004_preparation_checklists/migration.sql
```

Arquivos compartilhados podem ser modificados somente para registro, contratos, permissões ou integração necessária.
