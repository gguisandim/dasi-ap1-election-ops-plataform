User: Implemente integralmente o módulo Central de Tarefas especificado em:

docs/modules/tasks.md

Antes de implementar:

1. Leia integralmente o AGENTS.md.
2. Leia docs/modules/tasks.md.
3. Leia docs/AI-PLUGIN-GUIDE.md, se existir.
4. Inspecione os plugins existentes para identificar os padrões arquiteturais e visuais utilizados.
5. Verifique o schema Prisma, RBAC, Event Bus, AppModule e pluginRegistry atuais.
6. Reutilize Election, ElectoralZone, PollingPlace e User existentes.
7. Não crie entidades duplicadas.
8. Preserve integralmente funcionalidades dos outros módulos.
9. Não importe implementações internas de outros plugins.

Implemente diretamente no workspace uma solução completa de ponta a ponta, incluindo tudo que a SPEC exigir e, quando aplicável:

- modelos e relações Prisma;
- migration;
- permissões tasks.read e tasks.manage;
- backend NestJS;
- DTOs e validações;
- regras de negócio;
- endpoints;
- dependências entre tarefas;
- prevenção de dependências circulares;
- comentários;
- histórico;
- Event Bus;
- manifest;
- registros necessários no backend e frontend;
- API client;
- interface React;
- dashboard;
- Kanban;
- listagem e filtros;
- formulário de criação;
- página de detalhes;
- tratamento de loading, empty state e erros;
- testes unitários relevantes.

Para atraso, prefira calcular a condição a partir do prazo e status em vez de persistir um campo redundante.

Antes de encerrar, valide a implementação.

O ambiente pode não permitir E2E por ausência/configuração de DATABASE_URL. Isso não deve impedir a conclusão se as demais validações passarem.

O npm test padrão pode incluir indevidamente testes Playwright/E2E no Vitest. Se isso ocorrer, execute os testes unitários separadamente e registre a limitação, sem modificar testes de outros módulos apenas para fazer o comando passar.

Execute, quando aplicável:

npm run check:boundaries
npm run db:validate
npm run db:generate
npm run typecheck
npm run lint
npm test
npm run build

Corrija erros provocados pela sua implementação.

NÃO execute git commit, git push, reset, rebase ou force push.

Ao terminar, apresente:
1. funcionalidades implementadas;
2. arquivos criados/modificados;
3. alterações no banco;
4. endpoints;
5. permissões;
6. eventos;
7. testes e validações executados;
8. limitações restantes.

GitHub Copilot: Vou começar pelas instruções locais e pela especificação do módulo; em seguida sigo o caminho arquitetural existente de um plugin semelhante para manter a integração consistente sem tocar em funcionalidades alheias.

Searched for files matching `**/AGENTS.md`, no matches

Read memory

Read 

Read 

A especificação e o guia estão lidos; não há `AGENTS.md` no workspace, então vou seguir as regras explícitas do guia. Agora estou identificando um plugin operacional próximo e os contratos globais exatos (schema, permissões, eventos e composição) antes de escolher os arquivos da implementação.

Searched for files matching `**/plugins/**/manifest.ts`, 16 matches

Searched for files matching `**/plugins/**/src/server/**/*.ts`, 20 matches

Searched for files matching `**/plugins/**/src/client/**/*.{tsx,ts,css}`, 20 matches

Searched for files matching `**/packages/database/prisma/schema.prisma`, 1 match

Searched for files matching `**/packages/security/src/*.ts`, 4 matches

Searched for files matching `**/packages/event-bus/src/*.ts`, 5 matches

Searched for files matching `**/apps/api/src/app.module.ts`, 1 match

Searched for files matching `**/apps/web/src/pluginRegistry.ts`, 1 match

Searched for files matching `**/plugins/**/AGENTS.md`, no matches

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read , lines 1 to 360

Read , lines 1 to 320

Searched for files matching `**/plugins/operations/preparation-checklists/src/**/*`, 17 matches

Searched for files matching `**/plugins/operations/field-teams/src/**/*`, 18 matches

Read 

Read 

Read , lines 360 to 1100

Read 

Read 

Read 

O padrão indica um plugin autocontido com composição explícita no `AppModule` e no registry; as permissões são cadastradas no catálogo e distribuídas pelo seed. O banco não tem relações atuais de tarefas; vou acrescentar relações em `Election`, `ElectoralZone`, `PollingPlace` e `User`, com modelos próprios apenas para tarefas, comentários, histórico e dependências.

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Searched for regex `model PreparationChecklist|model PreparationChecklistHistory|model PreparationChecklistItem` (`**/packages/database/prisma/schema.prisma`), 6 results

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Read 

Searched for regex `DomainEvent|eventBus.emit` (`**/plugins/**/src/server/**/*.ts`), 12 results

Searched for regex `plugin-preparation-checklists|preparationChecklistsPlugin` (`**/apps/web/**`), 3 results

Read 

Read , lines 1080 to 1193

Read 

Read 

