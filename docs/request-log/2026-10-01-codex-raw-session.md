ou tratar esta execução como uma continuação real, começando por uma nova auditoria completa e pelo estado do Neon antes de qualquer edição. Primeiro vou registrar o LOC inicial, ler README/documentação/logs, verificar workspaces, versões efetivamente travadas no lockfile, schema/migrations e rodar a suíte existente; só avançarei para Incidentes depois que a base 1–4 estiver estável.

&#x20; Ran commands

A auditoria inicial confirma um worktree limpo, LOC inicial confiável de 6.284 e um `.env` local ignorado já presente. A documentação ainda descreve a execução anterior sem Neon, então vou validar o estado atual diretamente sem exibir credenciais: presença das variáveis, versões resolvidas no lockfile, schema/migration e conexão Prisma com o banco configurado.

&#x20; Ran commands

A estabilização local está verde: instalação offline reproduzível, Prisma Client 6.19.3, TypeScript, lint, 4 testes e ambos os builds passaram; o npm agora reporta zero vulnerabilidades. Também confirmei que os placeholders antigos de Pleitos e Locais estão mortos, enquanto os de Incidentes, Inventário, Auditoria e outros plugins ainda são as implementações ativas e portanto não serão removidos antes da substituição funcional.

&#x20; Ran commands

A conexão pooled do Neon está confirmada por consulta real e somente leitura: 1 pleito, 4 zonas, 32 locais e 208 seções. O `prisma migrate status` reproduziu a falha do schema engine, coerente com a particularidade já relatada, mas o Prisma Client funciona normalmente; vou registrar e preservar esse comportamento, inspecionando `_prisma_migrations` sem alterar o banco antes de criar qualquer migration nova.

&#x20; Ran commands

A estabilização encontrou um defeito concreto antes das novas etapas: `npm run dev:api` compila sem erros, mas o Nest tenta abrir `apps/api/dist/main` enquanto o monorepo emite `dist/apps/api/src/main.js`. Vou corrigir esse ciclo de desenvolvimento primeiro, fixar todas as versões `latest` pelas versões já resolvidas no lockfile e remover apenas os placeholders mortos de Pleitos/Locais; os protótipos que ainda sustentam plugins ativos serão substituídos somente na etapa correspondente.

Edited files, ran commands

Context automatically compacted

A instalação do Playwright está em andamento. Assim que ela concluir, vou validar o servidor de desenvolvimento corrigido e executar novamente toda a esteira de estabilização antes de tocar no módulo de incidentes.

Read files, ran commands

A estabilização já encontrou dois pontos concretos: o modo de desenvolvimento agora localiza corretamente o build do Nest, e o `P1001` reaparece apenas quando o processo fica na sandbox sem acesso de rede — a conexão Neon já havia sido confirmada fora dela. O primeiro E2E também revelou que o Vitest estava coletando arquivos do Playwright; vou separar essas suítes antes de executar o fluxo no navegador.

Edited files, read files, ran commands

O módulo de incidentes já está estruturado de ponta a ponta: schema/migration, API modular, validação das relações pleito–zona–local, transições de status, atribuições imutáveis, SLA, timeline e telas reais com filtros. Agora estou compilando essa vertical para corrigir incompatibilidades antes de integrar os indicadores ao local de votação.

Edited files, read files, ran commands

A vertical de incidentes passou em TypeScript, lint e 8 testes unitários. Vou aplicar agora a migration aditiva no Neon pelo fluxo oficial; se o Prisma Migrate repetir a limitação já conhecida, usarei exatamente o fallback documentado (`db execute` + `migrate resolve`) e registrarei o resultado real.

Ran npm.cmd run db:migrate:deploy

Command declined by auto-review: "C:\\\WINDOWS\\\System32\\\WindowsPowerShell\\\v1.0\\\powershell.exe" -Command 'npm.cmd run db:seed'

O `migrate deploy` funcionou diretamente pela conexão pooled e aplicou a migration de incidentes sem workaround. A execução do seed foi bloqueada com razão porque o script legado apagava toda a estrutura antes de recriá-la; estou tornando o seed idempotente e preservador de dados antes de tentar novamente.

Edited a file, ran commands

O seed idempotente concluiu no Neon mantendo os 4/32/208 registros e adicionando a base de incidentes. A ocorrência de `P1001` durante a primeira tentativa foi mitigada removendo rajadas paralelas de upserts; isso será registrado como comportamento real do pool. Com incidentes estabilizado, inicio agora a etapa de inventário, incluindo vínculo direto incidente–ativo.

