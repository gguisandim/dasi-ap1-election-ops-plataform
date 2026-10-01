# Comunicações Operacionais — especificação

- **Data:** 2026-10-01
- **Status:** escrita antes do código de implementação
- **Plugin:** `plugins/operations/communications`
- **Categoria:** Operações

## O quê e por quê

### Problema

A plataforma já acompanha estrutura eleitoral, incidentes, logística e transmissão, mas não possui um canal formal para **comunicados oficiais**. Na prática operacional, avisos como "transmissão da Zona 76 será retomada às 18h" ou "todos os locais devem confirmar o checklist de energia" circulam por telefone, rádio e grupos informais. Isso gera três problemas:

1. **sem rastro** — não há registro auditável de quem foi avisado, quando e se confirmou;
2. **sem priorização** — um comunicado crítico concorre visualmente com um aviso trivial;
3. **sem direcionamento** — mensagens são enviadas para todos ou para ninguém.

### Motivação

Centralizar comunicados operacionais, com direcionamento explícito (todos, zona, local, equipe, função ou usuário), prioridade, ciclo de vida controlado e confirmação de leitura auditável.

### Usuários

| Perfil | Necessidade |
| --- | --- |
| Coordenação de operações | Redigir, aprovar e publicar comunicados direcionados |
| Supervisão de zona | Acompanhar leitura e confirmação da sua zona |
| Operador/técnico de campo | Receber, ler e confirmar comunicados |
| Auditoria | Reconstruir quem recebeu, leu e confirmou cada comunicado |

### Valor operacional

- Um comunicado crítico passa a ter indicador de confirmação, permitindo escalar quem não confirmou.
- O histórico de leitura alimenta a timeline global do Centro de Comando.
- Templates reduzem o tempo de redação de comunicados recorrentes (abertura de turno, falha de energia, retomada de transmissão).

## Critérios de aceitação

