export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export const ELECTION_STATUSES = [
  "PLANNING",
  "PREPARATION",
  "IN_PROGRESS",
  "FINISHED",
  "ARCHIVED",
] as const;
export const ELECTION_TYPES = [
  "GENERAL",
  "MUNICIPAL",
  "SUPPLEMENTARY",
  "REFERENDUM",
] as const;
export const ROUND_STATUSES = [
  "SCHEDULED",
  "IN_PROGRESS",
  "FINISHED",
  "CANCELLED",
] as const;
export const RESOURCE_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const MONITORING_STATUSES = [
  "NORMAL",
  "ATTENTION",
  "CRITICAL",
  "OFFLINE",
] as const;
export const INCIDENT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const INCIDENT_STATUSES = [
  "NEW",
  "TRIAGED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
] as const;
export const ASSET_STATUSES = ["AVAILABLE", "ALLOCATED", "IN_TRANSIT", "IN_USE", "MAINTENANCE", "LOST", "RETIRED"] as const;
export const ASSET_CONDITIONS = ["GOOD", "ATTENTION", "DAMAGED", "UNAVAILABLE"] as const;

export type ElectionStatus = (typeof ELECTION_STATUSES)[number];
export type ElectionType = (typeof ELECTION_TYPES)[number];
export type RoundStatus = (typeof ROUND_STATUSES)[number];
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];
export type MonitoringStatus = (typeof MONITORING_STATUSES)[number];
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export type AssetStatus = (typeof ASSET_STATUSES)[number];
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];

export interface ElectionRound {
  id: string;
  electionId: string;
  roundNumber: number;
  date: string;
  status: RoundStatus;
}

export interface ElectionSummary {
  id: string;
  name: string;
  description: string | null;
  year: number;
  type: ElectionType;
  status: ElectionStatus;
  rounds: ElectionRound[];
  zoneCount: number;
  pollingPlaceCount: number;
  sectionCount: number;
}

export interface ElectoralZoneSummary {
  id: string;
  electionId: string;
  number: number;
  name: string;
  municipality: string;
  state: string;
  status: ResourceStatus;
  election: Pick<ElectionSummary, "id" | "name" | "year">;
  pollingPlaceCount: number;
  sectionCount: number;
}

export interface PollingPlaceSummary {
  id: string;
  electoralZoneId: string;
  name: string;
  address: string;
  district: string;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  status: ResourceStatus;
  monitoringStatus: MonitoringStatus;
  electoralZone: Pick<
    ElectoralZoneSummary,
    "id" | "number" | "name" | "municipality"
  > & { election: Pick<ElectionSummary, "id" | "name"> };
  sectionCount: number;
  registeredVoters: number;
  activeIncidentCount?: number;
  assetCount?: number;
}

export interface PollingSectionSummary {
  id: string;
  pollingPlaceId: string;
  number: number;
  registeredVoters: number;
  status: ResourceStatus;
  pollingPlace: Pick<PollingPlaceSummary, "id" | "name"> & {
    electoralZone: PollingPlaceSummary["electoralZone"];
  };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface IncidentCategorySummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  active: boolean;
}

