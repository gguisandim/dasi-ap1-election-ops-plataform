import { Link } from "react-router-dom";
import { formatDateTime } from "@eops/shared/format";
import type { CommunicationSummary } from "@eops/shared/communications";
import { PriorityBadge, StatusBadge } from "./CommunicationBadges";
import { MetricBar } from "./MetricBar";
import styles from "../styles/communications.module.css";
import { describeExpiration } from "../utils/presentation";

/**
 * Cartão de comunicado usado no painel e nos destaques.
 * Prioridades HIGH/CRITICAL recebem faixa lateral de alerta.
 */
export function CommunicationCard({ communication }: { communication: CommunicationSummary }) {
  const expiration = describeExpiration(communication.expiresAt);
  return (
    <article
      className={`${styles.communicationCard} ${communication.urgent ? styles.communicationCardUrgent : ""}`}
    >
      <header>
        <Link to={`/communications/messages/${communication.id}`}>{communication.code}</Link>
        <div className={styles.badges}>
          <PriorityBadge priority={communication.priority} />
          <StatusBadge status={communication.status} />
        </div>
      </header>
      <h3>
        <Link to={`/communications/messages/${communication.id}`}>{communication.title}</Link>
      </h3>
      <p className={styles.clamp}>{communication.content}</p>
      <footer>
        <span>{communication.category?.name ?? "Sem categoria"}</span>
        <span>{communication.authorName}</span>
        <span>{formatDateTime(communication.publishedAt ?? communication.createdAt)}</span>
      </footer>
      {communication.metrics && <MetricBar metrics={communication.metrics} />}
      {expiration && (
        <small className={communication.expired ? styles.dangerText : styles.mutedText}>
          {expiration}
        </small>
      )}
    </article>
  );
}
