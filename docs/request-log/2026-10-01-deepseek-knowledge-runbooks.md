# Base de Conhecimento e Runbooks — 2026-10-01

Etapa 3 de 6 da expansão de plugins operacionais da AP1.

## Prompt resumido

Criar o plugin **Base de Conhecimento / Runbooks**: manter procedimentos
operacionais e soluções conhecidas para acelerar atendimento, com artigos
(título, resumo, conteúdo, categoria, status, autor, versão, tags), runbooks
(problema, sintomas, diagnóstico, pré-requisitos, passos, validação, rollback,
escalonamento, referências), passos ordenados como registros próprios, categorias
cadastráveis, associação a categoria de incidente / severidade / palavras-chave /
tipo de ativo, **recomendação automática determinística e explicável** (sem IA
externa), registro de uso com resultado, métricas de eficácia e cobertura, busca
textual e versionamento.

## Implementado

- Plugin `plugins/operations/knowledge-runbooks` (categoria Operações).
- Artigos e runbooks na mesma base pesquisável, distinguidos por `kind` — decisão
  que mantém busca, categorização, versionamento e métricas em um só lugar.
- Runbook completo: problema, sintomas, diagnóstico, pré-requisitos, validação,
  rollback, escalonamento e referências.
- **Passos ordenados como entidade própria** (`RunbookStep`): ordem, título,
  instrução, resultado esperado, obrigatório/opcional, alerta e observações.
  Alterações de ordem são renumeradas a partir de 1.
- Categorias cadastráveis (7 semeadas: conectividade, hardware, transmissão,
  energia, logística, software, autenticação) e etiquetas reutilizáveis.
- Associação a incidente por categoria, severidade, tipo de ativo e palavras-chave
  normalizadas (sem acento, minúsculas, únicas).
- **Recomendação determinística e explicável** (`runbook-matching`):
  categoria 40 + severidade 20 + tipo de ativo 15 + 5 por palavra-chave (máx. 25),
  teto 100. Cada resultado devolve `breakdown` e `reasons`, e a interface expõe a
  legenda dos pesos. Empates são desempatados por quem já resolveu mais, maior taxa
  de sucesso, maior uso e, por fim, título — ordem estável entre execuções.
- Recomendação por incidente existente (contexto lido do registro) ou por
  critérios avulsos, para quando o incidente ainda não foi aberto.
- **Registro de uso**: incidente, usuário, passos concluídos, desfecho
  (`RESOLVED`/`PARTIALLY_RESOLVED`/`NOT_RESOLVED`), observações e intervalo. Os
  contadores agregados ficam no próprio verbete para não exigir agregação a cada
  consulta.
- Página de execução com marcação de passos, progresso e registro do desfecho.
- Métricas: runbooks mais utilizados, taxa de sucesso, distribuição de desfechos,
  cobertura por categoria (menor cobertura primeiro), publicados sem uso e
  desatualizados (sem atualização há mais de 180 dias).
- Versionamento com **instantâneo** de título, resumo, conteúdo e passos, com nota
  obrigatória quando o verbete já saiu do rascunho.
- Fluxo `DRAFT → REVIEW → PUBLISHED → ARCHIVED`; publicar exige resumo e, em
  runbooks, ao menos um passo; exclusão física restrita a rascunho.
- Busca textual em título, resumo, problema, sintomas e conteúdo, mais filtros por
  tipo, situação, categoria, categoria de incidente, etiqueta, desatualizados e sem
  uso.
- Teste de recomendação na própria página do runbook: a curadoria confere com que
  pontuação ele seria sugerido para um incidente aberto.

## Não implementado

- Recomendação por IA ou embeddings: o matching é local, explicável e testável
  (fora de escopo declarado na spec).
- Aprovação em múltiplas etapas, comentários, avaliações por estrelas e FAQ.
- Editor rich-text e anexos embutidos (evidências pertencem à etapa 2; o vínculo é
  por ID).
