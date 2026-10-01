# Gestão de Riscos

Identificação, avaliação e acompanhamento dos riscos operacionais do pleito, com
score calculado por regra explícita, matriz 5×5, plano de mitigação acompanhado e
registro de materialização vinculado ao incidente.

- **Categoria:** Operações
- **Rota raiz:** `/risks`
- **Permissões:** `risks.read`, `risks.manage`, `risks.assess`
- **Spec:** [`SPEC/2026-10-01-risk-management.md`](../../../SPEC/2026-10-01-risk-management.md)

## Páginas

| Rota | Página |
| --- | --- |
| `/risks` | Painel: indicadores, matriz e distribuições |
| `/risks/list` | Lista filtrável |
| `/risks/new` | Novo risco |
| `/risks/:id` | Detalhe, mitigações, materialização e histórico |
| `/risks/:id/edit` | Edição da avaliação e do plano de mitigação |
| `/risks/matrix` | Matriz 5×5 interativa |
| `/risks/categories` | Categorias cadastráveis |

## A regra do score

Probabilidade e impacto usam a mesma escala de cinco níveis, com valores de 1 a 5.

```text
score = valorDaProbabilidade × valorDoImpacto      (1 a 25)
```

| Score | Classificação |
| --- | --- |
| 1 – 4 | `LOW` |
| 5 – 9 | `MODERATE` |
| 10 – 15 | `HIGH` |
| 16 – 25 | `CRITICAL` |

A matriz 5×5 é **derivada da mesma função** de classificação — não existe uma
segunda tabela de decisão que possa divergir do que está gravado. Há teste
garantindo a consistência célula a célula.

O score **nunca** vem do cliente: o formulário mostra uma pré-visualização, e o
servidor recalcula ao salvar.

## Mitigação

Cada risco pode ter várias ações com responsável, prazo, situação, percentual de
conclusão, evidência (por ID) e observações. Ação com prazo vencido e não concluída
é marcada como **atrasada**; o progresso do risco é a média das ações não
canceladas, e risco sem nenhuma ação entra no indicador "sem mitigação".

O plano é substituído em bloco, e o serviço diferencia o que entrou, saiu e foi
concluído para registrar cada movimento no histórico.

## Materialização

Quando o risco deixa de ser hipótese, registra-se data, impacto real, observação e,
opcionalmente, o incidente correspondente — **por ID validado no banco central**.
Nenhum serviço de outro plugin é importado; o vínculo é uma referência, e o
acontecimento é publicado como `risk.materialized`.

## Histórico

Criação, avaliação, alteração de score (com valores anterior/novo e faixas),
troca de proprietário, mudança de situação, mitigação adicionada/atualizada/
concluída, materialização e encerramento. É o que permite responder por que um
risco subiu de faixa.

## Descarte

Exclusão física só para risco `IDENTIFIED` e sem plano de mitigação. Risco tratado
é histórico: **encerre** em vez de excluir.

## Estrutura

```text
src/
  manifest.ts / index.ts
  server/
    risk.module.ts              registro NestJS
    risk.controller.ts          endpoints
    risk.service.ts             CRUD, filtros, painel, matriz, materialização
    risk-mitigation.service.ts  plano de mitigação e detecção de atraso
    risk-catalog.service.ts     categorias
    risk-timeline.service.ts    histórico
    helpers/risk-scoring.ts      score, classificação e matriz (isolados)
    dto/                        validação de entrada
  client/
    pages/ components/ hooks/ services/ styles/ utils/
```

## Integrações globais

- **Event Bus:** `risk.created`, `risk.escalated`, `risk.materialized`,
  `risk.closed`; Notificações consome `escalated` e `materialized` como críticos.
- **Shared:** contratos em `@eops/shared/risks`, incluindo `RISK_LEVEL_BANDS`.
- **Banco:** models `Risk*` no `schema.prisma` central, migration
  `202610010007_risk_management`.

## Testes

```bash
npx vitest run plugins/operations/risk-management
```

Cobrem o cálculo do score, os limites de cada faixa, a consistência entre matriz e
classificação, escalonamento, progresso, atraso, criação com score no servidor,
materialização com vínculo de incidente, regras de exclusão e filtros.
