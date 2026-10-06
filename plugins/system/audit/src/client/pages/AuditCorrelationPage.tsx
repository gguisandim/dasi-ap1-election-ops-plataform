import { Breadcrumb, Card, EmptyState, ErrorState, Loading, useAsync } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import { Link, useParams } from "react-router-dom";
import { RestrictedNotice, SeverityBadge } from "../components";
import { auditService } from "../services/auditService";
import styles from "../styles/audit.module.css";

export function AuditCorrelationPage() {
  const { id = "" } = useParams();
  const { data, loading, error, reload } = useAsync(() => auditService.correlation(id), [id]);
  if (loading) return <Loading label="Reconstruindo cadeia de correlação…" />;
  if (error || !data) return <><Breadcrumb items={[{ label: "Auditoria", to: "/audit" }, { label: id }]} /><ErrorState error={error ?? new Error("Cadeia não encontrada.")} onRetry={reload} /></>;
  return <section className={styles.page}>
    <Breadcrumb items={[{ label: "Auditoria", to: "/audit" }, { label: "Correlação" }]} />
    <header><span>CADEIA DE CORRELAÇÃO</span><h1><code>{data.correlationId}</code></h1><p>{data.events.length} evento(s) de auditoria · {data.notifications.length} notificação(ões)</p></header>
    <RestrictedNotice categories={data.restrictedCategories} />
    <div className={styles.correlationGrid}>
      <Card><h2>Eventos de auditoria</h2>
        {data.events.length === 0
          ? <EmptyState title="Sem eventos" description="Nenhum evento de auditoria nesta cadeia." />
          : <ol className={styles.timeline}>{data.events.map((event) => <li key={event.id}>
              <div className={styles.timelineMarker} aria-hidden="true" />
              <div className={styles.timelineBody}>
                <div className={styles.timelineHead}><span className={styles.actionBadge}>{event.action}</span><SeverityBadge severity={event.severity} /><time>{formatDateTime(event.createdAt)}</time></div>
                <strong><code>{event.eventName ?? "—"}</code></strong>
                <span>{event.actor?.name ?? "Sistema"} · {event.entityType}</span>
                <Link to={`/audit/${event.id}`}>Ver evento</Link>
              </div>
            </li>)}
          </ol>}
      </Card>
      <Card><h2>Notificações relacionadas</h2>
        {data.notifications.length === 0
          ? <EmptyState title="Sem notificações" description="Nenhuma notificação compartilha este correlation ID." />
          : <ul className={styles.notifications}>{data.notifications.map((notification) => <li key={notification.id}>
              <div className={styles.timelineHead}><strong>{notification.title}</strong><time>{formatDateTime(notification.createdAt)}</time></div>
              <p>{notification.message}</p>
              <small><code>{notification.eventName ?? "—"}</code>{notification.entityId ? ` · ${notification.entityId}` : ""}</small>
            </li>)}
          </ul>}
      </Card>
    </div>
  </section>;
}
