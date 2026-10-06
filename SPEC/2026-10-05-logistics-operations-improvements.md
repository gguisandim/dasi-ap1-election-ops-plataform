# Logistics Operations Improvements

Status: approved

## Contexto

A vertical logística da Election Ops Platform já possui dois plugins funcionais:

- `Inventory`, responsável por ativos, tipos, condição, localização, movimentações e alocações;
- `Routes`, responsável por rotas de distribuição, veículos, paradas, lotes, entregas, atraso e histórico.

Esta evolução conecta planejamento, custódia e execução logística sem transferir ownership entre plugins e sem introduzir imports internos cross-plugin.

## Estado atual

### Inventory

O plugin já oferece cadastro e consulta paginada de ativos, tipos configuráveis, status e condição física, localização por zona/local, movimentação imutável, encerramento da alocação anterior, nova alocação, vínculo com incidentes e dashboard básico. Publica `asset.created`, `asset.moved` e `asset.status_changed`.

### Routes

O plugin já oferece CRUD e filtros de rotas, veículos, paradas ordenadas, lotes, entregas, itens associados a ativos, cálculo de atraso, mapa, histórico e eventos de criação/início/conclusão e entrega. O status atual inclui `PLANNED`, `READY`, `IN_PROGRESS`, `DELAYED`, `COMPLETED` e `CANCELLED`.

## Problemas

- disponibilidade de ativo não considera reserva, custódia e manutenção ativa;
- retirada e devolução não são operações explícitas, embora `AssetAssignment` preserve parte da alocação;
- manutenção não possui entidade e lifecycle consultável;
- mudanças de status de rota aceitam transições arbitrárias;
- não existe fase explícita de dispatch;
- carga não valida capacidade do veículo nem elegibilidade do ativo;
- paradas não possuem falha explícita, ações formais ou reordenação protegida;
- exceções de entrega não possuem registro próprio e consultável;
- risco logístico não distingue objetivamente `ON_TIME`, `AT_RISK` e `DELAYED`.

## Objetivos

1. aprofundar o lifecycle operacional de ativos sem substituir o status físico/administrativo existente;
2. adicionar reservas, custódia/check-out/check-in e manutenção simples;
3. formalizar lifecycle e ações de Route e RouteStop;
4. validar carga, capacidade e elegibilidade dos ativos no backend;
5. registrar exceções e prova mínima de entrega com ator e tempo do servidor;
6. expor dashboards e telas operacionais com estados de loading, erro, vazio e sucesso;
7. preservar RBAC, Event Bus, Audit global, Notifications e boundaries existentes.

## Ownership

### Inventory

Inventory é o único owner de:

- `Asset` e `AssetType`;
- status, condição e disponibilidade operacional do ativo;
- reservas;
- custódia e check-out/check-in;
- movimentações e alocações;
- manutenção simples.

### Routes

Routes é o único owner de:

- `DistributionRoute` e `Vehicle`;
- carga logística representada por `Delivery`/`DeliveryItem`/`DeliveryBatch`;
- stops, dispatch e execução da rota;
- entrega, retorno logístico, exceções e histórico.

Integrações usam IDs persistidos, contratos públicos, `@eops/database`, Event Bus ou API pública. Nenhum plugin pode importar `plugins/**/src/**` de outro plugin.

## Inventory

### Lifecycle e disponibilidade derivada

O enum `AssetStatus` existente permanece como estado físico/administrativo:

```text
AVAILABLE | ALLOCATED | IN_TRANSIT | IN_USE | MAINTENANCE | LOST | RETIRED
```

O estado operacional é derivado, nesta precedência:

1. `RETIRED`, `LOST`, condição `DAMAGED` ou `UNAVAILABLE` => `UNAVAILABLE`;
2. manutenção `OPEN` ou `IN_PROGRESS` => `MAINTENANCE`;
3. custódia ativa => `IN_CUSTODY`;
4. reserva aprovada vigente => `RESERVED`;
5. status `IN_USE` => `IN_USE`;
6. status `IN_TRANSIT` ou `ALLOCATED` => mantém o significado operacional do status;
7. caso contrário => `AVAILABLE`.