export interface IncidentEventSummary {
  id: string;
  type: string;
  message: string;
  actorId: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface IncidentSummary {
  id: string;
  code: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  electionId: string;
  electoralZoneId: string | null;
  pollingPlaceId: string | null;
  categoryId: string;
  assignedToId: string | null;
  assignedToName: string | null;
  openedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  slaDeadline: string | null;
  isSimulated: boolean;
  slaOverdue: boolean;
  category: IncidentCategorySummary;
  election: Pick<ElectionSummary, "id" | "name" | "year">;
  electoralZone: Pick<ElectoralZoneSummary, "id" | "number" | "name"> | null;
  pollingPlace: Pick<PollingPlaceSummary, "id" | "name" | "city"> | null;
  asset?: Pick<AssetSummary, "id" | "assetTag" | "name" | "status" | "condition"> | null;
  events?: IncidentEventSummary[];
}

export interface IncidentDashboard {
  open: number;
  critical: number;
  inProgress: number;
  resolvedToday: number;
  slaOverdue: number;
}

export interface AssetTypeSummary { id: string; key: string; name: string; description: string | null; active: boolean; }
export interface AssetMovementSummary {
  id: string; assetId: string; originLabel: string; destinationLabel: string; responsibleName: string;
  reason: string; statusBefore: AssetStatus; statusAfter: AssetStatus; movedAt: string;
}
export interface AssetSummary {
  id: string; assetTag: string; name: string; typeId: string; serialNumber: string | null; manufacturer: string | null;
  model: string | null; status: AssetStatus; condition: AssetCondition; electoralZoneId: string | null; pollingPlaceId: string | null;
  type: AssetTypeSummary; electoralZone: Pick<ElectoralZoneSummary, "id" | "number" | "name" | "municipality"> | null;
  pollingPlace: Pick<PollingPlaceSummary, "id" | "name" | "city"> | null; movements?: AssetMovementSummary[];
  incidents?: Array<Pick<IncidentSummary, "id" | "code" | "title" | "severity" | "status">>;
}
export interface AssetDashboard { total: number; unavailable: number; maintenance: number; inTransit: number; allocated: number; }
export type UserStatus = "ACTIVE" | "INACTIVE" | "LOCKED";
export interface CurrentUser { id: string; name: string; email: string; status: UserStatus; roles: string[]; permissions: string[]; }
export interface RoleSummary { id: string; key: string; name: string; description: string | null; permissions: Array<{ permission: { id: string; key: string; description: string } }>; }
export interface UserSummary { id: string; name: string; email: string; status: UserStatus; roles: Array<{ role: RoleSummary }>; createdAt: string; updatedAt: string; }
export type SimulationStatus = "DRAFT" | "RUNNING" | "PAUSED" | "FINISHED" | "CANCELLED";
export type FailureProbability = "LOW" | "MEDIUM" | "HIGH";
export interface SimulationEventSummary { id: string; eventType: string; title: string; description: string | null; offsetSeconds: number; incidentId: string | null; assetId: string | null; pollingPlaceId: string | null; incident?: { code: string; status: IncidentStatus } | null; asset?: { assetTag: string; name: string } | null; pollingPlace?: { name: string } | null; }
export interface SimulationSummary { id: string; name: string; electionId: string; status: SimulationStatus; speed: number; probability: FailureProbability; connectivity: boolean; equipment: boolean; transmission: boolean; logistics: boolean; applyToOperations: boolean; elapsedSeconds: number; startedAt: string | null; endedAt: string | null; election: { id: string; name: string }; events?: SimulationEventSummary[]; _count?: { events: number; incidents: number }; }

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  AVAILABLE: "Disponível", ALLOCATED: "Alocado", IN_TRANSIT: "Em trânsito", IN_USE: "Em uso",
  MAINTENANCE: "Manutenção", LOST: "Extraviado", RETIRED: "Baixado",
};
export const ASSET_CONDITION_LABELS: Record<AssetCondition, string> = {
  GOOD: "Bom", ATTENTION: "Atenção", DAMAGED: "Danificado", UNAVAILABLE: "Indisponível",
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  NEW: "Novo",
  TRIAGED: "Triado",
  ASSIGNED: "Atribuído",
  IN_PROGRESS: "Em atendimento",
  RESOLVED: "Resolvido",
  CLOSED: "Fechado",
  CANCELLED: "Cancelado",
};

export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export const STATUS_LABELS: Record<
  ElectionStatus | RoundStatus | ResourceStatus | MonitoringStatus,
  string
> = {
  PLANNING: "Planejamento",
  PREPARATION: "Preparação",
  IN_PROGRESS: "Em andamento",
  FINISHED: "Finalizado",
  ARCHIVED: "Arquivado",
  SCHEDULED: "Agendado",
  CANCELLED: "Cancelado",
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  NORMAL: "Normal",
  ATTENTION: "Atenção",
  CRITICAL: "Crítico",
  OFFLINE: "Offline",
};

export const TYPE_LABELS: Record<ElectionType, string> = {
  GENERAL: "Geral",
  MUNICIPAL: "Municipal",
  SUPPLEMENTARY: "Suplementar",
  REFERENDUM: "Referendo",
};
