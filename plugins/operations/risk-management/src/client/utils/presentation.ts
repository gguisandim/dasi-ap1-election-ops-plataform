import type { RiskLevel, RiskScaleValue, RiskStatus } from "@eops/shared/risks";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info";

export const LEVEL_TONES: Record<RiskLevel, Tone> = {
  LOW: "success",
  MODERATE: "info",
  HIGH: "warning",
  CRITICAL: "danger",
};

/** Cor da célula da matriz, na mesma escala da classificação. */
export const LEVEL_CLASS: Record<RiskLevel, string> = {
  LOW: "levelLow",
  MODERATE: "levelModerate",
  HIGH: "levelHigh",
  CRITICAL: "levelCritical",
};

export const STATUS_TONES: Record<RiskStatus, Tone> = {
  IDENTIFIED: "neutral",
  ASSESSED: "info",
  MITIGATING: "warning",
  MONITORING: "info",
  ACCEPTED: "neutral",
  CLOSED: "success",
  MATERIALIZED: "danger",
};

export const SCALE_ICONS: Record<RiskScaleValue, string> = {
  VERY_LOW: "▁",
  LOW: "▂",
  MEDIUM: "▄",
  HIGH: "▆",
  VERY_HIGH: "█",
};

/** Faixa textual do score, alinhada às bandas publicadas. */
export function scoreBand(score: number): string {
  if (score <= 4) return "1–4";
  if (score <= 9) return "5–9";
  if (score <= 15) return "10–15";
  return "16–25";
}

/** Percentual de progresso com rótulo legível quando não há mitigações. */
export function progressLabel(progress: number | null): string {
  return progress === null ? "sem plano" : `${progress}%`;
}
