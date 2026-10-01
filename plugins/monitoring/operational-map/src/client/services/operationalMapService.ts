import { apiClient } from "@eops/api-client";
import type { ElectionSummary, ElectoralZoneSummary, MonitoringStatus, PollingPlaceSummary } from "@eops/shared/elections";
export interface MapFiltersValue {
  electionId: string;
  zoneId: string;
  municipality: string;
  status: "" | MonitoringStatus;
}
export const emptyMapFilters: MapFiltersValue = {
  electionId: "",
  zoneId: "",
  municipality: "",
  status: "",
};
export const operationalMapService = {
  elections: () => apiClient.get<ElectionSummary[]>("/elections"),
  zones: () => apiClient.get<ElectoralZoneSummary[]>("/electoral-zones"),
  places: (filters: MapFiltersValue) =>
    apiClient.get<PollingPlaceSummary[]>("/polling-places/map", {
      query: filters,
    }),
};
