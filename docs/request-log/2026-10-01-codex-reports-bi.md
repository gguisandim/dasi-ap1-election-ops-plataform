# Relatórios e BI — 2026-10-01

## Prompt resumido

Implementar o plugin de Relatórios e BI usando agregações reais dos módulos persistidos, com dashboard executivo, análises por pleito/zona/local, incidentes, inventário, disponibilidade, filtros, histórico e exportações CSV/PDF.

## Implementado

- Dashboard executivo calculado diretamente sobre eleições, zonas, locais, incidentes, inventário, rotas e transmissões.
- Filtros por período, pleito, zona, local, categoria e status.
- Indicadores de locais operacionais/críticos, incidentes, SLA, ativos, transmissão, rotas e entregas atrasadas.
- Incidentes por severidade, categoria e status; tempo médio de resolução; SLA; evolução diária.
- Inventário por status, condição, tipo e localização; contagem de movimentações.
- Métricas consolidadas de disponibilidade de locais, ativos e pontos online.
- Agregações por zona e por local.
- Comparação com período anterior equivalente quando data inicial e final são informadas.
- Gráficos de barras acessíveis em React/CSS, baseados em séries reais.
- Exportação CSV real e autenticada.
- Relatório PDF funcional no backend, gerado com PDFKit a partir das mesmas agregações persistidas.
- Download binário autenticado adicionado ao `@eops/api-client`.

## Arquivos principais alterados

- `plugins/analytics/reports/`: frontend, backend, DTO, agregador, controller, módulo, componentes, tipos, estilos e testes.
- `packages/api-client/src/index.ts` e teste.
- `packages/security/src/permissions.ts`.
- `packages/database/prisma/seed.ts`.
- `apps/api/src/app.module.ts`.
- `package-lock.json` para PDFKit.

## Banco

Nenhum model, enum ou migration foi criado. Os relatórios consultam os domínios existentes e não duplicam dados analíticos.

## Integrações globais

- AppModule: `ReportsModule` registrado.
- pluginRegistry: o plugin já estava registrado; manifest e rota foram atualizados.
- Event Bus: nenhuma alteração necessária.
- Segurança: `reports.read` e `reports.export` adicionadas.
- Shared contracts: nenhuma alteração necessária; contratos analíticos permanecem no plugin.
- Seed: permissões de leitura/exportação sincronizadas; leitura concedida aos perfis operacionais e técnicos.
- API client: método `getBlob` com autenticação para CSV/PDF.

## Testes e validação

- `npm run db:generate`: passou.
- `npm run db:validate`: passou.
- `npm run check:boundaries`: passou.
- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm test`: passou, 12 arquivos e 27 testes.
- `npm run build`: passou; Vite alertou sobre chunk acima de 500 kB.
- `npm run db:seed`: passou.
- Teste funcional do dashboard: passou; retornou 28 locais operacionais, 2 incidentes abertos, transmissão em 100% e 4 zonas para o pleito consultado.
- Exportação CSV: passou; conteúdo continha cabeçalho e indicadores reais.
- Exportação PDF: passou; resposta iniciou com `%PDF`, terminou com `%%EOF` e teve conteúdo não vazio.

## Pendências

- A métrica de equipes está explicitamente indisponível até a criação do domínio Equipes de Campo na Etapa 4. A integração será concluída nessa etapa, sem dependência direta entre plugins.

## IA utilizada

Codex, agente principal baseado em GPT-5.

## Tokens

Tokens: indisponível
