# Notificações

Plugin: `plugins/system/notifications`

## Responsabilidade

Criar notificações persistentes a partir de eventos de domínio para destinatários elegíveis e oferecer leitura operacional por usuário.

## Política de audiência

A seleção combina usuário ativo, permissão RBAC correspondente ao domínio do evento e preferência diferente de desabilitada. Eventos de atribuição carregam `assignedToId`. A consulta usa relações públicas do banco e não importa implementação de outros plugins.

## Preferências

O catálogo configurável é definido em `@eops/event-bus` e retornado pela API. Ausência de registro explícito significa habilitado. A rota `/notifications/preferences` agrupa opções por domínio e salva somente preferências da própria conta.

## API e interface

- `GET /notifications`: paginação e filtros de leitura, tipo, evento e período;
- `GET /notifications/unread-count`: contador leve usado pelo sino;
- `PATCH /notifications/:id/read` e `/unread`: operação com ownership;
- `PATCH /notifications/read-all`: afeta apenas o usuário autenticado;
- `GET/PUT /notifications/preferences`: leitura e atualização próprias;
- `/notifications`: filtros Todos/Não lidos/Críticos e navegação segura para incidentes;
- `/notifications/preferences`: preferências persistentes por domínio.

O sino atualiza após operações locais e faz polling moderado a cada 60 segundos, com cleanup ao desmontar.
