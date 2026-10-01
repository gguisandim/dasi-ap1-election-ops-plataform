# Gestão de Riscos — especificação

- **Data:** 2026-10-01
- **Status:** escrita antes do código de implementação
- **Plugin:** `plugins/operations/risk-management`
- **Categoria:** Operações

## O quê e por quê

### Problema

Uma operação eleitoral tem riscos conhecidos antes de acontecer: zona com
histórico de queda de energia, local sem cobertura de equipe, rota única de acesso,
ponto de transmissão com link instável. Hoje esses riscos são conversados e
esquecidos — não há registro de quem é o dono, qual a probabilidade combinada com o
impacto, o que foi feito para mitigar nem quando o risco deixou de ser hipótese.

Consequências:

1. **risco sem dono** — ninguém responde por ele;
2. **priorização por impressão** — o risco mais comentado compete com o mais grave;
3. **mitigação sem acompanhamento** — ações planejadas não têm prazo nem conclusão;
4. **materialização invisível** — quando o risco vira incidente, ninguém liga os dois.

### Motivação

Identificar, avaliar e acompanhar riscos operacionais do pleito, com pontuação
calculada por regra explícita, matriz visual, plano de mitigação acompanhado e
registro de materialização vinculado ao incidente.

### Usuários

| Perfil | Necessidade |
| --- | --- |
| Coordenação | Ver a matriz do pleito e onde estão os riscos críticos |
| Proprietário do risco | Acompanhar as ações de mitigação sob sua responsabilidade |
| Supervisão de zona | Consultar riscos da sua zona e local |
| Gestão | Saber quantos riscos seguem sem mitigação e quantos se materializaram |

### Valor operacional

- Priorização deixa de ser opinião: `probabilidade × impacto` com faixas publicadas.
- Ação de mitigação tem responsável, prazo e percentual de conclusão acompanhados.
- A materialização de um risco vira evento e pode ser ligada ao incidente real.

## Critérios de aceitação

1. É possível registrar um risco com código, título, descrição, pleito, zona e
   local opcionais, categoria, responsável, proprietário, probabilidade, impacto,
   status, data de identificação, prazo e observação.
