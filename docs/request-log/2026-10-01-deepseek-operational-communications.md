# Comunicações Operacionais — 2026-10-01

Etapa 1 de 6 da expansão de plugins operacionais da AP1.

## Prompt resumido

Criar o plugin **Comunicações Operacionais**: centralizar comunicados oficiais e
mensagens internas da operação eleitoral, com prioridade (`LOW`/`NORMAL`/`HIGH`/
`CRITICAL`), ciclo de vida (`DRAFT`/`SCHEDULED`/`PUBLISHED`/`EXPIRED`/`ARCHIVED`/
`CANCELLED`), direcionamento para todos, zonas, locais, equipes, funções
operacionais e usuários, confirmação de leitura auditável, destaque visual para
prioridades altas, timeline completa, templates reutilizáveis e dashboard de
indicadores — sem importar implementação interna de outros plugins.

## Implementado

- Plugin `plugins/operations/communications` (categoria Operações).
- Comunicado com título, conteúdo, prioridade, status, autor, pleito, categoria,
  observações, tags, agendamento, publicação, expiração, arquivamento e cancelamento.
- Direcionamento relacional tipado: `CommunicationAudience` com FK real para zona,
  local, equipe, função operacional e usuário — sem lista em JSON.
- Resolução determinística de destinatários a partir das regras, usando escalas e
  alocações vigentes para zona/local; deduplicação por identidade.
- Materialização de destinatários com `dedupeKey` única por comunicado; a
  rematerialização preserva quem já saiu de `PENDING`.
- Acompanhamento de leitura com carimbos de entrega, leitura e confirmação, mais
  nota de confirmação; confirmar implica leitura e uma leitura posterior não
  rebaixa quem confirmou.
- Indicadores por comunicado (total, entregues, lidos, confirmados, pendentes,
  taxa de entrega, taxa de leitura, taxa de confirmação) e agregados de painel.
- Dashboard com publicados, agendados, rascunhos, prioritários, críticos,
  expirados, confirmações pendentes, taxas de leitura/confirmação e ranking de
  categorias.
- Expiração derivada e idempotente: comunicados publicados com prazo vencido são
  convertidos em `EXPIRED` na leitura, com atualização condicional para não
  duplicar eventos sob concorrência.
- Timeline com criação, edição, agendamento, publicação, envio, recálculo de
  destinatários, leitura, confirmação, expiração, arquivamento e cancelamento.
- Templates reutilizáveis com categoria, título padrão, corpo, prioridade e
  ativação/inativação; aplicação no formulário; quatro templates semeados.
- Categorias e etiquetas cadastráveis; etiquetas normalizadas por slug.
- Caixa do operador (`/communications/inbox`) com pendentes e histórico, leitura e
  confirmação em um clique.
- Eventos consumidos por Notificações via Event Bus.

## Não implementado

- Envio por e-mail, SMS, push ou WhatsApp — não há canal externo no projeto; a
  confirmação é registrada pela própria plataforma (declarado fora de escopo na spec).
- Anexos em comunicados (pertencem ao plugin Documentos e Evidências, etapa 2).
- Editor rich-text, aprovação em múltiplos níveis, respostas em thread e recorrência
  automática (declarados fora de escopo na spec).
- Rotina de expiração por job/cron: a expiração é derivada na leitura, por decisão
  de projeto registrada na spec.

## Arquivos

Principais arquivos criados:

- `SPEC/2026-10-01-operational-communications.md` (commitada antes do código).
- `plugins/operations/communications/`: `package.json`, `README.md`, `src/manifest.ts`,
  `src/index.ts`.
- Backend: `src/server/communications.{module,controller,service}.ts`,
  `communication-recipients.service.ts`, `communication-metrics.service.ts`,
  `communication-templates.service.ts`, `communication-timeline.service.ts`,
  `dto/communication.dto.ts`, `dto/communication-audience.dto.ts`,
  `dto/communication-template.dto.ts`, `types/index.ts` e
  `helpers/{communication-status,communication-code,communication-metrics,audience,tag-slug}.ts`.
- Frontend: 8 páginas, 11 componentes, `hooks/useCommunications.ts`,
  `hooks/useCommunicationForm.ts`, `services/communicationService.ts`,
  `utils/presentation.ts`, `styles/communications.module.css`.
