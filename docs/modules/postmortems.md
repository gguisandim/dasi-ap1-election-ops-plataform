# Postmortem e RCA

Plugin `@eops/plugin-postmortems`, em `plugins/operations/postmortems`, categoria `operations`, rota `/postmortems`.

Documentação descritiva. A fonte normativa é `SPEC/2026-10-06-operational-coordination-suite.md` (Parte 3).

## Papel

Responde "o que aconteceu, por quê e o que precisa mudar?". É dono da análise pós-incidente, do RCA, da timeline analítica, das causas, das lições aprendidas, das ações corretivas, do review e da publicação.

O plugin **nunca** altera o incidente original: não muda status, severidade ou responsável, e não cria `IncidentEvent`. Publicar um postmortem não fecha o incidente.

## Lifecycle

```text
DRAFT → IN_REVIEW → APPROVED → PUBLISHED → ARCHIVED
              ↓
        CHANGES_REQUESTED → IN_REVIEW
```

`ARCHIVED` é terminal. `PUBLISHED` não volta para `DRAFT` nem para `CHANGES_REQUESTED`.

O conteúdo (resumos, causas, lições, ações, timeline) só é editável em `DRAFT` e `CHANGES_REQUESTED`. Em `IN_REVIEW`, `APPROVED` e `PUBLISHED`, apenas ações administrativas são permitidas — com uma exceção: o `status` de uma ação corretiva pode ser atualizado por quem gerencia o postmortem ou por quem é responsável pela ação, mesmo após o review.

## Incidente primário

`primaryIncidentId` é obrigatório e precisa estar `RESOLVED` ou `CLOSED` na criação. Um incidente aceita **um** postmortem não arquivado por vez; arquivar libera o incidente para uma nova análise, preservando o histórico. Incidentes relacionados são referências adicionais, não duplicatas de incidente.

## Timeline e importação

A timeline aceita entradas manuais e importadas. O import lê:

- marcos do incidente (abertura, reconhecimento, escalonamento, resolução, encerramento);
- `IncidentEvent` do incidente primário e dos relacionados;
- `ShiftHandover` vinculadas a esses incidentes (submissão, confirmação, cancelamento);
- `ResourceRequest` do incidente primário (submissão, aprovação, atendimento, rejeição);
- `Task` ligadas por dispatch ou passagem de turno, quando solicitado.

A idempotência vem da chave única `(postmortemId, sourceType, sourceId)`: reimportar não cria duplicata e o retorno informa quantas entradas foram criadas e quantas foram ignoradas. Entradas `MANUAL` têm `sourceId` nulo e não colidem entre si. Entradas importadas não podem ser removidas individualmente — elas são regeneradas a partir da origem.

## Causas (RCA e 5 Whys)

`PostmortemCause` forma uma árvore com `parentId`, tipos `ROOT_CAUSE`, `CONTRIBUTING_FACTOR` e `CONDITION`, e categorias `PEOPLE`, `PROCESS`, `TECHNOLOGY`, `COMMUNICATION`, `LOGISTICS`, `EXTERNAL` e `OTHER`. A profundidade máxima é 5 níveis, o que cobre a ferramenta 5 Whys sem modelo separado. A causa superior precisa pertencer ao mesmo postmortem e ciclos são recusados.

## Lições e ações corretivas

Lições têm tipo `WENT_WELL`, `WENT_WRONG`, `LESSON` ou `FOLLOW_UP` e categoria opcional.

Ações corretivas têm prioridade, responsável, prazo, status (`OPEN`, `IN_PROGRESS`, `DONE`, `CANCELLED`) e vínculo opcional com uma `Task` existente. O plugin **não** cria tarefas automaticamente — o vínculo é sempre explícito e exibido como deep link.

## Review e publicação

Pré-condições para enviar ao review: incidente elegível, resumos executivo/impacto/causa raiz preenchidos, ao menos uma causa `ROOT_CAUSE`, ao menos uma lição, ao menos um revisor designado e — para incidentes `HIGH`/`CRITICAL` — ao menos uma ação corretiva.

Regra de aprovação: todos os revisores designados precisam de decisão `APPROVED` na sua decisão **mais recente**. Qualquer `CHANGES_REQUESTED` devolve o postmortem para ajustes. O histórico de reviews é append-only: decisões anteriores nunca são removidas, e um revisor que pediu mudanças só conta como aprovador depois de registrar nova decisão de aprovação.

`PUBLISHED` exige `APPROVED` e a permissão `postmortems.publish`, e registra `publishedAt` e `publishedById`. Publicar não cria artigo na base de conhecimento.

## Insights

`/postmortems/insights` agrega dados reais: causas por categoria e tipo, causas recorrentes (categoria + tipo presentes em duas ou mais análises), lições por tipo e categoria, incidentes por severidade, ações abertas e vencidas, e tempo médio entre criação e publicação (`null` quando não há publicações). Não substitui os relatórios consolidados da plataforma.

## Ações vencidas

`postmortem.action_overdue` é emitido quando uma ação vencida é observada por uma consulta autenticada do dashboard, no máximo uma vez por ação. A marcação fica em `PostmortemActionItem.overdueNotifiedAt`. Não há scheduler nem job assíncrono.

## Permissões

```text
postmortems.read     leitura
postmortems.manage   criar, editar, arquivar, submeter para review
postmortems.review   registrar decisão de review
postmortems.publish  publicar
```

## Rotas

```text
/postmortems
/postmortems/dashboard
/postmortems/new
/postmortems/insights
/postmortems/:id
/postmortems/:id/edit
/postmortems/:id/timeline
```

## Arquivos principais

```text
src/server/postmortems.service.ts        lifecycle, causas, lições, ações, review, publicação
src/server/timeline-import.ts            candidatos e plano de importação idempotente
src/server/insights.ts                   agregações de RCA
src/client/components/CauseTree.tsx      árvore causal editável
packages/shared/src/postmortems.ts       transições, árvore, regras de review e pré-condições
```

## Limites conhecidos

- A pipeline de importação de `Task` depende de vínculo via dispatch ou passagem de turno; tarefas sem esses vínculos não entram na timeline.
- A regra de "um postmortem ativo por incidente" é verificada na transação de criação. A migration não cria índice único parcial sobre o incidente, então a garantia é de aplicação, não de banco.
