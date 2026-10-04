# Resposta a incidentes, auditoria e notificações operacionais

## Status

`approved`

## Contexto

A Central de Incidentes, Auditoria e Notificações já existem como plugins independentes. O MVP oferece CRUD, SLA básico, atribuição e timeline de incidentes; persiste alguns Domain Events em auditoria; e cria notificações internas para usuários ativos. A integração já usa `@eops/event-bus`, mas cobre poucas mutações e depende de listas manuais diferentes em cada subscriber.

Esta evolução transforma os três plugins em uma vertical operacional coesa, sem dependência direta entre implementações de plugins. O Event Bus permanece in-process e a persistência continua em Prisma/PostgreSQL.

## Estado atual

- Incidentes possui sete status, transições validadas apenas no backend, cinco métricas simples, categorias administráveis somente por API, atribuições históricas e três eventos globais (`created`, `assigned`, `resolved`).
- As permissões `incidents.resolve` e `incidents.close` existem, mas a alteração genérica de status usa somente `incidents.update`.
- Auditoria oferece apenas listagem paginada e observa uma lista manual de eventos; não persiste `eventName` nem sanitiza payloads.
- Notificações lista até 100 registros, calcula unread no mesmo endpoint, aplica preferências apenas por ausência de opt-out e envia quase todo evento para todos os usuários ativos.
- `NotificationPreference`, índices principais de Notification e histórico de `IncidentAssignment` já existem.

## Problemas

- frontend e backend não compartilham a matriz de transições;
- acknowledgement, escalation e priorização de fila não existem;
- mutações relevantes perdem ator ou não chegam ao Event Bus;
- eventos novos podem não ser auditados;
- payloads de auditoria podem conter conteúdo sensível;
- auditoria não possui detail, summary ou busca operacional;
- preferências de notificação não possuem API/UI e a audiência ignora RBAC;
- o bell carrega uma coleção inteira para obter uma contagem.

## Objetivos

- tornar lifecycle, permissões, SLA e priorização de incidentes explícitos;
- emitir eventos tipados compactos para toda mutação humana relevante;
- permitir observação global do Event Bus sem lista manual na Auditoria;
- oferecer trilha auditável pesquisável, detalhada e sanitizada;
- selecionar destinatários por status ativo, permissão e preferência;
- fornecer listagens paginadas, unread count e preferências reais;
- entregar interfaces responsivas e acessíveis para os fluxos operacionais.

## Personas

- operador de incidentes: reconhece, atribui, comenta, escala e conduz o lifecycle;
- supervisor: resolve, fecha, reabre e acompanha SLA/fila;
- auditor: pesquisa eventos, atores, recursos e mudanças before/after;
- usuário operacional: recebe somente notificações elegíveis e configura preferências próprias.

## Escopo

- `plugins/monitoring/incidents`;
- `plugins/system/audit`;
- `plugins/system/notifications`;
- contratos mínimos em `@eops/event-bus` e `@eops/shared/incidents`;
- novos campos e uma migration Prisma;
- documentação descritiva dos três módulos;
- testes unitários/integração em memória dos serviços, subscribers e contratos.

## Fora de escopo

- novos plugins, Shift Handover ou alterações funcionais em outros domínios;
- Kafka, RabbitMQ, outbox, WebSocket, email, SMS, push/mobile ou cron de SLA;
- atualização principal de Prisma ou `npm audit fix --force`;
- correlação, IP, user-agent ou request ID inexistentes;
- delete/update de AuditEvent;
- redesenho do shell ou alteração dos workspace boundaries.

## Central de Incidentes

### Lifecycle e RBAC

`@eops/shared/incidents` define `INCIDENT_ALLOWED_TRANSITIONS` e `getAllowedIncidentTransitions`. Backend e frontend consomem a mesma matriz.

- transições normais e cancelamento usam `incidents.update`;
- `POST /incidents/:id/resolve` exige `incidents.resolve`;
- `POST /incidents/:id/close` exige `incidents.close`;
- `POST /incidents/:id/reopen` exige `incidents.update` e aceita somente `RESOLVED → IN_PROGRESS`;
- o endpoint genérico de status rejeita destino `RESOLVED` ou `CLOSED`, evitando contornar permissões específicas.

### Acknowledgement

`POST /incidents/:id/acknowledge` exige `incidents.update`, usa exclusivamente o usuário autenticado e persiste `acknowledgedAt` e `acknowledgedById`. A operação é idempotente no estado, mas uma segunda tentativa retorna conflito para sinalizar acknowledgement já realizado. A primeira registra `IncidentEvent` e `incident.acknowledged`.

### Escalation

