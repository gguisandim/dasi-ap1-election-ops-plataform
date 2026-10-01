# Gestão de Riscos — 2026-10-01

Etapa 4 de 6 da expansão de plugins operacionais da AP1.

## Prompt resumido

Criar o plugin **Gestão de Riscos**: identificar, avaliar e acompanhar riscos
operacionais do pleito, com registro completo (código, título, descrição, pleito,
zona/local opcionais, categoria, responsável, proprietário, probabilidade,
impacto, status, data de identificação, prazo, observação), escalas de cinco
níveis, score calculado por regra explícita, classificação em quatro faixas,
matriz 5×5 visual e clicável, mitigações com responsável/prazo/status/percentual/
evidência, status incluindo materialização, histórico completo, dashboard com
distribuições por categoria e zona, e materialização vinculada ao incidente por
Event Bus — sem importar o plugin de Incidents.

## Implementado

- Plugin `plugins/operations/risk-management` (categoria Operações).
- Escalas de probabilidade e impacto com os mesmos cinco níveis
  (`VERY_LOW`…`VERY_HIGH`, valores 1 a 5).
- **Score = valorDaProbabilidade × valorDoImpacto** (1 a 25), sempre calculado no
  servidor — o cliente exibe uma pré-visualização, mas nunca envia o score.
- **Classificação por faixa publicada**: 1–4 `LOW`, 5–9 `MODERATE`, 10–15 `HIGH`,
  16–25 `CRITICAL`. A matriz 5×5 é **derivada da mesma função**, e há teste
  garantindo que célula e registro nunca divirjam.
- Matriz 5×5 com contagem por célula, cores por faixa, legenda com as faixas de
  score e clique que abre a lista filtrada pela combinação.
- Mitigações: descrição, responsável, prazo, situação, percentual de conclusão,
  evidência (por ID) e observações. Ações com prazo vencido e não concluídas são
  marcadas como **atrasadas**; o progresso do risco é a média das ações não
  canceladas.
- Sete status (`IDENTIFIED`, `ASSESSED`, `MITIGATING`, `MONITORING`, `ACCEPTED`,
  `CLOSED`, `MATERIALIZED`) com máquina de transições; `CLOSED` é terminal.
- A primeira alteração de probabilidade ou impacto move o risco de `IDENTIFIED`
  para `ASSESSED`.
- **Materialização** registra data, impacto real, observação e vincula um incidente
  **por ID validado no banco central**; emite `risk.materialized`. Nenhum serviço de
  outro plugin é importado.
- **Escalonamento**: subir de faixa emite `risk.escalated`.
- Histórico com criação, avaliação, alteração de score (com valores anterior/novo e
  faixas), troca de proprietário, mudança de situação, mitigação adicionada /
  atualizada / concluída, materialização e encerramento.
- Dashboard: ativos, críticos, altos, sem mitigação, mitigações atrasadas,
  materializados, encerrados, aceitos, score médio e distribuições por categoria,
  zona, classificação e situação.
- Exclusão física restrita a risco `IDENTIFIED` sem plano de mitigação.

## Não implementado

- Risco financeiro, valor esperado monetário e apetite de risco por área.
- Cálculo estatístico de probabilidade: os níveis são atribuídos por pessoas.
- Workflow de aprovação para aceitação de risco e notificação por e-mail a
  proprietários.
- Visão consolidada entre pleitos em um único painel (o filtro por pleito cobre).

## Arquivos

Criados:

- `SPEC/2026-10-01-risk-management.md` (commitada antes do código).
- `plugins/operations/risk-management/`: `package.json`, `README.md`,
  `src/manifest.ts`, `src/index.ts`.
- Backend: `risk.{module,controller,service}.ts`, `risk-mitigation.service.ts`,
  `risk-catalog.service.ts`, `risk-timeline.service.ts`, `dto/risk.dto.ts`,
  `types/index.ts` e `helpers/{risk-scoring,risk-status,risk-code}.ts`.
- Frontend: 7 páginas, 10 componentes, `hooks/useRisks.ts`,
  `services/riskService.ts`, `utils/presentation.ts`, `styles/risk.module.css`.
- Testes: `helpers/risk-scoring.test.ts` e `risk.service.test.ts`.

Alterados:

- `packages/database/prisma/schema.prisma`, `packages/database/prisma/seed.ts`.
- `packages/security/src/permissions.ts`.
- `packages/shared/src/risks.ts`, `packages/shared/src/index.ts`,
  `packages/shared/package.json`, `packages/shared/src/format.ts` (novo `formatDate`).
- `packages/event-bus/src/contracts.ts`.
- `apps/api/src/app.module.ts`, `apps/web/src/pluginRegistry.ts`,
  `apps/web/package.json`.
- `plugins/system/notifications/src/server/notification.subscriber.ts`.

## Banco

Enums: `RiskProbability`, `RiskImpact`, `RiskLevel`, `RiskStatus`,
`RiskMitigationStatus`, `RiskEventType`.

Models: `Risk`, `RiskCategory`, `RiskMitigation`, `RiskEvent`. Back-relations
`risks` em `Election`, `ElectoralZone` e `PollingPlace`.