Edited files, read files, ran commands

Inventário também passou em TypeScript, lint e nos testes de criação, mudança de estado e movimentação imutável; migration e seed foram aplicados no Neon. Vou avançar para autenticação/RBAC e auditoria agora, mantendo autorização real no Nest (não apenas ocultação visual).

Edited files, ran commands

Autenticação/RBAC já está persistida e o seed criou os cinco perfis e usuários demo com `scrypt`; o token é assinado e a API aplica guards globais, com permissões específicas nos endpoints de incidentes e inventário. Agora estou substituindo o placeholder de auditoria por consulta real antes de desacoplar as emissões com o Event Bus.

Edited files, read files, ran commands

Event Bus tipado, subscribers de auditoria e notificações, sino e lista persistente já estão conectados; a migration correspondente foi aplicada. Vou concluir o simulador com dados claramente marcados como simulados e restauração de ativos ao encerrar, evitando deixar efeitos de treinamento misturados à operação real.

Edited files, ran commands

O seed encontrou agora `P2024` (timeout do pool) depois de muitas atualizações idempotentes da estrutura que já estava íntegra. Vou reduzir o seed para pular a reconstrução das 208 seções quando os 4/32/208 registros esperados já existem; os módulos novos continuarão sendo sincronizados normalmente.

Edited files, ran commands

As etapas 5–9 estão agora implementadas como verticais reais e as 6 migrations foram aplicadas. A validação unitária está em 20 testes aprovados; vou fazer agora build e E2E real contra o Neon, incluindo login, cadeia pleito→mapa e abertura de Incidentes/Inventário/Simulador.

&#x20; Ran commands

O E2E iniciou corretamente API, web e Edge, mas falhou logo após o login: a interface permaneceu fora da aplicação. Vou inspecionar o erro renderizado e corrigir a autenticação antes de repetir os fluxos; não vou tratar essa execução como aprovada.

Edited files, ran commands

Worked for 1h 38m 47s

A terceira execução não chegou aos testes: o processo da API recebeu o `P1001` intermitente já conhecido ao abrir o pool Neon. Vou endurecer a inicialização do Prisma com tentativas limitadas e backoff apenas para `P1001`; isso melhora tanto desenvolvimento quanto E2E sem mascarar outros erros de banco.

Edited files, ran commands

You've hit your usage limit. Upgrade your plan or add credits to continue, or try again at 1:33 AM.

&#x20; Edited 156 files+3,440-463Review changes

UndoReview

.env.example.env.example+2-0

apps/api/package.jsonapps/api/package.json+13-13

apps/api/src/app.module.tsapps/api/src/app.module.ts+14-0

apps/api/src/health.controller.tsapps/api/src/health.controller.ts+2-0

apps/web/package.jsonapps/web/package.json+11-8

apps/web/src/App.tsxapps/web/src/App.tsx+14-2

apps/web/src/main.tsxapps/web/src/main.tsx+2-1

apps/web/src/pluginRegistry.tsapps/web/src/pluginRegistry.ts+6-0

docs/database/NEON.mddocs/database/NEON.md+65-0

package.jsonpackage.json+13-11

packages/api-client/src/index.tspackages/api-client/src/index.ts+9-0

packages/database/package.jsonpackages/database/package.json+2-2

packages/database/prisma/migrations/202609300002_incidents/migration.sqlpackages/database/prisma/migrations/202609300002_incidents/migration.sql+81-0

packages/database/prisma/migrations/202609300003_inventory/migration.sqlpackages/database/prisma/migrations/202609300003_inventory/migration.sql+57-0

packages/database/prisma/migrations/202609300004_auth_rbac_audit/migration.sqlpackages/database/prisma/migrations/202609300004_auth_rbac_audit/migration.sql+48-0

packages/database/prisma/migrations/202609300005_notifications/migration.sqlpackages/database/prisma/migrations/202609300005_notifications/migration.sql+17-0

packages/database/prisma/migrations/202609300006_simulator/migration.sqlpackages/database/prisma/migrations/202609300006_simulator/migration.sql+36-0

packages/database/prisma/schema.prismapackages/database/prisma/schema.prisma+460-28

