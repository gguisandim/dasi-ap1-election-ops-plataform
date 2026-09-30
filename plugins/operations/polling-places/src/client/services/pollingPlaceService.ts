import { apiClient } from "@eops/api-client";
import type {
  MonitoringStatus,
  Paginated,
  PollingPlaceSummary,
  ResourceStatus,
} from "@eops/shared";
export interface PlaceQuery {
  search?: string;
  electionId?: string;
  zoneId?: string;
  municipality?: string;
  status?: MonitoringStatus;
  page?: number;
  pageSize?: number;
}
export interface PlaceInput {
  electoralZoneId: string;
  name: string;
  address: string;
  district: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
  status: ResourceStatus;
  monitoringStatus: MonitoringStatus;
}
export interface PlaceDetail extends PollingPlaceSummary {
  sections: Array<{
    id: string;
    number: number;
    registeredVoters: number;
    status: ResourceStatus;
  }>;
}
export const pollingPlaceService = {
  list: (query: PlaceQuery) =>
    apiClient.get<Paginated<PollingPlaceSummary>>("/polling-places", { query }),
  map: (query: PlaceQuery) =>
    apiClient.get<PollingPlaceSummary[]>("/polling-places/map", { query }),
  get: (id: string) => apiClient.get<PlaceDetail>(`/polling-places/${id}`),
  create: (input: PlaceInput) =>
    apiClient.post<PlaceDetail, PlaceInput>("/polling-places", input),
  update: (id: string, input: PlaceInput) =>
    apiClient.patch<PlaceDetail, PlaceInput>(`/polling-places/${id}`, input),
  remove: (id: string) => apiClient.delete(`/polling-places/${id}`),
};
