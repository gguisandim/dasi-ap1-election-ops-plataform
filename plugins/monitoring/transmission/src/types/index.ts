import {
  CONNECTIVITY_LABELS,
  CONNECTIVITY_STATUSES,
  TRANSMISSION_FAILOVER_LABELS,
  TRANSMISSION_FAILOVER_STATUSES,
  isCircuitActiveStatus,
  type ConnectivityStatus,
  type TransmissionFailoverStatus,
} from "@eops/shared/transmission";

// Vocabulário de conectividade/failover no formato runtime do shared (fonte única).
export { CONNECTIVITY_LABELS, CONNECTIVITY_STATUSES, TRANSMISSION_FAILOVER_LABELS, TRANSMISSION_FAILOVER_STATUSES, isCircuitActiveStatus };
export type { ConnectivityStatus, TransmissionFailoverStatus };

export const TRANSMISSION_STATUSES = ["WAITING", "QUEUED", "TRANSMITTING", "SUCCESS", "FAILED", "RETRYING", "OFFLINE"] as const;
export type TransmissionStatus = (typeof TRANSMISSION_STATUSES)[number];
export type AttemptResult = "SUCCESS" | "FAILED" | "TIMEOUT" | "CANCELLED";
export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
export type DeadlineState = "ON_TRACK" | "DUE_SOON" | "OVERDUE" | "COMPLETED";
export const TRANSMISSION_LABELS: Record<TransmissionStatus, string> = { WAITING: "Aguardando", QUEUED: "Na fila", TRANSMITTING: "Transmitindo", SUCCESS: "Concluída", FAILED: "Falhou", RETRYING: "Nova tentativa", OFFLINE: "Offline" };
export const DEADLINE_STATE_LABELS: Record<DeadlineState, string> = { ON_TRACK: "No prazo", DUE_SOON: "Prazo próximo", OVERDUE: "Atrasado", COMPLETED: "Concluída" };
/** Janela de "prazo próximo"; coincide com o critério do alerta DEADLINE_NEAR (1 hora). */
export const DUE_SOON_WINDOW_MS = 60 * 60 * 1000;

/** Estado de prazo derivado no cliente; a regra canônica vive no servidor. */
export function deriveDeadlineState(status: TransmissionStatus, operationalDeadline: string | null | undefined, now: Date = new Date()): DeadlineState {
  if (status === "SUCCESS") return "COMPLETED";
  if (!operationalDeadline) return "ON_TRACK";
  const deadline = new Date(operationalDeadline).getTime();
  if (now.getTime() > deadline) return "OVERDUE";
  if (deadline - now.getTime() <= DUE_SOON_WINDOW_MS) return "DUE_SOON";
  return "ON_TRACK";
}

export interface TransmissionAttempt { id: string; number: number; startedAt: string; endedAt: string; result: AttemptResult; durationMs: number; error: string | null; }
export interface TimelineEvent { id: string; type: string; message: string; createdAt: string; metadata?: Record<string, unknown> | null; }
export interface TransmissionAlert { id: string; type: string; status: AlertStatus; message: string; notes: string | null; acknowledgedAt: string | null; acknowledgedById: string | null; resolvedAt: string | null; resolvedById: string | null; createdAt: string; point?: TransmissionPoint; }
export interface TransmissionPoint { id: string; electionId: string; electoralZoneId: string; pollingPlaceId: string; identification: string; status: TransmissionStatus; connectivity: ConnectivityStatus; lastActivity: string | null; observations: string | null; latencyMs: number | null; lastCheckedAt: string | null; connectionMethod: string | null; priority: number; queuedAt: string | null; operationalDeadline: string | null; attemptCount: number; lastError: string | null; election: { id: string; name: string; year: number }; electoralZone: { id: string; number: number; name: string; municipality: string }; pollingPlace: { id: string; name: string; address: string; city: string }; attempts: TransmissionAttempt[]; timeline: TimelineEvent[]; alerts: TransmissionAlert[]; }
export interface TransmissionFilters { electionId?: string; zoneId?: string; pollingPlaceId?: string; status?: TransmissionStatus; }
export interface AlertFilters { electionId?: string; zoneId?: string; pollingPlaceId?: string; status?: AlertStatus; includeResolved?: boolean; }
export interface TransmissionDashboard { totalExpected: number; completed: number; pending: number; failed: number; transmitting: number; completionPercentage: number; completeZones: number; zonesWithFailure: number; successRate: number; failureRate: number; deadlineRisk: number; offlineLocations: number; averageLatencyMs: number; attemptsToday: number; }
export interface TransmissionInput { electionId: string; electoralZoneId: string; pollingPlaceId: string; identification: string; status?: TransmissionStatus; connectivity?: ConnectivityStatus; observations?: string; priority: number; queuedAt?: string; operationalDeadline?: string; connectionMethod?: string; }

