import { formatDateTime } from "@eops/shared/format";
import { COMMUNICATION_EVENT_LABELS } from "@eops/shared/communications";
import styles from "../styles/communications.module.css";

export interface TimelineEvent {
  id: string;
  type: string;
  message: string;
  actorName: string | null;
  createdAt: string;
}

const EVENT_TONES: Record<string, string> = {
  CREATED: "neutral",
  UPDATED: "info",
  SCHEDULED: "info",
  PUBLISHED: "success",
  DISPATCHED: "info",
  RECIPIENTS_SYNCED: "neutral",
  VIEWED: "info",
  CONFIRMED: "success",
  EXPIRED: "warning",
  ARCHIVED: "neutral",
  CANCELLED: "danger",
};

/**
 * Timeline do ciclo de vida e do acompanhamento de leitura.
 *
 * Lê, confirma e envia são registrados individualmente, permitindo reconstruir
 * quem interagiu com o comunicado e quando.
 */
export function CommunicationTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className={styles.mutedText}>Nenhum evento registrado ainda.</p>;
  }
  return (
    <ol className={styles.timeline}>
      {events.map((event) => (
        <li key={event.id} className={styles[EVENT_TONES[event.type] ?? "neutral"]}>
          <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
          <div>
            <strong>{COMMUNICATION_EVENT_LABELS[event.type] ?? event.type}</strong>
            <p>{event.message}</p>
            {event.actorName && <small>por {event.actorName}</small>}
          </div>
        </li>
      ))}
    </ol>
  );
}
