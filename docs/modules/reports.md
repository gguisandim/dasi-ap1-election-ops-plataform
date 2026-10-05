# Relatórios e BI

## 1. Objetivo

O módulo Relatórios e BI tem como objetivo oferecer leitura analítica e histórica sobre os dados persistidos da plataforma, consolidando indicadores de operação, incidentes, transmissão, equipes, logística e ativos.

O módulo é analítico, não é um centro de comando em tempo real: os números são derivados de registros já persistidos e podem estar sujeitos à latência natural de atualização dos domínios de origem. O módulo não possui entidades de domínio próprias; apenas lê e agrega dados dos owners (`Incidents`, `Field Teams`, `Routes`, `Inventory`, `Transmission`) por meio do schema compartilhado.

Este documento é descritivo. A fonte normativa é a SPEC `SPEC/2026-10-05-operational-intelligence-improvements.md`.

---

## 2. Estrutura

- **Visão geral** (`/reports`): relatório executivo consolidado, preservado como contrato existente, com exportação CSV e PDF;
- **Relatórios por domínio**: cada rota apresenta recortes analíticos específicos de um domínio;
- **Navegação interna**: barra de abas do próprio plugin, sem alterar o shell global.

### 2.1 Rotas de frontend

```text
/reports                 visão geral (executivo)
/reports/operations      operações combinadas
/reports/incidents       incidentes
/reports/transmission    transmissão
/reports/workforce       equipes de campo
/reports/logistics       logística
/reports/assets          ativos
```

### 2.2 Endpoints

```http
GET /api/reports/executive
GET /api/reports/operations
GET /api/reports/incidents
GET /api/reports/transmission
GET /api/reports/workforce
GET /api/reports/logistics
GET /api/reports/assets
GET /api/reports/export.csv
GET /api/reports/export.pdf
```

---

## 3. Filtros compartilhados

`ReportQueryDto` é o contrato comum de filtros, aplicado a todos os relatórios:

```text
from              data inicial do período
to                data final do período
electionId        pleito
zoneId            zona eleitoral
pollingPlaceId    local de votação
status            status (interpretado por domínio, quando aplicável)
categoryId        categoria de incidente
```

O `status` é mapeado apenas para o domínio compatível de cada relatório: o mesmo valor só é aplicado quando pertence ao enum correspondente (por exemplo, `SUCCESS` filtra pontos de transmissão, mas é ignorado em incidentes). Filtros específicos de domínio são adicionados somente quando há uso real — o relatório de incidentes aceita `severity` adicionalmente.

Cada resposta por domínio segue o envelope:

```text
generatedAt     instante de geração
period          { from, to }
filters         filtros aplicados
summary         indicadores consolidados
breakdown       byZone e byPlace; distribuições adicionais quando aplicável
comparison      comparação com o período anterior
```

---

## 4. Relatórios por domínio

### 4.1 Operações

Combina incidentes, transmissão, equipes, tarefas, ativos e rotas: incidentes abertos e críticos, taxa de sucesso de transmissão, equipes ativas, tarefas atrasadas, ativos disponíveis e rotas ativas/atrasadas.

### 4.2 Incidentes

Volume total, abertos, críticos e resolvidos, tempo médio de resolução, SLA, distribuição por severidade, categoria e status, e tendência diária por data de abertura.

### 4.3 Transmissão

Taxa de sucesso e de falha, latência média, taxa de retentativa, pontos offline, violações de prazo e tentativas do dia, além de distribuição por status e conectividade.

### 4.4 Equipes

Cobertura de locais, alocações, despachos, tempo de resposta (a partir dos timestamps de `FieldDispatch`), utilização e disponibilidade das equipes.

### 4.5 Logística

Rotas, rotas concluídas e atrasadas, entregas, pontualidade, exceções e taxa de exceção apuradas sobre rotas e entregas persistidas.

### 4.6 Ativos

Status, condição, tipo, movimentações, distribuição por zona e local, disponibilidade e ativos em boa condição.

---

## 5. Comparação de período

Quando `from` e `to` estão presentes e formam um intervalo válido, cada relatório compara o período atual com o **período anterior de mesma duração**, terminando exatamente onde o período atual começa.

```text
current  = [from, to]
previous = [from - (to - from), from)
```

Sem `from`/`to`, ou com intervalo inválido (duração não positiva), a comparação retorna `available: false` e `previous: null`. Nenhum período histórico é sintetizado.

A comparação zona × zona não é um bloco separado: é apresentada como ranking, ordenando as linhas do `breakdown` pelo indicador relevante.

---

## 6. Drill-down

As linhas do `breakdown` carregam os identificadores necessários para navegação. Os links de frontend apontam apenas para rotas existentes:

```text
local de votação   /polling-places/:id
incidentes         /incidents
transmissão        /transmission
ativo              /inventory/:id
rota               /routes/:id
equipes            /field-teams
```

Linhas por local linkam para o local de votação correspondente. Nenhum link aponta para rota inexistente.

---

## 7. Exportação

A visão geral executa exportação CSV e PDF sobre o relatório executivo; ambos os formatos permanecem inalterados. Nenhum valor demonstrativo é injetado — os arquivos refletem somente dados persistidos.

---

## 8. RBAC

Toda leitura exige `reports.read`, validada no backend. Exportações exigem adicionalmente `reports.export`. Nenhuma permissão nova é criada para os relatórios por domínio.

---

## 9. Limitações declaradas

- os relatórios usam apenas dados persistidos disponíveis; períodos sem registros retornam zero, nunca valores fictícios;
- não há infraestrutura de séries temporais nem agregação em tempo real;
- a leitura é feita sobre o schema compartilhado, garantindo isolamento por leitura e nunca por import de implementação de outro plugin;
- o módulo não assume propriedade das entidades lidas nem duplica regras de negócio dos domínios de origem.