1. É possível criar um comunicado em rascunho com título, conteúdo, prioridade, categoria, tags, pleito e observações.
2. É possível direcionar um comunicado para: todos, uma ou mais zonas, um ou mais locais, uma ou mais equipes, uma ou mais funções operacionais e um ou mais usuários — de forma combinada.
3. Publicar um comunicado materializa a lista de destinatários e registra o evento `PUBLISHED` na timeline.
4. `HIGH` e `CRITICAL` aparecem com destaque visual distinto em tabelas, cards e dashboard, e possuem filtro dedicado.
5. Todo destinatário possui estado `PENDING`, `DELIVERED`, `VIEWED` ou `CONFIRMED`, com carimbo de data em cada transição.
6. O detalhe de um comunicado exibe indicadores de total, entregues, lidos, confirmados e pendentes, além das taxas de leitura e confirmação.
7. A timeline registra criação, edição, agendamento, publicação, envio, leitura, confirmação, expiração, arquivamento e cancelamento.
8. Templates reutilizáveis podem ser cadastrados, listados, editados, ativados/inativados e aplicados no formulário de novo comunicado.
9. Um comunicado `PUBLISHED` cujo `expiresAt` já passou é considerado expirado de forma determinística.
10. Nenhum plugin importa implementação interna de outro plugin; a integração com Notificações ocorre exclusivamente pelo Event Bus.
11. `npm run check:boundaries`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` e `npm run db:validate` passam.

## Fora do escopo

- Envio real de e-mail, SMS, push ou WhatsApp. O canal externo não existe neste projeto; a confirmação é registrada pela própria plataforma.
- Anexos e evidências em comunicados (pertencem ao plugin Documentos e Evidências).
- Editor rich-text. O corpo do comunicado é texto puro com quebras de linha preservadas.
- Aprovação em múltiplos níveis / workflow de revisão. `DRAFT → SCHEDULED|PUBLISHED` é decidido por quem tem `communications.publish`.
- Tradução automática, enquetes, respostas encadeadas (threads) ou chat em tempo real.
- Recorrência automática de comunicados.

## Domínio

### Entidades

| Entidade | Papel |
| --- | --- |
| `Communication` | Comunicado: título, conteúdo, prioridade, status, categoria, tags, pleito, ciclo de vida |
| `CommunicationCategory` | Categoria cadastrável (conectividade, energia, logística, transmissão…) |
| `CommunicationTag` | Etiqueta livre reutilizável |
| `CommunicationTagLink` | Relação N:N entre comunicado e etiqueta |
| `CommunicationAudience` | Regra de direcionamento tipada, apontando para zona, local, equipe, função ou usuário |
| `CommunicationRecipient` | Destinatário materializado, com estado de entrega/leitura/confirmação |
| `CommunicationTemplate` | Modelo reutilizável de comunicado |
| `CommunicationEvent` | Evento de timeline do comunicado |

### Enums

- `CommunicationPriority`: `LOW`, `NORMAL`, `HIGH`, `CRITICAL`
- `CommunicationStatus`: `DRAFT`, `SCHEDULED`, `PUBLISHED`, `EXPIRED`, `ARCHIVED`, `CANCELLED`
- `CommunicationAudienceType`: `ALL`, `ELECTORAL_ZONE`, `POLLING_PLACE`, `FIELD_TEAM`, `OPERATIONAL_ROLE`, `USER`
- `CommunicationDeliveryStatus`: `PENDING`, `DELIVERED`, `VIEWED`, `CONFIRMED`
- `CommunicationEventType`: `CREATED`, `UPDATED`, `SCHEDULED`, `PUBLISHED`, `DISPATCHED`, `RECIPIENTS_SYNCED`, `VIEWED`, `CONFIRMED`, `EXPIRED`, `ARCHIVED`, `CANCELLED`

### Regras de negócio

1. **Transições de status** (determinísticas):
   - `DRAFT → SCHEDULED | PUBLISHED | CANCELLED`
   - `SCHEDULED → PUBLISHED | DRAFT | CANCELLED`
   - `PUBLISHED → EXPIRED | ARCHIVED | CANCELLED`
   - `EXPIRED → ARCHIVED | CANCELLED`
   - `ARCHIVED → ∅` (terminal), `CANCELLED → ∅` (terminal)
2. **Publicação**: exige ao menos uma regra de audiência; materializa destinatários; preenche `publishedAt`; publicar duas vezes é idempotente.
3. **Código**: `COM-00001`, sequencial, único.
4. **Expiração**: derivada — `status = PUBLISHED` e `expiresAt < agora` ⇒ `EXPIRED`. Não há job agendado: a expiração é aplicada na leitura (`expireOverdue`), mantendo o comportamento determinístico e testável.
5. **Direcionamento**: cada linha de `CommunicationAudience` deve preencher exatamente o alvo correspondente ao seu `type`; a validação rejeita linhas inconsistentes.
6. **Resolução de destinatários** (explicável, sem IA):
   - `ALL` → todos os usuários ativos da plataforma.
   - `USER` → o usuário indicado.
   - `OPERATIONAL_ROLE` → usuários cujo perfil (`Role.key`) coincide com a função.
   - `FIELD_TEAM` → membros da equipe.
   - `ELECTORAL_ZONE` → membros de campo com escala ou alocação não encerrada na zona.
   - `POLLING_PLACE` → membros de campo com escala ou alocação não encerrada no local.
   - Destinatários são deduplicados por `dedupeKey` (`user:<id>` para usuários da plataforma; `<audienceId>:member:<memberId>` para membros de campo).
7. **Confirmação**: só é possível confirmar um comunicado `PUBLISHED` do qual o usuário autenticado é destinatário. Confirmar implica `VIEWED` e `DELIVERED` anteriores.
8. **Exclusão**: comunicados publicados não são apagados — apenas arquivados/cancelados. Rascunhos podem ser excluídos.

## Interface

| Página | Rota | Conteúdo |
| --- | --- | --- |
| Painel | `/communications` | Cards de publicados, prioritários, pendentes, taxa de leitura e de confirmação; comunicados prioritários; últimos publicados |
| Comunicados | `/communications/messages` | Tabela filtrável (status, prioridade, categoria, pleito, tag, período, busca) com paginação |
| Novo/editar comunicado | `/communications/messages/new`, `/communications/messages/:id/edit` | Formulário com editor de audiência, tags, agendamento e aplicação de template |
| Detalhe | `/communications/messages/:id` | Conteúdo, metadados, audiências, indicadores e ações de ciclo de vida |
| Acompanhamento de leitura | `/communications/messages/:id/tracking` | Tabela de destinatários filtrável por estado, com confirmação manual de leitura |
| Templates | `/communications/templates` | Lista, criação, edição e ativação de templates |
| Minha caixa | `/communications/inbox` | Comunicados publicados dirigidos ao usuário autenticado, com leitura e confirmação |

## Backend

### Endpoints

```text
GET    /communications                          lista paginada com filtros
GET    /communications/dashboard                indicadores do painel
GET    /communications/pending                  comunicados pendentes do usuário autenticado
GET    /communications/categories               lista de categorias
POST   /communications/categories               cria categoria
PATCH  /communications/categories/:id           atualiza categoria
GET    /communications/tags                     lista de etiquetas
POST   /communications/tags                     cria etiqueta
GET    /communications/templates                lista templates
POST   /communications/templates                cria template
PATCH  /communications/templates/:id            atualiza template
DELETE /communications/templates/:id            remove template
GET    /communications/:id                      detalhe
GET    /communications/:id/metrics              indicadores do comunicado
GET    /communications/:id/timeline             timeline
GET    /communications/:id/recipients           destinatários paginados
POST   /communications/:id/recipients/sync      rematerializa destinatários
POST   /communications/:id/recipients/:recipientId/read        marca leitura
POST   /communications/:id/recipients/:recipientId/confirm     confirma leitura
POST   /communications                           cria comunicado
PATCH  /communications/:id                      atualiza comunicado
POST   /communications/:id/publish              publica
POST   /communications/:id/schedule             agenda
POST   /communications/:id/cancel               cancela
POST   /communications/:id/archive              arquiva
PUT    /communications/:id/audiences            substitui as regras de direcionamento
DELETE /communications/:id                      exclui rascunho
```

## Eventos

| Evento | Quando |
| --- | --- |
| `communication.created` | Comunicado criado |
| `communication.published` | Comunicado publicado, com contagem de destinatários |
| `communication.cancelled` | Comunicado cancelado |
| `communication.expired` | Expiração detectada na leitura |
| `communication.read` | Destinatário marca leitura |
| `communication.acknowledged` | Destinatário confirma leitura |
| `communication.archived` | Comunicado arquivado |

Consumidos por Auditoria e Notificações via Event Bus. Nenhum import direto entre plugins.

## Permissões

| Permissão | Uso |
| --- | --- |
| `communications.read` | Consultar painel, listas, detalhes, templates e a própria caixa |
| `communications.manage` | Criar/editar comunicados, categorias, tags e templates; excluir rascunho |
| `communications.publish` | Publicar, agendar, cancelar e arquivar; rematerializar destinatários |

## LOC / completude

A implementação segue a orientação de profundidade do projeto: serviços de backend separados por responsabilidade (CRUD, destinatários, métricas, templates, timeline), DTOs com validação real, helpers testáveis, componentes de UI reutilizáveis, CSS Module próprio e testes das regras críticas — sem código morto, duplicação artificial ou arquivos vazios.
