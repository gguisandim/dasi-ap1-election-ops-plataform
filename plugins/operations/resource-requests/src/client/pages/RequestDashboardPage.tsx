import { Card, ErrorState, LinkButton, Loading, useAsync } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import {
  RESOURCE_REQUEST_ITEM_KIND_LABELS,
  RESOURCE_REQUEST_PRIORITY_LABELS,
  type ResourceRequestItemKind,
  type ResourceRequestPriority,
} from "@eops/shared/resource-requests";
import { resourceRequestsService } from "../services/resourceRequestsService";
import styles from "../styles/resource-requests.module.css";

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "critical" | "warning";
}) {
  return (
    <Card
      className={`${styles.metric} ${
        tone === "critical"
          ? styles.metricCritical
          : tone === "warning"
            ? styles.metricWarning
            : ""
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </Card>
  );
}

export function RequestDashboardPage() {
  const { data, error, loading, reload } = useAsync(
    resourceRequestsService.dashboard,
    [],
  );

  const maxZone = data?.byZone[0]?.count ?? 0;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>OPERAÇÕES</span>
          <h1>Solicitações de recurso</h1>
          <p>
            Pedidos operacionais de equipamento, equipe, veículo, transporte,
            apoio técnico e material.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton secondary to="/resource-requests/queue">
            Fila operacional
          </LinkButton>
          <LinkButton secondary to="/resource-requests/list">
            Todas as solicitações
          </LinkButton>
          <LinkButton to="/resource-requests/new">Nova solicitação</LinkButton>
        </div>
      </header>

      {loading && <Loading label="Consolidando solicitações…" />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data && (
        <>
          <div className={styles.metrics}>
            <Metric label="Rascunhos" value={data.counters.draft} />
            <Metric
              label="Aguardando triagem"
              value={data.counters.awaitingTriage}
              tone="warning"
            />
            <Metric
              label="Aguardando aprovação"
              value={data.counters.awaitingApproval}
              tone="warning"
            />
            <Metric label="Aprovadas" value={data.counters.approved} />
            <Metric
              label="Parcialmente atendidas"
              value={data.counters.partiallyFulfilled}
            />
            <Metric label="Atendidas hoje" value={data.counters.fulfilledToday} />
            <Metric
              label="Vencidas"
              value={data.counters.overdue}
              tone="critical"
            />
            <Metric
              label="Críticas"
              value={data.counters.critical}
              tone="critical"
            />
          </div>

          <div className={styles.breakdowns}>
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Por prioridade</h2>
              </div>
              <ul className={styles.breakdownList}>
                {data.byPriority.map((row) => (
                  <li key={row.priority}>
                    <span>
                      {
                        RESOURCE_REQUEST_PRIORITY_LABELS[
                          row.priority as ResourceRequestPriority
                        ]
                      }
                    </span>
                    <strong>{row.count}</strong>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Por tipo de item</h2>
              </div>
              <ul className={styles.breakdownList}>
                {data.byItemKind.map((row) => (
                  <li key={row.kind}>
                    <span>
                      {
                        RESOURCE_REQUEST_ITEM_KIND_LABELS[
                          row.kind as ResourceRequestItemKind
                        ]
                      }
                    </span>
                    <strong>{row.count}</strong>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Por zona</h2>
              </div>
              {data.byZone.length === 0 ? (
                <p className={styles.muted}>Nenhuma solicitação com zona definida.</p>
              ) : (
                <ul className={styles.breakdownList}>
                  {data.byZone.slice(0, 10).map((row) => (
                    <li key={row.zoneId}>
                      <span>{row.zoneName}</span>
                      <div className={styles.bar}>
                        <span
                          style={{
                            width: `${maxZone ? (row.count / maxZone) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <strong>{row.count}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Por responsável</h2>
              </div>
              <ul className={styles.breakdownList}>
                {data.byOwner.slice(0, 10).map((row) => (
                  <li key={row.ownerId ?? "unassigned"}>
                    <span>{row.ownerName}</span>
                    <strong>{row.count}</strong>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <p className={styles.muted} style={{ marginTop: 12 }}>
            Gerado em {formatDateTime(data.generatedAt)}
          </p>
        </>
      )}
    </section>
  );
}
