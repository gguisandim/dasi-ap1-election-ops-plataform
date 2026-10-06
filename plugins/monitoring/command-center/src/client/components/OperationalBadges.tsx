import {
  OPERATIONAL_HEALTH_LABELS,
  OPERATIONAL_SEVERITY_LABELS,
  OPERATIONAL_SOURCE_LABELS,
  type OperationalAttentionItem,
  type OperationalHealth,
  type OperationalSeverity,
} from "@eops/shared/command-center";
import styles from "../styles/command-center.module.css";

const healthClass: Record<OperationalHealth, string> = {
  NORMAL: styles.pillNormal,
  ATTENTION: styles.pillAttention,
  CRITICAL: styles.pillCritical,
};

const severityClass: Record<OperationalSeverity, string> = {
  LOW: styles.severityLow,
  MEDIUM: styles.severityMedium,
  HIGH: styles.severityHigh,
  CRITICAL: styles.severityCritical,
};

export function HealthPill({ health }: { health: OperationalHealth }) {
  return (
    <span className={`${styles.pill} ${healthClass[health]}`}>
      {OPERATIONAL_HEALTH_LABELS[health]}
    </span>
  );
}

export function SeverityMark({ severity }: { severity: OperationalSeverity }) {
  return (
    <span
      className={`${styles.severityMark} ${severityClass[severity]}`}
      role="img"
      aria-label={`Severidade ${OPERATIONAL_SEVERITY_LABELS[severity]}`}
    />
  );
}

export function ItemTags({ item }: { item: OperationalAttentionItem }) {
  const classification =
    item.severity === "CRITICAL" ||
    item.deadlineState === "OVERDUE" ||
    item.statusState === "ESCALATED" ||
    item.statusState === "BLOCKED"
      ? styles.tagCritical
      : styles.tagWarning;
  return (
    <div className={styles.feedTags}>
      <span className={`${styles.tag} ${classification}`}>
        {OPERATIONAL_SEVERITY_LABELS[item.severity]}
      </span>
      <span className={styles.tag}>
        {OPERATIONAL_SOURCE_LABELS[item.sourceType]}
      </span>
      <span className={styles.tag}>{item.status}</span>
      {item.deadlineState === "OVERDUE" && (
        <span className={`${styles.tag} ${styles.tagCritical}`}>Prazo vencido</span>
      )}
      {item.deadlineState === "DUE_SOON" && (
        <span className={`${styles.tag} ${styles.tagWarning}`}>Prazo próximo</span>
      )}
    </div>
  );
}
