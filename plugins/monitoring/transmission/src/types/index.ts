export const TRANSMISSION_STATUSES = ["WAITING", "QUEUED", "TRANSMITTING", "SUCCESS", "FAILED", "RETRYING", "OFFLINE"] as const;
export const CONNECTIVITY_STATUSES = ["ONLINE", "DEGRADED", "OFFLINE", "UNKNOWN"] as const;
export type TransmissionStatus = (typeof TRANSMISSION_STATUSES)[number];
export type ConnectivityStatus = (typeof CONNECTIVITY_STATUSES)[number];
export type AttemptResult = "SUCCESS" | "FAILED" | "TIMEOUT" | "CANCELLED";
export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
export const TRANSMISSION_LABELS: Record<TransmissionStatus, string> = { WAITING: "Aguardando", QUEUED: "Na fila", TRANSMITTING: "Transmitindo", SUCCESS: "Concluída", FAILED: "Falhou", RETRYING: "Nova tentativa", OFFLINE: "Offline" };
export const CONNECTIVITY_LABELS: Record<ConnectivityStatus, string> = { ONLINE: "Online", DEGRADED: "Degradada", OFFLINE: "Offline", UNKNOWN: "Desconhecida" };
export interface TransmissionAttempt { id: string; number: number; startedAt: string; endedAt: string; result: AttemptResult; durationMs: number; error: string | null; }
export interface TimelineEvent { id: string; type: string; message: string; createdAt: string; }
export interface TransmissionAlert { id: string; type: string; status: AlertStatus; message: string; createdAt: string; point?: TransmissionPoint; }
export interface TransmissionPoint { id: string; electionId: string; electoralZoneId: string; pollingPlaceId: string; identification: string; status: TransmissionStatus; connectivity: ConnectivityStatus; lastActivity: string | null; observations: string | null; latencyMs: number | null; lastCheckedAt: string | null; connectionMethod: string | null; priority: number; queuedAt: string | null; operationalDeadline: string | null; attemptCount: number; lastError: string | null; election: { id: string; name: string; year: number }; electoralZone: { id: string; number: number; name: string; municipality: string }; pollingPlace: { id: string; name: string; address: string; city: string }; attempts: TransmissionAttempt[]; timeline: TimelineEvent[]; alerts: TransmissionAlert[]; }
export interface TransmissionFilters { electionId?: string; zoneId?: string; pollingPlaceId?: string; status?: TransmissionStatus; }
export interface TransmissionDashboard { totalExpected: number; completed: number; pending: number; failed: number; transmitting: number; completionPercentage: number; completeZones: number; zonesWithFailure: number; }
export interface TransmissionInput { electionId: string; electoralZoneId: string; pollingPlaceId: string; identification: string; status?: TransmissionStatus; connectivity?: ConnectivityStatus; observations?: string; priority: number; queuedAt?: string; operationalDeadline?: string; connectionMethod?: string; }
