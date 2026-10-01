# Rotas e Distribuição — 2026-10-01

## Prompt resumido

Implementar o plugin persistente de Rotas e Distribuição, mantendo o isolamento do monorepo, com cadastro e acompanhamento de rotas, paradas, veículos, entregas, lotes, atrasos, mapa, histórico, filtros, RBAC, eventos e testes.

## Implementado

- Cadastro, edição, listagem, filtros e detalhe de rotas.
- Status `PLANNED`, `READY`, `IN_PROGRESS`, `DELAYED`, `COMPLETED` e `CANCELLED`.
- Sequência persistente de paradas com local eleitoral, coordenadas, ETA, horário real, status e observações.
- Cadastro e alocação de veículos com placa, modelo, capacidade, motorista, responsável e status.
- Entregas associadas a rota, local, lote e itens/equipamentos, com quantidade, lote, recebedor, horário, observação, URL de comprovante e justificativa de falha.
- Lotes com métricas calculadas de itens, locais, pendências, conclusões e falhas.
- Cálculo de atraso da rota e de paradas em minutos.
- Mapa Leaflet com origem, paradas, destino, cores de status e linha sequencial.
- Histórico persistente de criação, início, chegada, entrega, falha, atraso, cancelamento e recolhimento previsto pelo catálogo.
- Eventos desacoplados para criação/início/conclusão de rota e conclusão/falha de entrega, consumidos por auditoria e notificações.
- Páginas de lista, criação/edição, detalhe, entregas/lotes, mapa e histórico.
- Teste funcional autenticado da API com persistência real de veículo, rota, parada, lote, entrega e histórico.

## Arquivos principais alterados

- `plugins/logistics/routes/`: frontend, backend, DTOs, service, controller, módulo, tipos, estilos e testes.
- `packages/database/prisma/schema.prisma`.
- `packages/database/prisma/migrations/202610010001_routes_distribution/migration.sql`.
- `packages/security/src/permissions.ts`.
- `packages/event-bus/src/contracts.ts`.
- `packages/database/prisma/seed.ts`.
- `apps/api/src/app.module.ts`.
- Consumidores globais de auditoria e notificações para os novos eventos.

## Banco

Enums adicionados:

- `RouteStatus`.
- `RouteStopStatus`.
- `VehicleStatus`.
- `DeliveryStatus`.
- `LogisticsEventType`.

Models adicionados:

- `Vehicle`.
- `DistributionRoute`.
- `RouteStop`.
- `DeliveryBatch`.
- `Delivery`.
- `DeliveryItem`.
- `RouteHistoryEvent`.

Migration aditiva `202610010001_routes_distribution` criada e aplicada sem apagar ou resetar dados.

## Integrações globais

- AppModule: `RoutesModule` registrado.
- pluginRegistry: o plugin já estava registrado; o manifest e as rotas internas foram ampliados.
- Event Bus: `route.created`, `route.started`, `route.completed`, `delivery.completed` e `delivery.failed`.
- Segurança: `routes.read` e `routes.manage` adicionadas ao catálogo RBAC.
- Shared contracts: nenhuma alteração necessária; tipos específicos permaneceram no plugin.
- Seed: permissões sincronizadas de forma idempotente e perfis `OPERATOR`/`TECHNICIAN` atualizados conforme responsabilidade.

## Testes e validação

- `npm run db:generate`: passou.
- `npm run db:validate`: passou.
- `npm run check:boundaries`: passou.
- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm test`: passou, 10 arquivos e 22 testes.
- `npm run build`: passou; Vite apenas alertou sobre chunk acima de 500 kB.
- `npm run db:migrate:deploy`: passou e aplicou a migration.
- `npm run db:seed`: passou.
- Teste funcional autenticado: passou; rota `IN_PROGRESS`, uma parada, uma entrega `DELIVERED`, um lote e três eventos de histórico foram lidos novamente da API.
- `prisma migrate status`: primeira tentativa falhou com `P1001` por oscilação de conexão; o deploy subsequente conectou e concluiu.

## Pendências

- O comprovante é persistido como URL; upload e armazenamento binário não foram implementados.
- Não foi implementado roteamento viário externo, conforme permitido pelo escopo.

## IA utilizada

Codex, agente principal baseado em GPT-5.

## Tokens

Tokens: indisponível