- Testes: 8 arquivos (`helpers/*.test.ts`, `communication-recipients.service.test.ts`,
  `communication-metrics` via helpers, `communications.service.test.ts`,
  `communication-templates.service.test.ts`).

Principais arquivos alterados:

- `packages/database/prisma/schema.prisma`.
- `packages/database/prisma/seed.ts`.
- `packages/security/src/permissions.ts`.
- `packages/shared/src/communications.ts`, `packages/shared/src/index.ts`,
  `packages/shared/package.json`.
- `packages/event-bus/src/contracts.ts`.
- `apps/api/src/app.module.ts`.
- `apps/api/src/api-exception.filter.ts` (log de erro não-HTTP).
- `apps/web/src/pluginRegistry.ts`, `apps/web/package.json`.
- `plugins/system/notifications/src/server/notification.subscriber.ts`.

## Banco

Enums adicionados: `CommunicationPriority`, `CommunicationStatus`,
`CommunicationAudienceType`, `CommunicationDeliveryStatus`,
`CommunicationEventType`.

Models adicionados: `Communication`, `CommunicationCategory`, `CommunicationTag`,
`CommunicationTagLink`, `CommunicationAudience`, `CommunicationRecipient`,
`CommunicationEvent`.

Back-relations adicionadas em `Election`, `ElectoralZone`, `PollingPlace`,
`FieldTeam`, `FieldRole`, `FieldMember` e `User`.

Índices relevantes: `[electionId, status]`, `[status, priority]`,
`[priority, publishedAt]`, `[publishedAt]`, `[expiresAt]`,
`[communicationId, deliveryStatus]`, `[userId, deliveryStatus]`,
`[communicationId, type]` e únicos em `code`, `(communicationId, dedupeKey)`,
`(communicationId, tagId)`, `name` de template e `label`/`slug` de etiqueta.

Migration `202610010004_operational_communications`: puramente aditiva (apenas
`CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX` e `ADD CONSTRAINT`), sem
`DROP`/`ALTER` de coluna existente. Gerada por
`prisma migrate diff --from-schema-datasource --to-schema-datamodel` e aplicada
com `npm run db:migrate:deploy`.

## API

```text
GET    /communications                          lista paginada com filtros
GET    /communications/dashboard                indicadores do painel
GET    /communications/pending                  pendentes do usuário autenticado
GET    /communications/inbox                    histórico do usuário autenticado
GET    /communications/reference-data           dados de apoio do formulário
GET    /communications/categories               categorias ativas
POST   /communications/categories               cria categoria
PATCH  /communications/categories/:id           atualiza categoria
GET    /communications/tags                     etiquetas com contagem de uso
POST   /communications/tags                     cria/recupera etiqueta
GET    /communications/templates                templates ativos
GET    /communications/templates/:id            template
POST   /communications/templates                cria template
PATCH  /communications/templates/:id            atualiza template
DELETE /communications/templates/:id            remove template
GET    /communications/:id                      detalhe com métricas e timeline
GET    /communications/:id/metrics              indicadores do comunicado
GET    /communications/:id/timeline             timeline
GET    /communications/:id/recipients           destinatários paginados
POST   /communications/:id/recipients/sync      rematerializa destinatários
POST   /communications/:id/recipients/:recipientId/read      registra leitura
POST   /communications/:id/recipients/:recipientId/confirm   confirma leitura
POST   /communications                           cria comunicado
PATCH  /communications/:id                      atualiza comunicado
PUT    /communications/:id/audiences             substitui direcionamento
POST   /communications/:id/publish               publica
POST   /communications/:id/schedule              agenda
POST   /communications/:id/cancel                cancela
POST   /communications/:id/archive               arquiva
DELETE /communications/:id                       exclui rascunho não publicado
```

## UI

Páginas: painel (`/communications`), comunicados (`/communications/messages`),
novo (`/communications/messages/new`), detalhe (`/communications/messages/:id`),
edição (`/communications/messages/:id/edit`), acompanhamento de leitura
(`/communications/messages/:id/tracking`), templates
(`/communications/templates`) e caixa do operador (`/communications/inbox`).

Componentes: `CommunicationBadges` (prioridade/status/entrega/chip),
`CommunicationFilters`, `CommunicationTable`, `CommunicationCard`,
`CommunicationSummaryCards`, `CommunicationTimeline`, `CommunicationForm`,
`AudienceEditor` + `AudienceList`, `TagInput`, `TemplateForm`, `TemplateList`,
`RecipientTable` + `RecipientStatusSummary`, `InboxList` e `MetricBar`
(barra segmentada, legenda e grade de indicadores).

