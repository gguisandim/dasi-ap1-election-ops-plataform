# Shift Handover Operations

Status: Approved for implementation

## Contexto

A plataforma já possui turnos, equipes de campo, incidentes, tarefas, inventário, Event Bus, Audit e Notifications, mas não possui um contrato normativo nem uma implementação operacional para passagem de turno. A continuidade entre equipes depende de um registro explícito, rastreável e confirmado pelo destinatário.

Esta SPEC define a primeira implementação do plugin `shift-handovers`, preservando o ownership dos domínios existentes. O handover agrega referências e contexto; não altera diretamente turnos, incidentes, tarefas ou ativos.

## Estado atual

- `Shifts` é o owner do ciclo de vida e da escala dos turnos.
- `Field Teams` é o owner da estrutura, capacidades e disponibilidade da força de trabalho.
- Incidentes, tarefas e ativos possuem APIs e persistência próprias.
- Audit observa todos os Domain Events publicados pelo Event Bus.
- Notifications aplica RBAC e preferências persistidas aos eventos configuráveis.
- Não existe modelo, API, permissão, navegação ou frontend de passagem de turno.

## Problema

Sem handover formal, pendências, riscos e contexto operacional podem ser perdidos entre equipes. Também não há confirmação inequívoca de recebimento, histórico imutável das ações ou audiência direcionada para notificações.

## Objetivos

1. Criar um domínio explícito de passagem de turno.
2. Suportar preparação em rascunho, envio, confirmação e cancelamento controlado.
3. Associar incidentes, tarefas e ativos relevantes sem transferir seu ownership.
4. Fornecer contexto operacional e sugestões baseadas em dados reais.
5. Registrar histórico e Domain Events suficientes para auditoria.
6. Notificar somente participantes elegíveis, respeitando RBAC, atividade e preferências.
7. Entregar API e frontend completos com estados de loading, error, empty e success.

## Fora de escopo

- Alterar o lifecycle de Shifts, Incidents, Tasks ou Inventory.
- Fechar, resolver, atribuir ou editar entidades referenciadas pelo handover.
- Chat, assinatura digital, anexos, email, SMS, push, WebSocket ou broker externo.
- Aprovação multinível, handover automático ou geração por inteligência artificial.
- Reimplementar Audit ou criar lógica específica dentro do plugin Audit.

## Domain ownership

`Shift Handovers` é owner apenas de:

- conteúdo narrativo da passagem;
- remetente e destinatário;
- referências escolhidas para incidentes, tarefas e ativos;
- lifecycle do handover;
- confirmação e cancelamento;
- histórico das mudanças do handover.

`Shifts`, `Incidents`, `Tasks`, `Inventory` e `Field Teams` continuam owners exclusivos de seus respectivos dados. O plugin não importa implementações internas desses workspaces.

## Plugin e entrypoints

O plugin fica em `plugins/operations/shift-handovers`, com package público `@eops/plugin-shift-handovers` e entrypoint server público `@eops/plugin-shift-handovers/server`. A composição permanece estática em `apps/api` e `apps/web`.

## Persistência

### ShiftHandover

Campos mínimos:

- `id`;
- `shiftId`;
- `senderUserId`;
- `recipientUserId`;
- `summary`;
- `pendingNotes` e `observations` opcionais;
- `status`;
- `submittedAt`, `confirmedAt`, `confirmedById`;
- `cancelledAt`, `cancelledById`, `cancellationReason`;
- `createdAt` e `updatedAt`.

Estados:

- `DRAFT`;
- `PENDING_CONFIRMATION`;
- `CONFIRMED`;
- `CANCELLED`.

### Referências

As associações com incidentes, tarefas e ativos usam tabelas de junção com chave composta. A associação não copia objetos Prisma, não altera a entidade referenciada e preserva o registro mesmo após a confirmação.

### Histórico

Cada criação, edição, inclusão/remoção de referência, envio, confirmação e cancelamento gera item de histórico com ator, ação, timestamp e metadata mínima. O histórico não é sobrescrito.

### Índices

Devem existir índices adequados para:

- status e criação;
- destinatário e status;
- remetente e criação;
- turno e criação;
- data de envio;
- referências por entidade.

## Lifecycle

Transições válidas:

```text
DRAFT -> PENDING_CONFIRMATION -> CONFIRMED
  |              |
  +-----------> CANCELLED
```

`CONFIRMED` e `CANCELLED` são terminais. Transições inválidas retornam erro claro.

## Criação e edição