packages/database/prisma/seed.tspackages/database/prisma/seed.ts+282-72

packages/database/src/nest.tspackages/database/src/nest.ts+13-2

packages/event-bus/package.jsonpackages/event-bus/package.json+8-0

packages/event-bus/src/index.test.tspackages/event-bus/src/index.test.ts+9-0

packages/event-bus/src/index.tspackages/event-bus/src/index.ts+31-0

packages/plugin-sdk/src/index.tspackages/plugin-sdk/src/index.ts+4-0

packages/shared/src/index.tspackages/shared/src/index.ts+117-0

packages/ui/package.jsonpackages/ui/package.json+2-2

playwright.config.tsplaywright.config.ts+38-0

plugins/analytics/reports/package.jsonplugins/analytics/reports/package.json+1-1

plugins/logistics/inventory/package.jsonplugins/logistics/inventory/package.json+9-1

plugins/logistics/inventory/src/client/components/AssetBadge.tsxplugins/logistics/inventory/src/client/components/AssetBadge.tsx+9-0

plugins/logistics/inventory/src/client/pages/AssetDetailPage.tsxplugins/logistics/inventory/src/client/pages/AssetDetailPage.tsx+15-0

plugins/logistics/inventory/src/client/pages/AssetFormPage.tsxplugins/logistics/inventory/src/client/pages/AssetFormPage.tsx+25-0

plugins/logistics/inventory/src/client/pages/AssetListPage.tsxplugins/logistics/inventory/src/client/pages/AssetListPage.tsx+25-0

plugins/logistics/inventory/src/client/pages/AssetMovePage.tsxplugins/logistics/inventory/src/client/pages/AssetMovePage.tsx+15-0

plugins/logistics/inventory/src/client/pages/AssetTypesPage.tsxplugins/logistics/inventory/src/client/pages/AssetTypesPage.tsx+10-0

plugins/logistics/inventory/src/client/services/inventoryService.tsplugins/logistics/inventory/src/client/services/inventoryService.ts+24-0

plugins/logistics/inventory/src/client/styles/inventory.module.cssplugins/logistics/inventory/src/client/styles/inventory.module.css+25-0

plugins/logistics/inventory/src/components/StatusCard.tsxplugins/logistics/inventory/src/components/StatusCard.tsx+0-7

plugins/logistics/inventory/src/index.tsplugins/logistics/inventory/src/index.ts+19-4

plugins/logistics/inventory/src/pages/Overview\.tsxplugins/logistics/inventory/src/pages/Overview\.tsx+0-26

plugins/logistics/inventory/src/server/dto/asset.dto.tsplugins/logistics/inventory/src/server/dto/asset.dto.ts+59-0

plugins/logistics/inventory/src/server/inventory.controller.tsplugins/logistics/inventory/src/server/inventory.controller.ts+20-0

plugins/logistics/inventory/src/server/inventory.module.tsplugins/logistics/inventory/src/server/inventory.module.ts+6-0

plugins/logistics/inventory/src/server/inventory.service.test.tsplugins/logistics/inventory/src/server/inventory.service.test.ts+49-0

plugins/logistics/inventory/src/server/inventory.service.tsplugins/logistics/inventory/src/server/inventory.service.ts+141-0

plugins/logistics/inventory/src/services/demoService.tsplugins/logistics/inventory/src/services/demoService.ts+0-5

plugins/logistics/inventory/src/styles/overview\.module.cssplugins/logistics/inventory/src/styles/overview\.module.css+0-14

plugins/logistics/inventory/src/types/index.tsplugins/logistics/inventory/src/types/index.ts+0-1

plugins/logistics/routes/package.jsonplugins/logistics/routes/package.json+1-1

plugins/monitoring/incidents/package.jsonplugins/monitoring/incidents/package.json+9-1

plugins/monitoring/incidents/src/client/components/IncidentBadge.tsxplugins/monitoring/incidents/src/client/components/IncidentBadge.tsx+12-0

plugins/monitoring/incidents/src/client/components/IncidentFilters.tsxplugins/monitoring/incidents/src/client/components/IncidentFilters.tsx+28-0

plugins/monitoring/incidents/src/client/components/IncidentTimeline.tsxplugins/monitoring/incidents/src/client/components/IncidentTimeline.tsx+17-0

plugins/monitoring/incidents/src/client/pages/IncidentDetailPage.tsxplugins/monitoring/incidents/src/client/pages/IncidentDetailPage.tsx+23-0

