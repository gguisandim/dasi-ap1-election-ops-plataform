`Você está trabalhando no monorepo **Election Ops Platform**.
`\
`
`\
`Esta é a **Parte 1** da evolução da vertical de Workforce Operations.
`\
`
`\
`Plugins principais:
`\
`
`\
` ```text
 `\
`plugins/operations/field-teams
`\
`plugins/operations/shifts
`\
` ```
 `\
`
`\
`O objetivo desta execução é:
`\
`
`\
` ```text
 `\
`1. corrigir a sobreposição de responsabilidade entre Field Teams e Shifts;
`\
`2. estabelecer ownership claro do domínio de turnos;
`\
`3. aprofundar disponibilidade, cobertura e planejamento de equipes;
`\
`4. melhorar frontend e APIs desses dois módulos;
`\
`5. preservar Event Bus, RBAC, Audit e Notifications já existentes;
`\
`6. preparar contratos claros para uma Parte 2 posterior.
`\
` ```
 `\
`
`\
`NÃO implemente Tasks nesta execução.
`\
`
`\
`NÃO implemente Shift Handover nesta execução.
`\
`
`\
`A Parte 2 será responsável por:
`\
`
`\
` ```text
 `\
`dispatch operacional
`\
`missões/deslocamentos
`\
`integração com Tasks
`\
`workload avançado
`\
`execução em campo
`\
` ```
 `\
`
`\
`---
`\
`
`\
`# 0. Registrar este prompt
`\
`
`\
`Preserve uma cópia literal deste prompt em:
`\
`
`\
` ```text
 `\
`prompts/sessoes/2026-10-04-workforce-operations-part-1.md
`\
` ```
 `\
`
`\
`Não resumir.
`\
`
`\
`Não reescrever.
`\
`
`\
`Não substituir pelo relatório final.
`\
`
`\
`---
`\
`
`\
`# 1. Preflight
`\
`
`\
`Antes de alterar qualquer arquivo:
`\
`
`\
` ```bash
 `\
`git status --short
`\
`git log --oneline -10
`\
`npm run spec:check -- HEAD
`\
`npm run check:boundaries
`\
` ```
 `\
`
`\
`Leia:
`\
`
`\
` ```text
 `\
`AGENTS.md
`\
`plugins/AGENTS.md
`\
`SPEC/README.md
`\
`docs/AI-PLUGIN-GUIDE.md
`\
`docs/UI-DESIGN-GUIDE.md
`\
`docs/COMMIT-GUIDE.md
`\
`docs/execution-issues/README.md
`\
`prompts/templates/implementation.md
`\
` ```
 `\
`
`\
`Leia as implementações completas somente de:
`\
`
`\
` ```text
 `\
`plugins/operations/field-teams
`\
`plugins/operations/shifts
`\
` ```
 `\
`
`\
`Leia também apenas os contratos necessários em:
`\
`
`\
` ```text
 `\
`packages/shared
`\
`packages/security
`\
`packages/event-bus
`\
`packages/database/prisma/schema.prisma
`\
` ```
 `\
`
`\
`Leia as SPECs existentes relacionadas:
`\
`
`\
` ```text
 `\
`SPEC/2026-10-01-field-teams.md
`\
`SPEC/2026-10-03-shifts-schedules.md
`\
` ```
 `\
`
`\
`e documentação correspondente em:
`\
`
`\
` ```text
 `\
`docs/modules/
`\
` ```
 `\
`
`\
``Não use `docs/modules` como substituto de SPEC.
``\
`
`\
`---
`\
`
`\
`# 2. Execution Issues Preflight
`\
`
`\
`Revise issues abertos relevantes.
`\
`
`\
`Classifique:
`\
`
`\
` ```text
 `\
`BLOCKS_CURRENT_TASK
`\
`RELATED_NON_BLOCKING
`\
`OUT_OF_SCOPE
`\
` ```
 `\
`
`\
`Esperado aproximadamente:
`\
`
`\
` ```text
 `\
`Prisma/deepmerge
`\
`→ RELATED_NON_BLOCKING
`\
`
`\
`Shift Handover sem SPEC
`\
`→ OUT_OF_SCOPE
`\
`
`\
`issues históricos de tooling/browser
`\
`→ OUT_OF_SCOPE
`\
` ```
 `\
`
`\
`Se surgir blocker real de database/schema/runtime, trate conforme o protocolo.
`\
`
`\
`---
`\
`
`\
`# 3. SPEC Gate
`\
`
`\
`Execute formalmente o SPEC Gate.
`\
`
`\
`Classificação esperada:
`\
`
`\
` ```text
 `\
`NEW_SPEC
`\
` ```
 `\
`
`\
`Motivo:
`\
`
`\
`a execução modifica materialmente responsabilidades de domínio e adiciona novos comportamentos em Field Teams e Shifts.
`\
`
`\
`Crie:
`\
`
`\
` ```text
 `\
`SPEC/2026-10-04-workforce-operations-part-1.md
`\
` ```
 `\