Já confirmei a integração e a regra de domínio que vou usar: bloqueio por dependências será calculado a partir das dependências ainda não concluídas, sem gravar uma coluna redundante nem perder o status operacional anterior. O teste mais discriminante será exercitar a detecção de ciclos e a regra de bloqueio no service; a implementação ficará dentro do plugin `operations/tasks`, com alterações globais somente nos pontos de composição, contratos Prisma, segurança e eventos.

Read 

Read 

Read 

Read 

Read 

Read 

Vou iniciar pelo contrato persistente e compartilhado: enums/modelos e relações no Prisma, permissões e nomes tipados dos eventos; também adiciono a migration correspondente. Isso torna verificável já nesta etapa se as relações Prisma e o SQL da migration estão estruturalmente coerentes, antes de avançar para o service e a interface.

Generating patch (146 lines) in , , 


```

```

```

```

```

```


Ran terminal command:  npm run db:validate

O schema passou na validação Prisma. Agora estou implementando o domínio no servidor: validação de pleito/zona/local e usuários ativos, alterações transacionais com histórico, comentários, filtros/dashboard e dependências com checagem de ciclos; bloqueios por dependência serão derivados na resposta da API.

Generating patch (378 lines) in , , , , 


```

```

```

```

```

```

```

```

```

```


Ran terminal command:  npm run db:generate

Ran terminal command:  npm run typecheck -w @eops/api
Tool execution failed with exit code 2

A geração do client passou; a primeira checagem de tipos apontou um efeito esperado no contrato global: o subscriber de notificações tem um `switch` exaustivo e agora precisa tratar os novos eventos de tarefa. Vou completar essa reação compartilhada e incluir os eventos no subscriber de auditoria, depois repetir o mesmo typecheck do backend.

Generating patch (20 lines) in , 


```

```

```

```


Ran terminal command:  npm run typecheck -w @eops/api

O backend já passa no typecheck da API após completar notificações/auditoria. Vou agora registrar a migration, distribuir `tasks.read/manage` por papel padrão e incluir o plugin nos dois pontos de composição; depois sigo para o cliente React e os testes de regras críticas.

Generating patch (97 lines) in , , , , 


```

```

```

```

```

```

```

```

```

```


Read 

Read 

Read 

Os pontos de composição e a migration estão no lugar. Estou montando as cinco superfícies pedidas (dashboard, Kanban, lista/filtros, criação e detalhe) com o `@eops/api-client`, componentes compartilhados e estilos modulares; a interação com dependências, comentários, histórico e mudança de status fica disponível na página de detalhe e no Kanban.

Generating patch (224 lines) in , , , , , , 


```

```

```

```

```

```

```

```

```

```

```

```

```

```


Generating patch (98 lines) in , , , 


```

```

```

```

```

```

```

```


Generating patch (75 lines) in , 


```

```

```

```
As telas e as rotas do plugin estão criadas. Antes de acrescentar mais comportamento, vou validar o frontend integrado; como o pacote workspace é novo, esta checagem também precisa registrar/linkar a dependência local no lockfile.

Ran terminal command:  npm install --ignore-scripts && npm run typecheck -w @eops/web
Tool execution failed with exit code 1

Read , lines 1 to 260

O typecheck encontrou um erro de parsing na expressão compacta do dashboard, antes de avaliar as demais telas. Vou simplificar esse bloco JSX e corrigir também a importação do campo de busca apontada durante a mesma validação, então repetirei exatamente o typecheck do web.

Read 

Generating patch (61 lines) in , 


```

```

```

```


Ran terminal command:  npm run typecheck -w @eops/web

O frontend passou no typecheck após a correção. Agora estou fechando cobertura unitária para os três pontos de maior risco local (ciclo indireto, bloqueio derivado e atraso sem persistência); em seguida rodo a suíte focada e, se verde, avanço para os gates globais solicitados.

Generating patch (47 lines) in , 


```

```

```

```


Ran terminal command:  npx vitest run plugins/operations/tasks/src/server/tasks.service.test.ts

Os testes unitários focados passaram: três casos cobrem dependências não concluídas, ciclos diretos/indiretos e cálculo de atraso com status terminal. Vou verificar agora fronteiras de plugin e banco, e depois executar typecheck/lint/test/build do workspace; também vou observar se o `npm test` atinge acidentalmente os E2E conforme a ressalva da especificação.

Ran terminal command:  npm run check:boundaries

Ran terminal command:  npm run db:validate

Ran terminal command:  npm run typecheck

As fronteiras estão limpas, o Prisma valida e o typecheck completo passa tanto na API quanto no web. Estou nos gates finais; a próxima rodada pode expor apenas estilo/testes já existentes, que vou separar de falhas causadas pelo módulo.

Ran terminal command:  npm run lint
Tool execution failed with exit code 1

O lint apontou dois imports/valores sem uso no novo código, sem falhas em outros módulos. Vou removê-los e repetir o lint completo, que é a mesma validação que encontrou os problemas.

Generating patch (10 lines) in , 


```

```

```

```


Ran terminal command:  npm run lint

Ran terminal command:  npm test
Tool execution failed with exit code 1