- O remetente é sempre derivado da sessão autenticada; nunca é aceito arbitrariamente do frontend.
- O destinatário deve existir, estar ativo e ser diferente do remetente.
- A criação produz `DRAFT`.
- Somente o remetente com `shift-handovers.manage` pode editar um rascunho.
- Alterações em referências são calculadas e registradas no histórico sem apagar eventos anteriores.

## Compatibilidade das referências

- Incidente e tarefa devem pertencer à mesma eleição do turno.
- Quando turno e referência possuírem zona, zonas divergentes são rejeitadas.
- Quando turno e referência possuírem local de votação, locais divergentes são rejeitados.
- Ativos não possuem eleição obrigatória; sua compatibilidade usa zona e local quando ambos os lados tiverem esses dados.
- IDs inexistentes ou incompatíveis são rejeitados com erro identificável.

## Contexto operacional

O endpoint de contexto retorna somente dados reais e não associa sugestões automaticamente.

- Incidentes: mesma eleição, exceto fechados/cancelados; prioridade por localização, severidade e SLA. Resolvidos podem aparecer com prioridade reduzida quando ainda relevantes.
- Tarefas: mesma eleição e estado `PENDING`, `IN_PROGRESS` ou `BLOCKED`; prioridade para bloqueadas, vencidas e de maior prioridade.
- Ativos: itens com condição/status operacional problemático, manutenção ativa, custódia problemática ou prazo relevante; prioridade para a mesma localização.
- Destinatários: somente usuários ativos.

## Envio

Somente o remetente com `shift-handovers.manage` pode enviar. O envio exige:

- estado `DRAFT`;
- turno `IN_PROGRESS` ou `COMPLETED`;
- resumo não vazio;
- destinatário ainda ativo;
- referências ainda existentes e compatíveis.

O envio define `PENDING_CONFIRMATION` e `submittedAt`.

## Confirmação

Somente o destinatário autenticado com `shift-handovers.confirm` pode confirmar um handover pendente. A confirmação define `CONFIRMED`, `confirmedAt` e `confirmedById`. Confirmação duplicada ou por outro usuário é rejeitada.

## Cancelamento

- Rascunhos podem ser cancelados pelo remetente com permissão de gestão.
- Handovers pendentes podem ser cancelados pelo remetente, com motivo obrigatório.
- Handovers confirmados não podem ser cancelados.
- O cancelamento preserva conteúdo, referências e histórico.

## Ações disponíveis

As respostas de detalhe devem expor `availableActions`, calculadas no backend a partir de status, identidade e permissões da sessão. O frontend não exibe ações que necessariamente seriam rejeitadas.

## API

Rotas públicas sob `/shift-handovers`:

- `GET /dashboard`;
- `GET /` com filtros e paginação;
- `GET /context`;
- `GET /:id`;
- `POST /`;
- `PATCH /:id`;
- `POST /:id/submit`;
- `POST /:id/confirm`;
- `POST /:id/cancel`.

Filtros da listagem: `shiftId`, `status`, `senderUserId`, `recipientUserId`, `electionId`, `from`, `to`, `page` e `pageSize`. A resposta usa o contrato paginado da plataforma.

## Dashboard

O dashboard apresenta apenas métricas calculáveis:

- rascunhos do usuário;
- aguardando confirmação;
- aguardando minha confirmação;
- confirmados hoje;
- handovers recentes.

## RBAC

Permissões públicas:

- `shift-handovers.read`;
- `shift-handovers.manage`;
- `shift-handovers.confirm`.

Política inicial:

- Administrador: todas;
- Supervisor: todas;
- Operador: leitura, gestão e confirmação;
- Técnico: leitura e confirmação;
- Visualizador: leitura.

As permissões são persistidas pelo mecanismo RBAC existente. Mutação sempre valida a permissão e as regras de participante.

## Domain Events

Eventos mínimos:

- `shift_handover.created`;
- `shift_handover.updated`;
- `shift_handover.submitted`;
- `shift_handover.confirmed`;
- `shift_handover.cancelled`.

Payloads incluem apenas dados necessários, como `entityId`, `actorId`, `shiftId`, `senderUserId`, `recipientUserId`, `from`, `to` e `reason` quando aplicável. Objetos Prisma completos não são publicados.

## Audit

Audit recebe os eventos através do `subscribeAll` já existente. Não há import ou regra específica do plugin Shift Handovers em Audit. O nome, ator, entidade, transição e metadata do evento devem ser suficientes para reconstruir a ação.

## Notifications

São configuráveis e notificáveis:

- `shift_handover.submitted`: somente o destinatário;
- `shift_handover.confirmed`: somente o remetente;
- `shift_handover.cancelled`: a contraparte relevante, distinta do ator, quando houver.

