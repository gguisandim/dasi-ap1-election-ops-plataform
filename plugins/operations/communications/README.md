# Comunicações Operacionais

Centraliza comunicados oficiais e mensagens internas da operação eleitoral, com
direcionamento explícito, priorização e confirmação de leitura auditável.

- **Categoria:** Operações
- **Rota raiz:** `/communications`
- **Permissões:** `communications.read`, `communications.manage`, `communications.publish`
- **Spec:** [`SPEC/2026-10-01-operational-communications.md`](../../../SPEC/2026-10-01-operational-communications.md)

## Páginas

| Rota | Página |
| --- | --- |
| `/communications` | Painel com indicadores, prioritários e publicados recentes |
| `/communications/messages` | Lista filtrável com acompanhamento de leitura |
| `/communications/messages/new` | Novo comunicado |
| `/communications/messages/:id` | Detalhe, ações de ciclo de vida e timeline |
| `/communications/messages/:id/edit` | Edição |
| `/communications/messages/:id/tracking` | Acompanhamento de leitura e confirmação |
| `/communications/templates` | Templates reutilizáveis |
| `/communications/inbox` | Caixa do operador (pendentes e histórico) |

## Ciclo de vida

```text
DRAFT ──▶ SCHEDULED ──▶ PUBLISHED ──▶ EXPIRED ──▶ ARCHIVED
  │            │             │            │
  └────────────┴─────────────┴────────────┴────▶ CANCELLED
```

`ARCHIVED` e `CANCELLED` são terminais. A expiração é **derivada**: um comunicado
publicado cujo `expiresAt` passou é convertido em `EXPIRED` na primeira leitura
que o encontra — sem job agendado, e de forma idempotente (a atualização é
condicional a `status = PUBLISHED`, evitando eventos duplicados sob concorrência).

## Direcionamento

Cada linha de `CommunicationAudience` é uma regra tipada que aponta para
exatamente um alvo. Publicar exige ao menos uma regra.

| Tipo | Alvo | Quem é alcançado |
| --- | --- | --- |
| `ALL` | — | Usuários ativos + membros de equipes ativas |
| `ELECTORAL_ZONE` | zona | Membros com escala ou alocação vigente na zona |
| `POLLING_PLACE` | local | Membros com escala ou alocação vigente no local |
| `FIELD_TEAM` | equipe | Membros da equipe |
| `OPERATIONAL_ROLE` | função operacional | Membros cuja função é a indicada |
| `USER` | usuário | O usuário da plataforma indicado |

A resolução é determinística e explicável — não há IA nem heurística opaca.
Destinatários são deduplicados por identidade (`user:<id>` / `member:<id>`), de
modo que uma pessoa alcançada por duas regras recebe uma única vez.

## Confirmação de leitura

Cada destinatário percorre `PENDING → DELIVERED → VIEWED → CONFIRMED`. Publicar
marca todos como `DELIVERED` (o comunicado entra na caixa de cada um). Confirmar
implica leitura. Uma leitura posterior **não** rebaixa quem já confirmou.

Destinatários que já saíram de `PENDING` são preservados ao recalcular o
direcionamento: o histórico de leitura é auditável e não desaparece.

## Estrutura

```text
src/
  manifest.ts
  index.ts
  server/
    communications.module.ts          registro NestJS
    communications.controller.ts      endpoints
    communications.service.ts         CRUD, ciclo de vida e expiração
    communication-recipients.service.ts  resolução, entrega e confirmação
    communication-metrics.service.ts     indicadores agregados
    communication-templates.service.ts   templates, categorias e etiquetas
    communication-timeline.service.ts    eventos da timeline
    helpers/                          regras puras e testáveis
    dto/                              validação de entrada
  client/
    pages/ components/ hooks/ services/ styles/ utils/
```

## Integrações globais

- **Event Bus:** `communication.created`, `communication.published`,
  `communication.cancelled`, `communication.expired`, `communication.archived`,
  `communication.read`, `communication.acknowledged`. Consumidos por Auditoria e
  Notificações; nenhum import direto entre plugins.
- **Shared:** contratos em `@eops/shared/communications`.
- **Banco:** models `Communication*` no `schema.prisma` central, migration
  `202610010004_operational_communications`.

## Testes

```bash
npx vitest run plugins/operations/communications
```

Cobrem máquina de estados, expiração, códigos, métricas, validação e
deduplicação de direcionamento, resolução de destinatários, leitura/confirmação,
publicação idempotente, retenção de publicados e filtros.
