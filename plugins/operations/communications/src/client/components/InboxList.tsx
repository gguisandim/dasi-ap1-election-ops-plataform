import { Link } from "react-router-dom";
import { formatDateTime } from "@eops/shared/format";
import type { CommunicationRecipientSummary } from "@eops/shared/communications";
import { Button } from "@eops/ui";
import { DeliveryBadge, PriorityBadge, StatusBadge } from "./CommunicationBadges";
import styles from "../styles/communications.module.css";

/**
 * Caixa de entrada do operador: comunicados publicados dirigidos a ele,
 * com ação direta de leitura e confirmação.
 */
export function InboxList({
  items,
  busyId,
  onMarkRead,
  onConfirm,
}: {
  items: CommunicationRecipientSummary[];
  busyId?: string;
  onMarkRead: (recipient: CommunicationRecipientSummary) => void;
  onConfirm: (recipient: CommunicationRecipientSummary) => void;
}) {
  return (
    <ul className={styles.inboxList}>
      {items.map((recipient) => {
        const communication = recipient.communication;
        const urgent = communication?.priority === "HIGH" || communication?.priority === "CRITICAL";
        return (
          <li
            key={recipient.id}
            className={`${styles.inboxItem} ${urgent ? styles.inboxItemUrgent : ""}`}
          >
            <header>
              <div>
                {communication ? (
                  <Link to={`/communications/messages/${communication.id}`}>
                    {communication.code}
                  </Link>
                ) : (
                  <span>{recipient.sourceLabel ?? "Comunicado"}</span>
                )}
                <strong>{communication?.title ?? "Comunicado"}</strong>
              </div>
              <div className={styles.badges}>
                {communication && <PriorityBadge priority={communication.priority} />}
                {communication && <StatusBadge status={communication.status} />}
                <DeliveryBadge status={recipient.deliveryStatus} />
              </div>
            </header>
            <p className={styles.mutedText}>
              Recebido em {formatDateTime(communication?.publishedAt ?? recipient.deliveredAt ?? "")}
              {recipient.confirmedAt
                ? ` · confirmado em ${formatDateTime(recipient.confirmedAt)}`
                : ""}
            </p>
            <div className={styles.rowActions}>
              {recipient.deliveryStatus !== "CONFIRMED" && (
                <Button
                  disabled={busyId === recipient.id}
                  onClick={() => onMarkRead(recipient)}
                >
                  Marcar como lido
                </Button>
              )}
              {recipient.deliveryStatus !== "CONFIRMED" && (
                <Button
                  disabled={busyId === recipient.id}
                  onClick={() => onConfirm(recipient)}
                >
                  Confirmar ciência
                </Button>
              )}
              {recipient.confirmedAt && (
                <span className={styles.successText}>
                  Confirmado em {formatDateTime(recipient.confirmedAt)}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
