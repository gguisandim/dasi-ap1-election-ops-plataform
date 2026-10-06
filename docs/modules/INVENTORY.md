# Inventário e Ativos

Plugin: `plugins/logistics/inventory`

## Entidades

- `AssetType`
- `Asset`
- `AssetMovement`
- `AssetAssignment`
- `AssetReservation`
- `AssetMaintenance`

## Funcionalidades

- cadastro e consulta de ativos;
- tipos de ativos configuráveis;
- status e condição física;
- vínculo com zona/local;
- movimentação com origem, destino, responsável e motivo;
- histórico de movimentações;
- encerramento da alocação anterior ao mover;
- vínculo de incidentes ao ativo;
- dashboard de disponibilidade/manutenção/trânsito/alocação.
- estado operacional derivado, sem duplicar o status físico/administrativo;
- reservas com aprovação, cancelamento, validação de período e fulfillment na retirada;
- check-out/check-in com custódia, condição de saída/retorno e devolução prevista;
- manutenção preventiva/corretiva com lifecycle e bloqueio operacional;
- rotas `/inventory/reservations` e `/inventory/maintenance`.

## Ownership e integração com Routes

Inventory é o único owner do ativo, de sua disponibilidade, reserva, custódia e manutenção. Routes referencia apenas o ID do ativo em `DeliveryItem` e consulta a API pública de Inventory no frontend. Não existe import de implementação entre plugins.

O estado operacional segue a precedência: condição indisponível, manutenção ativa, custódia (incluindo atraso), reserva vigente e, por fim, o status persistido.

## Status

```text
AVAILABLE
ALLOCATED
IN_TRANSIT
IN_USE
MAINTENANCE
LOST
RETIRED
```

Condições:

```text
GOOD
ATTENTION
DAMAGED
UNAVAILABLE
```

## Event Bus

Além dos eventos existentes, o módulo publica eventos tipados de reserva, retirada, devolução e manutenção. O `actorId` corresponde ao usuário autenticado; responsáveis logísticos permanecem dados separados da operação. Audit observa os eventos pela assinatura global, enquanto Notifications cataloga apenas abertura de manutenção como sinal de valor operacional.