export interface NocZone { zoneId: string; number: number; name: string; total: number; success: number; failed: number; offline: number; deadlineRisk: number; successRate: number; averageLatencyMs: number; }
export interface NocPlace { pollingPlaceId: string; name: string; zoneId: string; total: number; success: number; failed: number; offline: number; deadlineRisk: number; }
export interface NocAttentionPoint { id: string; identification: string; status: TransmissionStatus; deadlineState: DeadlineState; connectivity: ConnectivityStatus; latencyMs: number | null; operationalDeadline: string | null; zoneId: string; zoneNumber: number; pollingPlaceId: string; pollingPlaceName: string; }
export interface TransmissionNoc {
  totals: { total: number; success: number; queued: number; transmitting: number; failed: number; offline: number };
  rates: { successRate: number; failureRate: number };
  latency: { averageLatencyMs: number };
  volume: { attemptsToday: number };
  risk: { deadlineRisk: number; overdue: number; dueSoon: number };
  byStatus: Record<TransmissionStatus, number>;
  byDeadlineState: Record<DeadlineState, number>;
  byZone: NocZone[];
  byPlace: NocPlace[];
  needsAttention: NocAttentionPoint[];
}
export interface ConnectivityHistoryEntry { at: string; connectivity: ConnectivityStatus; latencyMs: number | null; }
export interface ConnectivityHistory { entries: ConnectivityHistoryEntry[]; current: { connectivity: ConnectivityStatus; latencyMs: number | null }; lastCheckedAt: string | null; lastSuccessAt: string | null; failureStreak: number; }

// --- Circuitos, provedores e failover (SPEC 3.2 / 3.4) ---------------------

export interface TransmissionProvider { id: string; code: string; name: string; contact: string | null; slaTargetUptimePercent: number | string | null; notes: string | null; active: boolean; createdAt?: string; circuitCount?: number; }
export interface TransmissionProviderInput { code?: string; name: string; contact?: string; slaTargetUptimePercent?: number; notes?: string; active?: boolean; }
export interface CircuitProviderRef { id: string; code: string; name: string; active: boolean; }
export interface TransmissionCircuit { id: string; pointId: string; providerId: string | null; code: string; name: string; technology: string | null; bandwidthMbps: number | null; isPrimary: boolean; status: ConnectivityStatus; notes?: string | null; createdAt?: string; provider: CircuitProviderRef | null; }
export interface CircuitInput { code?: string; name: string; technology?: string; bandwidthMbps?: number; isPrimary?: boolean; status?: ConnectivityStatus; providerId?: string; notes?: string; }
export interface TransmissionStateTransition { id: string; pointId: string; circuitId: string | null; from: ConnectivityStatus; to: ConnectivityStatus; reason: string | null; actorId: string | null; durationSeconds: number | null; occurredAt: string; circuit?: { id: string; code: string; name: string } | null; }
export interface TransmissionFailover { id: string; pointId: string; fromCircuitId: string | null; toCircuitId: string; reason: string; status: TransmissionFailoverStatus; startedAt: string; recoveredAt: string | null; cancelledAt: string | null; notes: string | null; toCircuit: CircuitProviderRef & { technology: string | null; status: ConnectivityStatus; isPrimary: boolean; provider: CircuitProviderRef | null }; fromCircuit: (CircuitProviderRef & { technology: string | null; status: ConnectivityStatus; isPrimary: boolean; provider: CircuitProviderRef | null }) | null; }
export interface FailoverInput { fromCircuitId?: string; toCircuitId: string; reason: string; notes?: string; }
export interface RecoveryInput { connectivity?: ConnectivityStatus; reason?: string; connectionMethod?: string; latencyMs?: number; }

