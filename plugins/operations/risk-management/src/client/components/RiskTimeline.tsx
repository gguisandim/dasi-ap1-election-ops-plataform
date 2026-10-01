import { formatDateTime } from "@eops/shared/format";
import { RISK_EVENT_LABELS } from "@eops/shared/risks";
import styles from "../styles/risk.module.css";

export interface RiskTimelineEvent {
  id: string;
  type: string;
  message: string;
  actorName: string | null;
  createdAt: string;
}

const EVENT_TONES: Record<string, string> = {
  CREATED: "neutral",
  ASSESSED: "info",
  SCORE_CHANGED: "warning",
  OWNER_CHANGED: "info",
  STATUS_CHANGED: "info",
  MITIGATION_ADDED: "info",
  MITIGATION_UPDATED: "neutral",
  MITIGATION_COMPLETED: "success",
  MATERIALIZED: "danger",
  CLOSED: "success",
  REOPENED: "warning",
  NOTE_ADDED: "neutral",
};

/**
 * Histórico do risco.
 *
 * É o que permite responder por que um risco subiu de faixa: cada mudança de score
 * registra o valor anterior, o novo e a faixa resultante.
 */
export function RiskTimeline({ events }: { events: RiskTimelineEvent[] }) {
  if (events.length === 0) {
    return <p className={styles.mutedText}>Nenhum evento registrado ainda.</p>;
  }
  return (
    <ol className={styles.timeline}>
      {events.map((event) => (
        <li key={event.id} className={styles[EVENT_TONES[event.type] ?? "neutral"]}>
          <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
          <div>
            <strong>{RISK_EVENT_LABELS[event.type] ?? event.type}</strong>
            <p>{event.message}</p>
            {event.actorName && <small>por {event.actorName}</small>}
          </div>
        </li>
      ))}
    </ol>
  );
}
