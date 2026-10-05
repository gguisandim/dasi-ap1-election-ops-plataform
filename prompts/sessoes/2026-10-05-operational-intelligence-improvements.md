Você está trabalhando no monorepo **Election Ops Platform**.

Esta execução é:

```text
PLUGIN IMPROVEMENTS — OPERATIONAL INTELLIGENCE
```

Plugins-alvo:

```text
Operational Simulator
Reports / BI
Operational Map
Transmission
```

Objetivo:

transformar quatro módulos atualmente pequenos ou intermediários em uma vertical operacional integrada:

```text
Transmission
     ↓
falhas / alertas
     ↓
Operational Map
     ↓
visão geográfica
     ↓
Simulator
     ↓
cenários e treinamento
     ↓
Reports
     ↓
análise e indicadores
```

NÃO redesenhar plugins maduros.

NÃO alterar profundamente:

```text
Incidents
Field Teams
Shifts
Tasks
Preparation Checklists
Access Control
Communications
Evidence
Knowledge
Risks
```

Eles podem ser apenas consumidores/fontes de dados através de contratos públicos.

---

# 0. CONTEXTO DE ORDEM DAS EXECUÇÕES

A ordem originalmente planejada das execuções foi alterada.

A execução de:

```text
Access Control
Tasks
Preparation Checklists
```

já foi realizada antes desta etapa.

Portanto:

> considere o estado ATUAL do repositório como baseline autoritativo.

NÃO tente:

```text
restaurar estado anterior
desfazer implementações já realizadas
reordenar migrations existentes
recriar funcionalidades implementadas
assumir schema anterior
assumir LOC antigo
```

A nomenclatura histórica:

```text
Part 1
Part 2
Part 3
```

representava apenas organização do plano de trabalho.

Ela NÃO representa dependência cronológica obrigatória.

A fonte de verdade desta execução é:

```text
HEAD atual
+
working tree atual
+
SPECs existentes
+
schema Prisma atual
+
migrations existentes
+
contratos públicos atuais
```

No último handoff conhecido, o projeto estava aproximadamente em:

```text
611 arquivos
58.100 LOC
```

Esse número é apenas contexto.

NÃO hardcode esse valor.

Execute `npm run count:loc` no preflight e utilize o valor realmente encontrado.

Também existe atualmente uma migration semelhante a:

```text
202610050001_administration_work_improvements
```

NÃO presuma que esse seja o último identificador disponível.

Inspecione:

```text
packages/database/prisma/migrations/
```

e use o próximo identificador livre caso esta execução precise de nova migration.

NUNCA:

```text
renomeie migration histórica
altere migration histórica
reordene migrations para reproduzir o plano original
```

---

# 1. DISCIPLINA DE EXECUÇÃO PARA DEEPSEEK

Esta tarefa deve priorizar:

```text
implementação
→ teste focado
→ implementação
→ teste focado
→ validação completa no final
```

Durante desenvolvimento:

```text
small diff
→ focused validation
→ continue
```

NÃO execute repetidamente:

```text
npm test
npm run build
npm run typecheck
```

após cada pequena mudança.

A suíte completa deve rodar somente no Validation Gate final.

Se um teste focado falhar:

```text
corrigir
→ repetir somente o teste afetado
```

Não reiniciar toda a validação.

---

# 2. POLÍTICA DE TESTES

Use **risk-based testing**.

Criar testes principalmente para:

```text
regras de negócio
cálculos
transições
filtros
agregações
determinismo
SLA
lifecycle
Event Bus relevante
```

NÃO criar testes unitários desnecessários para:

```text
CSS
componentes puramente visuais
DTO sem lógica
wrapper trivial
constantes
funções de encaminhamento
```

Não duplicar a mesma regra em várias camadas sem necessidade.

---

# 3. PROMPT REGISTRATION

Salvar este prompt literalmente em:

```text
prompts/sessoes/2026-10-05-operational-intelligence-improvements.md
```

Não resumir.

Não reescrever.

Não substituir pelo handoff final.

---

# 4. PREFLIGHT

Executar:

```bash
git status --short
git log --oneline -12
npm run spec:check -- HEAD
npm run check:boundaries
npm run count:loc
```

