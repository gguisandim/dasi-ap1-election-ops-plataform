# Central de Comando (Command Center)

Plugin `@eops/plugin-command-center`, em `plugins/monitoring/command-center`, categoria `monitoring`, rota `/command-center`.

Documentação descritiva. A fonte normativa é `SPEC/2026-10-06-operational-coordination-suite.md` (Parte 1).

## Papel

A Central de Comando responde "o que está acontecendo agora?". Ela **não** é o módulo de relatórios: Reports é histórico e análise; a Central de Comando é o estado operacional corrente.

O plugin é dono de:

- visão operacional agregada;
- saved views;
- situation snapshots;
- contratos de agregação;
- ranking de atenção.

Ele **não** é dono de nenhum dos domínios que lê. Nunca altera `Incident`, `Task`, `TransmissionPoint`, `FieldShift`, `FieldDispatch`, `ShiftHandover`, `PreparationChecklist`, `DistributionRoute`, `Asset`, `ResourceRequest` ou `Postmortem`.

## Como os dados chegam

Cada seção é carregada por leitura somente-leitura via `PrismaService` compartilhado, com `select` explícito. Não há import de código de outro plugin. Quando o ator não possui a permissão de leitura do domínio de origem, a seção **nem é consultada** — a resposta traz `{ available: false, reason: "FORBIDDEN" }` e as métricas daquele domínio ficam `null`. Contagem também é informação de domínio, então ela é omitida junto.

Permissões subjacentes: `incidents.read`, `transmission.read`, `shifts.read`, `field-teams.read`, `shift-handovers.read`, `preparation-checklists.read`, `routes.read`, `inventory.read`, `resource-requests.read`.

## Feed unificado de atenção

Attention items são derivados a cada consulta e nunca persistidos (exceto dentro de um snapshot). Cada item carrega origem, severidade, estado, prazo, idade, score, deep link e `metadata`.

O score é determinístico:

```text
score = severityWeight + deadlineWeight + statusWeight + ageWeight + impactWeight
```

com os pesos documentados em `packages/shared/src/command-center.ts` (`ATTENTION_WEIGHTS`). A ordenação é total: score desc, idade asc, origem asc, id asc.

O estado geral (`NORMAL`, `ATTENTION`, `CRITICAL`) deriva da classificação dos itens: um item é crítico quando a severidade é `CRITICAL`, o prazo está vencido ou o estado é `ESCALATED`/`BLOCKED`.

## Saved views

Cada operador mantém suas visões. Visões privadas são visíveis apenas para o dono; compartilhadas ficam visíveis para quem tem `command-center.read` e só podem ser criadas, editadas ou removidas por quem tem `command-center.manage`. Os filtros são restritos a `severity`, `sourceType`, `statusState`, `electionId` e `electoralZoneId` — qualquer outra chave é rejeitada.

## Snapshots

Um snapshot registra manualmente o estado agregado em um instante: escopo, saúde, métricas, até 20 itens mais relevantes e o resumo por zona. Ele é imutável e serve para comparação, registro de situação e referência pós-evento. A comparação devolve apenas deltas de métricas numéricas.

## Wallboard

`/command-center?mode=wallboard` entrega um painel de alta densidade, sem formulários, com auto-refresh por polling (30–60 s, padrão 45 s, ou o intervalo da visão padrão do usuário). Não usa WebSocket. O polling é limpo no unmount e não dispara requisições concorrentes.

## Rotas

```text
/command-center
/command-center/attention
/command-center/zones
/command-center/views
/command-center/snapshots
```

## Backend

```text
GET    /command-center/summary
GET    /command-center/attention
GET    /command-center/zones
GET    /command-center/workforce
GET    /command-center/logistics
GET    /command-center/continuity
GET    /command-center/views
POST   /command-center/views
PATCH  /command-center/views/:id
DELETE /command-center/views/:id
GET    /command-center/snapshots
GET    /command-center/snapshots/:id
GET    /command-center/snapshots/:id/compare
POST   /command-center/snapshots
```

## Arquivos principais

```text
src/server/command-center.service.ts              agregação e leitura gateada por permissão
src/server/attention/attention-signals.ts         sinais puros por domínio (testável sem Prisma)
src/server/command-center-views.service.ts        saved views
src/server/command-center-snapshots.service.ts    snapshots e comparação
src/client/hooks/useOperationalSummary.ts         polling com cleanup
src/client/components/Wallboard.tsx               modo painel
packages/shared/src/command-center.ts             contrato, pesos e ordenação
```

## Limites conhecidos

- O feed é truncado em 100 itens por consulta; cada domínio é limitado a 500 linhas na leitura.
- A cobertura de turno usa `isOperationalShiftAssignment` de `@eops/shared/workforce` como definição compartilhada de designação operacional.
- Sinais de ativos sem zona eleitoral não aparecem na matriz por zona, mas continuam no feed.