2. Probabilidade e impacto usam a mesma escala de cinco níveis.
3. O score é `valorDaProbabilidade × valorDoImpacto`, de 1 a 25.
4. A classificação (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`) vem de faixas
   publicadas e testadas.
5. Existe matriz 5×5 visual com os riscos posicionados, e clicar em uma célula
   leva à lista filtrada.
6. Cada risco pode ter múltiplas ações de mitigação, com responsável, prazo,
   status, percentual de conclusão, evidência (por ID) e observação.
7. Ações vencidas e não concluídas são identificadas como atrasadas.
8. Um risco materializado registra data, impacto real, observação e pode ser
   vinculado a um incidente **por ID, via Event Bus** — sem importar o plugin de
   Incidents.
9. O histórico registra criação, alteração de score, mudança de proprietário,
   mitigação, materialização e fechamento.
10. O painel mostra riscos ativos, críticos, sem mitigação, com mitigação atrasada,
    materializados e distribuição por categoria e por zona.
11. `npm run check:boundaries`, `npm run typecheck`, `npm run lint` e `npm run build`
    passam.

## Fora do escopo

- Cálculo de risco financeiro, valor esperado monetário e apetite de risco por
  área.
- Algoritmos estatísticos de probabilidade: os níveis são atribuídos por pessoas.
- Workflow de aprovação de aceitação de risco.
- Notificação automática por e-mail a proprietários.
- Visão consolidada entre pleitos no mesmo painel (o filtro por pleito é o caminho).

## Domínio

### Entidades

| Entidade | Papel |
| --- | --- |
| `Risk` | Risco operacional: descrição, localização, escala, score, classificação, status e dono |
| `RiskCategory` | Categoria cadastrável (energia, conectividade, logística, segurança, pessoal…) |
| `RiskMitigation` | Ação de mitigação com responsável, prazo, status e progresso |
| `RiskEvent` | Histórico: criação, alteração de score, troca de responsável, mitigação, materialização, fechamento |

### Enums

- `RiskProbability`: `VERY_LOW`, `LOW`, `MEDIUM`, `HIGH`, `VERY_HIGH`
- `RiskImpact`: mesma escala
- `RiskLevel`: `LOW`, `MODERATE`, `HIGH`, `CRITICAL`
- `RiskStatus`: `IDENTIFIED`, `ASSESSED`, `MITIGATING`, `MONITORING`, `ACCEPTED`, `CLOSED`, `MATERIALIZED`
- `RiskMitigationStatus`: `PLANNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- `RiskEventType`: `CREATED`, `ASSESSED`, `SCORE_CHANGED`, `OWNER_CHANGED`, `STATUS_CHANGED`, `MITIGATION_ADDED`, `MITIGATION_UPDATED`, `MITIGATION_COMPLETED`, `MATERIALIZED`, `CLOSED`, `REOPENED`, `NOTE_ADDED`

### Regras de negócio

1. **Escala**: `VERY_LOW` = 1, `LOW` = 2, `MEDIUM` = 3, `HIGH` = 4, `VERY_HIGH` = 5.
2. **Score** = valor da probabilidade × valor do impacto (1 a 25).
3. **Classificação por faixa de score**:

   | Score | Classificação |
   | --- | --- |
   | 1 – 4 | `LOW` |
   | 5 – 9 | `MODERATE` |
   | 10 – 15 | `HIGH` |
   | 16 – 25 | `CRITICAL` |

   A matriz 5×5 é derivada da mesma regra: a célula `(probabilidade, impacto)`
   recebe a classificação do produto. Não existem duas fontes de verdade.

4. **Código**: `RSK-00001`, sequencial e único.
5. **Score e classificação são sempre derivados** no servidor — o cliente não os
   envia.
6. **Criação** inicia em `IDENTIFIED`; a primeira alteração de probabilidade ou
   impacto move para `ASSESSED`.
7. **Transições**: `IDENTIFIED → ASSESSED | MITIGATING | MONITORING | ACCEPTED | CLOSED | MATERIALIZED`;
   `ASSESSED → MITIGATING | MONITORING | ACCEPTED | CLOSED | MATERIALIZED`;
   `MITIGATING → MONITORING | ACCEPTED | CLOSED | MATERIALIZED`;
   `MONITORING → MITIGATING | ACCEPTED | CLOSED | MATERIALIZED`;
   `ACCEPTED → MONITORING | MITIGATING | CLOSED | MATERIALIZED`;
   `MATERIALIZED → MITIGATING | MONITORING | CLOSED`; `CLOSED` é terminal.
8. **Mitigação atrasada**: prazo anterior a hoje e status diferente de `COMPLETED`
   ou `CANCELLED`.
9. **Progresso do risco**: média do percentual das mitigações não canceladas;
   risco sem mitigação tem progresso nulo e entra no indicador "sem mitigação".
10. **Materialização** registra data, impacto real e observação; quando um
    incidente é informado, o ID é validado no banco central e vinculado.
11. **Escalonamento**: passar de classificação não-`CRITICAL` para `CRITICAL`, ou
    piorar a classificação, emite `risk.escalated`.
12. **Exclusão física** apenas para risco `IDENTIFIED` e sem mitigação nem
    histórico de materialização.

## Interface

| Página | Rota |
| --- | --- |
| Painel e indicadores | `/risks` |
| Lista filtrável | `/risks/list` |
| Novo risco | `/risks/new` |
| Edição | `/risks/:id/edit` |
| Detalhe (mitigações, materialização, histórico) | `/risks/:id` |
| Matriz 5×5 | `/risks/matrix` |
| Categorias | `/risks/categories` |

## Backend

```text
GET    /risks                       lista paginada com filtros
GET    /risks/dashboard             indicadores, distribuições e matriz
GET    /risks/matrix                matriz 5×5 com riscos posicionados
GET    /risks/reference-data        pleitos, zonas, locais, categorias
GET    /risks/categories            categorias
POST   /risks/categories            cria categoria
PATCH  /risks/categories/:id        atualiza categoria
GET    /risks/:id                   detalhe com mitigações e histórico
GET    /risks/:id/timeline          histórico
POST   /risks                       cria risco
PATCH  /risks/:id                   atualiza risco (recalcula score)
PUT    /risks/:id/mitigations       substitui as ações de mitigação
POST   /risks/:id/materialize       registra materialização
POST   /risks/:id/close             encerra o risco
DELETE /risks/:id                   exclui apenas risco não tratado
```

## Eventos

| Evento | Quando |
| --- | --- |
| `risk.created` | Risco registrado |
| `risk.escalated` | Classificação subiu de faixa |
| `risk.materialized` | Risco se materializou, com impacto real e incidente vinculado |
| `risk.closed` | Risco encerrado |

## Permissões

| Permissão | Uso |
| --- | --- |
| `risks.read` | Consultar painel, lista, matriz, detalhe e histórico |
| `risks.manage` | Criar/editar riscos, mitigações e categorias |
| `risks.assess` | Alterar probabilidade, impacto, status, materializar e encerrar |

## LOC / completude

Backend separado entre riscos (CRUD, filtros, painel, matriz, materialização),
mitigações, catálogo e histórico, com o cálculo de score e a classificação isolados
em helper puro testado. Frontend com páginas distintas, matriz 5×5 interativa,
acompanhamento de mitigações, formulário de materialização e CSS Module próprio.
