# Solicitações de Recurso (Resource Requests)

Plugin `@eops/plugin-resource-requests`, em `plugins/operations/resource-requests`, categoria `operations`, rota `/resource-requests`.

Documentação descritiva. A fonte normativa é `SPEC/2026-10-06-operational-coordination-suite.md` (Parte 2).

## Papel

Formaliza o ciclo "precisamos de algo → pedido → triagem → aprovação → atendimento". Cobre equipamento, equipe, veículo, transporte, apoio técnico, material e outros recursos operacionais.

O plugin é dono do pedido, da triagem, da aprovação, da responsabilidade, do fulfillment e do histórico. **Não** é dono de `Asset`, `AssetReservation`, `AssetType`, `FieldTeam`, `Vehicle`, `DistributionRoute`, `Task` ou `Incident`: ele referencia esses domínios e nunca altera o lifecycle deles.

## Lifecycle

```text
DRAFT → SUBMITTED → TRIAGED → APPROVED → PARTIALLY_FULFILLED → FULFILLED
SUBMITTED | TRIAGED                 → REJECTED
DRAFT | SUBMITTED | TRIAGED | APPROVED | PARTIALLY_FULFILLED → CANCELLED
```

`FULFILLED`, `REJECTED` e `CANCELLED` são terminais. Não existe reabertura: um novo pedido deve ser criado. A tabela completa está em `RESOURCE_REQUEST_TRANSITIONS`, em `@eops/shared/resource-requests`, e qualquer transição fora dela é rejeitada com `409`.

## Itens e atendimento

Um pedido tem um ou mais itens. Itens de catálogo (`ASSET_TYPE`, `FIELD_TEAM`, `VEHICLE`) exigem a referência correspondente; os demais tipos não aceitam FK, porque representam conceitos genéricos descritos por rótulo e quantidade.

O atendimento é registrado em `ResourceRequestFulfillment`. Vários atendimentos por item são permitidos. `fulfilledQuantity`, `remainingQuantity` e o status derivado (`PARTIALLY_FULFILLED` / `FULFILLED`) são calculados exclusivamente no servidor, dentro da transação que grava o atendimento. O cliente nunca define esses valores.

## Validações de atendimento

- Ativo: precisa existir e não pode estar `LOST`, `RETIRED` ou `MAINTENANCE`; condição `UNAVAILABLE` também é recusada.
- Reserva: precisa pertencer ao ativo informado e estar `REQUESTED` ou `APPROVED`.
- Equipe: precisa existir, estar `ACTIVE` e pertencer ao mesmo pleito do pedido.
- Veículo: não pode estar `UNAVAILABLE`.
- Rota: precisa pertencer ao mesmo pleito.
- Tarefa: precisa existir.

O plugin nunca aprova reservas, muda status de ativos, altera disponibilidade de equipes nem cria tarefas.

## Urgência

Derivada de `neededAt` e do status, nunca persistida:

```text
status terminal            → COMPLETED
neededAt ausente           → ON_TRACK
now > neededAt             → OVERDUE
neededAt - now <= 4 horas  → DUE_SOON
caso contrário             → ON_TRACK
```

## Fila e dashboard

A fila ordena por urgência, prioridade, prazo e idade. O dashboard traz contagens reais por status, prioridade, zona, tipo de item e responsável.

## availableActions

O servidor devolve `availableActions` no detalhe, considerando status, permissões do ator e vínculo (solicitante ou responsável). O cliente apenas exibe o que recebe.

## Permissões

```text
resource-requests.read     leitura
resource-requests.manage   criar, editar rascunho, triagem, cancelar
resource-requests.approve  aprovar, rejeitar
resource-requests.fulfill  registrar e remover atendimento
```

## Rotas

```text
/resource-requests
/resource-requests/dashboard
/resource-requests/queue
/resource-requests/list
/resource-requests/new
/resource-requests/:id
/resource-requests/:id/edit
```

## Arquivos principais

```text
src/server/resource-requests.service.ts     lifecycle, triagem, fulfillment, fila
src/server/fulfillment-rules.ts             elegibilidade pura de ativo/equipe/veículo/rota
src/client/components/FulfillmentPanel.tsx  painel de atendimento
packages/shared/src/resource-requests.ts    transições, urgência, cálculo e ordenação
```

## Limites conhecidos

- `code` é gerado por ano (`RR-<ano>-<4 dígitos>`) dentro da transação de criação. A sequência é derivada do maior código existente do ano; não há contador dedicado.
- Comentários são append-only: não há edição nem remoção.
- A leitura da fila é limitada a 500 candidatos por consulta antes da ordenação.
