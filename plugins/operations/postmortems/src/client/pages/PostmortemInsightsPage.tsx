import { Card, ErrorState, LinkButton, Loading, useAsync } from "@eops/ui";
import {
  POSTMORTEM_CAUSE_CATEGORY_LABELS,
  POSTMORTEM_CAUSE_TYPE_LABELS,
  POSTMORTEM_LESSON_TYPE_LABELS,
  type PostmortemCauseCategory,
  type PostmortemCauseType,
  type PostmortemLessonType,
} from "@eops/shared/postmortems";
import { postmortemsService } from "../services/postmortemsService";
import styles from "../styles/postmortems.module.css";

function BarList({
  rows,
  emptyLabel,
}: {
  rows: Array<{ label: string; count: number }>;
  emptyLabel: string;
}) {
  const max = rows.reduce((value, row) => Math.max(value, row.count), 0);
  if (rows.length === 0) return <p className={styles.muted}>{emptyLabel}</p>;
  return (
    <div style={{ marginTop: 12 }}>
      {rows.map((row) => (
        <div key={row.label} className={styles.bar}>
          <span>{row.label}</span>
          <div className={styles.barTrack}>
            <span style={{ width: `${max ? (row.count / max) * 100 : 0}%` }} />
          </div>
          <strong>{row.count}</strong>
        </div>
      ))}
    </div>
  );
}

export function PostmortemInsightsPage() {
  const { data, error, loading, reload } = useAsync(
    postmortemsService.insights,
    [],
  );

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>ANÁLISE DE CAUSAS</span>
          <h1>Insights de RCA</h1>
          <p>
            Causas recorrentes, categorias, lições e ações corretivas. Não
            substitui os relatórios consolidados da plataforma.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton secondary to="/postmortems/dashboard">
            Painel
          </LinkButton>
          <LinkButton secondary to="/postmortems">
            Todas as análises
          </LinkButton>
        </div>
      </header>

      {loading && <Loading label="Agregando causas e lições…" />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data && (
        <>
          <div className={styles.metrics}>
            <Card className={styles.metric}>
              <span>Análises consideradas</span>
              <strong>{data.sampleSize}</strong>
            </Card>
            <Card className={styles.metric}>
              <span>Publicadas</span>
              <strong>{data.publishedCount}</strong>
            </Card>
            <Card className={styles.metric}>
              <span>Tempo médio até publicação</span>
              <strong>
                {data.averageTimeToPublishHours === null
                  ? "—"
                  : `${data.averageTimeToPublishHours}h`}
              </strong>
            </Card>
            <Card className={`${styles.metric} ${styles.metricWarning}`}>
              <span>Ações abertas</span>
              <strong>{data.actionItems.open}</strong>
            </Card>
            <Card className={`${styles.metric} ${styles.metricCritical}`}>
              <span>Ações vencidas</span>
              <strong>{data.actionItems.overdue}</strong>
            </Card>
          </div>

          <div className={styles.layout}>
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Causas por categoria</h2>
              </div>
              <BarList
                rows={data.causesByCategory.map((row) => ({
                  label:
                    POSTMORTEM_CAUSE_CATEGORY_LABELS[
                      row.key as PostmortemCauseCategory
                    ] ?? row.key,
                  count: row.count,
                }))}
                emptyLabel="Nenhuma causa registrada."
              />
            </Card>
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Causas por tipo</h2>
              </div>
              <BarList
                rows={data.causesByType.map((row) => ({
                  label:
                    POSTMORTEM_CAUSE_TYPE_LABELS[row.key as PostmortemCauseType] ??
                    row.key,
                  count: row.count,
                }))}
                emptyLabel="Nenhuma causa registrada."
              />
            </Card>
          </div>

          <div className={styles.stack} style={{ marginTop: 16 }}>
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Causas recorrentes</h2>
                <span className={styles.muted}>
                  Aparecem em duas ou mais análises
                </span>
              </div>
              {data.recurringCauses.length === 0 ? (
                <p className={styles.muted}>
                  Nenhuma causa se repete entre análises distintas.
                </p>
              ) : (
                <div className={styles.tableWrap} style={{ marginTop: 12 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Categoria</th>
                        <th>Tipo</th>
                        <th className={styles.numeric}>Análises</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recurringCauses.map((row) => (
                        <tr key={`${row.category}-${row.type}`}>
                          <td>
                            {POSTMORTEM_CAUSE_CATEGORY_LABELS[row.category] ??
                              row.category}
                          </td>
                          <td>
                            {POSTMORTEM_CAUSE_TYPE_LABELS[row.type] ?? row.type}
                          </td>
                          <td className={styles.numeric}>{row.postmortemCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <div className={styles.layout}>
              <Card>
                <div className={styles.sectionTitle}>
                  <h2>Lições por tipo</h2>
                </div>
                <BarList
                  rows={data.lessonsByType.map((row) => ({
                    label:
                      POSTMORTEM_LESSON_TYPE_LABELS[
                        row.key as PostmortemLessonType
                      ] ?? row.key,
                    count: row.count,
                  }))}
                  emptyLabel="Nenhuma lição registrada."
                />
              </Card>
              <Card>
                <div className={styles.sectionTitle}>
                  <h2>Lições por categoria</h2>
                </div>
                <BarList
                  rows={data.lessonsByCategory
                    .filter((row) => row.key !== null)
                    .map((row) => ({
                      label:
                        POSTMORTEM_CAUSE_CATEGORY_LABELS[
                          row.key as PostmortemCauseCategory
                        ] ?? String(row.key),
                      count: row.count,
                    }))}
                  emptyLabel="Nenhuma lição classificada."
                />
              </Card>
            </div>

            <Card>
              <div className={styles.sectionTitle}>
                <h2>Incidentes por severidade</h2>
              </div>
              <BarList
                rows={data.incidentsBySeverity.map((row) => ({
                  label: row.key,
                  count: row.count,
                }))}
                emptyLabel="Nenhuma análise registrada."
              />
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