O `npm test` confirmou a limitação prevista: o Vitest coletou `operations-flow.spec.ts` mesmo com a exclusão e falhou ao interpretar o teste Playwright. Não vou alterar testes de outros módulos; vou executar os testes unitários das pastas de código explicitamente e depois concluir o build.

Ran terminal command:  npx vitest run apps packages plugins

Ran terminal command:  npm run build

Os testes unitários explicitamente selecionados passaram (15 arquivos, 41 testes), e o build de produção compilou API e web. O build só sinalizou um chunk geral acima de 500 kB; agora estou revisando a lista de mudanças e whitespace para garantir que o lockfile/migration ficaram restritos ao módulo e às integrações exigidas.

Ran terminal command:  git status --short && git diff --check && git diff --stat

Read , lines 1 to 160

Ran terminal command:  git diff -- package-lock.json

Read , lines 1 to 250

A revisão confirmou que as alterações são do módulo e dos registros esperados; o lockfile também corrigiu uma omissão anterior do pacote de preparação ao integrar a nova dependência. Como a especificação destaca possível limitação por `DATABASE_URL`, vou tentar o E2E para registrar o resultado real do ambiente, sem alterar a configuração/testes existentes.

Ran terminal command:  npm run e2e
Tool execution failed with exit code 1

O E2E conseguiu conectar ao ambiente e passou nos dois testes de integração/RBAC; os outros dois testes existentes não iniciaram porque o Playwright está configurado para Edge, ausente no container. Vou fazer a checagem final de diagnósticos/arquivos e deixar a aplicação disponível para inspeção local.

Ran terminal command:  git status --short && git diff --check

Checked , , , , , no problems found

Ran terminal command:  git diff -- test-results/.last-run.json

A execução E2E atualizou `.last-run.json`; o arquivo era previamente “passed” e agora apenas registra os testes que não conseguiram abrir Edge. Vou restaurar esse artefato gerado ao estado anterior para não incluir resultado transitório no diff, sem tocar em código ou testes do projeto.

Generating patch (12 lines) in 


```

```


Ran terminal command:  npm run dev

Saída do terminal verificada

Saída do terminal verificada

Saída do terminal verificada

A interface está servida em `http://localhost:5173/` e o Nest iniciou com todas as rotas `/api/tasks` registradas. Vou só conferir o estado de aplicação das migrations no banco configurado e o diff final; não vou aplicar migration automaticamente, para evitar alterar um banco sem confirmação explícita.

Ran terminal command:  npx prisma migrate status --schema packages/database/prisma/schema.prisma
Tool execution failed with exit code 1

Ran terminal command:  git status --short && git diff --check

**Entrega**
1. **Funcionalidades:** dashboard com indicadores e alertas; Kanban; lista com filtros; criação e edição; atribuição; prazos e prioridade; dependências com prevenção de ciclos e indicação de bloqueio; comentários; histórico. Atrasos e bloqueios por dependências são calculados, sem campos redundantes.

2. **Arquivos:** o plugin foi criado em `index.ts`, com telas de dashboard, Kanban, lista, criação e detalhes, além de API, estilos, tipos e testes. Integrações atualizadas em `schema.prisma`, `seed.ts`, `permissions.ts`, `contracts.ts`, AppModule, pluginRegistry, manifestos e subscribers de auditoria/notificações.

3. **Banco:** migration criada em 202610010005_tasks/migration.sql, com tarefa, dependência, comentário e histórico, relacionados às entidades existentes `Election`, `ElectoralZone`, `PollingPlace` e `User`. Nenhuma entidade duplicada. **A migration não foi aplicada**: o banco configurado tem histórico divergente, com migrations remotas ausentes localmente e a migration de preparação ainda pendente. Não alterei esse banco.

4. **Endpoints:** `GET /api/tasks/dashboard`, `/references`, `/`; `GET /api/tasks/:id`; `POST /api/tasks`; `PATCH /api/tasks/:id`; `POST /api/tasks/:id/comments`; `POST /api/tasks/:id/dependencies`; `DELETE /api/tasks/:id/dependencies/:dependsOnId`.

5. **Permissões:** `tasks.read` e `tasks.manage` registradas. Administradores e supervisores têm ambas; operadores e técnicos podem gerenciar; consulta mantém apenas leitura.

6. **Eventos:** `task.created`, `task.assigned`, `task.status_changed`, `task.completed` e `task.blocked`, publicados pelo Event Bus e consumidos por auditoria e notificações.

7. **Validações:** `db:validate`, `db:generate`, `typecheck`, `lint`, `check:boundaries` e `build` passaram. Testes unitários: **41 passaram**. `npm test` falhou porque o Vitest coletou um teste Playwright apesar da exclusão configurada. O E2E passou em 2 testes; outros 2 não iniciaram por falta do Microsoft Edge no container.

8. **Limitações:** a divergência do histórico de migrations precisa ser reconciliada antes de usar os endpoints de tarefas contra esse banco. O build também reporta um bundle web acima de 500 kB. A aplicação está disponível em **http://localhost:5173/**. Não executei commit, push nem apliquei migrations ao banco.

Fez alterações.
