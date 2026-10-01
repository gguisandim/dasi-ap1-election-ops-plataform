import {
  RISK_LEVEL_LABELS,
  RISK_SCALE_LABELS,
  RISK_STATUS_LABELS,
  type RiskLevel,
  type RiskScaleValue,
  type RiskStatus,
} from "@eops/shared/risks";
import styles from "../styles/risk.module.css";
import { LEVEL_TONES, SCALE_ICONS, STATUS_TONES } from "../utils/presentation";

export function RiskLevelBadge({ level, score }: { level: RiskLevel; score?: number }) {
  return (
    <span className={`${styles.badge} ${styles[LEVEL_TONES[level]]}`}>
      {RISK_LEVEL_LABELS[level]}
      {score !== undefined && <b>{score}</b>}
    </span>
  );
}

export function RiskStatusBadge({ status }: { status: RiskStatus }) {
  return (
    <span className={`${styles.badge} ${styles[STATUS_TONES[status]]}`}>
      {RISK_STATUS_LABELS[status]}
    </span>
  );
}

export function RiskScaleBadge({ value, kind }: { value: RiskScaleValue; kind: "P" | "I" }) {
  return (
    <span className={`${styles.badge} ${styles.neutral}`}>
      <span aria-hidden="true">{SCALE_ICONS[value]}</span>
      {kind === "P" ? "Prob." : "Impacto"} {RISK_SCALE_LABELS[value]}
    </span>
  );
}

export function RiskChip({ label, icon }: { label: string; icon?: string }) {
  return (
    <span className={styles.chip}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {label}
    </span>
  );
}
