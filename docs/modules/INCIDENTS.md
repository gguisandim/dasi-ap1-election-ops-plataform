# Central de Incidentes

Plugin: `plugins/monitoring/incidents`

## Responsabilidade

Gerenciar o ciclo de vida de ocorrências operacionais, com prioridade, categoria, vínculo ao pleito/local/ativo, SLA, atribuição e timeline.

## Entidades

- `Incident`
- `IncidentCategory`
- `IncidentEvent`
- `IncidentAssignment`

Estados principais:

```text
NEW → TRIAGED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
```

Também existe `CANCELLED`; transições inválidas são rejeitadas pelo service.

## Funcionalidades

- listagem paginada e filtros;
- dashboard (`abertos`, `críticos`, `em atendimento`, `resolvidos hoje`, `SLA vencido`);
- criação e edição;
- atribuição com histórico imutável;
- comentários/timeline;
- mudança controlada de status;
- vínculo opcional com `Asset`;
- indicador de SLA;
- integração com local de votação;
- eventos `incident.created`, `incident.assigned` e `incident.resolved`.

## Segurança

Leitura exige `incidents.read`; criação, atribuição e alterações possuem permissões próprias. O autor da ação é obtido da sessão autenticada, e não de um `actorId` enviado pelo cliente.

## Integrações

Incidentes ativos alimentam o status operacional do local. Um incidente `CRITICAL` torna o marcador crítico; incidente `HIGH` gera atenção quando não existe condição mais grave.