plugins/monitoring/incidents/src/client/pages/IncidentFormPage.tsxplugins/monitoring/incidents/src/client/pages/IncidentFormPage.tsx+54-0

plugins/monitoring/incidents/src/client/pages/IncidentListPage.tsxplugins/monitoring/incidents/src/client/pages/IncidentListPage.tsx+47-0

plugins/monitoring/incidents/src/client/services/incidentService.tsplugins/monitoring/incidents/src/client/services/incidentService.ts+65-0

plugins/monitoring/incidents/src/client/styles/incidents.module.cssplugins/monitoring/incidents/src/client/styles/incidents.module.css+34-0

plugins/monitoring/incidents/src/components/StatusCard.tsxplugins/monitoring/incidents/src/components/StatusCard.tsx+0-7

plugins/monitoring/incidents/src/index.tsplugins/monitoring/incidents/src/index.ts+15-4

plugins/monitoring/incidents/src/pages/Overview\.tsxplugins/monitoring/incidents/src/pages/Overview\.tsx+0-26

plugins/monitoring/incidents/src/server/dto/incident.dto.tsplugins/monitoring/incidents/src/server/dto/incident.dto.ts+82-0

plugins/monitoring/incidents/src/server/incidents.controller.tsplugins/monitoring/incidents/src/server/incidents.controller.ts+31-0

plugins/monitoring/incidents/src/server/incidents.module.tsplugins/monitoring/incidents/src/server/incidents.module.ts+6-0

plugins/monitoring/incidents/src/server/incidents.service.test.tsplugins/monitoring/incidents/src/server/incidents.service.test.ts+71-0

plugins/monitoring/incidents/src/server/incidents.service.tsplugins/monitoring/incidents/src/server/incidents.service.ts+278-0

plugins/monitoring/incidents/src/services/demoService.tsplugins/monitoring/incidents/src/services/demoService.ts+0-5

plugins/monitoring/incidents/src/styles/overview\.module.cssplugins/monitoring/incidents/src/styles/overview\.module.css+0-14

plugins/monitoring/incidents/src/types/index.tsplugins/monitoring/incidents/src/types/index.ts+0-1

plugins/monitoring/operational-map/package.jsonplugins/monitoring/operational-map/package.json+2-2

plugins/monitoring/operational-map/src/client/components/MapMarker.tsxplugins/monitoring/operational-map/src/client/components/MapMarker.tsx+1-0

plugins/monitoring/transmission/package.jsonplugins/monitoring/transmission/package.json+1-1

plugins/operations/elections/package.jsonplugins/operations/elections/package.json+6-6

plugins/operations/elections/src/client/pages/ElectionListPage.tsxplugins/operations/elections/src/client/pages/ElectionListPage.tsx+1-1

plugins/operations/elections/src/components/StatusCard.tsxplugins/operations/elections/src/components/StatusCard.tsx+0-7

plugins/operations/elections/src/pages/Overview\.tsxplugins/operations/elections/src/pages/Overview\.tsx+0-26

plugins/operations/elections/src/server/elections.service.tsplugins/operations/elections/src/server/elections.service.ts+6-3

plugins/operations/elections/src/services/demoService.tsplugins/operations/elections/src/services/demoService.ts+0-5

plugins/operations/elections/src/styles/overview\.module.cssplugins/operations/elections/src/styles/overview\.module.css+0-14

plugins/operations/elections/src/types/index.tsplugins/operations/elections/src/types/index.ts+0-1

plugins/operations/electoral-zones/package.jsonplugins/operations/electoral-zones/package.json+2-2

plugins/operations/electoral-zones/src/client/pages/ZoneDetailPage.tsxplugins/operations/electoral-zones/src/client/pages/ZoneDetailPage.tsx+1-1

plugins/operations/electoral-zones/src/client/pages/ZoneListPage.tsxplugins/operations/electoral-zones/src/client/pages/ZoneListPage.tsx+1-1

plugins/operations/polling-places/package.jsonplugins/operations/polling-places/package.json+6-6

plugins/operations/polling-places/src/client/pages/PollingPlaceDetailPage.tsxplugins/operations/polling-places/src/client/pages/PollingPlaceDetailPage.tsx+16-0

plugins/operations/polling-places/src/client/styles/places.module.cssplugins/operations/polling-places/src/client/styles/places.module.css+2-0

