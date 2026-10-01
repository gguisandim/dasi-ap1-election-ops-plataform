import {
  EVIDENCE_STATUS_LABELS,
  type EvidenceLinkType,
  type EvidenceStatus,
  type EvidenceType,
} from "@eops/shared/evidence";
import styles from "../styles/evidence.module.css";
import { LINK_ICONS, TYPE_ICONS, TYPE_TONES, linkTypeLabel, typeLabel } from "../utils/presentation";

export function EvidenceTypeBadge({ type }: { type: EvidenceType }) {
  return (
    <span className={`${styles.badge} ${styles[TYPE_TONES[type]]}`}>
      <span aria-hidden="true">{TYPE_ICONS[type]}</span>
      {typeLabel(type)}
    </span>
  );
}

export function EvidenceStatusBadge({ status }: { status: EvidenceStatus }) {
  return (
    <span
      className={`${styles.badge} ${status === "ARCHIVED" ? styles.warning : styles.success}`}
    >
      {EVIDENCE_STATUS_LABELS[status]}
    </span>
  );
}

export function EvidenceLinkBadge({ type }: { type: EvidenceLinkType }) {
  return (
    <span className={`${styles.badge} ${styles.neutral}`}>
      <span aria-hidden="true">{LINK_ICONS[type]}</span>
      {linkTypeLabel(type)}
    </span>
  );
}

export function EvidenceChip({ label, icon }: { label: string; icon?: string }) {
  return (
    <span className={styles.chip}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {label}
    </span>
  );
}
