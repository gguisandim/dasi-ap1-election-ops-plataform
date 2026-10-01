# Base de Conhecimento e Runbooks — especificação

- **Data:** 2026-10-01
- **Status:** escrita antes do código de implementação
- **Plugin:** `plugins/operations/knowledge-runbooks`
- **Categoria:** Operações

## O quê e por quê

### Problema

A operação eleitoral resolve os mesmos problemas repetidamente — enlace de
conectividade que cai, impressora que não inicializa, transmissão que falha por
timeout, bateria com autonomia reduzida. O conhecimento de como resolver existe,
mas está na cabeça de poucas pessoas. Consequências:

1. **resolução dependente de quem está de plantão** — o tempo de atendimento varia
   conforme quem recebe o chamado;
2. **retrabalho de diagnóstico** — cada pessoa redescobre os mesmos sintomas;
3. **conhecimento que envelhece sem aviso** — um procedimento desatualizado é pior
   que nenhum, porque induz ao erro;
4. **nenhuma medição** — não se sabe quais procedimentos realmente resolvem.

### Motivação

Manter procedimentos operacionais e soluções conhecidas em uma base pesquisável,
com passos estruturados, associação determinística a incidentes e registro de uso
que permita medir quais runbooks resolvem de fato.

### Usuários

| Perfil | Necessidade |
| --- | --- |
| Técnico de plantão | Receber runbooks recomendados a partir do incidente e seguir os passos |
| Supervisão | Consultar procedimentos por categoria, severidade e palavra-chave |
| Curadoria | Publicar, revisar, versionar e arquivar artigos e runbooks |
| Gestão | Ver quais runbooks são mais usados, quais resolvem e onde falta cobertura |

### Valor operacional

- Um incidente passa a chegar com os procedimentos aplicáveis já sugeridos.
- O registro de uso transforma "achismo" em taxa de sucesso mensurável.
- Categorias sem cobertura ficam visíveis e viram pauta de curadoria.

## Critérios de aceitação

1. É possível cadastrar artigos com título, resumo, conteúdo, categoria, status,
   tags, autor e versão.
2. Artigos e runbooks convivem em uma única base pesquisável, distinguidos por
   tipo.
3. Runbooks possuem problema, sintomas, diagnóstico, pré-requisitos, passos,
   validação, rollback, escalonamento e referências.
4. Passos são registros ordenados próprios — ordem, título, instrução, resultado
   esperado, obrigatório/opcional, alerta e observações — não um texto gigante.
5. Categorias são cadastráveis.
6. Runbooks se associam a categoria de incidente, severidade, tipo de ativo e
   palavras-chave.
7. A recomendação de runbooks para um incidente é **determinística e explicável**:
   o score é calculado por regra publicada e cada resultado expõe os componentes
   que o compuseram. Nenhuma IA externa é usada.
8. O uso de um runbook registra incidente, usuário, data, resultado e se resolveu.
9. As métricas mostram runbooks mais utilizados, taxa de sucesso, categorias com
   menos cobertura, artigos sem uso e runbooks desatualizados.
10. A busca textual cobre título, resumo, tags, problema e sintomas.
11. Alterações relevantes geram versão consultável, com autor, data e nota.
12. `npm run check:boundaries`, `npm run typecheck`, `npm run lint` e `npm run build`
    passam.

## Fora do escopo

- Recomendação por IA ou embeddings: o matching é local, explicável e testável.
- Fluxo de aprovação em múltiplas etapas: `DRAFT → REVIEW → PUBLISHED` é decidido
  por quem tem `knowledge.publish`.
- Editor rich-text, anexos e imagens embutidas (evidências pertencem ao plugin
  Documentos e Evidências; o vínculo é por ID).
- Comentários, avaliações por estrelas e perguntas frequentes.
- Execução automatizada de passos: o runbook é um roteiro para pessoas.

## Domínio

### Entidades

| Entidade | Papel |
| --- | --- |
| `KnowledgeArticle` | Artigo ou runbook: conteúdo, tipo, status, categoria, tags, associação a incidentes |
| `KnowledgeCategory` | Categoria cadastrável (conectividade, hardware, transmissão, energia, logística, software, autenticação…) |
| `KnowledgeTag` / `KnowledgeTagLink` | Etiquetas e sua relação N:N |
| `RunbookStep` | Passo ordenado de um runbook |
| `KnowledgeArticleVersion` | Versão consultável: título, resumo, conteúdo/passos e nota da alteração |
| `RunbookUsage` | Registro de uso: incidente, usuário, resultado, se resolveu |

### Enums

