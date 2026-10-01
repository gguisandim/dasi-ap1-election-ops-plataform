# Event Bus

## Objetivo

O `@eops/event-bus` desacopla efeitos secundários dos módulos de domínio. Um service publica um evento tipado e subscribers podem reagir sem que Incidentes, Inventário, Auditoria e Notificações precisem se importar diretamente entre si.

## Localização

```text
packages/event-bus/
  src/contracts.ts        nomes e payloads compartilhados
  src/event-bus.ts        implementação em memória
  src/event-bus.module.ts módulo NestJS
  src/index.ts            barrel público
  src/index.test.ts
```

O módulo é global no NestJS e é registrado em `apps/api/src/app.module.ts`.

## Eventos atuais

- `incident.created`
- `incident.assigned`
- `incident.resolved`
- `asset.created`
- `asset.moved`
- `asset.status_changed`
- `user.created`
- `election.created`
- `route.created`
- `route.started`
- `route.completed`
- `delivery.completed`
- `delivery.failed`
- `transmission.completed`
- `transmission.failed`
- `transmission.connectivity_changed`
- `transmission.alert_created`
- `field_team.allocated`
- `field_member.checked_in`
- `field_member.checked_out`

Cada nome possui payload definido em `DomainEventMap`, em `src/contracts.ts`. Não use `any` para eventos novos: primeiro acrescente o contrato ao mapa e depois publique/consuma o evento.

## Fluxo

```text
Service de domínio
      ↓ emit
   EventBus
   ↙     ↘
Audit   Notifications
```

Os subscribers atuais ficam nos próprios plugins:

- `plugins/system/audit/src/server/audit.subscriber.ts`
- `plugins/system/notifications/src/server/notification.subscriber.ts`

## Regra de uso

O evento deve representar algo que já aconteceu. Alterações persistentes críticas continuam dentro da transação do domínio; auditoria/notificações são efeitos posteriores. Evite fazer um plugin importar diretamente o service de outro plugin somente para produzir um efeito secundário.

## Limitação atual

O barramento é em memória e síncrono no processo NestJS. Ele é adequado ao MVP acadêmico, mas não substitui uma fila durável. Em uma evolução distribuída, o contrato pode ser mantido e a implementação trocada por Redis Streams, RabbitMQ, Kafka ou tecnologia equivalente.