Também inspecionar:

```text
packages/database/prisma/migrations/
```

Não executar a suíte completa neste momento.

Leia:

```text
AGENTS.md
SPEC/README.md
docs/AI-PLUGIN-GUIDE.md
docs/UI-DESIGN-GUIDE.md
docs/execution-issues/README.md
```

Depois inspecione somente os plugins desta execução:

```text
Simulator
Reports
Operational Map
Transmission
```

Use os paths reais encontrados no repositório.

Consulte quando necessário:

```text
packages/database
packages/shared
packages/event-bus
packages/security
```

Não carregue todos os plugins do monorepo no contexto.

---

# 5. EXECUTION ISSUES PREFLIGHT

Revise apenas issues relevantes para esta execução.

Classifique:

```text
BLOCKS_CURRENT_TASK
RELATED_NON_BLOCKING
OUT_OF_SCOPE
```

Issues conhecidos podem incluir:

```text
Prisma/deepmerge
migration vs banco remoto
browser visual QA
```

Não resolver dívida histórica fora deste escopo.

Se o banco remoto estiver atrás das migrations:

registre.

Não aplique migration remotamente sem autorização explícita.

---

# 6. SPEC GATE

Classificação esperada:

```text
NEW_SPEC
```

Criar:

```text
SPEC/2026-10-05-operational-intelligence-improvements.md
```

A SPEC deve refletir o estado ATUAL do código.

Não escrever SPEC baseada em estado antigo do repositório.

---

# 7. COMMIT EXCLUSIVO DA SPEC

Você está autorizado a realizar SOMENTE o commit inicial da SPEC.

Stage exclusivamente:

```text
SPEC/2026-10-05-operational-intelligence-improvements.md
```

Verificar:

```bash
git diff --cached --name-only
```

Commit:

```text
docs(spec): define operational intelligence improvements
```

Utilize trailer `Agent:` compatível com a regex atual do projeto.

Exemplo:

```text
Agent: claude/deepseek-flash-1m
```

Não utilizar:

```text
[
]
espaços
caracteres fora de [A-Za-z0-9._-]
```

Nenhum outro commit deve ser feito durante a implementação.

---

# PARTE A — TRANSMISSION

# 8. OBJETIVO

Transformar Transmission em uma visão operacional semelhante a um pequeno NOC.

Preservar o que já existe:

```text
queue
attempts
connectivity
alerts
dashboard
priority
deadline
```

Não reconstruir o plugin.

---

# 9. TRANSMISSION NOC

Criar visão:

```text
/transmission/noc
```

Exibir indicadores reais:

```text
total
success
queued
transmitting
failed
offline
deadline risk
latency
```

Agregar quando possível por:

```text
zona
local
status
```

---

# 10. SLA / DEADLINE STATE

Criar estado calculado equivalente a:

```text
ON_TRACK
DUE_SOON
OVERDUE
COMPLETED
```

Não persistir se puder ser derivado.

A regra precisa estar documentada na SPEC.

---

# 11. ALERT LIFECYCLE

Alertas devem possuir lifecycle operacional.

Exemplo:

```text
OPEN
ACKNOWLEDGED
RESOLVED
```

Persistir quando necessário:

```text
acknowledgedAt
acknowledgedBy
resolvedAt
resolvedBy
reason
notes
```

Não apagar alertas históricos.

---

# 12. RETRY POLICY

Aprofundar tentativas.

Permitir:

```text
manual retry
bulk retry
retry reason
attempt history
```

Não criar scheduler/daemon complexo.

---

# 13. CONNECTIVITY HISTORY

Disponibilizar histórico suficiente para mostrar:

```text
online/offline
latency evolution
last successful transmission
failure streak
```

Não criar infraestrutura pesada de séries temporais.

---

# 14. TRANSMISSION DASHBOARD

Adicionar métricas como:

```text
success rate
failure rate
deadline risk
offline locations
average latency
attempts today
```

Somente métricas calculáveis com os dados existentes.

---

# 15. DETALHE OPERACIONAL

Melhorar detail page para apresentar:

```text
estado atual
local
zona
deadline
SLA
conectividade
latência
tentativas
alertas
timeline
```

---

# PARTE B — OPERATIONAL MAP

# 16. OBJETIVO

Transformar o mapa em uma visão geográfica agregadora da operação.

Operational Map NÃO deve assumir ownership de outros domínios.

---

# 17. LAYERS

Implementar layers equivalentes a:

```text
Polling Places
Incidents
Transmission
Field Teams
Routes
Assets
```

Somente incluir layer cuja informação possa ser obtida de maneira correta no estado atual do repositório.

Não criar dados fake.

---

# 18. MAP API

Criar API agregadora própria se isso evitar múltiplas requests desnecessárias.

Exemplo:

```text
GET /operational-map/features
```

Possíveis filtros:

```text
electionId
zoneId
types
severity
status
```

O mapa pode consultar persistência/contratos públicos.

Não importar implementação interna de outro plugin.

---

# 19. FEATURE CONTRACT

Definir contrato unificado equivalente a:

```ts
{
  id,
  type,
  latitude,
  longitude,
  title,
  status,
  severity?,
  entityId,
  updatedAt,
  metadata
}
```

Ajustar conforme arquitetura existente.

Não expor objetos Prisma inteiros.

---

# 20. MARKER SEMANTICS

Diferenciar:

```text
local
incidente
transmissão
equipe
rota
ativo
```

Status não pode depender somente de cor.

Use:

```text
ícone
badge
label
shape
```

quando adequado.

---

# 21. CLUSTERING

Adicionar clustering quando houver quantidade significativa de pontos.

Não renderizar centenas de markers individualmente sem necessidade.

---

# 22. SIDEBAR

Ao selecionar feature:

mostrar:

```text
tipo
nome/código
status
resumo
última atualização
ações/deep link
```

Links devem apontar somente para rotas existentes.

---

# 23. FILTERS

Adicionar:

```text
layer
zona
severidade
status
```

e outros filtros apenas quando justificáveis.

---

# 24. FULLSCREEN

Criar modo operacional apropriado para monitor/NOC.

Não redesenhar o shell global.

---

# PARTE C — OPERATIONAL SIMULATOR

# 25. OBJETIVO

O Simulator deve deixar de ser apenas:

```text
create
start
pause
tick
finish
```

e passar a representar cenários operacionais reais.

---

# 26. SCENARIO BUILDER

Criar fluxo:

```text
/simulator/scenarios
/simulator/scenarios/new
/simulator/scenarios/:id
```

Um cenário deve possuir:

```text
nome
descrição
seed opcional
duração
configuração
eventos
```

---

# 27. SCENARIO EVENTS

Representar eventos programados.

Exemplo:

```text
00:05 connectivity degradation
00:10 transmission failure
00:15 critical incident
00:25 asset failure
00:40 restoration
```

Campos conceituais:

```text
offset
type
target
severity
configuration
probability
```

---

# 28. EVENT TYPES

Suportar inicialmente apenas eventos executáveis pela plataforma.

Exemplos:

```text
INCIDENT_CREATE
TRANSMISSION_FAILURE
TRANSMISSION_RECOVERY
ASSET_FAILURE
ASSET_RECOVERY
```

Não adicionar evento sem implementação real.

---

# 29. TARGET SELECTION

Eventos podem direcionar:

```text
pollingPlace
zone
asset
transmission
```

quando aplicável.

Não criar relacionamentos excessivamente genéricos sem necessidade.

---

# 30. DETERMINISM

Quando existir seed:

execuções equivalentes devem ser deterministicamente reproduzíveis quando a lógica permitir.

Adicionar teste específico.

---

# 31. ENGINE

Preservar engine simples e in-process.

Lifecycle:

```text
start
pause
resume
tick
finish
```

Não introduzir:

```text
Kafka
RabbitMQ
Redis
job queue externa
```

---

# 32. LOGICAL CLOCK

A simulação pode utilizar relógio lógico.

Permitir avanço da timeline sem depender de longos timers reais.

---

# 33. SPEED

Adicionar velocidade conceitual:

```text
1x
2x
5x
10x
```

Pode representar avanço lógico.

Evitar timers frágeis.