`
`\
`---
`\
`
`\
`# 4. Conteúdo da SPEC
`\
`
`\
`A SPEC deve definir pelo menos:
`\
`
`\
` ```text
 `\
`Contexto
`\
`Estado atual
`\
`Problemas
`\
`Objetivos
`\
`
`\
`Domain ownership
`\
`Field Teams
`\
`Shifts
`\
`
`\
`Disponibilidade
`\
`Especialidades
`\
`Cobertura
`\
`Assignments
`\
`Presença
`\
`Ausência
`\
`Sobreaviso
`\
`Substituição
`\
`Conflitos
`\
`Calendário
`\
`
`\
`RBAC
`\
`Event Bus
`\
`Audit
`\
`Notifications
`\
`Frontend
`\
`API
`\
`Persistência
`\
`Critérios de aceite
`\
`Validação
`\
`
`\
`Parte 2 / Fora de escopo
`\
` ```
 `\
`
`\
`A SPEC deve refletir o código real encontrado.
`\
`
`\
`---
`\
`
`\
`# 5. Commit exclusivo da SPEC
`\
`
`\
`Você está explicitamente autorizado a fazer SOMENTE o commit inicial da SPEC.
`\
`
`\
`Faça stage exclusivamente de:
`\
`
`\
` ```text
 `\
`SPEC/2026-10-04-workforce-operations-part-1.md
`\
` ```
 `\
`
`\
`Confirme:
`\
`
`\
` ```bash
 `\
`git diff --cached --name-only
`\
` ```
 `\
`
`\
`Deve aparecer somente a SPEC.
`\
`
`\
`Commit:
`\
`
`\
` ```text
 `\
`docs(spec): define workforce operations part 1
`\
` ```
 `\
`
`\
`Não faça nenhum outro commit durante esta execução.
`\
`
`\
`---
`\
`
`\
`# 6. Problema de ownership identificado
`\
`
`\
`Atualmente existem responsabilidades sobrepostas.
`\
`
`\
`` `Field Teams` possui endpoints equivalentes a:
 ``\
`
`\
` ```text
 `\
`GET  /field-teams/shifts
`\
`POST /field-teams/shifts
`\
` ```
 `\
`
`\
`e página própria de shifts.
`\
`
`\
`Ao mesmo tempo existe o plugin especializado:
`\
`
`\
` ```text
 `\
`/shifts
`\
` ```
 `\
`
`\
`com regras próprias para:
`\
`
`\
` ```text
 `\
`turnos
`\
`assignments
`\
`presença
`\
`ausência
`\
`sobreaviso
`\
`substituição
`\
`cobertura
`\
`conflitos
`\
`lifecycle
`\
` ```
 `\
`
`\
`Essa duplicidade deve ser eliminada.
`\
`
`\
`---
`\
`
`\
`# 7. Ownership final
`\
`
`\
`A arquitetura desejada é:
`\
`
`\
` ```text
 `\
`FIELD TEAMS
`\
`     │
 `\
`     ├── equipes
 `\
`     ├── membros
 `\
`     ├── funções
 `\
`     ├── especialidades
 `\
`     ├── disponibilidade
 `\
`     └── dados operacionais da equipe
 `\
`
`\
`SHIFTS
`\
`     │
 `\
`     ├── turnos
 `\
`     ├── assignments
 `\
`     ├── presença
 `\
`     ├── ausência
 `\
`     ├── sobreaviso
 `\
`     ├── substituições
 `\
`     ├── cobertura
 `\
`     ├── conflitos
 `\
`     └── lifecycle
 `\
` ```
 `\
`
`\
`Regra:
`\
`
`\
`> Shifts é o único owner de criação e manutenção de turnos.
`\
`
`\
`Field Teams pode consultar dados relacionados a turnos através de contratos públicos/APIs, mas não deve possuir fluxo paralelo de criação de turnos.
`\
`
`\
`---
`\
`
`\
`# 8. Remover duplicidade sem quebrar usuários
`\
`
`\
`Audite:
`\
`
`\
` ```text
 `\
`/field-teams/shifts
`\
`ShiftsPage.tsx
`\
`services relacionados
`\
` ```
 `\
`
`\
`Determine o que é:
`\
`
`\
` ```text
 `\
`duplicado
`\
`ainda útil
`\
`legado
`\
` ```
 `\
`
`\
`Não faça remoção cega.
`\
`
`\
`Se uma tela do Field Teams apenas exibe turnos:
`\
`
`\
`ela pode ser convertida para uma visão read-only ou link/deep-link para o plugin Shifts.
`\
`
`\
`Não manter dois formulários de criação.
`\
`
`\
`---
`\
`
`\
`# 9. Permissions
`\
`
`\
`Hoje pode existir divergência entre:
`\
`
`\
` ```text
 `\
`field-teams.manage
`\
` ```
 `\
`
`\
`e:
`\
`
`\
` ```text
 `\
`shifts.manage
`\
` ```
 `\
`
`\
`Criação/edição de turnos deve depender de:
`\
`
`\
` ```text
 `\
`shifts.manage
`\
` ```
 `\
`
`\
`ou permissões específicas definidas no contrato de Shifts.
`\
`
`\
`` `field-teams.manage` não deve conceder implicitamente poder de alterar turnos.
 ``\
`
`\
`Preserve RBAC existente quando possível.
`\
`
`\
`---
`\
`
`\
`# PARTE A — FIELD TEAMS
`\
`
`\
`# 10. Estado atual
`\
`
`\
`Preserve funcionalidades existentes de:
`\
`
`\
` ```text
 `\
`teams
`\
`members
`\
`roles
`\
`specialties
`\
`allocations
`\
`checks
`\
`dashboard
`\
` ```
 `\
