import { Card, ErrorState, LinkButton, Loading, useAsync } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import { Link } from "react-router-dom";
import { SeverityBadge } from "../components/PostmortemBadges";
import { postmortemsService } from "../services/postmortemsService";
import styles from "../styles/postmortems.module.css";

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "critical" | "warning" | "success";
}) {
  const className =
    tone === "critical"
      ? styles.metricCritical
      : tone === "warning"
        ? styles.metricWarning
        : tone === "success"
          ? styles.metricSuccess
          : "";
  return (
    <Card className={`${styles.metric} ${className}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </Card>
  );
}

export function PostmortemDashboardPage() {
  const { data, error, loading, reload } = useAsync(
    postmortemsService.dashboard,
    [],
  );

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>ANÁLISE PÓS-INCIDENTE</span>
          <h1>Postmortem e RCA</h1>
          <p>
            Registro estruturado do que aconteceu, por que aconteceu e o que
            precisa mudar.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton secondary to="/postmortems">
            Todas as análises
          </LinkButton>
          <LinkButton secondary to="/postmortems/insights">
            Insights
          </LinkButton>
          <LinkButton to="/postmortems/new">Nova análise</LinkButton>
        </div>
      </header>

      {loading && <Loading label="Consolidando análises…" />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data && (
        <>
          <div className={styles.metrics}>
            <Metric label="Rascunhos" value={data.counters.draft} />
            <Metric
              label="Em revisão"
              value={data.counters.inReview}
              tone="warning"
            />
            <Metric
              label="Mudanças solicitadas"
              value={data.counters.changesRequested}
              tone="warning"
            />
            <Metric
              label="Aprovados"
              value={data.counters.approved}
              tone="success"
            />
            <Metric
              label="Publicados"
              value={data.counters.published}
              tone="success"
            />
            <Metric
              label="Ações vencidas"
              value={data.counters.overdueActionItems}
              tone="critical"
            />
            <Metric
              label="Incidentes High/Critical sem postmortem"
              value={data.criticalIncidentsWithoutPostmortem}
              tone="critical"
            />
          </div>

          <div className={styles.stack}>
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Publicados recentemente</h2>
                <Link to="/postmortems">Ver todos</Link>
              </div>
              {data.recentPublished.length === 0 ? (
                <p className={styles.muted}>
                  Nenhuma análise publicada ainda.
                </p>
              ) : (
                <div className={styles.tableWrap} style={{ marginTop: 12 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Título</th>
                        <th>Incidente</th>
                        <th>Severidade</th>
                        <th>Publicado em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentPublished.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <Link to={`/postmortems/${item.id}`}>{item.code}</Link>
                          </td>
                          <td>{item.title}</td>
                          <td>{item.primaryIncident.code}</td>
                          <td>
                            <SeverityBadge
                              severity={item.primaryIncident.severity}
                            />
                          </td>
                          <td>
                            {item.publishedAt
                              ? formatDateTime(item.publishedAt)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <p className={styles.muted}>
              Gerado em {formatDateTime(data.generatedAt)}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
