# Monitor de Transmissão

## 1. Objetivo

O módulo Monitor de Transmissão acompanha, por pleito, zona e local de votação, os pontos de transmissão dos resultados: fila operacional, conectividade, tentativas, prazo de envio e alertas técnicos.

Ele deve permitir responder rapidamente: o que ainda não transmitiu, onde, por qual motivo, o que está fora de prazo ou offline e o que exige ação imediata.

Este documento é descritivo. A especificação normativa permanece em `SPEC/`.

---

## 2. Estrutura

```text
plugins/monitoring/transmission/
  src/manifest.ts                       registro do plugin
  src/index.ts                          rotas de frontend
  src/server/                           backend NestJS (controller, service, DTOs)
  src/services/transmissionService.ts   cliente HTTP
  src/client/pages/                     dashboard, NOC, detalhe e cadastro
  src/client/hooks/usePermissions.ts    leitura de permissões do usuário
  src/types/index.ts                    contratos e helpers do cliente
  src/styles/overview.module.css        CSS Module do plugin
```

O backend é exposto ao composition root por `@eops/plugin-transmission/server`. O frontend não importa implementação interna de outro plugin: as permissões do usuário são lidas por `GET /auth/me`, e o backend continua sendo a autoridade final.

---

## 3. Funcionalidades atuais

- cadastro e edição de pontos de transmissão, com prioridade, prazo operacional e conectividade;
- fila operacional ordenada por prioridade e `queuedAt`;
- registro de verificação de conectividade e de tentativas de transmissão;
- timeline de eventos por ponto;
- alertas técnicos com reconhecimento e resolução;
- dashboard com progresso e indicadores;
- visão NOC consolidada;
- retry manual e em lote;
- histórico de conectividade.

### Endpoints

```http
GET    /api/transmission
GET    /api/transmission/dashboard
GET    /api/transmission/queue
GET    /api/transmission/noc
GET    /api/transmission/alerts
PATCH  /api/transmission/alerts/:id
POST   /api/transmission
GET    /api/transmission/:id
GET    /api/transmission/:id/connectivity-history
PATCH  /api/transmission/:id
PATCH  /api/transmission/:id/connectivity
POST   /api/transmission/:id/retry
POST   /api/transmission/:id/attempts
POST   /api/transmission/retry
```

As rotas estáticas (`dashboard`, `queue`, `noc`, `alerts`, `retry`) são declaradas antes das rotas com `:id` para não serem capturadas como identificador.

---

## 4. Visão NOC

`GET /api/transmission/noc` (filtros `electionId`, `zoneId`, `pollingPlaceId`) retorna uma visão derivada, sem persistência:

- `totals`: total, sucesso, fila, transmitindo, falhas e offline;
- `rates`: taxa de sucesso e de falha;
- `latency.averageLatencyMs` e `volume.attemptsToday`;
- `risk`: risco de prazo (`DUE_SOON + OVERDUE`), atrasados e próximos;
- `byStatus`, `byDeadlineState`, `byZone`, `byPlace`;
- `needsAttention`: até 12 pontos ordenados por risco (atrasado, prazo próximo, falho, offline).

Todas as métricas são calculadas a partir de dados persistidos. `queued` agrega `WAITING`, `QUEUED` e `RETRYING`; `failed` agrega `FAILED` e `OFFLINE`; `offline` reflete a conectividade `OFFLINE`.

---

## 5. Estado de prazo derivado

O estado de prazo nunca é persistido. Ele é calculado por uma função pura `deriveDeadlineState(status, operationalDeadline, now)`:

- status `SUCCESS` resulta em `COMPLETED`;
- sem prazo definido resulta em `ON_TRACK`;
- `now` após o prazo resulta em `OVERDUE`;
- prazo restante de até 60 minutos resulta em `DUE_SOON`;
- caso contrário, `ON_TRACK`.

A janela de 60 minutos é uma constante exportada e coincide com o critério do alerta `DEADLINE_NEAR`, para que alerta e estado não divirjam.

---

## 6. Ciclo de vida do alerta

Os alertas nunca são excluídos. As transições permitidas são:

```text
OPEN          → ACKNOWLEDGED
OPEN          → RESOLVED
ACKNOWLEDGED  → RESOLVED
```

Transições regressivas (por exemplo `RESOLVED → OPEN`) são rejeitadas com 400. O servidor grava `acknowledgedAt`/`acknowledgedById` na primeira passagem para `ACKNOWLEDGED` e `resolvedAt`/`resolvedById` na passagem para `RESOLVED`; o cliente nunca envia timestamps.

`PATCH /api/transmission/alerts/:id` aceita `{ status, notes? }` e exige `transmission.manage`. `GET /api/transmission/alerts` aceita filtro opcional por `status` e, por padrão, exclui alertas `RESOLVED` (a menos que um status seja informado ou `includeResolved` seja usado).

---

## 7. Retry operacional

`POST /api/transmission/:id/retry` `{ reason? }` e `POST /api/transmission/retry` `{ ids, reason }` exigem `transmission.manage`.

São elegíveis os status `FAILED`, `OFFLINE`, `RETRYING` e `WAITING`. O retry recoloca o ponto em `QUEUED`, limpa `lastError` e registra um evento de timeline `RETRY` com o motivo.

O retry em lote aceita de 1 a 100 identificadores e é atômico: todos os pontos são validados antes; se qualquer ponto não existir ou não for elegível, nada é aplicado. O histórico de tentativas (`TransmissionAttempt`) permanece intacto e continua exposto no detalhe. Não existe scheduler, daemon ou execução automática.

---

## 8. Histórico de conectividade

`GET /api/transmission/:id/connectivity-history` é derivado de eventos de timeline `CONNECTIVITY_CHANGED` (com `metadata.latencyMs`) e das tentativas registradas:

- `entries`: mudanças de conectividade em ordem cronológica;
- `current`: conectividade e latência atuais;
- `lastCheckedAt`: último registro de verificação;
- `lastSuccessAt`: fim da última tentativa `SUCCESS`;
- `failureStreak`: tentativas consecutivas não-`SUCCESS` a partir da mais recente, por `calculateFailureStreak(attempts)`.

Nenhuma infraestrutura de séries temporais é criada.

---

## 9. Eventos emitidos

O módulo publica no Event Bus existente:

- `transmission.alert_created`
- `transmission.alert_acknowledged`
- `transmission.alert_resolved`
- `transmission.retry_requested` (uma vez por operação, com `count` e `reason`)
- `transmission.connectivity_changed`
- `transmission.completed`
- `transmission.failed`

Outros módulos reagem por meio do Event Bus; nenhum import interno entre plugins é utilizado.

---

## 10. RBAC

Nenhuma permissão nova é criada.

- `transmission.read` permite consultar pontos, fila, dashboard, NOC, alertas e histórico.
- `transmission.manage` permite cadastrar, editar, registrar conectividade e tentativas, reconhecer/resolver alertas e solicitar retry.

Toda autorização é validada no backend. No frontend, ações de gestão são exibidas apenas quando o usuário possui `transmission.manage`.

---

## 11. Limitações conhecidas

- o módulo não executa transmissão nem agendamento; apenas registra e acompanha o estado operacional;
- o estado de prazo é derivado em memória e não é persistido;
- a média de latência considera apenas pontos com valor registrado;
- `attemptsToday` conta tentativas iniciadas a partir da meia-noite do dia corrente;
- o histórico de conectividade depende dos eventos de timeline efetivamente gravados, sem inferência de períodos não registrados.
