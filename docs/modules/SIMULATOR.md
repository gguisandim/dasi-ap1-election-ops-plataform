# Simulador Operacional

Plugin: `plugins/simulation/operational-simulator`

## Objetivo

Produzir eventos de treinamento claramente marcados como simulados e exercitar Incidentes, Inventário, mapa, Event Bus, notificações e auditoria.

## Entidades

- `SimulationScenario`
- `Simulation`
- `SimulationEvent`

## Estados

```text
DRAFT
RUNNING
PAUSED
FINISHED
CANCELLED
```

## Fluxo atual

1. criar uma simulação para um pleito;
2. escolher velocidade, probabilidade e tipos de falha;
3. iniciar;
4. cada `tick` seleciona um ativo/local e gera uma falha simulada;
5. é criado um `Incident` com `isSimulated=true` e `simulationId`;
6. opcionalmente o ativo é colocado temporariamente em manutenção;
7. o Event Bus distribui os efeitos para auditoria/notificações;
8. ao encerrar, incidentes simulados ativos são resolvidos e estados temporários de ativos são restaurados;
9. `SimulationEvent` mantém a timeline usada pelo replay básico.

## Isolamento

`applyToOperations=false` mantém a simulação isolada das condições dos ativos produtivos. Mesmo assim os incidentes criados continuam explicitamente marcados como simulados.

## Segurança

Consulta exige `simulation.read`; criação e controles exigem `simulation.manage`. O criador é obtido da sessão autenticada.
