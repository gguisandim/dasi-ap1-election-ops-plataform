export const TRANSMISSION_STATUSES = ["WAITING", "QUEUED", "TRANSMITTING", "SUCCESS", "FAILED", "RETRYING", "OFFLINE"] as const;
export const CONNECTIVITY_STATUSES = ["ONLINE", "DEGRADED", "OFFLINE", "UNKNOWN"] as const;
export type TransmissionStatus = (typeof TRANSMISSION_STATUSES)[number];
export type ConnectivityStatus = (typeof CONNECTIVITY_STATUSES)[number];
export type AttemptResult = "SUCCESS" | "FAILED" | "TIMEOUT" | "CANCELLED";
export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
export type DeadlineState = "ON_TRACK" | "DUE_SOON" | "OVERDUE" | "COMPLETED";
export const TRANSMISSION_LABELS: Record<TransmissionStatus, string> = { WAITING: "Aguardando", QUEUED: "Na fila", TRANSMITTING: "Transmitindo", SUCCESS: "Concluída", FAILED: "Falhou", RETRYING: "Nova tentativa", OFFLINE: "Offline" };
export const CONNECTIVITY_LABELS: Record<ConnectivityStatus, string> = { ONLINE: "Online", DEGRADED: "Degradada", OFFLINE: "Offline", UNKNOWN: "Desconhecida" };
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
