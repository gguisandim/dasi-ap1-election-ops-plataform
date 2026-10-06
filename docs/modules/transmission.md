# Monitor de Transmissão e NOC 2.0

Plugin `@eops/plugin-transmission`, em `plugins/monitoring/transmission`, categoria `monitoring`, rota `/transmission`.

Documentação descritiva. A fonte normativa é `SPEC/2026-10-06-platform-depth-integration.md` (Parte 3).

## Papel

Monitoramento da malha de transmissão: como está cada ponto agora, o que aconteceu com ele ao longo do tempo e qual foi o desempenho medido. É dono de pontos de transmissão, circuitos, provedores, histórico de estado, failover, tentativas, alertas e SLA de transmissão.

## Modelo de conectividade

`TransmissionPoint` é o local monitorado. `TransmissionCircuit` é o enlace: código, tecnologia (rótulo livre), banda, provedor e `isPrimary`. Regra: no máximo **um circuito primário ativo** por ponto; criar um segundo devolve `409`.

`TransmissionProvider` existe como catálogo separado (código, contato, alvo de uptime), porque o desempenho varia por provedor, não por ponto — e o mesmo provedor atende vários pontos.

## Histórico de estado

`TransmissionStateTransition` registra cada mudança de conectividade do ponto ou do circuito. Ao registrar uma transição, o servidor fecha o intervalo anterior do mesmo escopo calculando `durationSeconds`, que é o que permite calcular uptime sem varrer logs de evento.

Regras: `from = to` é recusado com `409` (não há histórico de não-mudança); duração é sempre calculada no servidor, nunca aceita do cliente.

Estados: `ONLINE`, `DEGRADED`, `OFFLINE`, `UNKNOWN`. `UNKNOWN` significa ausência de leitura recente, é **excluído do uptime** e reportado separadamente como `unknownMinutes` — nunca contabilizado como queda nem como disponibilidade.

## SLA

Funções puras em `packages/shared/src/transmission.ts`:

```text
observedMinutes  = janela − unknownMinutes
uptimePercent    = 100 × onlineMs / observedMs
downtimeMinutes  = Σ intervalos OFFLINE
degradedMinutes  = Σ intervalos DEGRADED
unknownMinutes   = Σ intervalos UNKNOWN
recoverySeconds  = média da duração de intervalos OFFLINE até o primeiro não-OFFLINE
deadlineRiskPercent   = 100 × pontos com deadline vencido e status ≠ SUCCESS / pontos com deadline
providerPerformance   = uptime ponderado por minutos observados, contagem de incidentes e failovers
```

Percentuais retornam `null` quando a janela observada é zero. Medidas em minutos retornam `0` para janela vazia, porque zero minuto de queda é uma medida real; a ausência de base fica registrada em `unknownMinutes`.

## Failover

`TransmissionFailover` liga circuito de origem, circuito de destino e motivo. Regras: destino precisa pertencer ao ponto, estar ativo e ser diferente da origem; no máximo um failover `ACTIVE` por ponto; recuperar ou cancelar exige um failover `ACTIVE`. O failover registra transição do ponto para o estado do destino e não altera o circuito de origem além do que a mudança de status implica.

## Correlação

`GET /transmission/correlation` devolve, **sempre derivado e nunca persistido**: incidentes do mesmo local/zona na janela, solicitações de recurso, postmortems cujo incidente primário ou timeline referencia o incidente correlacionado, passagens de turno do local e uma referência ao feed do Command Center.

Nenhuma escrita em `Incident`, `ResourceRequest`, `Postmortem`, `ShiftHandover` ou no Command Center. Quando o ator não possui a permissão de leitura de um domínio correlacionado, aquela seção retorna `available: false` **sem expor contagem**.

## Rotas

```text
/transmission
/transmission/noc
/transmission/analytics
/transmission/providers
/transmission/new
/transmission/:id
```

## Endpoints

Leitura com `transmission.read`; mutações com `transmission.manage`.

```text
GET    /transmission
GET    /transmission/dashboard
GET    /transmission/queue
GET    /transmission/noc
GET    /transmission/alerts
GET    /transmission/sla
GET    /transmission/analytics
GET    /transmission/providers
GET    /transmission/correlation
GET    /transmission/:id
GET    /transmission/:id/state-history
GET    /transmission/:id/connectivity-history
GET    /transmission/:id/sla
GET    /transmission/:id/circuits
GET    /transmission/:id/failovers
POST   /transmission
PATCH  /transmission/:id
PATCH  /transmission/:id/connectivity
POST   /transmission/:id/recovery
POST   /transmission/:id/attempts
POST   /transmission/:id/retry
POST   /transmission/retry
PATCH  /transmission/alerts/:id
POST   /transmission/providers
PATCH  /transmission/providers/:id
POST   /transmission/:id/circuits
PATCH  /transmission/circuits/:circuitId
POST   /transmission/:id/failover
POST   /transmission/:id/failover/:failoverId/recover
POST   /transmission/:id/failover/:failoverId/cancel
```

## Eventos

`transmission.connectivity_changed`, `transmission.failed`, `transmission.alert_created`, `transmission.state_transition`, `transmission.circuit_created`, `transmission.circuit_status_changed`, `transmission.failover_started`, `transmission.failover_recovered`, `transmission.provider_updated`.

Failover iniciado e recuperado geram notificação direcionada a quem possui `transmission.read`. Nenhum evento é emitido para polling, filtro ou abertura de página.

## Limites conhecidos

- `UNKNOWN` degrada a confiança do SLA: uma janela com muito tempo sem leitura tem base observada pequena, e o percentual passa a refletir apenas o que foi observado.
- A janela default de SLA e analytics é de 7 dias quando `from`/`to` não são informados; janela inválida devolve `400`.
- Não há sonda de rede real nem integração com topologia externa: o domínio registra o que a operação reporta.
