# Planejamento de Recursos — especificação

- **Data:** 2026-10-01
- **Status:** escrita antes do código de implementação
- **Plugin:** `plugins/operations/resource-planning`
- **Categoria:** Operações

## O quê e por quê

### Problema

A operação sabe o que precisa em cada local, mas não compara isso com o que
efetivamente tem. A conta é feita de cabeça, por pessoa e por zona, com dois
efeitos previsíveis: locais com falta de equipe são descobertos no dia, e ativos
parados em uma zona coexistem com falta do mesmo ativo em outra.

Faltam:

1. **comparação explícita** entre demanda prevista e disponibilidade real;
2. **quantificação do déficit** por zona, local e recurso;
3. **simulação de cenários** — o que acontece se a demanda subir 20%?
4. **recomendação de ação** — realocar, reservar, adquirir ou liberar excedente;
5. **reserva formal** de recurso para um pleito, zona, local e período.

### Motivação

Comparar a demanda operacional prevista com a disponibilidade real de recursos,
quantificar déficits e sobras, simular cenários sem tocar nos dados operacionais e
produzir recomendações determinísticas de ação.

### Usuários

| Perfil | Necessidade |
| --- | --- |
| Coordenação de logística | Ver onde falta recurso e o que fazer a respeito |
| Supervisão de zona | Consultar o déficit da sua zona |
| Planejamento | Simular cenário conservador e crítico antes de decidir compra |
| Gestão | Saber a cobertura percentual do pleito |

### Valor operacional

- Déficit deixa de ser surpresa: aparece por zona, por local e por recurso.
- Cenários permitem decidir com números em vez de intuição.
- Reserva formal evita que o recurso reservado seja consumido por outra frente.

## Critérios de aceitação

1. É possível criar um planejamento com nome, período, situação, responsável e
   descrição, vinculado a um pleito.
2. Demandas podem ser por tipo de ativo, função operacional, equipe de campo ou
   recurso genérico, com quantidade necessária, prioridade, data necessária,
   justificativa e observação, e podem ser escopadas por zona e por local.
3. A **disponibilidade é calculada dos dados reais** — inventário, equipes,
   pessoas de campo e alocações vigentes — e nunca copiada para o planejamento.
4. Para recurso genérico não existe fonte automática: a disponibilidade é
   informada na própria demanda, e a interface deixa isso explícito.
5. Reservas ativas são descontadas da disponibilidade.
6. O déficit é `quantidadeNecessária − disponibilidade`: positivo é déficit,
   negativo é sobra.
7. Cada linha de análise recebe **recomendações determinísticas**: realocar,
   recuperar de manutenção, convocar, adquirir, transferir excedente ou liberar
   sobra — com o motivo.
8. Reservas podem ser feitas para pleito, zona, local e período.
9. Cenários (`BASE`, `CONSERVATIVE`, `CRITICAL`, `CUSTOM`) alteram a demanda
   **sem tocar nos dados operacionais reais**; o ajuste é aplicado no cálculo.
10. O painel mostra demanda total, disponibilidade, déficit, sobra, zonas
    críticas, recursos mais escassos e cobertura percentual.
11. Existe tabela detalhada filtrável por pleito, zona, recurso, situação e
    déficit.
12. Déficit relevante gera alerta persistido e evento `resource.deficit.detected`.
13. `npm run check:boundaries`, `npm run typecheck`, `npm run lint` e `npm run build`
    passam.

## Fora do escopo

- Algoritmo de otimização de alocação: as recomendações são regras determinísticas
  e explicáveis, não um solver.
- Custo financeiro, orçamento e cotação de fornecedores.
- Integração com sistemas externos de compras ou RH.
- Movimentação real de ativos a partir da recomendação: a ação é executada nos
  plugins de Inventário e Equipes, que são a fonte de verdade.
- Previsão estatística de demanda.

## Domínio

### Entidades

| Entidade | Papel |
| --- | --- |
| `ResourcePlan` | Planejamento de um pleito: nome, período, situação, responsável |
| `ResourceDemand` | Necessidade de recurso por escopo, quantidade, prioridade e data |
| `ResourceScenario` | Cenário de demanda (base, conservador, crítico, personalizado) |
| `ResourceScenarioAdjustment` | Ajuste por demanda dentro de um cenário personalizado |
| `ResourceReservation` | Reserva de recurso para pleito, zona, local e período |
| `ResourceAlert` | Alerta de déficit relevante, com situação de tratamento |

### Enums

- `ResourcePlanStatus`: `DRAFT`, `ACTIVE`, `CLOSED`, `ARCHIVED`
- `ResourceDemandKind`: `ASSET_TYPE`, `FIELD_ROLE`, `FIELD_TEAM`, `GENERIC`
- `ResourcePriority`: `LOW`, `NORMAL`, `HIGH`, `CRITICAL`
- `ResourceScenarioKind`: `BASE`, `CONSERVATIVE`, `CRITICAL`, `CUSTOM`
- `ResourceReservationStatus`: `PLANNED`, `ACTIVE`, `RELEASED`, `CANCELLED`
- `ResourceGapLevel`: `SURPLUS`, `BALANCED`, `DEFICIT`, `CRITICAL_DEFICIT`
- `ResourceAlertStatus`: `OPEN`, `ACKNOWLEDGED`, `RESOLVED`

### Regras de negócio

