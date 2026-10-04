# Auditoria

Plugin: `plugins/system/audit`

## Responsabilidade

Preservar uma trilha imutável das mutações observáveis da plataforma. O subscriber usa a assinatura global do `@eops/event-bus`, sem conhecer ou importar plugins produtores.

## Dados registrados

Cada evento contém, quando disponível, `eventName`, `occurredAt`, ator validado, entidade, ação inferida, `oldData`, `newData` e metadata relevante. Payloads são sanitizados recursivamente antes da persistência; chaves sensíveis, incluindo password, authorization, token, secret e apiKey, recebem valor redigido.

O subscriber não fabrica estado anterior. Eventos com `from` e `to` geram uma transição legível; os demais usam somente os dados efetivamente publicados.

## API e interface

- `GET /audit`: filtros, busca e paginação;
- `GET /audit/summary`: volume do período/hoje, ações, recursos e atores mais ativos;
- `GET /audit/:id`: detalhe estruturado com metadata e comparação antes/depois;
- `/audit` e `/audit/:id`: overview e detalhe operacional.

Não existem endpoints de alteração ou exclusão de `AuditEvent`.

## Limitação

O Event Bus permanece in-process. Não há garantia de entrega transacional equivalente a outbox ou broker durável.