`POST /incidents/:id/escalate` exige `incidents.update`, aceita nível inteiro de 1 a 3 e motivo obrigatório. O nível deve ser maior que o atual. O incidente persiste o último nível, data, motivo e ator; cada mudança permanece no `IncidentEvent` e em `incident.escalated`. Não há escalonamento automático.

### SLA

O estado é calculado, não persistido:

- `COMPLETED`: `RESOLVED`, `CLOSED` ou `CANCELLED`;
- `OVERDUE`: ativo e deadline anterior ao instante atual;
- `DUE_SOON`: ativo e deadline nos próximos 60 minutos;
- `ON_TRACK`: demais casos, inclusive SLA ausente.

As respostas expõem `slaState` e `slaRemainingMinutes` (negativo quando vencido, `null` sem deadline).

### Dashboard e fila

O dashboard mantém métricas existentes e adiciona `untriaged`, `unassigned`, `acknowledgementPending`, `dueSoon`, distribuições `bySeverity`/`byStatus` e `meanResolutionMinutes` calculada apenas com incidentes resolvidos.

`GET /incidents/queue` retorna incidentes ativos paginados e ordenados por prioridade operacional: maior escalation, `CRITICAL`/`HIGH`, SLA vencido/próximo, não reconhecido, não atribuído e abertura mais antiga. Cada item expõe razões de prioridade; não é mera cópia da tabela cronológica.

### Detail, assignments e categorias

- o detail mostra Resumo, Atendimento, Timeline e Atribuições em seções acessíveis;
- ações exibidas dependem das transições compartilhadas e estado atual;
- histórico de assignments mostra responsável, início, fim e motivo sem sobrescrever registros;
- `/incidents/categories` lista, cria, edita e ativa/desativa categorias;
- desativar categoria impede novos usos, mas mantém incidentes históricos íntegros.

## Auditoria

- `AuditSubscriber` usa `subscribeAll`, sem lista manual de Domain Events;
- cada registro contém `eventName`, `occurredAt` preservado em metadata, ator válido quando existente, entidade, ação e payload relevante;
- `from`/`to` reais alimentam `oldData`/`newData`; sem estado anterior, `oldData` permanece nulo;
- payloads são sanitizados recursivamente antes da persistência. Chaves case-insensitive equivalentes a `password`, `passwordHash`, `authorization`, `token`, `secret` e `apiKey` recebem `[REDACTED]`;
- `GET /audit` filtra por action, eventName, entityType, entityId, actorId, período e busca, com paginação;
- `GET /audit/summary` agrega período, hoje, ações, entidades e atores mais ativos;
- `GET /audit/:id` retorna detail somente leitura;
- `/audit` exibe summary, filtros, busca, badges, recurso legível, link e paginação;
- `/audit/:id` apresenta metadados e before/after em viewer estruturado por chave.

## Notificações

- `GET /notifications` é paginado e filtra readState (`ALL`, `READ`, `UNREAD`), type, eventName e período;
- `GET /notifications/unread-count` retorna apenas a contagem;
- read, unread e read-all afetam exclusivamente o usuário autenticado;
- `GET /notifications/preferences` retorna o catálogo configurável com default `enabled: true` quando não há linha persistida;
- `PUT /notifications/preferences` altera somente preferências do usuário autenticado e somente eventos catalogados;
- `/notifications/preferences` agrupa opções por domínio e mostra sucesso/erro;
- `/notifications` oferece Todos, Não lidos e Críticos, paginação e link confiável de Incident para `/incidents/:id`;
- `NotificationBell` usa unread-count, `aria-label`, polling de 60 segundos e cleanup.

### Política de destinatários

A audiência final é a interseção de usuário ativo, permissão de leitura do domínio e preferência não desabilitada. O mapeamento mínimo é:

- `incident.*` → `incidents.read`;
- `asset.*` → `inventory.read`;
- `transmission.*` → `transmission.read`;
- `task.*` → `tasks.read`;
- `shift.*` → `shifts.read`;
- demais eventos catalogados usam a permissão pública do próprio domínio quando definida.

`incident.assigned` inclui `assignedToId`; o usuário atribuído ativo é incluído quando possui `incidents.read`. A consulta de usuários carrega roles/permissions e preferências em lote, sem query por usuário.

## Event Bus

- `subscribe(name, handler)` permanece compatível;
- `subscribeAll(handler)` observa todos os eventos e retorna unsubscribe;
- emit entrega um único objeto com `name`, payload tipado e `occurredAt` para subscribers específicos e globais;
- múltiplos subscribers são suportados e unsubscribe interrompe entregas futuras;
- um catálogo público de notificações expõe `eventName`, domínio, label, descrição e permissão requerida, consumido por backend e frontend via API;
- o bus permanece in-process: reinícios podem perder eventos ainda não persistidos e não há garantia distribuída.

