# Simulador Operacional

Plugin `@eops/plugin-simulator`, categoria `simulation`, rota `/simulator`.

Executa cenários persistidos, gera eventos reproduzíveis e cria incidentes marcados como simulados. Alterações em ativos só ocorrem quando `applyToOperations` está habilitado e são restauradas no encerramento.

A execução é determinística para `(cenário, seed, sequência de ticks)` — o gerador pseudoaleatório é semeado por `seed + offsetSeconds`, nunca pelo relógio de parede. Artefatos simulados carregam `Incident.isSimulated = true` e ficam fora das consultas operacionais reais e das séries de Reports por default.

Documentação completa do módulo, dos tipos de evento, do lifecycle (`DRAFT → RUNNING → PAUSED → FINISHED/FAILED/CANCELLED`), das decisões de operador, dos snapshots e do score de 11 dimensões: [docs/modules/SIMULATOR.md](../../../docs/modules/SIMULATOR.md).

Fonte normativa: `SPEC/2026-10-06-platform-depth-integration.md` (Parte 1).
