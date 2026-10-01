import {
  KNOWLEDGE_KIND_LABELS,
  KNOWLEDGE_STATUS_LABELS,
  RUNBOOK_OUTCOME_LABELS,
  type KnowledgeArticleKind,
  type KnowledgeArticleStatus,
  type RunbookUsageOutcome,
} from "@eops/shared/knowledge";
import styles from "../styles/knowledge.module.css";
import { KIND_ICONS, OUTCOME_TONES, STATUS_TONES } from "../utils/presentation";

export function KindBadge({ kind }: { kind: KnowledgeArticleKind }) {
  return (
    <span className={`${styles.badge} ${kind === "RUNBOOK" ? styles.info : styles.neutral}`}>
      <span aria-hidden="true">{KIND_ICONS[kind]}</span>
      {KNOWLEDGE_KIND_LABELS[kind]}
    </span>
  );
}

export function StatusBadge({ status }: { status: KnowledgeArticleStatus }) {
  return (
    <span className={`${styles.badge} ${styles[STATUS_TONES[status]]}`}>
      {KNOWLEDGE_STATUS_LABELS[status]}
    </span>
  );
}

export function OutcomeBadge({ outcome }: { outcome: RunbookUsageOutcome }) {
  return (
    <span className={`${styles.badge} ${styles[OUTCOME_TONES[outcome]]}`}>
      {RUNBOOK_OUTCOME_LABELS[outcome]}
    </span>
  );
}

export function KnowledgeChip({ label, icon }: { label: string; icon?: string }) {
  return (
    <span className={styles.chip}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {label}
    </span>
  );
}
