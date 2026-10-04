# Central de Incidentes

Plugin: `plugins/monitoring/incidents`

## Responsabilidade

Gerenciar a resposta operacional a ocorrências, da triagem ao fechamento, com prioridade, SLA, reconhecimento, escalonamento, atribuição e trilha temporal.

## Ciclo de vida

O contrato compartilhado em `@eops/shared/incidents` define as transições válidas. Resolução, reabertura e fechamento usam endpoints semânticos e permissões próprias; a mudança genérica de status não contorna essas regras.

```text
NEW → TRIAGED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
```

`CANCELLED` é terminal. Ações humanas usam sempre o ator da sessão autenticada.

## Operação

- `/incidents/queue`: fila priorizada por escalonamento, severidade, SLA vencido/próximo, falta de reconhecimento, falta de responsável e antiguidade;
- `/incidents/:id`: Resumo, Atendimento, Timeline e Atribuições;
- `/incidents/categories`: criação, edição e ativação/desativação sem apagar referências históricas;
- reconhecimento com duplicidade rejeitada;
- escalonamento crescente em níveis 1 a 3 com motivo;
- histórico de atribuições preserva responsável, início, fim e motivo;
- SLA classificado como `ON_TRACK`, `DUE_SOON`, `OVERDUE` ou `COMPLETED`;
- dashboard com volume, severidade, status, pendências e tempo médio de resolução.

A UI recebe `availableActions` calculado no backend a partir do status e das permissões da sessão, evitando apresentar mutações que seriam necessariamente rejeitadas.

## Eventos

As mutações publicam payloads mínimos e tipados para criação, atualização, reconhecimento, atribuição, status, severidade, escalonamento, comentário, resolução, reabertura, fechamento, cancelamento e manutenção de categorias. Objetos Prisma não são publicados.

## Segurança e integração

Leitura exige `incidents.read`; criação, atribuição, resolução, fechamento e atualização respeitam permissões específicas. Incidentes não importam Auditoria ou Notificações: a integração ocorre exclusivamente pelo `@eops/event-bus`.
