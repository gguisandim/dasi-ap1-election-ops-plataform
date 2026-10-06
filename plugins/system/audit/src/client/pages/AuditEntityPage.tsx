import { Breadcrumb, EmptyState, ErrorState, Loading, useAsync } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import { Link, useParams } from "react-router-dom";
import { RestrictedNotice, SeverityBadge } from "../components";
import { auditService } from "../services/auditService";
import styles from "../styles/audit.module.css";

export function AuditEntityPage() {
  const { type = "", id = "" } = useParams();
  const { data, loading, error, reload } = useAsync(() => auditService.entityTimeline(type, id), [type, id]);
  if (loading) return <Loading label="Carregando timeline da entidade…" />;
  if (error || !data) return <><Breadcrumb items={[{ label: "Auditoria", to: "/audit" }, { label: `${type} · ${id}` }]} /><ErrorState error={error ?? new Error("Entidade não encontrada.")} onRetry={reload} /></>;
  return <section className={styles.page}>
    <Breadcrumb items={[{ label: "Auditoria", to: "/audit" }, { label: `${data.entityType} · ${data.entityId}` }]} />
    <header><span>TIMELINE DE ENTIDADE</span><h1>{data.entityType}</h1><p>{data.entityId} · {data.total} evento(s)</p></header>
    <RestrictedNotice categories={data.restrictedCategories} />
    {data.items.length === 0
      ? <EmptyState title="Sem eventos" description="Nenhum evento de auditoria registrado para esta entidade." />
      : <ol className={styles.timeline}>{data.items.map((event) => <li key={event.id}>
          <div className={styles.timelineMarker} aria-hidden="true" />
          <div className={styles.timelineBody}>
            <div className={styles.timelineHead}><span className={styles.actionBadge}>{event.action}</span><SeverityBadge severity={event.severity} /><time>{formatDateTime(event.createdAt)}</time></div>
            <strong><code>{event.eventName ?? "—"}</code></strong>
            <span>{event.actor?.name ?? "Sistema"} · {event.category ?? "sem categoria"}</span>
            <Link to={`/audit/${event.id}`}>Ver evento</Link>
          </div>
        </li>)}
      </ol>}
  </section>;
}