`
`\
`Não reconstruir o plugin.
`\
`
`\
`---
`\
`
`\
`# 11. Disponibilidade de membros
`\
`
`\
`Aprofundar disponibilidade.
`\
`
`\
`O sistema deve poder responder:
`\
`
`\
` ```text
 `\
`este membro está disponível?
`\
`quando?
`\
`por quê?
`\
`para qual tipo de operação?
`\
` ```
 `\
`
`\
`Modele comportamento suficiente para representar algo equivalente a:
`\
`
`\
` ```text
 `\
`AVAILABLE
`\
`ASSIGNED
`\
`ON_DUTY
`\
`UNAVAILABLE
`\
`OFF_DUTY
`\
` ```
 `\
`
`\
`Não duplique estado derivável de Shifts sem necessidade.
`\
`
`\
`---
`\
`
`\
`# 12. Períodos de indisponibilidade
`\
`
`\
`Adicionar capacidade de registrar períodos como:
`\
`
`\
` ```text
 `\
`início
`\
`fim
`\
`motivo
`\
`observação
`\
`ator
`\
` ```
 `\
`
`\
`Exemplos:
`\
`
`\
` ```text
 `\
`férias
`\
`afastamento
`\
`indisponibilidade temporária
`\
`restrição operacional
`\
` ```
 `\
`
`\
`Não precisa criar sistema de RH.
`\
`
`\
`É disponibilidade operacional.
`\
`
`\
`---
`\
`
`\
`# 13. Specialties
`\
`
`\
`Especialidades já existem.
`\
`
`\
`Aprofundar seu uso.
`\
`
`\
`Permitir responder:
`\
`
`\
` ```text
 `\
`quais membros possuem determinada especialidade?
`\
`quais equipes possuem cobertura para determinada especialidade?
`\
` ```
 `\
`
`\
`Exemplos:
`\
`
`\
` ```text
 `\
`REDES
`\
`FIBRA
`\
`ELÉTRICA
`\
`TRANSMISSÃO
`\
`LOGÍSTICA
`\
`SUPORTE GERAL
`\
` ```
 `\
`
`\
`Não hardcode esses valores se já forem entidades persistidas.
`\
`
`\
`---
`\
`
`\
`# 14. Team capability
`\
`
`\
`Calcular capabilities de uma equipe a partir dos membros ativos e suas especialidades.
`\
`
`\
`Exemplo:
`\
`
`\
` ```text
 `\
`Equipe Alfa
`\
`
`\
`Membros: 4
`\
`
`\
`Cobertura:
`\
`✓ Redes
`\
`✓ Fibra
`\
`✓ Suporte geral
`\
`✕ Elétrica
`\
` ```
 `\
`
`\
`Preferencialmente derivado.
`\
`
`\
`Não persistir agregação se puder ser calculada.
`\
`
`\
`---
`\
`
`\
`# 15. Field Teams dashboard
`\
`
`\
`Expandir dashboard para mostrar informações realmente operacionais.
`\
`
`\
`Possíveis métricas:
`\
`
`\
` ```text
 `\
`equipes ativas
`\
`membros disponíveis
`\
`membros indisponíveis
`\
`em turno
`\
`sem alocação
`\
`equipes sem skill crítica
`\
` ```
 `\
`
`\
`Só use métricas calculáveis.
`\
`
`\
`Não inventar números.
`\
`
`\
`---
`\
`
`\
`# 16. Member detail
`\
`
`\
`Criar/refinar página de detalhe do membro.
`\
`
`\
`Mostrar:
`\
`
`\
` ```text
 `\
`dados básicos
`\
`equipe
`\
`função
`\
`especialidades
`\
`disponibilidade
`\
`turnos próximos
`\
`histórico operacional
`\
` ```
 `\
`
`\
`Turnos próximos devem vir do domínio Shifts através de contrato apropriado/API.
`\
`
`\
`Não criar queries duplicadas de business rule no frontend.
`\
`
`\
`---
`\
`
`\
`# 17. Team detail
`\
`
`\
`Refinar detalhe da equipe.
`\
`
`\
`Mostrar:
`\
`
`\
` ```text
 `\
`membros
`\
`especialidades/capabilities
`\
`disponibilidade
`\
`próximos turnos
`\
`status operacional
`\
` ```
 `\
`
`\
`Não incluir ainda dispatch/missões.
`\
`
`\
`Isso fica para Parte 2.
`\
`
`\
`---
`\
`
`\
`# PARTE B — SHIFTS
`\
`
`\
`# 18. Estado atual
`\
`
`\
`Preserve:
`\
`
`\
` ```text
 `\
`turnos
`\
`assignments
`\
`presença
`\
`ausência
`\
`sobreaviso
`\
`substituição
`\
`start
`\
`complete
`\
`cancel
`\
`coverage
`\
`conflicts
`\
`dashboard
`\
` ```
 `\
`
`\
`---
`\
`
`\
`# 19. Calendário operacional
`\
`
`\
`Adicionar uma visão de calendário.
`\
`
`\
`Rota possível:
`\
`
`\
` ```text
 `\
`/shifts/calendar
`\
` ```
 `\
`
`\
`Permitir visualizar:
`\
`
`\
` ```text
 `\
`dia
`\
`semana
`\
` ```
 `\
