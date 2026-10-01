# Checklist de Preparação

## 1. Objetivo

O módulo Checklist de Preparação tem como objetivo controlar a preparação operacional dos locais antes do início da operação eleitoral.

O sistema deve permitir a criação de modelos de checklist, aplicação desses modelos aos locais de votação, acompanhamento do progresso, registro de evidências e aprovação final do local.

## 2. Escopo

O módulo deve permitir:

- criar templates de checklist;
- definir o tipo de local ao qual o template se aplica;
- cadastrar itens obrigatórios e opcionais;
- gerar um checklist para um local de votação;
- atribuir responsável ao checklist;
- atribuir responsável a itens individuais;
- acompanhar o andamento dos itens;
- registrar observações;
- registrar evidências;
- visualizar pendências;
- calcular o progresso do checklist;
- bloquear aprovação quando existirem itens obrigatórios pendentes ou bloqueados;
- aprovar um local preparado;
- registrar responsável e data da aprovação;
- manter histórico das principais alterações;
- filtrar checklists.

## 3. Estados

### Checklist

- `PENDING`
- `IN_PROGRESS`
- `READY_FOR_APPROVAL`
- `APPROVED`
- `BLOCKED`

### Item

- `PENDING`
- `IN_PROGRESS`
- `COMPLETED`
- `BLOCKED`

## 4. Template

Um template possui:

- nome;
- descrição;
- tipo de local;
- status ativo/inativo;
- itens.

Cada item do template possui:

- título;
- descrição opcional;
- ordem;
- indicação se é obrigatório;
- indicação se exige evidência.

## 5. Checklist do local

Cada checklist deve estar associado a:

- pleito;
- zona eleitoral;
- local de votação;
- template utilizado;
- responsável;
- status;
- progresso;
- data de criação;
- data da aprovação;
- responsável pela aprovação.

A zona deve ser compatível com o local e o pleito informado.

## 6. Itens do checklist

Quando um checklist for criado a partir de um template, os itens do template devem ser copiados para o checklist.

Cada item deve permitir:

- alteração de status;
- responsável;
- observação;
- evidência;
- data de conclusão.

A alteração posterior de um template não deve modificar checklists já iniciados.

## 7. Evidências

Um item pode possuir evidências.

Nesta primeira versão, uma evidência pode ser representada por:

- descrição;
- URL;
- data de registro;
- responsável pelo registro.

Itens configurados com exigência de evidência não podem ser considerados concluídos sem pelo menos uma evidência.

## 8. Progresso

O progresso deve ser calculado automaticamente.

O percentual corresponde à quantidade de itens concluídos em relação ao total de itens.

Exemplo:

10 itens
8 concluídos

Progresso = 80%

O progresso não deve ser informado manualmente.

## 9. Aprovação

Um checklist somente poderá ser aprovado quando:

- todos os itens obrigatórios estiverem concluídos;
- nenhum item obrigatório estiver bloqueado;
- itens que exigem evidência possuírem evidência;
- o checklist possuir responsável.

Ao aprovar, registrar:

- usuário responsável pela aprovação;
- data e hora da aprovação.

Um checklist aprovado não poderá ter seus itens alterados sem que sua aprovação seja revogada.

## 10. Pendências

A aplicação deve apresentar:

- total de itens;
- itens concluídos;
- itens pendentes;
- itens bloqueados;
- itens obrigatórios pendentes;
- percentual de progresso.

## 11. Filtros

A listagem deve permitir filtros por:

- pleito;
- zona eleitoral;
- local de votação;
- responsável;
- status.

## 12. Dashboard

A página principal do plugin deve apresentar:

- total de checklists;
- locais aprovados;
- locais aguardando aprovação;
- locais bloqueados;
- progresso médio;
- checklists com pendências críticas.

## 13. Interface

O plugin deve possuir as páginas:

### Dashboard

Visão consolidada da preparação.

### Checklists

Listagem dos checklists existentes.

### Novo Checklist

Criação de checklist para um local.

### Detalhes do Checklist

Exibição do progresso e dos itens.

Deve permitir atualizar itens, adicionar evidências e aprovar o local.

### Templates

Gerenciamento dos templates e seus itens.

## 14. RBAC

Criar as permissões:

- `preparation-checklists.read`
- `preparation-checklists.manage`
- `preparation-checklists.approve`

Usuários com `read` podem consultar.

Usuários com `manage` podem criar templates, checklists, atualizar itens e registrar evidências.

Usuários com `approve` podem realizar a aprovação final.

## 15. API

O backend deve disponibilizar endpoints para:

- dashboard;
- listar templates;
- criar template;
- consultar template;
- criar itens de template;
- listar checklists;
- criar checklist;
- consultar checklist;
- atualizar item;
- adicionar evidência;
- aprovar checklist;
- revogar aprovação;
- consultar referências de pleitos, zonas e locais.

## 16. Integração

O módulo utilizará os IDs das entidades já existentes:

- Election;
- ElectoralZone;
- PollingPlace;
- User.

Não deve importar services ou implementação interna dos respectivos plugins.

As relações persistentes serão realizadas pelo schema Prisma central.

## 17. Eventos

O plugin deve publicar:

### `preparation_checklist.approved`

Quando um local for aprovado.

Dados mínimos:

- checklistId;
- electionId;
- electoralZoneId;
- pollingPlaceId;
- approvedBy;
- approvedAt.

### `preparation_checklist.blocked`

Quando uma pendência colocar o checklist em situação bloqueada.

Dados mínimos:

- checklistId;
- electionId;
- pollingPlaceId;
- reason.

## 18. Histórico

As principais operações devem possuir histórico:

- criação do checklist;
- alteração de item;
- registro de evidência;
- bloqueio;
- conclusão de item;
- aprovação;
- revogação da aprovação.

## 19. Critérios de aceitação

1. Deve ser possível criar um template com vários itens.
2. Um item pode ser obrigatório ou opcional.
3. Deve ser possível criar um checklist a partir de um template.
4. Os itens do template devem ser copiados para o checklist.
5. O checklist deve estar associado a um local existente.
6. O progresso deve ser calculado automaticamente.
7. Deve ser possível alterar o status de um item.
8. Deve ser possível registrar evidência.
9. Item que exige evidência não pode ser concluído sem evidência.
10. Checklist com item obrigatório pendente não pode ser aprovado.
11. Checklist com item obrigatório bloqueado não pode ser aprovado.
12. Uma aprovação deve registrar usuário e data.
13. Checklist aprovado não pode ser alterado sem revogar a aprovação.
14. Os filtros devem funcionar.
15. O dashboard deve refletir o estado atual dos checklists.
16. Usuários sem a permissão necessária não podem modificar ou aprovar checklists.

## 20. Testes mínimos

Devem existir testes para:

- cálculo de progresso;
- criação a partir de template;
- validação de local e pleito;
- conclusão de item com evidência obrigatória;
- tentativa inválida de aprovação;
- aprovação válida;
- bloqueio de alteração após aprovação;
- permissões principais.