1. **Código**: `RPL-00001`, sequencial e único.
2. **Quantidade necessária** = `ceil(quantidadeBase × multiplicadorDoCenário × ajusteDaDemanda)`.
   Sem cenário selecionado, vale o cenário base (multiplicador 1).
3. **Disponibilidade por tipo de demanda**:

   | Tipo | Fonte | Contagem |
   | --- | --- | --- |
   | `ASSET_TYPE` | `Asset` do tipo, opcionalmente na zona/local | `AVAILABLE`, `ALLOCATED`, `IN_USE` contam; `MAINTENANCE`, `LOST`, `RETIRED` não |
   | `FIELD_ROLE` | `FieldMember` com a função, opcionalmente na zona/local por escala ou alocação vigente | `AVAILABLE`, `ASSIGNED`, `ON_DUTY` contam; `UNAVAILABLE`, `OFF_DUTY` não |
   | `FIELD_TEAM` | `FieldTeam` do pleito | somente `ACTIVE` |
   | `GENERIC` | Informada na demanda (`availableOverride`) | valor informado |

4. **Reservas** com situação `PLANNED` ou `ACTIVE` e escopo compatível são
   subtraídas da disponibilidade.
5. **Déficit** = necessária − disponível. `SURPLUS` (< 0), `BALANCED` (= 0),
   `DEFICIT` (> 0), `CRITICAL_DEFICIT` (> 0 com prioridade `CRITICAL` ou déficit
   acima de 50% da quantidade necessária).
6. **Recomendações** (determinísticas, com motivo):

   | Situação | Recomendação |
   | --- | --- |
   | Déficit e há sobra do mesmo recurso em outra zona | `REALLOCATE` — realocar da zona com sobra |
   | Déficit e existem ativos do tipo em manutenção | `RECOVER` — recuperar ativos em manutenção |
   | Déficit e existem pessoas da função fora de serviço | `MOBILIZE` — convocar pessoal fora de serviço |
   | Déficit sem outra fonte | `ACQUIRE` — adquirir/contratar a diferença |
   | Sobra e outra demanda do plano precisa do mesmo recurso | `TRANSFER` — transferir excedente |
   | Sobra sem destino no plano | `RELEASE` — liberar excedente |

7. **Alerta de déficit** é criado para linhas em `CRITICAL_DEFICIT` e publicado no
   Event Bus. Recalcular não duplica o alerta aberto da mesma demanda.
8. **Cobertura** = `disponível ÷ necessária`, limitada a 100%; necessária zero
   implica cobertura 100%.
9. **Exclusão física** apenas para planejamento em `DRAFT` sem demandas; os demais
   são arquivados. Planejamento não altera dados operacionais reais.

## Interface

| Página | Rota |
| --- | --- |
| Visão geral dos planejamentos | `/resources` |
| Lista de planejamentos | `/resources/plans` |
| Novo planejamento | `/resources/plans/new` |
| Painel do planejamento | `/resources/plans/:id` |
| Demandas (tabela detalhada e cadastro) | `/resources/plans/:id/demands` |
| Cenários | `/resources/plans/:id/scenarios` |
| Reservas | `/resources/plans/:id/reservations` |
| Análise de déficit e recomendações | `/resources/plans/:id/analysis` |

## Backend

```text
GET    /resources/overview                    consolidação dos planejamentos ativos
GET    /resources/plans                       lista de planejamentos
GET    /resources/plans/reference-data        pleitos, zonas, locais, tipos de ativo, funções, equipes
GET    /resources/plans/:id                   detalhe do planejamento
GET    /resources/plans/:id/analysis           análise por demanda: disponível, déficit, cobertura, recomendações
GET    /resources/plans/:id/dashboard          indicadores, zonas críticas e recursos escassos
GET    /resources/plans/:id/demands            tabela detalhada filtrável
GET    /resources/plans/:id/scenarios          cenários
GET    /resources/plans/:id/reservations       reservas
GET    /resources/plans/:id/alerts             alertas de déficit
POST   /resources/plans                        cria planejamento
PATCH  /resources/plans/:id                    atualiza planejamento
PUT    /resources/plans/:id/demands            substitui as demandas do planejamento
POST   /resources/plans/:id/scenarios          cria cenário
PATCH  /resources/plans/:id/scenarios/:scenarioId   atualiza cenário
PUT    /resources/plans/:id/reservations       substitui as reservas
POST   /resources/plans/:id/alerts/:alertId/acknowledge  reconhece alerta
POST   /resources/plans/:id/archive            arquiva planejamento
DELETE /resources/plans/:id                    exclui apenas rascunho sem demandas
```

## Eventos

| Evento | Quando |
| --- | --- |
| `resource.deficit.detected` | Déficit crítico identificado na análise do planejamento |
| `resource.allocation.changed` | Demandas ou reservas do planejamento alteradas |

## Permissões

| Permissão | Uso |
| --- | --- |
| `resources.read` | Consultar painel, planejamentos, análise e reservas |
| `resources.manage` | Criar/editar planejamento, demandas, cenários e reservas |
| `resources.analyze` | Executar a análise e reconhecer alertas de déficit |

## LOC / completude

Backend separado entre planejamento (CRUD e painel), demandas, disponibilidade
(cálculo a partir dos dados reais), déficit/recomendações (helper puro testado),
cenários, reservas e alertas. Frontend com páginas por função, tabela detalhada
filtrável, gráficos comparativos sem dependência externa e CSS Module próprio.
