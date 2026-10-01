/**
 * Contratos compartilhados do domínio de Gestão de Riscos.
 *
 * O plugin `@eops/plugin-risk-management` é o dono destes tipos. Outros domínios
 * (Centro de Comando, Relatórios) consomem apenas estes contratos, nunca o
 * service interno do plugin.
 */

export const RISK_SCALE = ["VERY_LOW", "LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as const;
export const RISK_LEVELS = ["LOW", "MODERATE", "HIGH", "CRITICAL"] as const;
export const RISK_STATUSES = [
  "IDENTIFIED",
  "ASSESSED",
  "MITIGATING",
  "MONITORING",
  "ACCEPTED",
  "CLOSED",
  "MATERIALIZED",
] as const;
export const RISK_MITIGATION_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export type RiskScaleValue = (typeof RISK_SCALE)[number];
export type RiskLevel = (typeof RISK_LEVELS)[number];
export type RiskStatus = (typeof RISK_STATUSES)[number];
export type RiskMitigationStatus = (typeof RISK_MITIGATION_STATUSES)[number];

/** Valores da escala, 1 a 5 — iguais para probabilidade e impacto. */
export const RISK_SCALE_VALUES: Record<RiskScaleValue, number> = {
  VERY_LOW: 1,
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
  VERY_HIGH: 5,
};

/** Faixas de classificação, publicadas para que a regra seja auditável. */
export const RISK_LEVEL_BANDS: Array<{ maxScore: number; level: RiskLevel }> = [
  { maxScore: 4, level: "LOW" },
  { maxScore: 9, level: "MODERATE" },
  { maxScore: 15, level: "HIGH" },
  { maxScore: 25, level: "CRITICAL" },
];

export const RISK_SCALE_LABELS: Record<RiskScaleValue, string> = {
  VERY_LOW: "Muito baixa",
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  VERY_HIGH: "Muito alta",
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  LOW: "Baixo",
  MODERATE: "Moderado",
  HIGH: "Alto",
  CRITICAL: "Crítico",
};

export const RISK_STATUS_LABELS: Record<RiskStatus, string> = {
  IDENTIFIED: "Identificado",
  ASSESSED: "Avaliado",
  MITIGATING: "Em mitigação",
  MONITORING: "Em monitoramento",
  ACCEPTED: "Aceito",
  CLOSED: "Encerrado",
  MATERIALIZED: "Materializado",
};

export const RISK_MITIGATION_STATUS_LABELS: Record<RiskMitigationStatus, string> = {
  PLANNED: "Planejada",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

export const RISK_EVENT_LABELS: Record<string, string> = {
  CREATED: "Registrado",
  ASSESSED: "Avaliado",
  SCORE_CHANGED: "Score alterado",
  OWNER_CHANGED: "Proprietário alterado",
  STATUS_CHANGED: "Situação alterada",
  MITIGATION_ADDED: "Mitigação adicionada",
  MITIGATION_UPDATED: "Mitigação atualizada",
  MITIGATION_COMPLETED: "Mitigação concluída",
  MATERIALIZED: "Materializado",
  CLOSED: "Encerrado",
  REOPENED: "Reaberto",
  NOTE_ADDED: "Observação registrada",
};

export interface RiskCategorySummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  color: string | null;
  active: boolean;
  riskCount?: number;
}

export interface RiskMitigationSummary {
  id: string;
  riskId: string;
  description: string;
  responsibleName: string;
  responsibleId: string | null;
  dueDate: string | null;
  status: RiskMitigationStatus;
  progress: number;
  evidenceId: string | null;
  evidenceLabel: string | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Prazo vencido e ação ainda não concluída nem cancelada. */
  overdue: boolean;
}

export interface RiskEventSummary {
  id: string;
  type: string;
  message: string;
  actorId: string | null;
  actorName: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface RiskSummary {
  id: string;
  code: string;
  title: string;
  description: string;
  electionId: string;
  electoralZoneId: string | null;
  pollingPlaceId: string | null;
  categoryId: string;
  ownerId: string | null;
  ownerName: string;
  responsibleId: string | null;
  responsibleName: string;
  probability: RiskScaleValue;
  impact: RiskScaleValue;
  /** Derivado no servidor: valorDaProbabilidade × valorDoImpacto (1 a 25). */
  score: number;
  /** Derivado no servidor pelas faixas publicadas. */
  level: RiskLevel;
  status: RiskStatus;
  identifiedAt: string;
  dueDate: string | null;
  acceptedAt: string | null;
  closedAt: string | null;
  materializedAt: string | null;
  actualImpact: string | null;
  materializationNotes: string | null;
  incidentId: string | null;
  observations: string | null;
  mitigationCount: number;
  createdAt: string;
  updatedAt: string;
  election?: { id: string; name: string; year: number };
  electoralZone?: { id: string; number: number; name: string } | null;
  pollingPlace?: { id: string; name: string; city: string } | null;
  category?: RiskCategorySummary;
  mitigations?: RiskMitigationSummary[];
  /** Média do progresso das mitigações; `null` quando não há nenhuma. */
  mitigationProgress: number | null;
  /** Existe ao menos uma mitigação com prazo vencido. */
  hasOverdueMitigation: boolean;
  /** Prazo do próprio risco vencido sem encerramento. */
  overdue: boolean;
  timeline?: RiskEventSummary[];
}

export interface RiskDistributionEntry {
  key: string;
  label: string;
  total: number;
}

export interface RiskMatrixCell {
  probability: RiskScaleValue;
  impact: RiskScaleValue;
  score: number;
  level: RiskLevel;
  total: number;
  riskIds: string[];
}

export interface RiskDashboard {
  total: number;
  active: number;
  critical: number;
  high: number;
  withoutMitigation: number;
  overdueMitigations: number;
  materialized: number;
  closed: number;
  accepted: number;
  averageScore: number;
  byCategory: RiskDistributionEntry[];
  byZone: RiskDistributionEntry[];
  byLevel: RiskDistributionEntry[];
  byStatus: RiskDistributionEntry[];
  /** Células da matriz 5×5, já com a contagem de riscos de cada combinação. */
  matrix: RiskMatrixCell[][];
}

export interface RiskMitigationInput {
  description: string;
  responsibleName: string;
  dueDate?: string;
  status?: RiskMitigationStatus;
  progress?: number;
  evidenceId?: string;
  evidenceLabel?: string;
  notes?: string;
}

export interface RiskInput {
  title: string;
  description: string;
  electionId: string;
  electoralZoneId?: string;
  pollingPlaceId?: string;
  categoryId: string;
  ownerName: string;
  responsibleName: string;
  probability: RiskScaleValue;
  impact: RiskScaleValue;
  status?: RiskStatus;
  identifiedAt?: string;
  dueDate?: string;
  observations?: string;
}
