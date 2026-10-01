import { RiskImpact, RiskLevel, RiskProbability } from "@prisma/client";

/** Valores da escala de cinco níveis, iguais para probabilidade e impacto. */
export const RISK_SCALE_VALUES: Record<"VERY_LOW" | "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH", number> = {
  VERY_LOW: 1,
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
  VERY_HIGH: 5,
};

export const RISK_PROBABILITY_VALUES: Record<RiskProbability, number> = {
  VERY_LOW: RISK_SCALE_VALUES.VERY_LOW,
  LOW: RISK_SCALE_VALUES.LOW,
  MEDIUM: RISK_SCALE_VALUES.MEDIUM,
  HIGH: RISK_SCALE_VALUES.HIGH,
  VERY_HIGH: RISK_SCALE_VALUES.VERY_HIGH,
};

export const RISK_IMPACT_VALUES: Record<RiskImpact, number> = {
  VERY_LOW: RISK_SCALE_VALUES.VERY_LOW,
  LOW: RISK_SCALE_VALUES.LOW,
  MEDIUM: RISK_SCALE_VALUES.MEDIUM,
  HIGH: RISK_SCALE_VALUES.HIGH,
  VERY_HIGH: RISK_SCALE_VALUES.VERY_HIGH,
};

export const RISK_SCALE_ORDER: RiskProbability[] = [
  RiskProbability.VERY_LOW,
  RiskProbability.LOW,
  RiskProbability.MEDIUM,
  RiskProbability.HIGH,
  RiskProbability.VERY_HIGH,
];

/**
 * Faixas de classificação — regra única do domínio.
 *
 * A matriz 5×5 é derivada desta mesma função, garantindo que a célula exibida e a
 * classificação do registro nunca divirjam.
 */
export const RISK_LEVEL_BANDS: Array<{ maxScore: number; level: RiskLevel }> = [
  { maxScore: 4, level: RiskLevel.LOW },
  { maxScore: 9, level: RiskLevel.MODERATE },
  { maxScore: 15, level: RiskLevel.HIGH },
  { maxScore: 25, level: RiskLevel.CRITICAL },
];

/** Score = valor da probabilidade × valor do impacto (1 a 25). */
export function computeRiskScore(probability: RiskProbability, impact: RiskImpact): number {
  return RISK_PROBABILITY_VALUES[probability] * RISK_IMPACT_VALUES[impact];
}

/** Classificação por faixa de score. */
export function classifyRisk(score: number): RiskLevel {
  const band = RISK_LEVEL_BANDS.find((entry) => score <= entry.maxScore);
  return band?.level ?? RiskLevel.CRITICAL;
}

export function assessRisk(
  probability: RiskProbability,
  impact: RiskImpact,
): { score: number; level: RiskLevel } {
  const score = computeRiskScore(probability, impact);
  return { score, level: classifyRisk(score) };
}

/** Peso de ordenação: maior valor aparece primeiro. */
export const RISK_LEVEL_WEIGHT: Record<RiskLevel, number> = {
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
};

/** Escalada: mudou para uma faixa mais grave. */
export function isEscalation(from: RiskLevel, to: RiskLevel): boolean {
  return RISK_LEVEL_WEIGHT[to] > RISK_LEVEL_WEIGHT[from];
}

export interface RiskLevelCell {
  probability: RiskProbability;
  impact: RiskImpact;
  score: number;
  level: RiskLevel;
}

/**
 * Matriz 5×5 completa, na ordem de exibição: probabilidade decrescente nas linhas,
 * impacto crescente nas colunas — convenção usual de leitura de risco.
 */
export function buildRiskMatrix(): RiskLevelCell[][] {
  return [...RISK_SCALE_ORDER]
    .reverse()
    .map((probability) =>
      RISK_SCALE_ORDER.map((impact) => ({
        probability,
        impact,
        ...assessRisk(probability, impact),
      })),
    );
}

/** Média do progresso das mitigações não canceladas; `null` quando não há nenhuma. */
export function averageProgress(
  mitigations: Array<{ status: string; progress: number }>,
): number | null {
  const active = mitigations.filter((mitigation) => mitigation.status !== "CANCELLED");
  if (active.length === 0) return null;
  const total = active.reduce((sum, mitigation) => sum + mitigation.progress, 0);
  return Math.round(total / active.length);
}

/** Ação atrasada: prazo vencido e ainda não concluída nem cancelada. */
export function isMitigationOverdue(
  mitigation: { dueDate: Date | string | null; status: string },
  now: Date = new Date(),
): boolean {
  if (!mitigation.dueDate) return false;
  if (mitigation.status === "COMPLETED" || mitigation.status === "CANCELLED") return false;
  return new Date(mitigation.dueDate).getTime() < now.getTime();
}

/** Prazo do risco vencido sem encerramento. */
export function isRiskOverdue(
  risk: { dueDate: Date | string | null; status: string },
  now: Date = new Date(),
): boolean {
  if (!risk.dueDate) return false;
  if (risk.status === "CLOSED" || risk.status === "MATERIALIZED") return false;
  return new Date(risk.dueDate).getTime() < now.getTime();
}

/** Um risco é considerado ativo enquanto não foi encerrado. */
export function isActiveStatus(status: string): boolean {
  return status !== "CLOSED";
}
