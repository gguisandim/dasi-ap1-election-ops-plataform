import { Breadcrumb, Card, ErrorState, LinkButton, Loading, useAsync } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import { useParams } from "react-router-dom";
import { PostmortemStatusPill } from "../components/PostmortemBadges";
import { postmortemsService } from "../services/postmortemsService";
import styles from "../styles/postmortems.module.css";

/**
 * Visão dedicada da timeline analítica: leitura cronológica com marcação de
 * origem e distinção entre entradas importadas e manuais.
 */
export function PostmortemTimelinePage() {
  const { id = "" } = useParams<{ id: string }>();
  const detail = useAsync(() => postmortemsService.detail(id), [id]);

  if (detail.loading) return <Loading label="Carregando timeline…" />;
  if (detail.error) return <ErrorState error={detail.error} onRetry={detail.reload} />;
  if (!detail.data) return null;

  const record = detail.data;
  const imported = record.timeline.filter((item) => item.imported).length;

  return (
    <section className={styles.page}>
      <Breadcrumb
        items={[
          { label: "Postmortem", to: "/postmortems/dashboard" },
          { label: record.code, to: `/postmortems/${record.id}` },
          { label: "Timeline" },
        ]}
      />
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{record.code}</span>
          <h1>Timeline operacional</h1>
          <p>
            {record.timeline.length} entrada(s) · {imported} importada(s) das
            origens operacionais
          </p>
          <div className={styles.headerActions} style={{ marginTop: 8 }}>
            <PostmortemStatusPill status={record.status} />
          </div>
        </div>
        <div className={styles.headerActions}>
          <LinkButton secondary to={`/postmortems/${record.id}`}>
            Abrir análise
          </LinkButton>
        </div>
      </header>

      <Card>
        {record.timeline.length === 0 ? (
          <p className={styles.muted}>
            Nenhuma entrada registrada. Use a ação de importação na análise para
            trazer os marcos do incidente, das passagens de turno e das
            solicitações de recurso.
          </p>
        ) : (
          <ul className={styles.timeline}>
            {record.timeline.map((item) => (
              <li key={item.id}>
                <time>{formatDateTime(item.occurredAt)}</time>
                <div>
                  <strong>{item.title}</strong>
                  {item.description && <p>{item.description}</p>}
                  <div className={styles.timelineTags}>
                    <span
                      className={`${styles.tag} ${
                        item.imported ? styles.tagImported : styles.tagManual
                      }`}
                    >
                      {item.imported ? "importada" : "manual"}
                    </span>
                    <span className={styles.tag}>{item.sourceType}</span>
                    {item.createdBy && (
                      <span className={styles.tag}>{item.createdBy.name}</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
