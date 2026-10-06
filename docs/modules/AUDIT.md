# Auditoria e Observabilidade 2.0

Plugin `@eops/plugin-audit`, em `plugins/system/audit`, categoria `system`, rota `/audit`.

Documentação descritiva. A fonte normativa é `SPEC/2026-10-06-platform-depth-integration.md` (Parte 4).

## Papel

Responder "quem fez o quê, quando, sobre qual entidade e em que cadeia". Deixou de ser apenas um assinante de eventos: agora oferece exploração, timeline de entidade, correlação de cadeia e diff de alteração.

O plugin continua sendo um assinante global (`subscribeAll`). Ele **não** escreve `AuditEvent` manualmente e não emite eventos de negócio próprios — o registro nasce do Event Bus.

## Correlation ID

Fluxo coberto: requisição HTTP → operação de serviço → Event Bus → auditoria e notificação.

- `@eops/shared/correlation` mantém o valor em `AsyncLocalStorage` (`runWithCorrelationId`, `currentCorrelationId`, `normalizeCorrelationId`).
- Um interceptor global em `apps/api` lê o header `x-correlation-id`, aceita somente valores válidos (≤ 64 caracteres, ASCII imprimível), gera um `randomUUID()` quando ausente ou inválido e devolve o valor no header da resposta.
- O `EventBus` anexa `event.correlationId` a partir do contexto ativo.
- O assinante de auditoria persiste `correlationId`; o de notificação também.

Ausência de correlation ID nunca quebra emissão, persistência ou entrega: o campo fica `null`. Nada exige que um serviço receba o identificador por parâmetro.

## Enriquecimento do registro

`AuditEvent` carrega, além do que já existia: `category`, `severity`, `correlationId`, `electionId` e `electoralZoneId`.

```text
category  namespace do eventName (prefixo antes do primeiro ponto); sem eventName, derivado de entityType em kebab-case
severity  CRITICAL para falha, escalonamento e cancelamento crítico; WARNING para mudança de status ou severidade;
          NOTICE para criação; INFO para o resto
electionId / electoralZoneId  copiados do payload quando presentes; nunca inferidos por consulta adicional
```

Nada disso é enviado pelo cliente: o servidor deriva.

## Sanitização

Aplicada na escrita **e** na leitura (defesa em profundidade), recursivamente sobre objetos e arrays, por comparação de substring case-insensitive:

```text
password, senha, passwd, token, secret, authorization, apikey, api_key, credential,
refresh_token, access_token, private_key, certificate, hash, cookie, sessionid, cpf
```

Substituição por `[REDACTED]`. Payload acima de 8 KB é truncado com `[TRUNCATED]` em vez de rejeitado: perder o fim de um payload enorme é preferível a perder o registro.

## Explorer

Filtros: período (`from`/`to` obrigatórios, janela máxima de 366 dias), ator, ação, entidade, `entityId`, `eventName`, categoria, severidade, pleito, zona, correlation ID e busca textual. Paginação limitada a 100 por página.

`GET /audit/explorer` devolve ainda facets por ação, categoria, severidade e ator, sempre recalculadas sobre o conjunto visível.

A busca cobre colunas textuais (`eventName`, `entityType`, `entityId`, categoria, correlation ID e nome/e-mail do ator). Metadados JSON são retornados e sanitizados, mas não são pesquisáveis — o Prisma não faz busca textual em coluna `Json`.

## RBAC do Explorer

A auditoria não é atalho para descobrir domínio alheio. Cada categoria exige a permissão de leitura do domínio correspondente (`incident` → `incidents.read`, `asset` → `inventory.read`, `resource_request` → `resource-requests.read`, etc.), e **categoria sem mapeamento é negada por padrão**.

Regras:

```text
linhas de categoria sem permissão são removidas do resultado
contagens de summary e facets são recalculadas sobre o conjunto visível
restrictedCategories declara QUAIS categorias foram removidas, sem revelar quantas linhas foram omitidas
GET /audit/entities/:entityType/:entityId devolve 403 — não lista vazia — quando a categoria é restrita
```

## Before / After

`GET /audit/:id/diff` devolve `{ changed: [{ field, before, after }], unchanged, truncated }`, calculado no servidor sobre a união das chaves de `oldData` e `newData`, sanitizado antes de sair e limitado a 200 entradas.

## Rotas

```text
/audit
/audit/:id
/audit/entities/:type/:id
/audit/correlation/:id
```

## Endpoints

Todos exigem `audit.read`; o controle adicional é o mapa de categorias.

```text
GET /audit
GET /audit/summary
GET /audit/explorer
GET /audit/categories
GET /audit/actors
GET /audit/entities/:entityType/:entityId
GET /audit/correlation/:correlationId
GET /audit/:id
GET /audit/:id/diff
```

`GET /audit/correlation/:correlationId` devolve a cadeia completa: registros de auditoria daquele identificador e as notificações relacionadas (leitura somente-leitura da tabela de notificações), ambas filtradas pelo mesmo mapa de permissões.

## Limites conhecidos

- `from`/`to` são obrigatórios: consultar auditoria sem período não é uma leitura válida do domínio e devolve `400`.
- A busca textual não alcança metadados JSON.
- O correlation ID atravessa apenas o processo que o originou; cadeias distribuídas entre processos exigiriam propagação explícita no transporte, o que está fora do escopo desta fase.
