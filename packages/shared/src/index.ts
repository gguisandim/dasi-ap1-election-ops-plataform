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

export type ElectionStatus = (typeof ELECTION_STATUSES)[number];
export type ElectionType = (typeof ELECTION_TYPES)[number];
export type RoundStatus = (typeof ROUND_STATUSES)[number];
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];
export type MonitoringStatus = (typeof MONITORING_STATUSES)[number];

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
