import { apiClient } from "@eops/api-client";
import type { PollingSectionSummary, ResourceStatus } from "@eops/shared";
export interface SectionInput {
  pollingPlaceId: string;
  number: number;
  registeredVoters: number;
  status: ResourceStatus;
}
export const pollingSectionService = {
  list: (pollingPlaceId = "") =>
    apiClient.get<PollingSectionSummary[]>("/polling-sections", {
      query: { pollingPlaceId },
    }),
  get: (id: string) =>
    apiClient.get<PollingSectionSummary>(`/polling-sections/${id}`),
  create: (input: SectionInput) =>
    apiClient.post<PollingSectionSummary, SectionInput>(
      "/polling-sections",
      input,
    ),
  update: (id: string, input: SectionInput) =>
    apiClient.patch<PollingSectionSummary, SectionInput>(
      `/polling-sections/${id}`,
      input,
    ),
  remove: (id: string) => apiClient.delete(`/polling-sections/${id}`),
};