---

# 34. EVENT EXECUTION

Quando o tempo lógico alcançar um evento:

```text
identificar evento
→ validar target
→ executar mudança
→ registrar resultado
→ adicionar SimulationEvent/replay
```

Falha de execução também deve ser registrada.

---

# 35. SCORE

Ao concluir uma simulação, calcular score operacional.

Possíveis dimensões:

```text
acknowledgement speed
incident resolution
transmission recovery
SLA violations
critical unresolved events
```

A fórmula deve:

```text
estar na SPEC
ser determinística
ser testável
```

Não persistir componentes deriváveis sem necessidade.

---

# 36. SIMULATION REPORT

Mostrar:

```text
score
eventos previstos
eventos executados
incidentes
falhas
tempo de resposta
violações
resolvidos
pendentes
```

---

# 37. REPLAY

Melhorar replay:

```text
timeline
logical time
event type
target
result
entity
```

Permitir entender o que aconteceu durante a execução.

---

# 38. ISOLAMENTO

Antes de executar cenários contra entidades operacionais reais, defina na SPEC como a simulação evita corromper operação real.

Preferência:

```text
simulationId
ou
dados explicitamente marcados como simulação
```

Não misturar silenciosamente treinamento com estado operacional real.

Se o modelo atual já possui estratégia segura, reutilize.

---

# PARTE D — REPORTS / BI

# 39. OBJETIVO

Reports não deve continuar concentrado apenas em dashboard executivo genérico.

Criar análises por domínio.

---

# 40. ROTAS

Criar somente rotas com funcionalidade real.

Exemplos:

```text
/reports
/reports/operations
/reports/incidents
/reports/transmission
/reports/workforce
/reports/logistics
/reports/assets
```

---

# 41. SHARED REPORT FILTERS

Criar contrato consistente:

```text
from
to
electionId
zoneId
pollingPlaceId
```

Filtros específicos podem existir por domínio.

---

# 42. OPERATIONS REPORT

Combinar indicadores de:

```text
incidentes
transmissão
equipes
tasks
ativos
rotas
```

Reports = histórico/análise.

Não transformar Reports em Command Center realtime.

---

# 43. INCIDENT REPORT

Mostrar:

```text
volume
severity
resolution time
SLA
categories
zones
trend
```

Reutilizar dados atuais.

Não duplicar regras de Incidents no frontend.

---

# 44. TRANSMISSION REPORT

Mostrar:

```text
success rate
failure rate
latency
retry rate
offline periods
deadline violations
```

---

# 45. WORKFORCE REPORT

Aproveitar dados já implementados na vertical Workforce:

```text
coverage
dispatches
response time
utilization
availability
```

Não modificar Field Teams/Shifts para gerar relatório salvo se os dados puderem ser consultados.

---

# 46. LOGISTICS REPORT

Quando os dados atuais permitirem:

```text
routes
deliveries
delays
assets moved
exceptions
```

Não antecipar funcionalidades da futura melhoria de Inventory/Routes.

---

# 47. ASSET REPORT

Usar Inventory atual para mostrar:

```text
status
movements
distribution
availability
```

Somente métricas já suportadas.

---

# 48. DRILL-DOWN

Quando possível:

```text
geral
→ zona
→ local
→ entidade
```

Links devem usar páginas existentes.

---

# 49. COMPARISON

Adicionar comparação:

```text
período atual × período anterior
zona × zona
```

Não criar engine BI genérica.

---

# 50. EXPORT

Preservar CSV/PDF atuais.

Expandir exports somente onde houver benefício real.

---

# PARTE E — EVENT BUS / AUDIT / NOTIFICATIONS

# 51. DOMAIN EVENTS

Adicionar apenas eventos novos realmente relevantes.

Exemplos:

```text
transmission.alert_acknowledged
transmission.alert_resolved

simulation.started
simulation.paused
simulation.resumed
simulation.finished
simulation.scored
```

Não emitir evento para:

```text
map viewed
report viewed
filter changed
simulation tick trivial
```

---

# 52. AUDIT

Não alterar arquitetura do Audit.

O Audit já utiliza subscriber global.

Garanta payloads adequados.

