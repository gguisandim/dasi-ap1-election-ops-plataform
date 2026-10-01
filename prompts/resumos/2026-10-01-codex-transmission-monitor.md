# Monitor de Transmissão — 2026-10-01

## Prompt resumido

Implementar o plugin persistente de Monitor de Transmissão para acompanhar pontos por pleito, zona e local, fila, tentativas, conectividade, alertas, timeline, dashboard e filtros, respeitando isolamento, RBAC e Event Bus.

## Implementado

- Pontos de transmissão associados a pleito, zona e local eleitoral.
- Status `WAITING`, `QUEUED`, `TRANSMITTING`, `SUCCESS`, `FAILED`, `RETRYING` e `OFFLINE`.
- Fila persistente por prioridade e horário de entrada, com tentativas, último erro e limite operacional.
- Registro de tentativas com início, fim, resultado, duração calculada, erro e número sequencial.
- Conectividade `ONLINE`, `DEGRADED`, `OFFLINE` e `UNKNOWN`, com latência, última verificação e método.
- Alertas deduplicados para falha repetida, ponto offline, atraso, excesso de tentativas e proximidade do limite.
- Resolução automática de alertas transitórios após recuperação.
- Timeline persistente de fila, início, falha, retry, sucesso, conectividade e alertas.
- Dashboard com esperados, concluídos, pendentes, falhas, em transmissão, percentual, zonas completas e zonas com falha.
- Filtros por pleito, zona, local e status.
- Páginas de dashboard, cadastro e detalhe operacional.
- Eventos de conclusão, falha, mudança de conectividade e criação de alerta integrados a auditoria e notificações.

## Arquivos principais alterados

- `plugins/monitoring/transmission/`: frontend, backend, DTOs, service, controller, módulo, tipos, estilos e testes.
- `packages/database/prisma/schema.prisma`.
- `packages/database/prisma/migrations/202610010002_transmission_monitor/migration.sql`.
- `packages/security/src/permissions.ts`.
- `packages/event-bus/src/contracts.ts`.
- `packages/database/prisma/seed.ts`.
- `apps/api/src/app.module.ts`.
- Consumidores de auditoria e notificações.

## Banco

Enums adicionados:

- `TransmissionStatus`.
- `ConnectivityStatus`.
- `TransmissionAttemptResult`.
- `TransmissionEventType`.
- `TransmissionAlertType`.
- `TransmissionAlertStatus`.

Models adicionados:

- `TransmissionPoint`.
- `TransmissionAttempt`.
- `TransmissionTimelineEvent`.
- `TransmissionAlert`.

Migration aditiva `202610010002_transmission_monitor` criada e aplicada sem perda de dados.

## Integrações globais

- AppModule: `TransmissionModule` registrado.
- pluginRegistry: o plugin já estava registrado; manifest e rotas internas foram ampliados.
- Event Bus: `transmission.completed`, `transmission.failed`, `transmission.connectivity_changed` e `transmission.alert_created`.
- Segurança: `transmission.read` e `transmission.manage` adicionadas.
- Shared contracts: nenhuma alteração necessária.
- Seed: novas permissões sincronizadas; perfis operacionais e técnicos atualizados.

## Testes e validação

- `npm run db:generate`: passou.
- `npm run db:validate`: passou.
- `npm run check:boundaries`: passou.
- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm test`: passou, 11 arquivos e 24 testes.
- `npm run build`: passou; permaneceu apenas o alerta do Vite sobre chunk acima de 500 kB.
- `npm run db:migrate:deploy`: passou e aplicou a migration.
- `npm run db:seed`: passou.
- Teste funcional autenticado: passou; ponto terminou em `SUCCESS`, com 3 tentativas, 11 eventos de timeline e alertas de limite próximo, offline e falha repetida gerados durante o fluxo.

## Pendências

- Não há monitoramento externo de rede; conectividade, latência e método são dados operacionais registrados pela plataforma, conforme permitido.

## IA utilizada

Codex, agente principal baseado em GPT-5.

## Tokens

Tokens: indisponível