Não será persistido um segundo campo redundante de disponibilidade em `Asset`.

### Reservas

`AssetReservation` representa uma entidade consultável e histórica com:

- ativo individual;
- solicitante e finalidade;
- início e fim;
- status `REQUESTED`, `APPROVED`, `FULFILLED` ou `CANCELLED`;
- notas, criador, aprovador e timestamps do servidor.

Regras:

- `startsAt < endsAt`;
- ativo deve existir e não pode estar perdido, retirado, danificado ou indisponível;
- reserva aprovada não pode se sobrepor a outra reserva aprovada/solicitada incompatível do mesmo ativo;
- manutenção ativa ou custódia ativa bloqueiam aprovação;
- apenas `REQUESTED` pode ser aprovada ou cancelada;
- fulfillment exige reserva `APPROVED` e ocorre no check-out correspondente.

### Custódia

`AssetAssignment` será reaproveitado e distinguido por `kind`:

- `ALLOCATION` para alocação/localização existente;
- `CUSTODY` para retirada operacional.

Check-out registra ativo, destinatário, origem, destino, finalidade, condição de saída, retorno esperado, ator autenticado e horário do servidor. Apenas ativo operacionalmente disponível ou reservado para a própria finalidade pode entrar em custódia.

Check-in encerra a custódia ativa e registra condição de retorno, destino de devolução, recebedor, problema detectado, notas e horário do servidor. Se houver problema ou condição `DAMAGED`/`UNAVAILABLE`, o ativo vai para `MAINTENANCE` ou permanece indisponível; caso contrário volta a `AVAILABLE`.

### Manutenção

`AssetMaintenance` representa manutenção simples:

- tipo `PREVENTIVE` ou `CORRECTIVE`;
- status `OPEN`, `IN_PROGRESS`, `COMPLETED` ou `CANCELLED`;
- descrição, responsável, custo opcional, resultado, notas e timestamps;
- ator de abertura e conclusão.

Manutenção `OPEN`/`IN_PROGRESS` bloqueia nova reserva aprovada, check-out e carga de rota. A conclusão declara explicitamente retorno ao serviço; caso contrário o ativo fica `UNAVAILABLE`.

### Dashboard e detalhe

O dashboard deve informar dados reais de total, disponível, reservado, em custódia, em uso, manutenção, indisponível, retirado, devoluções vencidas e reservas do dia. Deve também expor movimentos recentes, custódias atuais, reservas vencidas e manutenções abertas.

O detalhe do ativo deve mostrar disponibilidade derivada, custódia atual, reservas, manutenção e timeline existente, além de ações permitidas calculadas no backend.

## Routes

### Lifecycle

O lifecycle normativo é:

```text
PLANNED -> READY -> DISPATCHED -> IN_PROGRESS -> COMPLETED
```

`DELAYED` representa uma execução ativa atrasada e pode voltar a `IN_PROGRESS` ou concluir. `CANCELLED` é terminal.

Transições permitidas:

- `PLANNED`: `READY`, `CANCELLED`;
- `READY`: `PLANNED`, `DISPATCHED`, `CANCELLED`;
- `DISPATCHED`: `IN_PROGRESS`, `CANCELLED`;
- `IN_PROGRESS`: `DELAYED`, `COMPLETED`, `CANCELLED`;
- `DELAYED`: `IN_PROGRESS`, `COMPLETED`, `CANCELLED`;
- `COMPLETED` e `CANCELLED`: nenhuma.

O servidor define timestamps de dispatch, saída e chegada. DTOs não aceitam ator nem timestamps de transição como autoridade.

### Carga e capacidade

`DeliveryItem` continua representando a carga e pode referenciar `Asset` sem transferir ownership.

Antes de `READY` ou `DISPATCHED`:

- a rota deve possuir veículo e responsável;
- deve possuir pelo menos uma parada;
- quantidade total conhecida da carga não pode exceder `Vehicle.capacity`, quando configurada;
- todo ativo da carga deve existir, estar operacionalmente elegível e não estar em manutenção, custódia incompatível ou outra rota ativa;
- o mesmo ativo não pode aparecer duplicado na mesma carga.