- `KnowledgeArticleKind`: `ARTICLE`, `RUNBOOK`
- `KnowledgeArticleStatus`: `DRAFT`, `REVIEW`, `PUBLISHED`, `ARCHIVED`
- `RunbookUsageOutcome`: `RESOLVED`, `PARTIALLY_RESOLVED`, `NOT_RESOLVED`
- `IncidentSeverity` (reuso): severidade alvo do runbook

### Regras de negócio

1. **Código**: `KB-00001`, sequencial e único, compartilhado por artigos e runbooks.
2. **Transições**: `DRAFT → REVIEW | PUBLISHED | ARCHIVED`;
   `REVIEW → DRAFT | PUBLISHED | ARCHIVED`; `PUBLISHED → ARCHIVED`;
   `ARCHIVED` é terminal.
3. **Publicar** preenche `publishedAt`, exige resumo não vazio e, para runbook, ao
   menos um passo.
4. **Versão**: toda alteração de título, resumo, conteúdo, passos ou associação
   cria uma versão com nota obrigatória quando o artigo já foi publicado.
5. **Score de recomendação** (`runbook-matching`), determinístico:

   ```text
   categoria de incidente igual .......... 40
   severidade igual ...................... 20
   tipo de ativo igual ................... 15
   palavra-chave presente no texto ....... 5 por palavra (máx. 25)
   ------------------------------------------------
   score máximo 100
   ```

   Empate é desempatado por: já resolveu este incidente antes, maior taxa de
   sucesso, maior número de usos, título em ordem alfabética. Somente runbooks
   `PUBLISHED` são recomendados.

6. **Uso**: registrar uso exige runbook publicado; `resolved` é derivado do
   resultado (`RESOLVED` ⇒ resolveu).
7. **Desatualizado**: runbook publicado sem atualização há mais de 180 dias.
8. **Sem uso**: artigo publicado sem nenhum registro de uso.
9. **Exclusão física** só para `DRAFT`; demais são arquivados.

## Interface

| Página | Rota |
| --- | --- |
| Base de conhecimento (busca) | `/knowledge` |
| Novo artigo ou runbook | `/knowledge/new` |
| Detalhe | `/knowledge/:id` |
| Editor | `/knowledge/:id/edit` |
| Versões | `/knowledge/:id/versions` |
| Execução de runbook | `/knowledge/:id/execute` |
| Recomendações | `/knowledge/recommendations` |
| Métricas | `/knowledge/metrics` |
| Categorias | `/knowledge/categories` |

## Backend

```text
GET    /knowledge                        lista paginada com busca e filtros
GET    /knowledge/dashboard              indicadores da base
GET    /knowledge/reference-data         pleitos, categorias, tags, incidentes
GET    /knowledge/categories             categorias
POST   /knowledge/categories             cria categoria
PATCH  /knowledge/categories/:id         atualiza categoria
GET    /knowledge/tags                   etiquetas com contagem de uso
POST   /knowledge/tags                   cria/recupera etiqueta
GET    /knowledge/recommendations        runbooks recomendados (por incidente ou critérios)
GET    /knowledge/metrics                métricas de uso e cobertura
GET    /knowledge/usages                 histórico de uso
GET    /knowledge/:id                    detalhe (com passos e versões)
GET    /knowledge/:id/versions           histórico de versões
GET    /knowledge/:id/usages             usos de um runbook
POST   /knowledge                        cria artigo ou runbook
PATCH  /knowledge/:id                    atualiza (gera versão)
PUT    /knowledge/:id/steps              substitui os passos do runbook
POST   /knowledge/:id/publish            publica
POST   /knowledge/:id/review             envia para revisão
POST   /knowledge/:id/archive            arquiva
POST   /knowledge/:id/usages             registra uso do runbook
DELETE /knowledge/:id                    exclui apenas rascunho
```

## Eventos

| Evento | Quando |
| --- | --- |
| `runbook.created` | Runbook criado |
| `runbook.published` | Runbook publicado |
| `runbook.matched` | Recomendação retornou runbooks para um incidente |
| `runbook.executed` | Uso de runbook registrado, com resultado |

## Permissões

| Permissão | Uso |
| --- | --- |
| `knowledge.read` | Consultar base, buscar, ver recomendações e métricas |
| `knowledge.manage` | Criar/editar artigos, runbooks, passos, categorias e etiquetas |
| `knowledge.publish` | Publicar, enviar para revisão, arquivar |
| `knowledge.execute` | Registrar uso de runbook |

## LOC / completude

Backend separado entre catálogo (categorias/etiquetas), artigos (CRUD, versões,
busca), runbooks (passos, recomendações, uso, métricas) e helpers puros testáveis
— com o score de recomendação isolado para permitir teste direto da regra.
Frontend com páginas distintas por função, componentes reutilizáveis, editor de
passos ordenáveis, painel de execução e CSS Module próprio.