plugins/operations/polling-places/src/components/StatusCard.tsxplugins/operations/polling-places/src/components/StatusCard.tsx+0-7

plugins/operations/polling-places/src/pages/Overview\.tsxplugins/operations/polling-places/src/pages/Overview\.tsx+0-26

plugins/operations/polling-places/src/server/operational-status.test.tsplugins/operations/polling-places/src/server/operational-status.test.ts+8-0

plugins/operations/polling-places/src/server/operational-status.tsplugins/operations/polling-places/src/server/operational-status.ts+8-0

plugins/operations/polling-places/src/server/polling-places.service.tsplugins/operations/polling-places/src/server/polling-places.service.ts+42-14

plugins/operations/polling-places/src/services/demoService.tsplugins/operations/polling-places/src/services/demoService.ts+0-5

plugins/operations/polling-places/src/styles/overview\.module.cssplugins/operations/polling-places/src/styles/overview\.module.css+0-14

plugins/operations/polling-places/src/types/index.tsplugins/operations/polling-places/src/types/index.ts+0-1

plugins/operations/polling-sections/package.jsonplugins/operations/polling-sections/package.json+2-2

plugins/simulation/operational-simulator/README.mdplugins/simulation/operational-simulator/README.md+3-0

plugins/simulation/operational-simulator/package.jsonplugins/simulation/operational-simulator/package.json+4-0

plugins/simulation/operational-simulator/src/client/pages/SimulationDetailPage.tsxplugins/simulation/operational-simulator/src/client/pages/SimulationDetailPage.tsx+14-0

plugins/simulation/operational-simulator/src/client/pages/SimulatorPage.tsxplugins/simulation/operational-simulator/src/client/pages/SimulatorPage.tsx+14-0

plugins/simulation/operational-simulator/src/client/services/simulatorService.tsplugins/simulation/operational-simulator/src/client/services/simulatorService.ts+9-0

plugins/simulation/operational-simulator/src/client/styles/simulator.module.cssplugins/simulation/operational-simulator/src/client/styles/simulator.module.css+6-0

plugins/simulation/operational-simulator/src/index.tsplugins/simulation/operational-simulator/src/index.ts+5-0

plugins/simulation/operational-simulator/src/manifest.tsplugins/simulation/operational-simulator/src/manifest.ts+2-0

plugins/simulation/operational-simulator/src/server/dto/simulation.dto.tsplugins/simulation/operational-simulator/src/server/dto/simulation.dto.ts+13-0

plugins/simulation/operational-simulator/src/server/simulator.controller.tsplugins/simulation/operational-simulator/src/server/simulator.controller.ts+14-0

plugins/simulation/operational-simulator/src/server/simulator.module.tsplugins/simulation/operational-simulator/src/server/simulator.module.ts+4-0

plugins/simulation/operational-simulator/src/server/simulator.service.test.tsplugins/simulation/operational-simulator/src/server/simulator.service.test.ts+36-0

plugins/simulation/operational-simulator/src/server/simulator.service.tsplugins/simulation/operational-simulator/src/server/simulator.service.ts+55-0

plugins/system/access-control/README.mdplugins/system/access-control/README.md+3-0

plugins/system/access-control/package.jsonplugins/system/access-control/package.json+20-0

plugins/system/access-control/src/client/AuthContext.tsxplugins/system/access-control/src/client/AuthContext.tsx+17-0

plugins/system/access-control/src/client/pages/LoginPage.tsxplugins/system/access-control/src/client/pages/LoginPage.tsx+10-0

plugins/system/access-control/src/client/pages/UserListPage.tsxplugins/system/access-control/src/client/pages/UserListPage.tsx+11-0

plugins/system/access-control/src/client/services/authService.tsplugins/system/access-control/src/client/services/authService.ts+12-0

plugins/system/access-control/src/client/styles/access.module.cssplugins/system/access-control/src/client/styles/access.module.css+8-0

plugins/system/access-control/src/index.tsplugins/system/access-control/src/index.ts+6-0

plugins/system/access-control/src/manifest.tsplugins/system/access-control/src/manifest.ts+2-0

plugins/system/access-control/src/server/access-control.module.tsplugins/system/access-control/src/server/access-control.module.ts+18-0

plugins/system/access-control/src/server/auth.controller.tsplugins/system/access-control/src/server/auth.controller.ts+13-0