### Stops

O enum existente é preservado e ampliado apenas com `FAILED`:

```text
PENDING -> ARRIVED -> COMPLETED
PENDING/ARRIVED -> FAILED | SKIPPED
```

`COMPLETED` corresponde semanticamente a stop entregue/concluído. Ações registram ator, timestamp do servidor e notas/motivo quando aplicável. Falha e skip exigem motivo.

Reordenação:

- aceita a lista completa de IDs da rota;
- rejeita IDs ausentes, duplicados ou de outra rota;
- normaliza posições contíguas iniciando em 1 dentro de transação;
- só é permitida em `PLANNED` ou `READY`;
- registra histórico.

### Exceções e prova de entrega

`RouteException` registra exceção real com rota, stop/entrega opcionais, reason, notas, ator, ocorrência e resolução opcional. Reasons suportados:

```text
RECIPIENT_ABSENT | WRONG_ADDRESS | ACCESS_BLOCKED | VEHICLE_PROBLEM |
ASSET_PROBLEM | DELIVERY_REFUSED | OTHER
```

Falha de entrega cria exceção quando houver reason e registra histórico/evento. Não cria Incident automaticamente.

`Delivery` existente continua sendo a prova mínima de entrega por meio de `receiverName`, `deliveredAt`, notas e URL/evidence ID opcional quando disponível. O ator é registrado na entrega e no histórico. O servidor define `deliveredAt`.

### Risco derivado

`deliveryRisk` não é persistido:

- `DELAYED`: rota em status `DELAYED`, planejamento vencido ou stop pendente/arrived com ETA vencido;
- `AT_RISK`: rota ativa com chegada planejada ou próximo stop dentro de 30 minutos;
- `ON_TIME`: demais rotas não terminais;
- rotas `COMPLETED`/`CANCELLED` mantêm `ON_TIME` para fins de dashboard histórico.

### Dashboard e detalhe

O dashboard informa rotas de hoje, planejadas, prontas, ativas, concluídas, atrasadas, em risco, stops com falha, ativos em trânsito e entregas pendentes. O detalhe informa resumo, veículo/responsável, carga, stops, exceções, entregas, histórico, risco e `availableActions`.

## API

### Inventory

Mantém rotas atuais e adiciona contratos equivalentes a:

```text
GET/POST   /inventory/reservations
GET        /inventory/reservations/:id
POST       /inventory/reservations/:id/approve
POST       /inventory/reservations/:id/cancel

POST       /inventory/:id/check-out
POST       /inventory/:id/check-in

GET/POST   /inventory/maintenance
POST       /inventory/maintenance/:id/start
POST       /inventory/maintenance/:id/complete
POST       /inventory/maintenance/:id/cancel
```

### Routes

Mantém rotas atuais e adiciona contratos equivalentes a:

```text
POST  /routes/:id/transition
PUT   /routes/:id/stops/order
POST  /routes/:routeId/stops/:stopId/action
POST  /routes/:id/exceptions
PATCH /routes/:routeId/exceptions/:exceptionId/resolve
```

## RBAC

As permissões existentes são reutilizadas:

- leitura: `inventory.read` e `routes.read`;
- mutações Inventory: `inventory.create`, `inventory.update`, `inventory.move` conforme operação;
- mutações Routes: `routes.manage`.

Não serão criadas novas permissões nesta execução.

## Event Bus, Audit e Notifications

Eventos novos são tipados, pequenos e carregam `entityId`, `actorId` e dados de transição necessários, sem objetos Prisma completos.

Inventory pode publicar:

- `inventory.reservation_created`, `inventory.reservation_approved`, `inventory.reservation_cancelled`;
- `inventory.asset_checked_out`, `inventory.asset_checked_in`;
- `inventory.maintenance_opened`, `inventory.maintenance_completed`.

Routes pode publicar:

- `route.ready`, `route.dispatched`, `route.started`, `route.completed`, `route.cancelled`;
- `route.stop_arrived`, `route.delivery_completed`, `route.delivery_failed`.

Audit continua observando o Event Bus global. Notifications só recebe catálogo para eventos de valor operacional: manutenção crítica, devolução vencida quando publicada, rota pronta, rota atrasada e falha de entrega. Check-in normal, movimento rotineiro e chegada normal em stop não geram notificação.