// --- SLA e analytics (SPEC 3.5) -------------------------------------------

export interface SlaQuery { electionId?: string; zoneId?: string; pollingPlaceId?: string; from?: string; to?: string; }
export interface SlaWindow { from: string; to: string; }
export interface SlaOverview { window: SlaWindow; pointCount: number; observedPointCount: number; uptimePercent: number | null; observedMinutes: number; onlineMinutes: number; degradedMinutes: number; downtimeMinutes: number; unknownMinutes: number; recoverySeconds: number | null; deadlineRiskPercent: number | null; }
export interface PointSla { pointId: string; identification: string; window: SlaWindow; windowMinutes: number; onlineMinutes: number; degradedMinutes: number; offlineMinutes: number; unknownMinutes: number; observedMinutes: number; uptimePercent: number | null; recoverySeconds: number | null; transitions: number; }
export interface AnalyticsZone { zoneId: string; number: number; name: string; pointCount: number; uptimePercent: number | null; downtimeMinutes: number; unknownMinutes: number; deadlineRiskPercent: number | null; }
export interface ProviderCircuitPerformance { circuitId: string; uptimePercent: number | null; observedMinutes: number; }
export interface ProviderPerformance { providerId: string; code: string; name: string; slaTargetUptimePercent: number | null; circuitCount: number; incidentCount: number; failoverCount: number; uptimePercent: number | null; observedMinutes: number; meetsTarget: boolean | null; circuits: ProviderCircuitPerformance[]; }
export interface AnalyticsTopOffender { pointId: string; identification: string; zoneId: string; zoneNumber: number; pollingPlaceId: string; pollingPlaceName: string; offlineMinutes: number; uptimePercent: number | null; }
export interface TransmissionAnalytics extends SlaOverview { mttrSeconds: number | null; byZone: AnalyticsZone[]; byProvider: ProviderPerformance[]; topOffenders: AnalyticsTopOffender[]; }

// --- Correlação derivada (SPEC 3.6) ---------------------------------------

export type CorrelationSection<T> = { available: true; total: number; items: T[] } | { available: false };
export interface CorrelationIncident { id: string; code: string; title: string; severity: string; status: string; occurredAt: string; resolvedAt: string | null; deepLink: string; }
export interface CorrelationResourceRequest { id: string; code: string; title: string; status: string; priority: string; occurredAt: string; neededAt: string | null; deepLink: string; }
export interface CorrelationPostmortem { id: string; code: string; title: string; status: string; publishedAt: string | null; deepLink: string; }
export interface CorrelationHandover { id: string; status: string; occurredAt: string; submittedAt: string | null; confirmedAt: string | null; shiftName: string; deepLink: string; }
export interface CorrelationPoint { id: string; identification: string; electionId: string; electoralZoneId: string; pollingPlaceId: string; pollingPlaceName: string; zoneNumber: number; }
export interface TransmissionCorrelation {
  point: CorrelationPoint;
  window: SlaWindow;
  incidents: CorrelationSection<CorrelationIncident>;
  resourceRequests: CorrelationSection<CorrelationResourceRequest>;
  postmortems: CorrelationSection<CorrelationPostmortem>;
  handovers: CorrelationSection<CorrelationHandover>;
  attentionItems: { available: true; route: string; filters: { electionId: string; electoralZoneId: string; pollingPlaceId: string } } | { available: false };
}