- Execução automatizada dos passos: o runbook é um roteiro para pessoas.
- Comparação lado a lado de duas versões (o painel mostra o conteúdo de cada uma).

## Arquivos

Criados:

- `SPEC/2026-10-01-knowledge-runbooks.md` (commitada antes do código).
- `plugins/operations/knowledge-runbooks/`: `package.json`, `README.md`,
  `src/manifest.ts`, `src/index.ts`.
- Backend: `knowledge.{module,controller,service}.ts`,
  `knowledge-catalog.service.ts`, `runbook.service.ts`, `dto/knowledge.dto.ts`,
  `types/index.ts` e `helpers/{runbook-matching,knowledge-status,knowledge-code,tag-slug}.ts`.
- Frontend: 9 páginas, 10 componentes, `hooks/useKnowledge.ts`,
  `services/knowledgeService.ts`, `utils/presentation.ts`,
  `styles/knowledge.module.css`.
- Testes: 6 arquivos (`helpers/*.test.ts`, `knowledge.service.test.ts`,
  `runbook.service.test.ts`).

Alterados:

- `packages/database/prisma/schema.prisma`, `packages/database/prisma/seed.ts`.
- `packages/security/src/permissions.ts`.
- `packages/shared/src/knowledge.ts`, `packages/shared/src/index.ts`,
  `packages/shared/package.json`.
- `packages/event-bus/src/contracts.ts`.
- `apps/api/src/app.module.ts`, `apps/web/src/pluginRegistry.ts`,
  `apps/web/package.json`.
- `plugins/system/notifications/src/server/notification.subscriber.ts`.

## Banco

Enums: `KnowledgeArticleKind`, `KnowledgeArticleStatus`, `RunbookUsageOutcome`
(`IncidentSeverity` foi reusado para a severidade alvo).

Models: `KnowledgeCategory`, `KnowledgeTag`, `KnowledgeTagLink`,
`KnowledgeArticle`, `RunbookStep`, `KnowledgeArticleVersion`, `RunbookUsage`.

Índices: `[kind, status]`, `[status, categoryId]`, `[incidentCategoryKey, status]`,
`[incidentSeverity, status]`, `[updatedAt]`, `[publishedAt]`, `[articleId, order]`
(único), `[articleId, createdAt]`, `[outcome]`, `[incidentId]`, `[userId, createdAt]`;
únicos em `code`, `key` de categoria, `(articleId, number)` e `label`/`slug` de
etiqueta.

Migration `202610010006_knowledge_runbooks`: puramente aditiva — verificada por
ausência de `DROP TABLE`, `DROP COLUMN`, `DROP TYPE` e `ALTER COLUMN`.

## Backend

Serviços separados: `knowledge.service` (CRUD, busca, painel, publicação,
versionamento, passos), `runbook.service` (recomendação, uso, métricas),
`knowledge-catalog.service` (categorias e etiquetas) e o helper puro
`runbook-matching` com o score isolado para teste direto da regra.

22 endpoints: listagem, painel, dados de apoio, métricas, recomendações, histórico
de uso, categorias (listar/criar/atualizar), etiquetas (listar/criar), detalhe,
versões, usos do runbook, criação, edição, substituição de passos, publicar,
enviar para revisão, arquivar, registrar uso e excluir rascunho.

## Frontend

Páginas: base de conhecimento, novo verbete, detalhe, editor, versões, execução de
runbook, recomendações, métricas e categorias.

Componentes: `KnowledgeBadges` (tipo/situação/desfecho/chip), `KnowledgeFilters`,
`KnowledgeTable`, `KnowledgeCard`, `KnowledgeSummaryCards`, `KnowledgeArticleForm`,
`RunbookStepsEditor` + `RunbookStepList`, `RunbookExecutionPanel`
(progresso e seletor de desfecho), `RecommendationList` + `ScoringLegend`,
`UsageHistoryTable`, `VersionHistoryTable`, `CategoryManager` e `TagInput`.

