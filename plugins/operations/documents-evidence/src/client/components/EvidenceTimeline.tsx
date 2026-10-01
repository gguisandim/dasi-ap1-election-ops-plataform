import { formatDateTime } from "@eops/shared/format";
import { EVIDENCE_EVENT_LABELS } from "@eops/shared/evidence";
import styles from "../styles/evidence.module.css";

export interface EvidenceTimelineEvent {
  id: string;
  type: string;
  message: string;
  actorName: string | null;
  createdAt: string;
}

const EVENT_TONES: Record<string, string> = {
  CREATED: "neutral",
  UPLOADED: "success",
  VERSION_ADDED: "info",
  METADATA_UPDATED: "info",
  LINK_ADDED: "info",
  LINK_REMOVED: "warning",
  ARCHIVED: "warning",
  RESTORED: "success",
  DOWNLOADED: "neutral",
};

/**
 * Timeline da evidência.
 *
 * Os downloads também entram aqui: saber quem baixou cada arquivo e quando faz
 * parte da trilha de auditoria de uma evidência.
 */
export function EvidenceTimeline({ events }: { events: EvidenceTimelineEvent[] }) {
  if (events.length === 0) {
    return <p className={styles.mutedText}>Nenhum evento registrado ainda.</p>;
  }
  return (
    <ol className={styles.timeline}>
      {events.map((event) => (
        <li key={event.id} className={styles[EVENT_TONES[event.type] ?? "neutral"]}>
          <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
          <div>
            <strong>{EVIDENCE_EVENT_LABELS[event.type] ?? event.type}</strong>
            <p>{event.message}</p>
            {event.actorName && <small>por {event.actorName}</small>}
          </div>
        </li>
      ))}
    </ol>
  );
}
