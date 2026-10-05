# Mapa Operacional

> Documento descritivo. A referência normativa é `SPEC/2026-10-05-operational-intelligence-improvements.md` (seção 4).

## 1. Objetivo

O módulo Mapa Operacional reúne em uma única visão geográfica as camadas operacionais do pleito. Ele não possui entidades de domínio próprias: agrega dados que pertencem a outros domínios (Polling Places, Incidents, Transmission, Inventory, Field Teams e Routes) em um contrato neutro de features.

O módulo não assume ownership de nenhum domínio. Toda leitura é feita pelo schema compartilhado, nunca por import de implementação de outro plugin.

## 2. Estrutura

O plugin tem duas metades explícitas:

- `src/client/**` — página `/map`, filtros, camadas, marcadores, painel de seleção, clustering e CSS Module próprio;
- `src/server/**` — agregador NestJS (`OperationalMapModule`, controller, service e DTOs) publicado em `@eops/plugin-operational-map/server` e registrado no composition root `apps/api`;
- `src/shared/types/**` — contrato `OperationalMapFeature` compartilhado entre as duas metades.

## 3. Endpoint

```http
GET /api/operational-map/features
```

Filtros: `electionId`, `zoneId`, `pollingPlaceId`, `types` (lista separada por vírgula), `status` e `severity`.

O endpoint exige `elections.read`. Uma camada solicitada em `types` para a qual o usuário não tem permissão é **silenciosamente omitida** — a API nunca devolve dado de domínio que o solicitante não pode ler. Um valor de `types` fora do conjunto conhecido é rejeitado com HTTP 400.

## 4. Contrato de feature

```ts
interface OperationalMapFeature {
  id: string;            // `${type}:${entityId}`
  type: "POLLING_PLACE" | "INCIDENT" | "TRANSMISSION" | "FIELD_TEAM" | "ROUTE" | "ASSET";
  latitude: number;
  longitude: number;
  title: string;
  subtitle?: string;
  status: string;
  severity?: string;
  entityId: string;
  updatedAt: string;
  metadata: Record<string, string | number | boolean | null>;
  deepLink?: string;
}
```

Nenhum objeto Prisma é exposto. Somente features com coordenadas válidas são emitidas.

## 5. Camadas e resolução de coordenadas

Coordenadas existem apenas em `PollingPlace.latitude/longitude` e `RouteStop.latitude/longitude`. As demais camadas resolvem a posição pelo local de votação relacionado. Features sem coordenada resolvível são omitidas — nunca posicionadas em valor fictício.

| Camada | Origem | Resolução da coordenada | Permissão |
| --- | --- | --- | --- |
| `POLLING_PLACE` | `PollingPlace` | próprias | `elections.read` |
| `INCIDENT` | `Incident` (`isSimulated = false`) | `pollingPlace` do incidente | `incidents.read` |
| `TRANSMISSION` | `TransmissionPoint` | `pollingPlace` do ponto | `transmission.read` |
| `ASSET` | `Asset` | `pollingPlace` do ativo | `inventory.read` |
| `FIELD_TEAM` | `FieldAllocation` ativa (equipe distinta) | `pollingPlace` da alocação | `field-teams.read` |
| `ROUTE` | `RouteStop` | coordenadas da parada, com o código da rota como título | `routes.read` |

## 6. Semântica de status e severidade

- `status` só é aplicado à camada quando o valor pertence ao domínio de status daquela camada (por exemplo `CRITICAL` filtra o `monitoringStatus` do local, mas não o status de um incidente).
- `severity` existe apenas em `INCIDENT` e filtra somente essa camada.

## 7. Clustering

`clusterFeatures(features, cellSize)` é uma função pura que agrupa por grade geográfica determinística e devolve centroide, contagem, tipos e identificadores. O cliente só renderiza clusters quando o total de features excede `CLUSTER_THRESHOLD = 60`; abaixo disso renderiza marcadores individuais com glifo, rótulo textual e forma por tipo.

## 8. Painel de seleção e deep links

Ao selecionar uma feature, um painel lateral apresenta tipo, nome/código, status, resumo, última atualização e um deep link para a rota existente do domínio:

```text
POLLING_PLACE → /polling-places/:id
INCIDENT      → /incidents/:id
TRANSMISSION  → /transmission/:id
FIELD_TEAM    → /field-teams/teams/:id
ROUTE         → /routes/:id
ASSET         → /inventory/:id
```

O status nunca é comunicado apenas por cor: cada marcador tem ícone, forma e rótulo textual, e o status aparece como `Badge` textual no popup e no painel.

## 9. Modo fullscreen

A página suporta modo operacional em tela cheia sobre o contêiner do próprio plugin, usando a Fullscreen API do navegador. Nenhuma alteração de shell é necessária.

## 10. Limitações

- Somente `PollingPlace` e `RouteStop` carregam coordenadas; toda outra camada depende do local de votação relacionado.
- A API lê o schema compartilhado em vez de chamar as APIs públicas de cada domínio, para evitar requisições múltiplas; o isolamento é garantido por leitura, nunca por import de implementação.
- Nenhuma permissão nova é criada; a autorização é validada no backend.
- O clustering é por grade determinística no cliente, sem dependência nova.