Índices: `[electionId, status]`, `[level, status]`, `[electoralZoneId, status]`,
`[pollingPlaceId, status]`, `[categoryId]`, `[probability, impact]`, `[dueDate]`,
`[riskId, status]`, `[dueDate, status]`, `[riskId, createdAt]`; únicos em `code`,
`key` de categoria.

Migration `202610010007_risk_management`: puramente aditiva — verificada por
ausência de `DROP TABLE`, `DROP COLUMN`, `DROP TYPE` e `ALTER COLUMN`.

## Backend

Serviços separados: `risk.service` (CRUD, filtros, painel, matriz, materialização,
encerramento), `risk-mitigation.service` (plano de mitigação com diferenciação de
adições, remoções e conclusões para o histórico), `risk-catalog.service`
(categorias) e `risk-timeline.service`. O cálculo de score, a classificação e a
matriz ficam em `helpers/risk-scoring.ts`, isolados e testados.

16 endpoints: listagem, painel, matriz, dados de apoio, categorias
(listar/criar/atualizar), detalhe, histórico, criação, atualização, substituição do
plano de mitigação, materialização, encerramento e exclusão restrita.

## Frontend

Páginas: painel, lista, novo risco, edição, detalhe, matriz e categorias.

Componentes: `RiskBadges` (classificação/situação/escala/chip), `RiskFilters`,
`RiskTable`, `RiskCard`, `RiskSummaryCards` + `DistributionList`, `RiskMatrix` +
`MatrixLegend` + `MatrixCellDetails`, `RiskForm` (com pré-visualização do score),
`MitigationList` + `MitigationEditor`, `MaterializationPanel`, `RiskTimeline` e
`CategoryManager`.

Hooks: listagem, painel, matriz, detalhe, dados de apoio, categorias e mutação.

## Segurança

`risks.read`, `risks.manage`, `risks.assess` no catálogo e no seed.
ADMIN/SUPERVISOR recebem as três; OPERATOR recebe as três; TECHNICIAN recebe
`read`/`assess`; VIEWER recebe `read`.

## Event Bus

`risk.created`, `risk.escalated`, `risk.materialized`, `risk.closed`. Notificações
consome `risk.escalated` e `risk.materialized` com tipo `CRITICAL` — são os dois
acontecimentos que exigem reação imediata.

## Shared

`packages/shared/src/risks.ts` exposto como `@eops/shared/risks`, incluindo
`RISK_SCALE_VALUES` e `RISK_LEVEL_BANDS` — as faixas de classificação são contrato
público, exibidas na interface. `formatDate` foi adicionado a
`@eops/shared/format` para prazos.

## Registros globais

- **AppModule:** `RiskManagementModule` registrado.
- **pluginRegistry:** `riskManagementPlugin` em Operações, rota `/risks`, ícone `△`,
  permissão `risks.read`.
- **Seed:** 6 categorias e 2 riscos demonstrativos — um `HIGH × HIGH = 16`
  (`CRITICAL`, em mitigação, com 2 ações e 3 eventos) e um `MEDIUM × MEDIUM = 9`
  (`MODERATE`, identificado, sem mitigação, para exercitar o indicador "sem
  mitigação"). Scores e classificações gravados conferem com a regra publicada.
  Protegido por verificação de existência: idempotente.

## Testes

`npx vitest run plugins/operations/risk-management` → **2 arquivos, 35 testes, todos aprovados.**

Cobrem: multiplicação da escala, limites de min/max, classificação nos limites de
cada faixa, consistência entre matriz e classificação, orientação da matriz,
detecção de escalonamento, média de progresso (ignorando canceladas e devolvendo
nulo sem plano), atraso de ação e de risco, criação com score no servidor,
rejeição de zona de outro pleito, recálculo com registro no histórico, transição
para `ASSESSED`, emissão de escalonamento (e ausência quando a faixa não sobe),
recusa de transição de encerrado, materialização (campos, vínculo e evento),
recusa de materializar duas vezes, de materializar encerrado e de incidente
inexistente, encerramento idempotente, regras de exclusão, filtros (classificação,
período, célula da matriz, busca, sem mitigação, mitigação atrasada) e ordenação do
painel.

**Defeito real encontrado e corrigido pelo lint:** código morto em
`RiskMatrixPage` (estado de filtros criado e nunca alterado) e import não usado em
`MitigationList`. Ambos removidos; a matriz passou a usar explicitamente o acervo
inteiro.

## Pendências

Nenhuma pendência funcional do plugin.

Infraestrutura: as quedas de conexão com o Supabase já documentadas continuaram; o
`db:seed` concluiu com sucesso.

## LOC

`npm run count:loc`:

| Momento | Arquivos | Linhas |
| --- | --- | --- |
| Baseline (antes da etapa 1) | 287 | 12.253 |
| Após a etapa 1 | 343 | 20.489 |
| Após a etapa 2 | 396 | 26.720 |
| Após a etapa 3 | 444 | 33.417 |
| Após a etapa 4 | 484 | 38.910 |
| Diferença da etapa 4 | +40 | **+5.493** |

## IA

`DeepSeek`

## Modelo

`deepseek-flash[1m]`

## Tokens

`indisponível`

## Próxima etapa

Etapa 5 — Planejamento de Recursos (`plugins/operations/resource-planning`).