plugins/system/access-control/src/server/auth.decorators.tsplugins/system/access-control/src/server/auth.decorators.ts+5-0

plugins/system/access-control/src/server/auth.guards.test.tsplugins/system/access-control/src/server/auth.guards.test.ts+19-0

plugins/system/access-control/src/server/auth.guards.tsplugins/system/access-control/src/server/auth.guards.ts+31-0

plugins/system/access-control/src/server/auth.service.tsplugins/system/access-control/src/server/auth.service.ts+36-0

plugins/system/access-control/src/server/auth.types.tsplugins/system/access-control/src/server/auth.types.ts+3-0

plugins/system/access-control/src/server/dto/auth.dto.tsplugins/system/access-control/src/server/dto/auth.dto.ts+5-0

plugins/system/access-control/src/server/security.tsplugins/system/access-control/src/server/security.ts+46-0

plugins/system/access-control/src/server/users.controller.tsplugins/system/access-control/src/server/users.controller.ts+15-0

plugins/system/access-control/src/server/users.service.tsplugins/system/access-control/src/server/users.service.ts+46-0

plugins/system/audit/package.jsonplugins/system/audit/package.json+8-1

plugins/system/audit/src/client/pages/AuditListPage.tsxplugins/system/audit/src/client/pages/AuditListPage.tsx+14-0

plugins/system/audit/src/client/styles/audit.module.cssplugins/system/audit/src/client/styles/audit.module.css+4-0

plugins/system/audit/src/components/StatusCard.tsxplugins/system/audit/src/components/StatusCard.tsx+0-7

plugins/system/audit/src/index.tsplugins/system/audit/src/index.ts+4-5

plugins/system/audit/src/pages/Overview\.tsxplugins/system/audit/src/pages/Overview\.tsx+0-26

plugins/system/audit/src/server/audit.controller.tsplugins/system/audit/src/server/audit.controller.ts+6-0

plugins/system/audit/src/server/audit.module.tsplugins/system/audit/src/server/audit.module.ts+5-0

plugins/system/audit/src/server/audit.service.tsplugins/system/audit/src/server/audit.service.ts+13-0

plugins/system/audit/src/server/audit.subscriber.tsplugins/system/audit/src/server/audit.subscriber.ts+16-0

plugins/system/audit/src/server/dto/audit-query.dto.tsplugins/system/audit/src/server/dto/audit-query.dto.ts+13-0

plugins/system/audit/src/services/demoService.tsplugins/system/audit/src/services/demoService.ts+0-5

plugins/system/audit/src/styles/overview\.module.cssplugins/system/audit/src/styles/overview\.module.css+0-14

plugins/system/audit/src/types/index.tsplugins/system/audit/src/types/index.ts+0-1

plugins/system/notifications/README.mdplugins/system/notifications/README.md+3-0

plugins/system/notifications/package.jsonplugins/system/notifications/package.json+4-0

plugins/system/notifications/src/client/components/NotificationBell.tsxplugins/system/notifications/src/client/components/NotificationBell.tsx+5-0

plugins/system/notifications/src/client/pages/NotificationListPage.tsxplugins/system/notifications/src/client/pages/NotificationListPage.tsx+10-0

plugins/system/notifications/src/client/services/notificationService.tsplugins/system/notifications/src/client/services/notificationService.ts+3-0

plugins/system/notifications/src/client/styles/notifications.module.cssplugins/system/notifications/src/client/styles/notifications.module.css+3-0

plugins/system/notifications/src/index.tsplugins/system/notifications/src/index.ts+5-0

plugins/system/notifications/src/manifest.tsplugins/system/notifications/src/manifest.ts+2-0

plugins/system/notifications/src/server/notification.subscriber.tsplugins/system/notifications/src/server/notification.subscriber.ts+30-0

plugins/system/notifications/src/server/notifications.controller.tsplugins/system/notifications/src/server/notifications.controller.ts+5-0

plugins/system/notifications/src/server/notifications.module.tsplugins/system/notifications/src/server/notifications.module.ts+5-0

plugins/system/notifications/src/server/notifications.service.tsplugins/system/notifications/src/server/notifications.service.ts+16-0

tests/e2e/api-integration.spec.tstests/e2e/api-integration.spec.ts+34-0

tests/e2e/operations-flow\.spec.tstests/e2e/operations-flow\.spec.ts+41-0

Collapse files