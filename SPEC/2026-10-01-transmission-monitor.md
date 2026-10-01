# Monitor de Transmissão

> **Nota de rastreabilidade:** esta especificação foi reconstruída retrospectivamente em 2026-10-01 a partir do código, request logs e histórico disponível. Ela documenta o estado/intenção real, mas **não deve ser apresentada como prova de que antecedeu o código**. Para novas funcionalidades, a spec deve ser criada e commitada antes da implementação.

## O quê e por quê

Acompanhar operacionalmente pontos de transmissão por pleito/zona/local, fila, tentativas, conectividade, alertas, timeline e indicadores.

## Critérios de aceitação

- [x] Estados WAITING/QUEUED/TRANSMITTING/SUCCESS/FAILED/RETRYING/OFFLINE.
- [x] Tentativas persistidas com duração/resultado/erro.
- [x] Conectividade ONLINE/DEGRADED/OFFLINE/UNKNOWN.
- [x] Alertas operacionais deduplicados.
- [x] Timeline e dashboard por zona/local.
- [x] RBAC e eventos de integração.

## Fora do escopo

- Sonda de rede externa real.
- Integração com infraestrutura eleitoral externa.

## Evidências usadas na reconstrução

- `docs/request-log/2026-10-01-codex-transmission-monitor.md`

## Rastreabilidade Git

Associe esta spec aos **commits futuros** que ainda alterarem este domínio usando trailer `Spec:`. Os commits já existentes permanecem como estão; não reescreva o histórico para simular anterioridade.