Hooks: listagem, painel, métricas, verbete, dados de apoio, categorias,
recomendações (só busca com critério informado), mutação e execução de runbook com
controle de passos concluídos.

## Segurança

`knowledge.read`, `knowledge.manage`, `knowledge.publish`, `knowledge.execute` no
catálogo e no seed. ADMIN/SUPERVISOR recebem as quatro; OPERATOR recebe
`read`/`manage`/`execute`; TECHNICIAN recebe `read`/`execute`; VIEWER recebe `read`.

## Event Bus

`runbook.created`, `runbook.published`, `runbook.matched` (emitido quando a
recomendação a partir de um incidente retorna resultados) e `runbook.executed`.
Consumidos por Notificações (`runbook.published` e `runbook.executed`; o
`runbook.matched` não gera notificação por ser resultado de consulta).

## Shared

`packages/shared/src/knowledge.ts` exposto como `@eops/shared/knowledge`, incluindo
`RUNBOOK_MATCH_WEIGHTS` e `RUNBOOK_STALE_DAYS` — os pesos da regra são um contrato
público, não uma constante escondida no backend.

## Registros globais

- **AppModule:** `KnowledgeRunbooksModule` registrado.
- **pluginRegistry:** `knowledgeRunbooksPlugin` em Operações, rota `/knowledge`,
  ícone `❖`, permissão `knowledge.read`.
- **Seed:** 7 categorias, 1 etiqueta, 1 runbook publicado com 5 passos ordenados,
  5 palavras-chave, associação a `CONNECTIVITY`/`HIGH`/`ROUTER`, 1 versão inicial e
  1 execução registrada (resolvida, vinculada ao `INC-00001`) com os contadores do
  verbete coerentes. Protegido por verificação de existência: idempotente.

## Testes

`npx vitest run plugins/operations/knowledge-runbooks` → **6 arquivos, 66 testes, todos aprovados.**

Cobrem: score por cada componente e combinações, teto de 25 nas palavras-chave,
comparação por termo exato, normalização e tokenização (acento, caixa, palavras
vazias, repetições), ordenação determinística em todos os níveis de desempate, taxa
de sucesso, transições de estado, regra de desatualização, códigos, normalização de
etiquetas e palavras-chave, criação com código/autor/versão inicial, exigência de
problema em runbook, ausência de evento ao criar artigo, publicação (exigência de
passos, idempotência, recusa de arquivado), exigência de nota de alteração,
avanço de versão, renumeração de passos, exclusão restrita a rascunho, filtros
(busca em 5 campos, desatualizados, sem uso), ordenação de cobertura, recomendações
(por critério, por incidente, descarte sem correspondência, limite, emissão de
evento) e registro de uso (contadores, desfecho negativo, fim automático).

Ajustes feitos durante os testes: três expectativas minhas estavam erradas, não o
código — (1) três palavras-chave valem 15 pontos, não 25; (2) `reconecta` não casa
com a palavra-chave `reconexao`, pois a comparação é por termo exato; (3) a
ordenação de cobertura coloca a maior cobertura por último, não "Sem categoria".

## Pendências

Nenhuma pendência funcional do plugin.

Infraestrutura: as quedas de conexão com o Supabase já documentadas nas etapas
anteriores continuaram; o `db:seed` foi executado com sucesso.

## LOC

`npm run count:loc`:

| Momento | Arquivos | Linhas |
| --- | --- | --- |
| Baseline (antes da etapa 1) | 287 | 12.253 |
| Após a etapa 1 | 343 | 20.489 |
| Após a etapa 2 | 396 | 26.720 |
| Após a etapa 3 | 444 | 33.417 |
| Diferença da etapa 3 | +48 | **+6.697** |

## IA

`DeepSeek`

## Modelo

`deepseek-flash[1m]`

## Tokens

`indisponível`

## Próxima etapa

Etapa 4 — Gestão de Riscos (`plugins/operations/risk-management`).
