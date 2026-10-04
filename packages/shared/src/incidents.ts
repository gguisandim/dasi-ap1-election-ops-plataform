import type { ElectionSummary, ElectoralZoneSummary, PollingPlaceSummary } from "./elections";
import type { AssetSummary } from "./inventory";

export const INCIDENT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const INCIDENT_STATUSES = ["NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_ALLOWED_TRANSITIONS: Readonly<Record<IncidentStatus, readonly IncidentStatus[]>> = {
  NEW: ["TRIAGED", "ASSIGNED", "IN_PROGRESS", "CANCELLED"],
  TRIAGED: ["ASSIGNED", "IN_PROGRESS", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["RESOLVED", "CANCELLED"],
  RESOLVED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

export function getAllowedIncidentTransitions(status: IncidentStatus): readonly IncidentStatus[] {
  return INCIDENT_ALLOWED_TRANSITIONS[status];
}

export const INCIDENT_SLA_STATES = ["ON_TRACK", "DUE_SOON", "OVERDUE", "COMPLETED"] as const;
export type IncidentSlaState = (typeof INCIDENT_SLA_STATES)[number];
export type IncidentAvailableAction = "EDIT" | "ACKNOWLEDGE" | "ESCALATE" | "ASSIGN" | "CHANGE_STATUS" | "RESOLVE" | "REOPEN" | "CLOSE" | "COMMENT" | "CANCEL";

export function calculateIncidentSla(
  status: IncidentStatus,
  slaDeadline: string | Date | null,
  now = new Date(),
): { slaState: IncidentSlaState; slaRemainingMinutes: number | null } {
  if (["RESOLVED", "CLOSED", "CANCELLED"].includes(status)) {
    return { slaState: "COMPLETED", slaRemainingMinutes: null };
  }
  if (!slaDeadline) return { slaState: "ON_TRACK", slaRemainingMinutes: null };
  const remaining = Math.ceil((new Date(slaDeadline).getTime() - now.getTime()) / 60_000);
  if (remaining < 0) return { slaState: "OVERDUE", slaRemainingMinutes: remaining };
  if (remaining <= 60) return { slaState: "DUE_SOON", slaRemainingMinutes: remaining };
  return { slaState: "ON_TRACK", slaRemainingMinutes: remaining };
}

export interface IncidentCategorySummary { id: string; key: string; name: string; description: string | null; active: boolean; }
export interface IncidentEventSummary { id: string; type: string; message: string; actorId: string | null; metadata: unknown; createdAt: string; }
export interface IncidentAssignmentSummary { id: string; assignedToId: string | null; assignedToName: string; assignedById: string | null; reason: string | null; assignedAt: string; endedAt: string | null; }
export interface IncidentSummary {
  id: string; code: string; title: string; description: string; severity: IncidentSeverity; status: IncidentStatus; electionId: string; electoralZoneId: string | null; pollingPlaceId: string | null; categoryId: string; assignedToId: string | null; assignedToName: string | null; openedAt: string; resolvedAt: string | null; closedAt: string | null; slaDeadline: string | null; acknowledgedAt: string | null; acknowledgedById: string | null; escalationLevel: number; escalatedAt: string | null; escalatedById: string | null; escalationReason: string | null; isSimulated: boolean; slaOverdue: boolean; slaState: IncidentSlaState; slaRemainingMinutes: number | null; availableActions?: IncidentAvailableAction[]; category: IncidentCategorySummary; election: Pick<ElectionSummary, "id" | "name" | "year">; electoralZone: Pick<ElectoralZoneSummary, "id" | "number" | "name"> | null; pollingPlace: Pick<PollingPlaceSummary, "id" | "name" | "city"> | null; asset?: Pick<AssetSummary, "id" | "assetTag" | "name" | "status" | "condition"> | null; events?: IncidentEventSummary[]; assignments?: IncidentAssignmentSummary[];
}
export interface IncidentDashboard { open: number; critical: number; inProgress: number; resolvedToday: number; slaOverdue: number; untriaged: number; unassigned: number; acknowledgementPending: number; dueSoon: number; bySeverity: Record<IncidentSeverity, number>; byStatus: Record<IncidentStatus, number>; meanResolutionMinutes: number | null; }
export interface IncidentQueueItem extends IncidentSummary { priorityReasons: string[]; priorityScore: number; }

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = { NEW: "Novo", TRIAGED: "Triado", ASSIGNED: "Atribuído", IN_PROGRESS: "Em atendimento", RESOLVED: "Resolvido", CLOSED: "Fechado", CANCELLED: "Cancelado" };
export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", CRITICAL: "Crítica" };
