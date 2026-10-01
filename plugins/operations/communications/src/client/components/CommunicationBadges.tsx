import type {
  CommunicationDeliveryStatus,
  CommunicationPriority,
  CommunicationStatus,
} from "@eops/shared/communications";
import {
  COMMUNICATION_DELIVERY_LABELS,
  COMMUNICATION_PRIORITY_LABELS,
  COMMUNICATION_STATUS_LABELS,
} from "@eops/shared/communications";
import styles from "../styles/communications.module.css";
import { PRIORITY_TONES, STATUS_TONES } from "../utils/presentation";

export function PriorityBadge({ priority }: { priority: CommunicationPriority }) {
  const urgent = priority === "HIGH" || priority === "CRITICAL";
  return (
    <span
      className={`${styles.badge} ${styles[PRIORITY_TONES[priority]]} ${urgent ? styles.urgentBadge : ""}`}
      data-urgent={urgent ? "true" : undefined}
    >
      {urgent && <b aria-hidden="true">!</b>}
      {COMMUNICATION_PRIORITY_LABELS[priority]}
    </span>
  );
}

export function StatusBadge({ status }: { status: CommunicationStatus }) {
  return (
    <span className={`${styles.badge} ${styles[STATUS_TONES[status]]}`}>
      {COMMUNICATION_STATUS_LABELS[status]}
    </span>
  );
}

export function DeliveryBadge({ status }: { status: CommunicationDeliveryStatus }) {
  const tone =
    status === "CONFIRMED"
      ? styles.success
      : status === "VIEWED"
        ? styles.info
        : status === "DELIVERED"
          ? styles.warning
          : styles.neutral;
  return (
    <span className={`${styles.badge} ${tone}`}>
      {COMMUNICATION_DELIVERY_LABELS[status]}
    </span>
  );
}

/** Selo textual compacto usado em cartões e cabeçalhos. */
export function CommunicationChip({
  label,
  icon,
  tone = "neutral",
}: {
  label: string;
  icon?: string;
  tone?: "neutral" | "info" | "warning" | "danger" | "success";
}) {
  return (
    <span className={`${styles.chip} ${styles[tone]}`}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {label}
    </span>
  );
}