---

# 53. NOTIFICATIONS

Somente eventos operacionais importantes.

Possíveis:

```text
transmission critical failure
transmission deadline overdue
critical alert unresolved
simulation finished
```

`simulation finished` só deve ser notificação se fizer sentido operacional.

Evitar spam.

---

# PARTE F — DATABASE

# 54. SCHEMA REVIEW

Antes de adicionar qualquer model:

inspecione schema atual.

Possíveis mudanças:

```text
TransmissionAlert lifecycle fields
SimulationScenarioEvent
Simulation score/result
```

Mas reutilize models existentes sempre que possível.

---

# 55. MIGRATION

Se schema mudar:

crie migration NOVA.

Use próximo identificador disponível.

Exemplo apenas conceitual:

```text
202610050002_operational_intelligence_improvements
```

MAS:

> descubra o próximo identificador real no repositório.

Não hardcode `002`.

Não alterar migrations anteriores.

Não aplicar migration no banco remoto.

---

# 56. INDEXES

Adicionar somente índices associados a queries reais.

Exemplos possíveis:

```text
Transmission(status, deadline)
TransmissionAlert(status, createdAt)
Simulation(status, createdAt)
SimulationScenarioEvent(scenarioId, offset)
```

Não duplicar índices existentes.

---

# PARTE G — FRONTEND

# 57. DESIGN

Seguir:

```text
docs/UI-DESIGN-GUIDE.md
```

Reutilizar:

```text
@eops/ui
```

Não criar design system paralelo.

---

# 58. STATES

Toda nova página deve contemplar:

```text
loading
error
empty
success
```

---

# 59. RESPONSIVIDADE

Implementar para:

```text
1440px
1024px
<=760px
```

Se browser não estiver disponível ao agente:

```text
VISUAL_QA = NOT_ACTIONABLE
```

Isso NÃO deve bloquear conclusão técnica quando:

```text
typecheck
tests
build
```

estiverem verdes.

---

# PARTE H — TESTES OTIMIZADOS

# 60. TRANSMISSION TESTS

Cobrir prioritariamente:

```text
SLA state
alert lifecycle
retry
aggregation
```

---

# 61. SIMULATOR TESTS

Cobrir:

```text
scenario validation
timeline execution
deterministic seed
event result
score
```

---

# 62. MAP TESTS

Cobrir backend/contratos:

```text
feature aggregation
filters
layer selection
```

Não testar Leaflet/renderização visual profundamente.

---

# 63. REPORT TESTS

Cobrir:

```text
filtering
aggregation
comparison
```

---

# 64. VOLUME DE TESTES

Orientação:

```text
12–24 testes novos no total
```

Não é limite rígido.

Ultrapassar somente se regras críticas distintas exigirem.

Não perseguir quantidade.

---

# 65. DURANTE DESENVOLVIMENTO

Executar:

```bash
npx vitest run <arquivo-focado>
```

ou comando equivalente já utilizado no projeto.

NÃO rodar `npm test` antes da validação final.

---

# PARTE I — LOC

# 66. BASELINE

Use o valor obtido no preflight:

```bash
npm run count:loc
```

Não use 58.100 como valor oficial sem medir.

---

# 67. FINAL

No fim:

```bash
npm run count:loc
```

Reportar:

```text
Antes
Depois
Delta
Arquivos antes/depois
```

Não perseguir meta de delta.

---

# PARTE J — FORA DO ESCOPO

# 68. NÃO IMPLEMENTAR

NÃO implementar nesta execução:

```text
Kafka
Redis
WebSocket infrastructure
machine learning
AI prediction
GPS tracking
route optimization
Inventory lifecycle avançado
Routes lifecycle avançado
Shift Handover
Command Center novo
Resource Requests
```

---

# PARTE K — FINAL VALIDATION

# 69. GATES

Somente no final:

```bash
npm run spec:check
npm run check:boundaries
npm run typecheck
npm run lint
```

Depois:

testes focados.

Depois UMA execução:

```bash
npm test
```

Depois:

```bash
npm run build
npm run db:validate
npm run count:loc
git diff --check
```

E:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-ap1.ps1
```

Este prompt autoriza explicitamente o uso de:

```text
-ExecutionPolicy Bypass
```

somente para executar:

```text
scripts/check-ap1.ps1
```

Se esse gate ainda for bloqueado pelo ambiente/harness:

registre como execution issue.

Não tente contornar outras políticas do sistema.

---

# 70. GATE FAILURE STRATEGY

Se um gate falhar:

```text
identificar causa
→ corrigir
→ repetir gate afetado
→ repetir somente dependentes necessários
```

Não reexecutar tudo automaticamente.

---

# PARTE L — DOCUMENTAÇÃO

# 71. DOCS MODULES

Atualizar documentos correspondentes a:

```text
Transmission
Simulator
Reports
Operational Map
```

Use os nomes reais existentes.

Se documento não existir e fizer sentido:

criar.

Lembrete:

```text
SPEC = normativo
docs/modules = descritivo
```

---

# PARTE M — EXECUTION ISSUES

# 72. RECONCILIATION

No final entregar:

```text
EXECUTION ISSUES RECONCILIATION
```

Tabela:

| Issue | Antes | Depois | Ação | Evidência | Bloqueia próxima fase? |

Não registrar debugging trivial.

---

# PARTE N — SPEC COMPLIANCE

# 73. CRITÉRIOS MÍNIMOS

A SPEC deve conter critérios verificáveis equivalentes a:

```text
AC-01 Transmission possui visão NOC.

AC-02 SLA/deadline possui estado derivado consistente.

AC-03 alertas possuem acknowledgement/resolution.

AC-04 retry mantém histórico.

AC-05 conectividade possui histórico suficiente para análise.

AC-06 Operational Map possui layers operacionais.

AC-07 Map não assume ownership de outros domínios.

AC-08 Map features possuem contrato unificado.

AC-09 Map suporta filtros e clustering quando necessário.

AC-10 Simulator possui Scenario Builder.

AC-11 cenário possui eventos programados.

AC-12 somente eventos executáveis são aceitos.

AC-13 seed permite comportamento determinístico quando aplicável.

AC-14 Simulation engine preserva lifecycle.

AC-15 score possui fórmula explícita e testada.

AC-16 replay explica os eventos executados.

AC-17 Reports possui análises por domínio.

AC-18 Reports possui filtros compartilhados.

AC-19 Reports suporta comparação.

AC-20 drill-down utiliza dados reais.

AC-21 Event Bus recebe apenas novos eventos relevantes.

AC-22 Audit continua via infraestrutura existente.

AC-23 Notifications evita eventos triviais.

AC-24 nenhum import interno cross-plugin é criado.

AC-25 migrations históricas permanecem intactas.

AC-26 regras críticas possuem testes focados.

AC-27 full suite passa ao final.

AC-28 LOC antes/depois é reportada sem expansão artificial.
```

---

# PARTE O — HANDOFF

# 74. RESPOSTA FINAL

Seja conciso.

Entregar:

## Prompt registration

## SPEC Gate

```text
Classification
SPEC
SPEC commit
```

## Baseline encontrado

```text
HEAD
LOC
última migration existente antes desta execução
```

## Before / After

## Transmission

## Operational Map

## Simulator

## Reports

## Database

```text
models
campos
migration
migration aplicada? não/sim
```

## Tests

```text
focused
full suite
```

## Validation

Tabela curta.

## LOC

```text
Antes
Depois
Delta
```

## Execution Issues

Tabela.

## SPEC Compliance

```text
PASS
PARTIAL
BLOCKED
```

Se PASS:

não repetir todos os ACs individualmente.

## Git

SPEC commit + working tree.

Não fazer commits adicionais.

---

# 75. CRITÉRIO PRINCIPAL DE SUCESSO

Ao final deve ser possível responder claramente:

```text
Transmission
→ qual é a saúde operacional da transmissão?

Operational Map
→ onde estão os problemas e recursos?

Simulator
→ como a plataforma reage a um cenário controlado?

Reports
→ o que aconteceu e como a operação performou?
```

Tudo isso deve funcionar sobre o estado ATUAL do repositório, independentemente da ordem original em que as fases foram planejadas.