`
`\
`Prioridade principal:
`\
`
`\
` ```text
 `\
`visão semanal
`\
` ```
 `\
`
`\
`Mostrar:
`\
`
`\
` ```text
 `\
`turno
`\
`horário
`\
`local/zona
`\
`equipe
`\
`quantidade necessária
`\
`quantidade atribuída
`\
`status
`\
` ```
 `\
`
`\
`---
`\
`
`\
`# 20. Coverage matrix
`\
`
`\
`Criar visão dedicada de cobertura.
`\
`
`\
`Exemplo:
`\
`
`\
` ```text
 `\
`              08h   10h   12h   14h   16h
 `\
`Zona 01       ✓     ✓     ⚠     ⚠     ✓
`\
`Zona 02       ✓     ✓     ✓     ✓     ✓
`\
`Zona 03       ⚠     ✕     ✕     ⚠     ✓
`\
` ```
 `\
`
`\
`A matriz deve ser baseada em dados reais.
`\
`
`\
`Não hardcode.
`\
`
`\
`---
`\
`
`\
`# 21. Coverage states
`\
`
`\
`Defina estado calculado de cobertura.
`\
`
`\
`Exemplo conceitual:
`\
`
`\
` ```text
 `\
`FULL
`\
`PARTIAL
`\
`CRITICAL
`\
`EMPTY
`\
` ```
 `\
`
`\
`Pode usar nomenclatura diferente.
`\
`
`\
`A SPEC deve definir os critérios.
`\
`
`\
`Não persistir se for derivável.
`\
`
`\
`---
`\
`
`\
`# 22. Required staffing
`\
`
`\
`Turnos devem ter capacidade de representar necessidade operacional.
`\
`
`\
`Exemplo:
`\
`
`\
` ```text
 `\
`requiredStaff = 8
`\
` ```
 `\
`
`\
`Se já existir campo equivalente, reutilize.
`\
`
`\
`Se não existir, avaliar migration.
`\
`
`\
`Cobertura:
`\
`
`\
` ```text
 `\
`assigned active members
`\
`/
`\
`required staff
`\
` ```
 `\
`
`\
`---
`\
`
`\
`# 23. Specialty requirements
`\
`
`\
`Permitir que um turno possa exigir capacidades específicas.
`\
`
`\
`Exemplo:
`\
`
`\
` ```text
 `\
`2 × Redes
`\
`1 × Fibra
`\
`1 × Elétrica
`\
` ```
 `\
`
`\
`Não é obrigatório implementar solver automático completo.
`\
`
`\
`Mas o sistema deve poder detectar:
`\
`
`\
` ```text
 `\
`headcount suficiente
`\
`mas skill coverage insuficiente
`\
` ```
 `\
`
`\
`---
`\
`
`\
`# 24. Conflict detection
`\
`
`\
`Preserve conflito temporal existente.
`\
`
`\
`Expanda quando seguro para detectar:
`\
`
`\
` ```text
 `\
`mesmo membro em turnos sobrepostos
`\
`indisponibilidade registrada
`\
`turno incompatível com ausência
`\
` ```
 `\
`
`\
`Não introduzir regras trabalhistas complexas nesta parte.
`\
`
`\
`---
`\
`
`\
`# 25. Availability-aware assignment
`\
`
`\
`Ao tentar atribuir membro:
`\
`
`\
`validar:
`\
`
`\
` ```text
 `\
`ativo
`\
`disponível
`\
`sem conflito
`\
` ```
 `\
`
`\
`Se existir incompatibilidade:
`\
`
`\
`retornar erro claro.
`\
`
`\
`Não permitir assignment silenciosamente inválido.
`\
`
`\
`---
`\
`
`\
`# 26. On-call
`\
`
`\
`Melhorar sobreaviso.
`\
`
`\
`Representar claramente:
`\
`
`\
` ```text
 `\
`quem está de sobreaviso
`\
`para qual turno
`\
`quando foi ativado
`\
`status
`\
` ```
 `\
`
`\
`Não criar pager externo.
`\
`
`\
`---
`\
`
`\
`# 27. Replacement
`\
`
`\
`A substituição atual deve continuar preservando histórico.
`\
`
`\
`Aprofundar validações:
`\
`
`\
` ```text
 `\
`substituto disponível
`\
`sem conflito
`\
`ativo
`\
`compatível com requirements quando possível
`\
` ```
 `\
`
`\
`Registrar motivo.
`\
`
`\
`---
`\
`
`\
`# 28. Shift templates
`\
`
`\
`Adicionar templates simples de turnos.
`\
`
`\
`Objetivo:
`\
`
`\
`evitar recriar manualmente escalas recorrentes.
`\
`
`\
`Exemplo:
`\
`
`\
` ```text
 `\
`Turno NOC manhã
`\
`08:00–14:00
`\
`6 operadores
`\
`requirements...
`\
` ```
 `\
`
`\
`Template não é turno ativo.
`\
`
`\
`Criar turno a partir de template.
`\
`
`\
`---
`\
`
`\
`# 29. Copy shift
`\
`
`\
`Permitir duplicar configuração de turno para nova data/período.
`\
`
`\
`Não copiar automaticamente:
`\
`
`\
` ```text
 `\
`presença
`\
`ausência
`\
`eventos históricos
`\
` ```
 `\
