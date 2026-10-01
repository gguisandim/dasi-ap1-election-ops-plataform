import { EmptyState } from "@eops/ui";
import { formatDateTime, type IncidentEventSummary } from "@eops/shared";
import styles from "../styles/incidents.module.css";

export function IncidentTimeline({ events = [] }: { events?: IncidentEventSummary[] }) {
  if (!events.length) return <EmptyState title="Timeline vazia" description="Ainda não há eventos registrados." />;
  return (
    <ol className={styles.timeline}>
      {events.map((event) => (
        <li key={event.id}>
          <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
          <div><strong>{event.type.replaceAll("_", " ")}</strong><p>{event.message}</p></div>
        </li>
      ))}
    </ol>
  );
}
