# Base de Conhecimento e Runbooks

Procedimentos operacionais e soluções conhecidas em uma base pesquisável, com
passos estruturados, recomendação automática a partir do incidente e registro de
uso que mede o que realmente resolve.

- **Categoria:** Operações
- **Rota raiz:** `/knowledge`
- **Permissões:** `knowledge.read`, `knowledge.manage`, `knowledge.publish`, `knowledge.execute`
- **Spec:** [`SPEC/2026-10-01-knowledge-runbooks.md`](../../../SPEC/2026-10-01-knowledge-runbooks.md)

## Páginas

| Rota | Página |
| --- | --- |
| `/knowledge` | Base: indicadores, busca e tabela |
| `/knowledge/new` | Novo artigo ou runbook (`?kind=RUNBOOK` abre direto no runbook) |
| `/knowledge/:id` | Detalhe, com passos, associação, versões e uso |
| `/knowledge/:id/edit` | Editor |
| `/knowledge/:id/versions` | Histórico de versões com instantâneos |
| `/knowledge/:id/execute` | Execução com progresso e registro do desfecho |
| `/knowledge/recommendations` | Recomendação por incidente ou por critérios |
| `/knowledge/metrics` | Uso, eficácia e cobertura |
| `/knowledge/categories` | Categorias cadastráveis |

## Artigos e runbooks

Compartilham uma tabela com discriminador `kind`. Isso mantém busca, categorização,
versionamento e métricas em um só lugar. Os campos exclusivos de runbook (problema,
sintomas, diagnóstico, pré-requisitos, validação, rollback, escalonamento,
referências) ficam nulos em artigos.

Publicar exige resumo; publicar um runbook exige ao menos um passo.

## Score de recomendação

Regra publicada, determinística e verificável. Os pesos são contrato compartilhado
(`RUNBOOK_MATCH_WEIGHTS` em `@eops/shared/knowledge`) e aparecem na interface.

```text
categoria de incidente igual ....... 40
severidade igual ................... 20
tipo de ativo igual ................ 15
palavra-chave presente no texto ....  5 por palavra (máx. 25)
-----------------------------------------------
score máximo 100
```

A comparação de palavra-chave é por **termo exato** (normalizado sem acento e em
minúsculas): `reconecta` não casa com a palavra-chave `reconexao`. Empates são
desempatados por quem já resolveu mais, maior taxa de sucesso, maior uso e, por
fim, título — a ordem é estável entre execuções.

Cada resultado devolve o `breakdown` e os `reasons`, e a página do runbook permite
testar com que pontuação ele seria sugerido para um incidente aberto.

## Uso e métricas

Registrar execução exige runbook publicado e grava incidente, usuário, passos
concluídos, desfecho e observações. Os contadores agregados (`usageCount`,
`resolvedCount`) ficam no verbete, para que métricas e ordenação de recomendação não
precisem agregar a tabela de uso a cada consulta.

As métricas respondem a: o que mais é usado, o que resolve, onde falta cobertura e
o que está desatualizado (mais de 180 dias sem atualização) ou nunca foi executado.

## Versionamento

Cada alteração gera uma versão com nota — obrigatória quando o verbete já saiu do
rascunho. A versão guarda um **instantâneo** de título, resumo, conteúdo e passos,
para que o histórico não aponte para o conteúdo atual.

## Estrutura

```text
src/
  manifest.ts / index.ts
  server/
    knowledge.module.ts         registro NestJS
    knowledge.controller.ts     endpoints
    knowledge.service.ts        CRUD, busca, publicação, versões, passos
    runbook.service.ts          recomendação, uso e métricas
    knowledge-catalog.service.ts categorias e etiquetas
    helpers/runbook-matching.ts  score determinístico (isolado para teste)
    helpers/                    códigos, estados, slugs
    dto/                        validação de entrada
  client/
    pages/ components/ hooks/ services/ styles/ utils/
```

## Integrações globais

- **Event Bus:** `runbook.created`, `runbook.published`, `runbook.matched`,
  `runbook.executed`; Notificações consome `runbook.published` e `runbook.executed`.
- **Shared:** contratos em `@eops/shared/knowledge`.
- **Banco:** models `Knowledge*` e `Runbook*` no `schema.prisma` central, migration
  `202610010006_knowledge_runbooks`.

## Testes

```bash
npx vitest run plugins/operations/knowledge-runbooks
```

Cobrem o score e seus componentes, normalização de texto e palavras-chave, a
ordenação determinística em todos os níveis de desempate, transições de estado,
versionamento com instantâneo, renumeração de passos, filtros, recomendações
(inclusive descarte e limite) e registro de uso com contadores.