`
`\
`Assignments podem ser opcionais conforme definido na SPEC.
`\
`
`\
`---
`\
`
`\
`# 30. Dashboard de Shifts
`\
`
`\
`Expandir dashboard para mostrar:
`\
`
`\
` ```text
 `\
`turnos hoje
`\
`turnos ativos
`\
`cobertura completa
`\
`cobertura parcial
`\
`cobertura crítica
`\
`conflitos
`\
`ausências
`\
`sobreavisos ativos
`\
` ```
 `\
`
`\
`---
`\
`
`\
`# 31. Detail view
`\
`
`\
`Refinar detalhe do turno em seções:
`\
`
`\
` ```text
 `\
`Resumo
`\
`Assignments
`\
`Cobertura
`\
`Conflitos
`\
`Histórico
`\
` ```
 `\
`
`\
`Mostrar:
`\
`
`\
` ```text
 `\
`required staff
`\
`assigned
`\
`present
`\
`absent
`\
`on-call
`\
`replacement
`\
`skill requirements
`\
`coverage state
`\
` ```
 `\
`
`\
`---
`\
`
`\
`# 32. Shared contracts
`\
`
`\
`Se Field Teams e Shifts precisarem compartilhar:
`\
`
`\
` ```text
 `\
`availability status
`\
`coverage representation
`\
`specialty requirement types
`\
` ```
 `\
`
`\
`coloque contratos semânticos apropriados em:
`\
`
`\
` ```text
 `\
`@eops/shared
`\
` ```
 `\
