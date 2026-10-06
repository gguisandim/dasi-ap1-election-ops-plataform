# Reports e Analytics Operacional 2.0

Plugin `@eops/plugin-reports`, em `plugins/analytics/reports`, categoria `analytics`, rota `/reports`.

Documentação descritiva. A fonte normativa é `SPEC/2026-10-06-platform-depth-integration.md` (Parte 2).

## Papel

Reports responde "o que aconteceu e como se comportou ao longo do tempo". É análise histórica e agregada — não é o Command Center (estado atual) nem o Simulador (treinamento).

O plugin não é dono de nenhum domínio de origem. Lê `Incident`, `TransmissionPoint`/`TransmissionStateTransition`/`TransmissionAttempt`, `ResourceRequest`, `FieldShift`, `FieldDispatch`, `DistributionRoute`/`Delivery`, `Asset`/`AssetMaintenance` e `PreparationChecklist` em modo somente-leitura, com `select` explícito.

## Isolamento

- Artefatos simulados ficam fora das séries por default (`Incident.isSimulated = false`); `includeSimulated` é explícito e default `false`.
- Consultas respeitam o pleito; quando o domínio não tem `electionId`, o filtro usa a entidade âncora (zona, local, ativo, time).
- A comparação de zonas exige `electionId`, porque sem pleito não há denominador confiável.

## Vocabulário de métricas

Fechado, definido em `packages/shared/src/reports.ts` (`REPORT_METRICS`). Métrica fora do vocabulário é rejeitada com `400`. Cobre incidentes (abertos, críticos, resolvidos, escalados, vencidos, ativos), transmissão (falhas, offline, taxa de sucesso), solicitações de recurso (criadas, atendidas, vencidas), cobertura de turno, dispatches, rotas e entregas, preparação e ativos.

## Séries temporais

`GET /reports/timeseries` aceita granularidade `hour`, `day` ou `week`, janela máxima de 366 dias e filtros de pleito, zona e local. O eixo temporal é contínuo: bucket sem dado retorna `0` com `sampleSize: 0`, e o `sampleSize` acompanha cada bucket porque séries com denominadores diferentes não são equivalentes.

## Fórmulas de SLA

Implementadas como funções puras em `packages/shared/src/reports.ts` e cobertas por teste:

```text
meanResponseMinutes   média(acknowledgedAt − openedAt)
meanResolutionMinutes média(resolvedAt − openedAt)
mttrMinutes           média da resolução restrita a severity HIGH/CRITICAL
slaCompliancePercent  100 × resolvidos no prazo / incidentes com slaDeadline
deadlineMisses        não-terminais vencidos + terminais resolvidos após o prazo
escalationRatePercent 100 × incidentes com escalationLevel > 0 / abertos no período
transmissionDowntimeMinutes  Σ intervalos OFFLINE (TransmissionStateTransition)
transmissionUptimePercent    100 × (janela − downtime) / janela
fulfillmentMeanMinutes       média(fulfilledAt − submittedAt)
dispatchMeanMinutes          média(completedAt − requestedAt)
```

Regra transversal: **nenhuma média usa denominador zero**. Sem amostra o valor é `null` com `sampleSize: 0`, e a interface mostra "sem dados" — nunca `0`.

## Comparação de zonas

`GET /reports/zones` devolve, por zona, valor absoluto, `per1000Voters` e `perPlace`, sempre acompanhados do denominador. Zona sem denominador (`registeredVoters = 0` ou `pollingPlaceCount = 0`) recebe `null` no normalizado e no ranking normalizado — o objetivo é impedir ranking enganoso.

## Drill-down

Todo agregado tem caminho até a entidade real:

```text
GET /reports/drilldown?metric=&from=&to=&bucketStart=&bucketEnd=&limit=
```

Devolve as entidades do bucket com `deepLink` para a rota real do domínio (`INCIDENT`, `TRANSMISSION_POINT`, `RESOURCE_REQUEST`, `FIELD_SHIFT`, `FIELD_DISPATCH`, `ROUTE`, `ASSET`, `PREPARATION_CHECKLIST`). `truncated: true` quando o limite é atingido, mas `total` continua sendo o total real do bucket.

## Visões salvas

`ReportSavedView` com filtros validados por whitelist (`REPORT_VIEW_FILTER_KEYS`). Visão privada por default; compartilhar exige `reports.manage`; editar/remover exige ser owner ou ter `reports.manage`; `isDefault` é transacional por owner; máximo de 20 por owner.

O modelo é próprio do plugin, não uma cópia de `CommandCenterSavedView`: a fronteira entre plugins proíbe importar implementação interna de outro domínio, e as duas semânticas de filtro são distintas (o Command Center filtra itens de atenção; Reports filtra séries e métricas).

## Export

CSV e PDF mantidos; `GET /reports/export.json` devolve JSON estruturado com escopo, seções dos relatórios por domínio e séries quando solicitadas. Todos exigem `reports.export` e respeitam o escopo.

## Rotas

```text
/reports
/reports/timeseries
/reports/sla
/reports/zones
/reports/views
/reports/export
/reports/operations
/reports/incidents
/reports/transmission
/reports/workforce
/reports/logistics
/reports/assets
```

## Permissões

```text
reports.read     dashboards, séries, SLA, zonas, drill-down, leitura de visões, export.json
reports.manage   criar, editar, remover e compartilhar visões
reports.export   CSV, PDF e JSON estruturado
```

## Eventos

Somente mutações próprias: `report_view.created` e `report_view.shared`. Leitura analítica não emite evento.

## Limites conhecidos

- A busca textual do explorer não cobre séries; o drill-down é o caminho para inspecionar um bucket.
- Métricas ancoradas em `updatedAt` (ativos, preparação) refletem o último estado conhecido, não a data do fato original.
- `transmissionUptimePercent` depende de `TransmissionStateTransition`; janela sem histórico de transição retorna `null` em vez de inventar disponibilidade.
