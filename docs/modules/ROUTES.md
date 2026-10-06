# Rotas e Distribuição

Plugin: `plugins/logistics/routes`

## Ownership

Routes é o owner de rotas, veículos, paradas, lotes, entregas, carga, dispatch, exceções e histórico logístico. Ativos continuam pertencendo ao Inventory e são referenciados por ID através de contratos públicos.

## Lifecycle

```text
PLANNED → READY → DISPATCHED → IN_PROGRESS → COMPLETED
```

`DELAYED` representa execução ativa atrasada e `CANCELLED` é terminal. Transições são validadas por endpoint próprio; timestamps de saída, chegada e entrega são definidos pelo servidor.

## Planejamento e carga

- veículo, motorista, paradas e entrega são exigidos antes de `READY`;
- capacidade conhecida do veículo é comparada com a quantidade da carga;
- ativos identificados precisam existir e estar livres de manutenção, custódia e outra rota ativa;
- lotes e entregas só podem ser alterados durante planejamento;
- o estado de risco `ON_TIME`, `AT_RISK` ou `DELAYED` é derivado.

## Execução

- paradas seguem `PENDING → ARRIVED → COMPLETED`, com `FAILED` e `SKIPPED` exigindo motivo;
- reordenação usa a lista completa de paradas e ocorre em transação;
- falhas de entrega criam uma exceção consultável;
- prova mínima de entrega registra recebedor, horário do servidor, ator e URL opcional;
- exceções podem ser registradas e resolvidas sem criar Incident automaticamente.

## Event Bus

Eventos pequenos e tipados cobrem liberação, dispatch, início, conclusão, cancelamento, ações de parada, reordenação e exceções. Audit continua usando a infraestrutura global. Notifications cataloga exceções e falhas de entrega, evitando eventos rotineiros.

## Limitações intencionais

Não há GPS em tempo real, otimização automática, WMS, upload próprio de evidências, WebSocket ou criação automática de Incident nesta versão.
