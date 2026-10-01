import { formatDateTime } from "@eops/shared/format";
import type {
  CommunicationDeliveryStatus,
  CommunicationRecipientSummary,
} from "@eops/shared/communications";
import { COMMUNICATION_DELIVERY_LABELS } from "@eops/shared/communications";
import { Button } from "@eops/ui";
import { DeliveryBadge } from "./CommunicationBadges";
import styles from "../styles/communications.module.css";

export interface RecipientTableProps {
  recipients: CommunicationRecipientSummary[];
  busyId?: string;
  onMarkRead?: (recipient: CommunicationRecipientSummary) => void;
  onConfirm?: (recipient: CommunicationRecipientSummary) => void;
}

const TIMELINE_FIELDS: Array<{
  key: keyof CommunicationRecipientSummary;
  label: string;
}> = [
  { key: "deliveredAt", label: "Entregue em" },
  { key: "viewedAt", label: "Visto em" },
  { key: "confirmedAt", label: "Confirmado em" },
];

export function RecipientTable({
  recipients,
  busyId,
  onMarkRead,
  onConfirm,
}: RecipientTableProps) {
  const showActions = Boolean(onMarkRead || onConfirm);
  return (
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            <th>Destinatário</th>
            <th>Origem</th>
            <th>Estado</th>
            {TIMELINE_FIELDS.map((field) => (
              <th key={field.key}>{field.label}</th>
            ))}
            {showActions && <th>Ações</th>}
          </tr>
        </thead>
        <tbody>
          {recipients.map((recipient) => (
            <tr key={recipient.id}>
              <td>
                <strong>{recipient.name}</strong>
                <small>
                  {recipient.roleLabel ?? "—"}
                  {recipient.email ? ` · ${recipient.email}` : ""}
                </small>
              </td>
              <td>{recipient.sourceLabel ?? "—"}</td>
              <td>
                <DeliveryBadge status={recipient.deliveryStatus} />
                {recipient.confirmationNote && <small>{recipient.confirmationNote}</small>}
              </td>
              {TIMELINE_FIELDS.map((field) => {
                const value = recipient[field.key] as string | null | undefined;
                return <td key={field.key}>{value ? formatDateTime(value) : "—"}</td>;
              })}
              {showActions && (
                <td className={styles.rowActions}>
                  {onMarkRead && recipient.deliveryStatus !== "CONFIRMED" && (
                    <Button
                      disabled={busyId === recipient.id}
                      onClick={() => onMarkRead(recipient)}
                    >
                      Registrar leitura
                    </Button>
                  )}
                  {onConfirm && recipient.deliveryStatus !== "CONFIRMED" && (
                    <Button
                      disabled={busyId === recipient.id}
                      onClick={() => onConfirm(recipient)}
                    >
                      Confirmar
                    </Button>
                  )}
                  {recipient.deliveryStatus === "CONFIRMED" && (
                    <span className={styles.mutedText}>Concluído</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Contadores por estado, exibidos acima da tabela de destinatários. */
export function RecipientStatusSummary({
  counts,
}: {
  counts: Array<{ status: CommunicationDeliveryStatus; total: number }>;
}) {
  return (
    <div className={styles.recipientSummary}>
      {counts.map((item) => (
        <div key={item.status}>
          <span>{COMMUNICATION_DELIVERY_LABELS[item.status]}</span>
          <strong>{item.total}</strong>
        </div>
      ))}
    </div>
  );
}
