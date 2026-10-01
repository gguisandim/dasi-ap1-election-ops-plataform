# Inventário e Ativos

Plugin: `plugins/logistics/inventory`

## Entidades

- `AssetType`
- `Asset`
- `AssetMovement`
- `AssetAssignment`

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

O módulo publica `asset.created`, `asset.moved` e `asset.status_changed`. O `actorId` desses eventos corresponde ao usuário autenticado que executou a operação; o responsável logístico continua sendo um dado separado da movimentação.