## RBAC

Todas as ações humanas usam `request.user.id`; DTOs não aceitam `actorId`. Permissões existentes são reutilizadas. Auditoria exige `audit.read`. Notificações e preferências são sempre restritas ao próprio usuário autenticado.

## Modelo de dados

Uma nova migration adiciona:

- `Incident.acknowledgedAt`, `acknowledgedById`;
- `Incident.escalationLevel` com default 0, `escalatedAt`, `escalatedById`, `escalationReason`;
- `AuditEvent.eventName` nullable para compatibilidade histórica;
- tipos `ACKNOWLEDGED`, `ESCALATED` e `CANCELLED` em `IncidentEventType`;
- índice `Incident(status, escalationLevel, slaDeadline)`;
- índice `AuditEvent(eventName, createdAt)`.

Índices existentes de Notification e NotificationPreference são mantidos, sem duplicação.

## APIs

Além dos endpoints existentes:

```text
GET  /incidents/queue
POST /incidents/:id/acknowledge
POST /incidents/:id/escalate
POST /incidents/:id/resolve
POST /incidents/:id/reopen
POST /incidents/:id/close
GET  /audit/summary
GET  /audit/:id
GET  /notifications/unread-count
PATCH /notifications/:id/unread
GET  /notifications/preferences
PUT  /notifications/preferences
```

## Frontend

Novas rotas públicas dos plugins:

```text
/incidents/queue
/incidents/categories
/audit/:id
/notifications/preferences
```

As páginas usam primitives `@eops/ui`, CSS Modules, estados loading/error/empty, controles semânticos, foco visível e layouts que permanecem utilizáveis em 1440 px, 1024 px e até 760 px. Tabelas podem rolar horizontalmente.

## Integrações e arquitetura

Incidentes publica contratos tipados compactos em `@eops/event-bus`. Auditoria observa todos; Notificações observa eventos com conteúdo suportado e usa catálogo/audience públicos. Nenhum dos três plugins importa `src/` ou implementação de outro plugin.

## Critérios de aceite

- **AC-01**: prompt registrado, SPEC commitada antes do código e nenhum commit adicional criado.
- **AC-02**: lifecycle compartilhado elimina matriz duplicada e endpoints resolve/close aplicam permissões específicas.
- **AC-03**: acknowledgement e escalation persistem ator/tempo/contexto, rejeitam duplicidade/invalidez e registram timeline/eventos.
- **AC-04**: SLA calculado, dashboard ampliado e fila priorizada usam somente dados reais.
- **AC-05**: detail mostra ações válidas e histórico de assignments; categorias possuem UI de criação/edição/ativação.
- **AC-06**: toda mutação relevante de incidentes publica evento tipado compacto com ator autenticado.
- **AC-07**: Event Bus suporta subscribe, subscribeAll, múltiplos handlers e unsubscribe com testes.
- **AC-08**: Auditoria observa todos os eventos, persiste eventName/ator/before/after honesto e sanitiza segredos recursivamente.
- **AC-09**: API/UI de auditoria entregam filtros, busca, paginação, summary e detail somente leitura.
- **AC-10**: Notificações entrega paginação/filtros, unread count leve e operações read/unread/read-all com ownership.
- **AC-11**: preferências próprias usam catálogo público e default enabled, com UI agrupada por domínio.
- **AC-12**: audiência usa usuário ativo + permissão + preferência, incluindo atribuído elegível sem N+1 por usuário.
- **AC-13**: Bell usa unread-count, acessibilidade e polling moderado com cleanup; links só são criados para rotas confiáveis.
- **AC-14**: migration é nova, preserva histórico e Prisma valida; migrations antigas não são alteradas.
- **AC-15**: documentação descritiva dos três módulos reflete o resultado sem substituir a SPEC.
- **AC-16**: testes cobrem regras negativas e positivas de Incidentes, Event Bus, Auditoria e Notificações.
- **AC-17**: boundaries, typecheck, lint, suíte completa, build, AP1 e diff check passam.
- **AC-18**: LOC é medida antes/depois sem criação artificial de código.

## Validação

```text
npm run spec:check
npm run check:boundaries
npm run typecheck
npm run lint
npm test
npm run build
npx prisma validate --schema packages/database/prisma/schema.prisma
powershell -ExecutionPolicy Bypass -File scripts/check-ap1.ps1
git diff --check
```

Executar também testes focados de Incidentes, Auditoria, Notificações e Event Bus, além de `npm run count:loc` antes/depois. E2E só pode ser declarado quando banco e ambiente forem realmente executados.
