import type { ElectionSummary, ElectoralZoneSummary, PollingPlaceSummary } from "./elections";
import type { AssetSummary } from "./inventory";

export const INCIDENT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const INCIDENT_STATUSES = ["NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export interface IncidentCategorySummary { id: string; key: string; name: string; description: string | null; active: boolean; }
export interface IncidentEventSummary { id: string; type: string; message: string; actorId: string | null; metadata: unknown; createdAt: string; }
export interface IncidentSummary {
  id: string; code: string; title: string; description: string; severity: IncidentSeverity; status: IncidentStatus; electionId: string; electoralZoneId: string | null; pollingPlaceId: string | null; categoryId: string; assignedToId: string | null; assignedToName: string | null; openedAt: string; resolvedAt: string | null; closedAt: string | null; slaDeadline: string | null; isSimulated: boolean; slaOverdue: boolean; category: IncidentCategorySummary; election: Pick<ElectionSummary, "id" | "name" | "year">; electoralZone: Pick<ElectoralZoneSummary, "id" | "number" | "name"> | null; pollingPlace: Pick<PollingPlaceSummary, "id" | "name" | "city"> | null; asset?: Pick<AssetSummary, "id" | "assetTag" | "name" | "status" | "condition"> | null; events?: IncidentEventSummary[];
}
export interface IncidentDashboard { open: number; critical: number; inProgress: number; resolvedToday: number; slaOverdue: number; }

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = { NEW: "Novo", TRIAGED: "Triado", ASSIGNED: "Atribuído", IN_PROGRESS: "Em atendimento", RESOLVED: "Resolvido", CLOSED: "Fechado", CANCELLED: "Cancelado" };
export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", CRITICAL: "Crítica" };
