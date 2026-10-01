import { apiClient } from "@eops/api-client";
import type { ElectoralZoneSummary, ResourceStatus } from "@eops/shared/elections";
export interface ZoneInput {
  electionId: string;
  number: number;
  name: string;
  municipality: string;
  state: string;
  status: ResourceStatus;
}
export interface ZoneDetail extends ElectoralZoneSummary {
  pollingPlaces: Array<{
    id: string;
    name: string;
    address: string;
    city: string;
    status: ResourceStatus;
    sectionCount: number;
  }>;
}
export const electoralZoneService = {
  list: (electionId = "", search = "") =>
    apiClient.get<ElectoralZoneSummary[]>("/electoral-zones", {
      query: { electionId, search },
    }),
  get: (id: string) => apiClient.get<ZoneDetail>(`/electoral-zones/${id}`),
  create: (input: ZoneInput) =>
    apiClient.post<ZoneDetail, ZoneInput>("/electoral-zones", input),
  update: (id: string, input: ZoneInput) =>
    apiClient.patch<ZoneDetail, ZoneInput>(`/electoral-zones/${id}`, input),
  remove: (id: string) => apiClient.delete(`/electoral-zones/${id}`),
};
