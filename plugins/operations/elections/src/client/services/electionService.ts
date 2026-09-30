import { apiClient } from "@eops/api-client";
import type {
  ElectionStatus,
  ElectionSummary,
  ElectionType,
  RoundStatus,
} from "@eops/shared";

export interface ElectionInput {
  name: string;
  description?: string | null;
  year: number;
  type: ElectionType;
  status: ElectionStatus;
  rounds?: Array<{ roundNumber: number; date: string; status: RoundStatus }>;
}

export const electionService = {
  list: () => apiClient.get<ElectionSummary[]>("/elections"),
  get: (id: string) => apiClient.get<ElectionSummary>(`/elections/${id}`),
  create: (input: ElectionInput) =>
    apiClient.post<ElectionSummary, ElectionInput>("/elections", input),
  update: (id: string, input: Omit<ElectionInput, "rounds">) =>
    apiClient.patch<ElectionSummary, Omit<ElectionInput, "rounds">>(
      `/elections/${id}`,
      input,
    ),
  remove: (id: string) => apiClient.delete(`/elections/${id}`),
};