Destinatários devem estar ativos, possuir `shift-handovers.read` e não ter desabilitado o evento. Não existe broadcast do handover. Título e mensagem não expõem dados sensíveis.

## Frontend

Rotas:

- `/shift-handovers` — dashboard;
- `/shift-handovers/list` — listagem e filtros;
- `/shift-handovers/new` — criação;
- `/shift-handovers/:id` — detalhe, histórico e confirmação;
- `/shift-handovers/:id/edit` — edição de rascunho.

O plugin usa `@eops/ui`, tokens globais e o shell existente. Todas as páginas novas tratam loading, error, empty e success. Referências confiáveis oferecem deep links para turnos, incidentes, tarefas e inventário. Tabelas e agrupamentos usam overflow controlado em telas pequenas e mantêm ações principais acessíveis.

## Migração e compatibilidade

- Alterações de schema usam nova migration; migrations históricas não são editadas.
- A migration não será aplicada automaticamente em banco remoto.
- A ausência da migration no banco de runtime deve ser informada no handoff.
- Não há contrato legado de handover a preservar.

## Testes

A cobertura deve priorizar 12 a 20 testes novos de alto valor, incluindo:

- lifecycle válido e transições inválidas;
- ator derivado da sessão;
- destinatário ativo e diferente do remetente;
- compatibilidade de referências;
- envio, confirmação, confirmação duplicada e cancelamento;
- autorização e ações disponíveis;
- paginação/filtros/dashboard/contexto;
- Domain Events;
- audiência direcionada, usuário inativo e preferência desabilitada.

## Validação

```bash
npm run spec:check
npm run check:boundaries
npm run typecheck
npm run lint
npm test
npm run build
npm run db:validate
git diff --check
```

Também devem ser executados testes focados do plugin e de Notifications, contagem LOC e `scripts/check-ap1.ps1` quando aplicável. O status de migrations deve ser relatado separadamente da validade do schema.

## Critérios de aceite

- **AC-01** Existe plugin público `shift-handovers` registrado no backend e frontend.
- **AC-02** O domínio possui ownership limitado ao handover e não muta entidades referenciadas.
- **AC-03** O remetente é sempre obtido da sessão autenticada.
- **AC-04** O destinatário deve estar ativo e ser diferente do remetente.
- **AC-05** O lifecycle implementa somente as transições definidas.
- **AC-06** Apenas rascunhos podem ser editados.
- **AC-07** O envio valida turno, conteúdo, destinatário e referências.
- **AC-08** Apenas o destinatário autorizado confirma.
- **AC-09** Confirmação duplicada é rejeitada.
- **AC-10** Cancelamento pendente exige motivo e confirmação é terminal.
- **AC-11** Histórico preserva ações e atores sem sobrescrita.
- **AC-12** Incidentes associados são validados por eleição e localização.
- **AC-13** Tarefas associadas são validadas por eleição e localização.
- **AC-14** Ativos associados são validados pela localização disponível.
- **AC-15** Sugestões de contexto não são associadas automaticamente.
- **AC-16** A listagem possui filtros e paginação.
- **AC-17** O dashboard usa métricas calculadas de dados reais.
- **AC-18** A API retorna ações disponíveis calculadas no backend.
- **AC-19** RBAC inclui leitura, gestão e confirmação.
- **AC-20** Perfis padrão recebem permissões coerentes com esta SPEC.
- **AC-21** Mutações relevantes publicam Domain Events tipados.
- **AC-22** Payloads de eventos não incluem objetos Prisma completos.
- **AC-23** Audit observa os eventos pela infraestrutura global existente.
- **AC-24** Notifications usa audiência direcionada, RBAC, atividade e preferências.
- **AC-25** O evento enviado notifica apenas o destinatário elegível.
- **AC-26** O evento confirmado notifica apenas o remetente elegível.
- **AC-27** O frontend possui dashboard, lista, criação, edição e detalhe funcionais.
- **AC-28** O frontend trata loading, error, empty e success.
- **AC-29** Deep links são criados somente para rotas públicas confiáveis.
- **AC-30** A interface permanece responsiva em 1440px, 1024px e até 760px.
- **AC-31** Nenhum import interno cross-plugin é criado.
- **AC-32** Uma nova migration representa toda alteração de schema.
- **AC-33** Migrations históricas permanecem inalteradas.
- **AC-34** Testes de alto valor cobrem lifecycle, RBAC, referências, eventos e notificações.
- **AC-35** Documentação e handoff registram limites, validações e estado da migration.
