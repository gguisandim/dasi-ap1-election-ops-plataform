/**
 * Contratos e regras puras do Command Center.
 *
 * A fórmula de atenção é determinística e vive aqui para que servidor e testes
 * compartilhem exatamente a mesma implementação. Nenhuma decisão deste módulo
 * depende de banco, rede ou estado externo.
 */

export type OperationalHealth = "NORMAL" | "ATTENTION" | "CRITICAL";

export type OperationalAttentionSource =
  | "INCIDENT"
  | "TRANSMISSION"
  | "PREPARATION"
  | "SHIFT_COVERAGE"
  | "FIELD_DISPATCH"
  | "SHIFT_HANDOVER"
  | "ROUTE"
  | "ASSET"
  | "RESOURCE_REQUEST";

export type OperationalSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type OperationalDeadlineState =
  | "OVERDUE"
  | "DUE_SOON"
  | "ON_TRACK"
  | "COMPLETED"
  | "NONE";

export type OperationalStatusState =
  | "UNACKNOWLEDGED"
  | "ESCALATED"
  | "BLOCKED"
  | "WAITING"
  | "IN_PROGRESS"
  | "RESOLVED";

export type OperationalItemClassification = "CRITICAL" | "WARNING";

export interface OperationalAttentionItem {
  id: string;
  sourceType: OperationalAttentionSource;
  sourceId: string;
  title: string;
  summary: string;
  severity: OperationalSeverity;
  status: string;
  statusState: OperationalStatusState;
  deadlineState: OperationalDeadlineState;
  electionId?: string | null;
  electoralZoneId?: string | null;
  pollingPlaceId?: string | null;
  occurredAt: string;
  ageSeconds: number;
  score: number;
  deepLink: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface OperationalMetrics {
  totalItems: number;
  criticalItems: number;
  warnings: number;
  activeIncidents: number | null;
  criticalIncidents: number | null;
  overdueIncidents: number | null;
  unacknowledgedIncidents: number | null;
  transmissionFailures: number | null;
  transmissionOffline: number | null;
  transmissionOverdue: number | null;
  shiftsTotal: number | null;
  shiftsCoverageEmpty: number | null;
  shiftsCoverageCritical: number | null;
  activeDispatches: number | null;
  waitingDispatches: number | null;
  pendingHandovers: number | null;
  oldestPendingHandoverAgeSeconds: number | null;
  confirmedHandoversToday: number | null;
  preparationBlocked: number | null;
  preparationOverdue: number | null;
  routesDelayed: number | null;
  routesFailedDeliveries: number | null;
  assetsLost: number | null;
  assetsInMaintenance: number | null;
  resourceRequestsCritical: number | null;
  resourceRequestsOverdue: number | null;
  resourceRequestsApprovedUnfulfilled: number | null;
}

export type OperationalSectionKey =
  | "incidents"
  | "transmission"
  | "workforce"
  | "continuity"
  | "preparation"
  | "logistics"
  | "resourceRequests";

export type OperationalSectionState<T> =
  | { available: true; data: T }
  | { available: false; reason: "FORBIDDEN" };

export interface OperationalScope {
  electionId?: string;
  electoralZoneId?: string;
}

export interface OperationalSummary {
  generatedAt: string;
  scope: OperationalScope;
  health: OperationalHealth;
  metrics: OperationalMetrics;
  criticalItems: OperationalAttentionItem[];
  warnings: OperationalAttentionItem[];
  sections: Record<OperationalSectionKey, OperationalSectionState<unknown>>;
}

export interface OperationalZoneSituation {
  zoneId: string;
  zoneNumber: number;
  zoneName: string;
  municipality: string;
  state: string;
  health: OperationalHealth;
  itemCount: number;
  criticalItemCount: number;
  activeIncidents: number | null;
  transmissionProblems: number | null;
  coverageEmptyShifts: number | null;
  waitingDispatches: number | null;
  preparationBlockers: number | null;
  routesDelayed: number | null;
  resourceRequestsOpen: number | null;
}

export interface OperationalSnapshotPayload {
  scope: OperationalScope;
  health: OperationalHealth;
  metrics: OperationalMetrics;
  topItems: OperationalAttentionItem[];
  zones: Array<{
    zoneId: string;
    zoneName: string;
    health: OperationalHealth;
    itemCount: number;
  }>;
}

/**
 * Pesos normativos da fórmula de atenção. Alterar qualquer valor aqui é uma
 * mudança material de comportamento e exige atualização da SPEC.
 */
export const ATTENTION_WEIGHTS = {
  severity: { LOW: 10, MEDIUM: 30, HIGH: 60, CRITICAL: 100 },
  deadline: { OVERDUE: 50, DUE_SOON: 25, ON_TRACK: 0, COMPLETED: 0, NONE: 0 },
  status: {
    UNACKNOWLEDGED: 20,
    ESCALATED: 15,
    BLOCKED: 15,
    WAITING: 10,
    IN_PROGRESS: 0,
    RESOLVED: 0,
  },
  age: { secondsPerPoint: 3600, maxPoints: 40 },
  impact: {
    default: 5,
    incidentCritical: 20,
    transmissionPriority: 10,
    coverageEmpty: 15,
    coveragePartial: 8,
    preparationBlocked: 10,
    routeFailed: 10,
    assetLost: 10,
    requestCritical: 10,
  },
} as const satisfies {
  severity: Record<OperationalSeverity, number>;
  deadline: Record<OperationalDeadlineState, number>;
  status: Record<OperationalStatusState, number>;
  age: { secondsPerPoint: number; maxPoints: number };
  impact: Record<string, number>;
};

/** Limites operacionais derivados da SPEC. */
export const OPERATIONAL_THRESHOLDS = {
  /** Janela para considerar um prazo próximo. */
  dueSoonHours: 4,
  /** Janela mais curta usada por cobertura de turno. */
  coverageDueSoonHours: 2,
  /** Idade a partir da qual uma passagem pendente vira severidade alta. */
  oldPendingHandoverHours: 24,
  /** Máximo de itens retornados no feed. */
  maxFeedItems: 100,
  /** Máximo de itens persistidos em um snapshot. */
  snapshotTopItems: 20,
  /** Modo wallboard: intervalo de polling. */
  wallboardRefreshSeconds: { min: 30, max: 60, default: 45 },
  /** Saved views: intervalo configurável de refresh. */
  viewRefreshSeconds: { min: 15, max: 300, default: 45 },
  /** Saved views: máximo por owner. */
  maxViewsPerOwner: 20,
} as const;

export const HOUR_MS = 3_600_000;

export function ageWeightPoints(ageSeconds: number): number {
  if (!Number.isFinite(ageSeconds) || ageSeconds <= 0) return 0;
  const hours = Math.floor(ageSeconds / ATTENTION_WEIGHTS.age.secondsPerPoint);
  return Math.min(hours, ATTENTION_WEIGHTS.age.maxPoints);
}

export interface AttentionScoreInput {
  severity: OperationalSeverity;
  deadlineState: OperationalDeadlineState;
  statusState: OperationalStatusState;
  ageSeconds: number;
  impactWeight: number;
}

export function computeAttentionScore(input: AttentionScoreInput): number {
  return (
    ATTENTION_WEIGHTS.severity[input.severity] +
    ATTENTION_WEIGHTS.deadline[input.deadlineState] +
    ATTENTION_WEIGHTS.status[input.statusState] +
    ageWeightPoints(input.ageSeconds) +
    Math.max(0, Math.trunc(input.impactWeight))
  );
}

export function classifyAttentionItem(
  item: Pick<
    OperationalAttentionItem,
    "severity" | "deadlineState" | "statusState"
  >,
): OperationalItemClassification {
  if (item.severity === "CRITICAL") return "CRITICAL";
  if (item.deadlineState === "OVERDUE") return "CRITICAL";
  if (item.statusState === "ESCALATED" || item.statusState === "BLOCKED")
    return "CRITICAL";
  return "WARNING";
}

export function attentionItemId(
  sourceType: OperationalAttentionSource,
  sourceId: string,
): string {
  return `${sourceType}:${sourceId}`;
}

export interface AttentionItemInput {
  sourceType: OperationalAttentionSource;
  sourceId: string;
  title: string;
  summary: string;
  severity: OperationalSeverity;
  status: string;
  statusState: OperationalStatusState;
  deadlineState: OperationalDeadlineState;
  impactWeight?: number;
  occurredAt: Date | string;
  deepLink: string;
  electionId?: string | null;
  electoralZoneId?: string | null;
  pollingPlaceId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export function buildAttentionItem(
  input: AttentionItemInput,
  now: Date = new Date(),
): OperationalAttentionItem {
  const occurredAt =
    input.occurredAt instanceof Date
      ? input.occurredAt
      : new Date(input.occurredAt);
  const ageSeconds = Math.max(
    0,
    Math.floor((now.getTime() - occurredAt.getTime()) / 1000),
  );
  const impactWeight = input.impactWeight ?? ATTENTION_WEIGHTS.impact.default;
  return {
    id: attentionItemId(input.sourceType, input.sourceId),
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    title: input.title,
    summary: input.summary,
    severity: input.severity,
    status: input.status,
    statusState: input.statusState,
    deadlineState: input.deadlineState,
    electionId: input.electionId ?? null,
    electoralZoneId: input.electoralZoneId ?? null,
    pollingPlaceId: input.pollingPlaceId ?? null,
    occurredAt: occurredAt.toISOString(),
    ageSeconds,
    score: computeAttentionScore({
      severity: input.severity,
      deadlineState: input.deadlineState,
      statusState: input.statusState,
      ageSeconds,
      impactWeight,
    }),
    deepLink: input.deepLink,
    metadata: input.metadata ?? {},
  };
}

/** Ordenação total e estável: score desc, idade asc, origem asc, id asc. */
export function compareAttentionItems(
  left: OperationalAttentionItem,
  right: OperationalAttentionItem,
): number {
  if (left.score !== right.score) return right.score - left.score;
  const leftTime = new Date(left.occurredAt).getTime();
  const rightTime = new Date(right.occurredAt).getTime();
  if (leftTime !== rightTime) return leftTime - rightTime;
  if (left.sourceType !== right.sourceType)
    return left.sourceType < right.sourceType ? -1 : 1;
  if (left.sourceId !== right.sourceId)
    return left.sourceId < right.sourceId ? -1 : 1;
  return 0;
}

export function rankAttentionItems(
  items: readonly OperationalAttentionItem[],
  limit: number = OPERATIONAL_THRESHOLDS.maxFeedItems,
): OperationalAttentionItem[] {
  return [...items].sort(compareAttentionItems).slice(0, limit);
}

export function partitionAttentionItems(
  items: readonly OperationalAttentionItem[],
): {
  criticalItems: OperationalAttentionItem[];
  warnings: OperationalAttentionItem[];
} {
  const criticalItems: OperationalAttentionItem[] = [];
  const warnings: OperationalAttentionItem[] = [];
  for (const item of items) {
    if (classifyAttentionItem(item) === "CRITICAL") criticalItems.push(item);
    else warnings.push(item);
  }
  return { criticalItems, warnings };
}

export function deriveOperationalHealth(
  items: readonly OperationalAttentionItem[],
): OperationalHealth {
  if (items.length === 0) return "NORMAL";
  return items.some((item) => classifyAttentionItem(item) === "CRITICAL")
    ? "CRITICAL"
    : "ATTENTION";
}

/**
 * Compara dois payloads de snapshot (ou um snapshot com o estado atual) e
 * devolve apenas os deltas numéricos existentes nos dois lados.
 */
export function diffSnapshotMetrics(
  before: Record<string, number>,
  after: Record<string, number>,
): Array<{ key: string; before: number; after: number; delta: number }> {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const deltas: Array<{
    key: string;
    before: number;
    after: number;
    delta: number;
  }> = [];
  for (const key of keys) {
    const left = before[key];
    const right = after[key];
    if (typeof left !== "number" || typeof right !== "number") continue;
    deltas.push({ key, before: left, after: right, delta: right - left });
  }
  return deltas;
}

export const OPERATIONAL_HEALTH_LABELS: Record<OperationalHealth, string> = {
  NORMAL: "Normal",
  ATTENTION: "Atenção",
  CRITICAL: "Crítico",
};

export const OPERATIONAL_SOURCE_LABELS: Record<
  OperationalAttentionSource,
  string
> = {
  INCIDENT: "Incidente",
  TRANSMISSION: "Transmissão",
  PREPARATION: "Preparação",
  SHIFT_COVERAGE: "Cobertura",
  FIELD_DISPATCH: "Dispatch",
  SHIFT_HANDOVER: "Passagem de turno",
  ROUTE: "Rota",
  ASSET: "Ativo",
  RESOURCE_REQUEST: "Recurso",
};

export const OPERATIONAL_SEVERITY_LABELS: Record<OperationalSeverity, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};