Hooks: `useCommunicationList`, `useCommunicationDashboard`, `useCommunication`,
`useCommunicationRecipients`, `useCommunicationReferenceData`, `useMutation`,
`useAutoRefresh`, `useCommunicationForm`.

Serviços: `communicationService` (cliente HTTP tipado sobre `@eops/api-client`).
Estilos: `communications.module.css` (CSS Module próprio, com responsividade).

## Integrações globais

- **Event Bus:** `communication.created`, `communication.published`,
  `communication.cancelled`, `communication.expired`, `communication.archived`,
  `communication.read`, `communication.acknowledged`.
- **Security:** `communications.read`, `communications.manage`,
  `communications.publish` no catálogo e no seed; `SUPERVISOR`/`ADMIN` recebem
  todas, `OPERATOR` recebe as três, `TECHNICIAN` recebe `read`, `VIEWER` recebe
  `read` pela regra `*.read`.
- **Shared:** `packages/shared/src/communications.ts` exposto como
  `@eops/shared/communications` (exports do package e barrel atualizados).
- **AppModule:** `CommunicationsModule` registrado.
- **pluginRegistry/sidebar:** `communicationsPlugin` em Operações, rota
  `/communications`, ícone `✉`, permissão `communications.read`; dependência
  adicionada em `apps/web/package.json` (junto de `@eops/plugin-field-teams`, que
  estava ausente do manifesto).
- **Seed:** 6 categorias, 4 templates, 2 etiquetas, 1 comunicado publicado com 4
  destinatários em estados distintos (confirmado, lido, entregue, pendente) e 1
  comunicado agendado com direcionamento por zona. Todas as operações usam
  `upsert`/verificação de existência: idempotente.
- **Notificações:** assinante passou a consumir os três eventos de comunicação
  relevantes para difusão (`published`, `cancelled`, `expired`) com tipos de
  notificação próprios. Os eventos `read`/`acknowledged` não geram notificação
  global para não produzir ruído — decisão registrada aqui e na spec.

## Testes

`npx vitest run plugins/operations/communications` → **8 arquivos, 83 testes, todos aprovados.**

Cobrem: máquina de estados e transições, expiração derivada, ordenação por
prioridade, formatação/sequência de código, taxas e contadores, validação de forma
e deduplicação de direcionamento, chave de deduplicação de destinatário, slug e
normalização de etiquetas, resolução por tipo de destino, `sync` (criação, poda de
pendentes e preservação de quem interagiu), leitura (incluindo não rebaixar quem
confirmou e recusar comunicado não publicado), confirmação, publicação idempotente,
exigência de direcionamento, cancelamento, retenção de publicados na exclusão,
filtros e expiração em lote.

Suíte completa: `npm test` → **21 arquivos, 112 testes, todos aprovados** (eram 13
arquivos / 29 testes no baseline).

## Pendências

Nenhuma pendência funcional do plugin.

Observação de infraestrutura (não é defeito do plugin): a conexão com o Supabase
apresentou quedas durante a sessão. Durante a verificação HTTP foi capturado, no
log da API, o erro real:

```text
PrismaClientKnownRequestError: Timed out fetching a new connection from the connection pool.
(Current connection pool timeout: 10, connection limit: 17)
PrismaClientKnownRequestError: Can't reach database server at
`aws-0-us-east-1.pooler.supabase.com:5432`
```

Ambos são falhas de conexão externas — as mesmas que já haviam feito `npm run db:seed`
falhar com `P1001` antes de qualquer alteração deste plugin. Os `POST` do plugin
alternam entre sucesso e 500 sem alteração de payload, e o mesmo fluxo executado
direto contra o banco (via `tsx`, com o service real) concluiu com sucesso. Para
tornar esses 500 diagnosticáveis, `apps/api/src/api-exception.filter.ts` passou a
registrar em log os erros não-HTTP — antes o filtro os descartava em silêncio,
inviabilizando o diagnóstico.

## IA

`DeepSeek`

## Modelo

`deepseek-flash[1m]`

## Tokens

`indisponível`

## Próxima etapa

Etapa 2 — Documentos e Evidências (`plugins/<categoria>/documents-evidence`).
