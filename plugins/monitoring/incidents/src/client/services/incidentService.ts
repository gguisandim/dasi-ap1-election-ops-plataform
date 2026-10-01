import { apiClient } from "@eops/api-client";
import type { ElectionSummary, ElectoralZoneSummary, PollingPlaceSummary } from "@eops/shared/elections";
import type { IncidentCategorySummary, IncidentDashboard, IncidentSeverity, IncidentStatus, IncidentSummary } from "@eops/shared/incidents";
import type { Paginated } from "@eops/shared/common";
import type { AssetSummary } from "@eops/shared/inventory";

export interface IncidentFilters {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  categoryId?: string;
  electionId?: string;
  zoneId?: string;
  pollingPlaceId?: string;
  assignedToId?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface IncidentInput {
  title: string;
  description: string;
  severity: IncidentSeverity;
  electionId: string;
  electoralZoneId?: string;
  pollingPlaceId?: string;
  categoryId: string;
  assetId?: string;
  slaDeadline?: string;
}

export const incidentService = {
  list: (query: IncidentFilters = {}) => apiClient.get<Paginated<IncidentSummary>>("/incidents", { query }),
  dashboard: () => apiClient.get<IncidentDashboard>("/incidents/dashboard"),
  categories: () => apiClient.get<IncidentCategorySummary[]>("/incidents/categories"),
  get: (id: string) => apiClient.get<IncidentSummary>(`/incidents/${id}`),
  create: (input: IncidentInput) => apiClient.post<IncidentSummary, IncidentInput>("/incidents", input),
  update: (id: string, input: Partial<Pick<IncidentInput, "title" | "description" | "severity" | "categoryId" | "slaDeadline">>) =>
    apiClient.patch<IncidentSummary, typeof input>(`/incidents/${id}`, input),
  changeStatus: (id: string, status: IncidentStatus, comment?: string) =>
    apiClient.patch<IncidentSummary, { status: IncidentStatus; comment?: string }>(`/incidents/${id}/status`, { status, comment }),
  assign: (id: string, assignedToName: string, reason?: string) =>
    apiClient.post<IncidentSummary, { assignedToName: string; reason?: string }>(`/incidents/${id}/assignments`, { assignedToName, reason }),
  comment: (id: string, message: string) => apiClient.post(`/incidents/${id}/comments`, { message }),
  remove: (id: string) => apiClient.delete(`/incidents/${id}`),
  referenceData: async () => {
    const [elections, zones, places, assets] = await Promise.all([
      apiClient.get<ElectionSummary[]>("/elections"),
      apiClient.get<ElectoralZoneSummary[]>("/electoral-zones", { query: { pageSize: 100 } }).then((result) => Array.isArray(result) ? result : (result as unknown as Paginated<ElectoralZoneSummary>).items),
      apiClient.get<Paginated<PollingPlaceSummary>>("/polling-places", { query: { pageSize: 100 } }).then((result) => result.items),
      apiClient.get<Paginated<AssetSummary>>("/inventory", { query: { pageSize: 100 } }).then((result) => result.items),
    ]);
    return { elections, zones, places, assets };
  },
};