## Persistência e migration

Uma nova migration deve:

- criar enums e tabelas de reservation, maintenance e route exception;
- estender `AssetAssignment` para custódia explícita;
- adicionar `DISPATCHED` a `RouteStatus` e `FAILED` a `RouteStopStatus`;
- adicionar somente índices exigidos pelas novas consultas;
- preservar todas as migrations históricas.

A migration será criada, validada e deixada pendente; não será aplicada automaticamente ao banco remoto.

## Frontend

Inventory preserva `/inventory` e o detalhe existente, adicionando acesso operacional a reservas e manutenção e refinando custódia/timeline.

Routes preserva `/routes`, `/routes/:id`, `/routes/deliveries`, mapa e histórico, refinando ações de lifecycle, carga, stops, exceções e risco.

Todas as novas telas usam primitives de `@eops/ui`, CSS Modules, foco/labels semânticos e estados de loading, error, empty e success. Em telas estreitas, tabelas usam overflow horizontal e ações principais permanecem acessíveis.

## Fora de escopo

- GPS ou telemetria em tempo real;
- otimização automática de rotas;
- novo provedor de mapas;
- WMS, procurement, combustível ou manutenção completa de frota;
- upload próprio de evidências;
- criação automática de Incident;
- Kafka, Redis, WebSocket ou infraestrutura assíncrona nova;
- Command Center, Resource Requests, Shift Handover e demais plugins.

## Estratégia de testes

Testes focados cobrem regras críticas, não DTOs ou CSS triviais:

- conflitos e disponibilidade de reserva;
- check-out/check-in e custódia vencida;
- bloqueio por manutenção;
- transições de manutenção;
- transições válidas/inválidas de rota;
- capacidade e elegibilidade da carga;
- lifecycle de stop;
- exceção/falha/prova de entrega;
- reordenação consistente;
- risco derivado;
- eventos e atribuição do ator.

## Validação

```text
npm run spec:check
npm run check:boundaries
npm run typecheck
npm run lint
testes focados Inventory e Routes
npm test
npm run build
npm run db:validate
npm run count:loc
powershell -ExecutionPolicy Bypass -File scripts/check-ap1.ps1
git diff --check
```

## Critérios de aceite

- AC-01 Inventory possui lifecycle operacional explícito.
- AC-02 disponibilidade do ativo considera reservation, custody e maintenance.
- AC-03 reservas possuem validação de conflito.
- AC-04 check-out registra custódia e responsável.
- AC-05 check-in registra condição de retorno.
- AC-06 ativo com manutenção ativa não é tratado como disponível.
- AC-07 manutenção possui lifecycle simples.
- AC-08 Inventory informa custódia atual e histórico.
- AC-09 Routes possui lifecycle operacional explícito.
- AC-10 transições inválidas de Route são rejeitadas.
- AC-11 capacidade/carga é validada quando aplicável.
- AC-12 ativo incompatível não pode entrar silenciosamente em carga ativa.
- AC-13 RouteStop possui lifecycle operacional.
- AC-14 falha de entrega registra reason, actor e timestamp.
- AC-15 proof of delivery possui registro mínimo verificável.
- AC-16 reordenação de stops preserva consistência.
- AC-17 estado `ON_TIME`/`AT_RISK`/`DELAYED` é derivado por regra objetiva.
- AC-18 Inventory continua owner do Asset.
- AC-19 Routes continua owner da Route.
- AC-20 integração não utiliza imports internos cross-plugin.
- AC-21 Event Bus recebe apenas eventos relevantes.
- AC-22 Audit continua utilizando infraestrutura global existente.
- AC-23 Notifications não gera spam para operações rotineiras.
- AC-24 migrations históricas permanecem intactas.
- AC-25 migration nova não é aplicada automaticamente ao banco remoto.
- AC-26 regras críticas possuem testes focados.
- AC-27 full suite passa ao final.
- AC-28 build funciona sem depender de `dist` stale.
- AC-29 LOC antes/depois é reportada sem crescimento artificial.