`
`\
`somente quando forem realmente compartilhados.
`\
`
`\
`Não criar shared package gigantesco.
`\
`
`\
`---
`\
`
`\
`# 33. Cross-plugin integration
`\
`
`\
`Field Teams e Shifts NÃO podem importar:
`\
`
`\
` ```text
 `\
`plugins/.../src/**
`\
` ```
 `\
`
`\
`um do outro.
`\
`
`\
`Integração permitida por:
`\
`
`\
` ```text
 `\
`shared contracts
`\
`database/public APIs
`\
`Event Bus
`\
`HTTP/API
`\
` ```
 `\
`
`\
`conforme arquitetura atual.
`\
`
`\
`` `check:boundaries` deve continuar PASS.
 ``\
`
`\
`---
`\
`
`\
`# PARTE C — EVENT BUS / AUDIT / NOTIFICATIONS
`\
`
`\
`# 34. Domain Events
`\
`
`\
`Mutações relevantes devem emitir eventos.
`\
`
`\
`Exemplos:
`\
`
`\
` ```text
 `\
`field_team.member_availability_changed
`\
`field_team.specialty_changed
`\
`
`\
`shift.created
`\
`shift.updated
`\
`shift.assignment_added
`\
`shift.presence_registered
`\
`shift.absence_registered
`\
`shift.on_call_activated
`\
`shift.replacement_created
`\
`shift.started
`\
`shift.completed
`\
`shift.cancelled
`\
`shift.coverage_changed
`\
` ```
 `\
`
`\
``Não é obrigatório emitir `coverage_changed` se a detecção exigir estado persistido desnecessário.
``\
`
`\
`A SPEC deve decidir.
`\
`
`\
`---
`\
`
`\
`# 35. Audit
`\
`
`\
`A infraestrutura global de Audit já observa Event Bus.
`\
`
`\
`Não implementar lógica específica dentro do plugin Audit.
`\
`
`\
`Garanta apenas payloads suficientes para auditoria.
`\
`
`\
`Não enviar Prisma objects completos.
`\
`
`\
`---
`\
`
`\
`# 36. Notifications
`\
`
`\
`Utilize o catálogo/política existente quando eventos novos justificarem notificação.
`\
`
`\
`Não transformar todo evento em notificação.
`\
`
`\
`Eventos candidatos:
`\
`
`\
` ```text
 `\
`cobertura crítica
`\
`ausência relevante
`\
`substituição
`\
`ativação de sobreaviso
`\
`alteração importante de turno
`\
` ```
 `\
`
`\
`Respeitar preferences e RBAC existentes.
`\
`
`\
`---
`\
`
`\
`# PARTE D — API
`\
`
`\
`# 37. APIs Field Teams
`\
`
`\
`Evolua somente conforme necessário.
`\
`
`\
`Possíveis endpoints:
`\
`
`\
` ```text
 `\
`GET  /field-teams/members/:id
`\
`GET  /field-teams/:id/capabilities
`\
`
`\
`GET  /field-teams/availability
`\
`POST /field-teams/members/:id/unavailability
`\
`PATCH/DELETE equivalente quando necessário
`\
` ```
 `\
`
`\
`Não é obrigatório usar exatamente essas rotas.
`\
`
`\
`Siga convenções atuais.
`\
`
`\
`---
`\
`
`\
`# 38. APIs Shifts
`\
`
`\
`Possíveis endpoints:
`\
`
`\
` ```text
 `\
`GET /shifts/calendar
`\
`GET /shifts/coverage
`\
`
`\
`GET  /shifts/templates
`\
`POST /shifts/templates
`\
`PATCH /shifts/templates/:id
`\
`
`\
`POST /shifts/:id/copy
`\
` ```
 `\
`
`\
`Não duplicar endpoint existente.
`\
`
`\
`---
`\
`
`\
`# 39. Remover ownership legado
`\
`
`\
`Depois que Shifts for owner:
`\
`
`\
` ```text
 `\
`POST /field-teams/shifts
`\
` ```
 `\
`
`\
`não deve continuar permitindo criar turno paralelamente.
`\
`
`\
`Escolha estratégia compatível:
`\
`
`\
` ```text
 `\
`remover rota
`\
`deprecar rota
`\
`redirecionar semanticamente
`\
` ```
 `\
`
`\
`Preferência: remover contrato duplicado se não houver consumidor legítimo.
`\
`
`\
`Atualizar frontend correspondente.
`\
`
`\
`---
`\
`
`\
`# PARTE E — DATABASE
`\
`
`\
`# 40. Schema
`\
`
`\
`Antes de criar models novos, audite schema existente.
`\
`
`\
`Reutilize:
`\
`
`\
` ```text
 `\
`FieldTeam
`\
`FieldTeamMember
`\
`FieldRole
`\
`FieldSpecialty
`\
`FieldShift
`\
`ShiftAssignment
`\
` ```
 `\
`
`\
`e demais models existentes.
`\
`
`\
`---
`\
`
`\
`# 41. Novos models/campos
`\
`
`\
`Adicionar apenas o necessário para:
`\
`
`\
` ```text
 `\
`availability periods
`\
`shift templates
`\
`required staffing
`\
`specialty requirements
`\
` ```
 `\
`
`\
`Se models existentes já suportarem isso:
`\
`
`\
`não duplicar.
`\
`
`\
`---
`\
`
`\
`# 42. Migration
`\
`
`\
`Se houver mudança de schema:
`\
`
`\
`crie nova migration.
`\
`
`\
`NÃO altere migrations históricas.
`\
`
`\
`Execute:
`\
`
`\
` ```bash
 `\
`npm run db:validate
`\
` ```
 `\
`
`\
`ou comando equivalente.
`\
`
`\
`Não aplique migration em banco remoto.
`\
`
`\
`---
`\
`
`\
`# PARTE F — FRONTEND
`\
`
`\
`# 43. Rotas Field Teams
`\
`
`\
`Preserve estrutura atual.
`\
`
`\
`Melhorar:
`\
`
`\
` ```text
 `\
`/field-teams
`\
`/field-teams/:id
`\
`/field-teams/members
`\
` ```
 `\
`
`\
`Remover/ajustar experiência duplicada de shifts.
`\
`
`\
`---
`\
`
`\
`# 44. Rotas Shifts
`\
`
`\
`Estrutura desejada pode incluir:
`\
`
`\
` ```text
 `\
`/shifts
`\
`/shifts/calendar
`\
`/shifts/coverage
`\
`/shifts/:id
`\
`/shifts/templates
`\
` ```
 `\
`
`\
`Não criar rota vazia.
`\
`
`\
`---
`\
`
`\
`# 45. UX
`\
`
`\
`Seguir:
`\
`
`\
` ```text
 `\
`docs/UI-DESIGN-GUIDE.md
`\
` ```
 `\
`
`\
`Não redesenhar shell.
`\
`
`\
`Usar primitives/tokens atuais.
`\
`
`\
`---
`\
`
`\
`# 46. Estados
`\
`
`\
`Toda nova página precisa prever:
`\
`
`\
` ```text
 `\
`loading
`\
`error
`\
`empty
`\
`success
`\
` ```
 `\
`
`\
`Sem mocks permanentes.
`\
`
`\
`---
`\
`
`\
`# 47. Mobile
`\
`
`\
`Validar:
`\
`
`\
` ```text
 `\
`1440
`\
`1024
`\
`<=760
`\
` ```
 `\
`
`\
`Calendário/matriz podem usar overflow controlado em telas pequenas.
`\
`
`\
`Ações principais devem permanecer acessíveis.
`\
`
`\
`---
`\
`
`\
`# PARTE G — TESTES
`\
`
`\
`# 48. Field Teams tests
`\
`
`\
`Adicionar cobertura para:
`\
`
`\
` ```text
 `\
`availability
`\
`unavailability periods
`\
`specialties
`\
`team capabilities
`\
`member detail
`\
`dashboard metrics
`\
`permission checks
`\
`domain events
`\
` ```
 `\
`
`\
`---
`\
`
`\
`# 49. Shifts tests
`\
`
`\
`Cobrir:
`\
`
`\
` ```text
 `\
`calendar
`\
`coverage states
`\
`required staffing
`\
`specialty requirements
`\
`assignment availability
`\
`conflicts
`\
`absence
`\
`presence
`\
`on-call
`\
`replacement
`\
`templates
`\
`copy
`\
`lifecycle
`\
`domain events
`\
` ```
 `\
`
`\
`---
`\
`
`\
`# 50. Ownership regression tests
`\
`
`\
`Adicionar teste que garanta que Field Teams não continua sendo um segundo owner do domínio Shifts.
`\
`
`\
`Não precisa testar arquitetura semântica de forma artificial.
`\
`
`\
`Mas contratos/API devem refletir o ownership novo.
`\
`
`\
`---
`\
`
`\
`# PARTE H — LOC
`\
`
`\
`# 51. Medição
`\
`
`\
`Antes da implementação:
`\
`
`\
` ```bash
 `\
`npm run count:loc
`\
` ```
 `\
`
`\
`No final:
`\
`
`\
` ```bash
 `\
`npm run count:loc
`\
` ```
 `\
`
`\
`Registrar:
`\
`
`\
` ```text
 `\
`antes
`\
`depois
`\
`delta
`\
` ```
 `\
`
`\
``Se `cloc` estiver disponível:
``\
`
`\
`pode medir adicionalmente.
`\
`
`\
`Não escrever código para aumentar delta.
`\
`
`\
`---
`\
`
`\
`# PARTE I — FORA DO ESCOPO / PARTE 2
`\
`
`\
`# 52. NÃO implementar agora
`\
`
`\
`NÃO implementar:
`\
`
`\
` ```text
 `\
`Tasks
`\
`Task assignment integration
`\
`dispatch de incidente
`\
`missões de campo
`\
`aceitar/recusar missão
`\
`GPS tracking
`\
`deslocamento
`\
`arrival ETA
`\
`route optimization
`\
`Field Team ↔ Incidents workflow avançado
`\
`Shift Handover
`\
`workload planning avançado
`\
` ```
 `\
`
`\
`Esses itens pertencem à **Workforce Operations Part 2**.
`\
`
`\
`---
`\
`
`\
`# 53. Não resolver Shift Handover
`\
`
`\
`Existe dívida de SPEC conhecida para Shift Handover.
`\
`
`\
`Não criar ou implementar handover incidentalmente.
`\
`
`\
`Classificar:
`\
`
`\
` ```text
 `\
`OUT_OF_SCOPE
`\
` ```
 `\
`
`\
`---
`\
`
`\
`# PARTE J — DOCUMENTAÇÃO
`\
`
`\
`# 54. docs/modules
`\
`
`\
`Atualizar:
`\
`
`\
` ```text
 `\
`docs/modules/field-teams.md
`\
`docs/modules/shifts-schedules.md
`\
` ```
 `\
`
`\
`ou os nomes reais existentes.
`\
`
`\
`Registrar claramente ownership final:
`\
`
`\
` ```text
 `\
`Field Teams owns workforce structure/capabilities/availability.
`\
`Shifts owns schedules and shift operations.
`\
` ```
 `\
`
`\
`---
`\
`
`\
`# PARTE K — EXECUTION ISSUES
`\
`
`\
`# 55. Reconciliation
`\
`
`\
`No início classifique issues.
`\
`
`\
`No final produza:
`\
`
`\
` ```text
 `\
`EXECUTION ISSUES RECONCILIATION
`\
` ```
 `\
`
`\
`Tabela:
`\
`
`\
`| Issue | Antes | Depois | Ação | Evidência | Bloqueia Parte 2? |
`\
`
`\
`Se surgir problema arquitetural novo:
`\
`
`\
`registrar.
`\
`
`\
`Não registrar debugging trivial.
`\
`
`\
`---
`\
`
`\
`# PARTE L — VALIDATION
`\
`
`\
`# 56. Validation Gate
`\
`
`\
`Execute obrigatoriamente:
`\
`
`\
` ```bash
 `\
`npm run spec:check
`\
`npm run check:boundaries
`\
`npm run typecheck
`\
`npm run lint
`\
`npm test
`\
`npm run build
`\
`npm run db:validate
`\
`git diff --check
`\
` ```
 `\
`
`\
`Também:
`\
`
`\
` ```powershell
 `\
`powershell -ExecutionPolicy Bypass -File scripts/check-ap1.ps1
`\
` ```
 `\
`
`\
`se continuar sendo gate atual.
`\
`
`\
`---
`\
`
`\
`# 57. Runtime database caveat
`\
`
`\
`O banco local/remoto pode estar atrás das migrations versionadas.
`\
`
`\
`Não confunda:
`\
`
`\
` ```text
 `\
`Prisma schema valid
`\
` ```
 `\
`
`\
`com:
`\
`
`\
` ```text
 `\
`database migration applied
`\
` ```
 `\
`
`\
`Se runtime depender da nova migration:
`\
`
`\
`registre explicitamente no handoff que:
`\
`
`\
` ```text
 `\
`migration created but not applied
`\
` ```
 `\
`
`\
`Não declare runtime DB validado se a migration não foi aplicada.
`\
`
`\
`---
`\
`
`\
`# 58. Testes focados
`\
`
`\
`Execute separadamente testes de:
`\
`
`\
` ```text
 `\
`field-teams
`\
`shifts
`\
`shared contracts relevantes
`\
` ```
 `\
`
`\
`Informe total.
`\
`
`\
`---
`\
`
`\
`# PARTE M — SPEC COMPLIANCE
`\
`
`\
`# 59. Critérios mínimos
`\
`
`\
`A SPEC desta execução deve conter critérios verificáveis equivalentes a:
`\
`
`\
` ```text
 `\
`AC-01 Field Teams não é owner de criação de turnos.
`\
`
`\
`AC-02 Shifts é o único owner do lifecycle de turnos.
`\
`
`\
`AC-03 permissões de Shifts controlam mutações de turno.
`\
`
`\
`AC-04 membros possuem disponibilidade operacional consistente.
`\
`
`\
`AC-05 períodos de indisponibilidade são persistidos e validados.
`\
`
`\
`AC-06 specialties continuam administráveis.
`\
`
`\
`AC-07 team capabilities são calculáveis.
`\
`
`\
`AC-08 Shifts possui visão semanal/calendário.
`\
`
`\
`AC-09 coverage possui estado calculado.
`\
`
`\
`AC-10 required staffing é representado.
`\
`
`\
`AC-11 requirements por specialty são representados.
`\
`
`\
`AC-12 assignments validam disponibilidade.
`\
`
`\
`AC-13 assignments continuam validando conflitos.
`\
`
`\
`AC-14 replacements preservam histórico.
`\
`
`\
`AC-15 templates de turno existem.
`\
`
`\
`AC-16 turno pode ser copiado com regras seguras.
`\
`
`\
`AC-17 dashboard de Field Teams é operacionalmente útil.
`\
`
`\
`AC-18 dashboard de Shifts mostra cobertura/conflitos.
`\
`
`\
`AC-19 Domain Events relevantes são emitidos.
`\
`
`\
`AC-20 Audit recebe eventos via infraestrutura existente.
`\
`
`\
`AC-21 Notifications usa somente eventos apropriados.
`\
`
`\
`AC-22 nenhum import interno cross-plugin é criado.
`\
`
`\
`AC-23 migrations históricas não são alteradas.
`\
`
`\
`AC-24 novas regras críticas possuem testes.
`\
`
`\
`AC-25 documentação registra ownership dos domínios.
`\
`
`\
`AC-26 LOC antes/depois é reportada sem meta artificial.
`\
` ```
 `\
`
`\
`---
`\
`
`\
`# 60. Handoff
`\
`
`\
`A resposta final deve conter:
`\
`
`\
`## Prompt registration
`\
`
`\
` ```text
 `\
`prompts/sessoes/2026-10-04-workforce-operations-part-1.md
`\
` ```
 `\
`
`\
`## SPEC Gate
`\
`
`\
` ```text
 `\
`Classification:
`\
`SPEC:
`\
`SPEC commit:
`\
` ```
 `\
`
`\
`## Ownership Before / After
`\
`
`\
`Mostrar claramente:
`\
`
`\
` ```text
 `\
`antes:
`\
`Field Teams + Shifts compartilhavam criação/operação de turnos
`\
`
`\
`depois:
`\
`Field Teams = workforce
`\
`Shifts = schedules
`\
` ```
 `\
`
`\
`## Field Teams
`\
`
`\
`Funcionalidades adicionadas.
`\
`
`\
`## Shifts
`\
`
`\
`Funcionalidades adicionadas.
`\
`
`\
`## Shared / Event Bus
`\
`
`\
`Somente mudanças necessárias.
`\
`
`\
`## Database
`\
`
`\
` ```text
 `\
`models
`\
`campos
`\
`migration
`\
`migration aplicada? sim/não
`\
` ```
 `\
`
`\
`## Execution Issues Reconciliation
`\
`
`\
`Tabela obrigatória.
`\
`
`\
`## Tests
`\
`
`\
`Focados + suíte completa.
`\
`
`\
`## Validation
`\
`
`\
`| Gate | Resultado |
`\
`|---|---|
`\
`| spec:check | |
`\
`| boundaries | |
`\
`| typecheck | |
`\
`| lint | |
`\
`| tests | |
`\
`| build | |
`\
`| db:validate | |
`\
`| check-ap1 | |
`\
`| diff check | |
`\
`
`\
`## LOC
`\
`
`\
` ```text
 `\
`Antes:
`\
`Depois:
`\
`Delta:
`\
` ```
 `\
`
`\
`## SPEC Compliance
`\
`
`\
`Critério por critério.
`\
`
`\
`## Parte 2 readiness
`\
`
`\
`Declarar:
`\
`
`\
` ```text
 `\
`WORKFORCE PART 2 GATE: READY
`\
` ```
 `\
`
`\
`ou:
`\
`
`\
` ```text
 `\
`WORKFORCE PART 2 GATE: BLOCKED
`\
` ```
 `\
`
`\
`## Git
`\
`
`\
`SPEC commit + working tree.
`\
`
`\
`## Commits sugeridos
`\
`
`\
`Não execute.
`\
`
`\
`Sugestão aproximada:
`\
`
`\
` ```text
 `\
`refactor(workforce): establish shifts domain ownership
`\
`
`\
`feat(field-teams): add workforce availability and capabilities
`\
`
`\
`feat(shifts): expand coverage and schedule planning
`\
` ```
 `\
`
`\
`Todos com:
`\
`
`\
` ```text
 `\
`Agent: <agente real>
`\
`Spec: SPEC/2026-10-04-workforce-operations-part-1.md
`\
` ```
 `\
`
`\
`---
`\
`
`\
`# 61. Critério principal de sucesso
`\
`
`\
`Ao terminar, deve ser possível explicar a arquitetura sem ambiguidade:
`\
`
`\
` ```text
 `\
`Quem são as pessoas/equipes?
`\
`→ Field Teams
`\
`
`\
`Quando elas trabalham?
`\
`→ Shifts
`\
`
`\
`Quem está disponível?
`\
`→ Field Teams fornece disponibilidade
`\
`
`\
`O turno está coberto?
`\
`→ Shifts calcula usando assignments + disponibilidade + requirements
`\
` ```
 `\
`
`\
`A Parte 1 termina no planejamento/cobertura.
`\
`
`\
`A Parte 2 começará em despacho, execução em campo e integração com Tasks.`

