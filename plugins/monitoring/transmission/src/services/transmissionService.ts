import { apiClient } from "@eops/api-client";
import type { ElectionSummary, ElectoralZoneSummary, PollingPlaceSummary } from "@eops/shared/elections";
import type { Paginated } from "@eops/shared/common";
import type { AlertStatus, AttemptResult, ConnectivityStatus, TransmissionAlert, TransmissionDashboard, TransmissionFilters, TransmissionInput, TransmissionPoint } from "../types";

export const transmissionService = {
  list: (query: TransmissionFilters = {}) => apiClient.get<TransmissionPoint[]>("/transmission", { query }),
  queue: (query: TransmissionFilters = {}) => apiClient.get<TransmissionPoint[]>("/transmission/queue", { query }),
  dashboard: (query: TransmissionFilters = {}) => apiClient.get<TransmissionDashboard>("/transmission/dashboard", { query }),
  alerts: (query: TransmissionFilters = {}) => apiClient.get<TransmissionAlert[]>("/transmission/alerts", { query }),
  get: (id: string) => apiClient.get<TransmissionPoint>(`/transmission/${id}`),
  create: (input: TransmissionInput) => apiClient.post<TransmissionPoint, TransmissionInput>("/transmission", input),
  update: (id: string, input: Partial<TransmissionInput>) => apiClient.patch<TransmissionPoint, typeof input>(`/transmission/${id}`, input),
  connectivity: (id: string, input: { connectivity: ConnectivityStatus; latencyMs?: number; checkedAt?: string; connectionMethod?: string }) => apiClient.patch<TransmissionPoint>(`/transmission/${id}/connectivity`, input),
  attempt: (id: string, input: { startedAt: string; endedAt: string; result: AttemptResult; error?: string }) => apiClient.post<TransmissionPoint>(`/transmission/${id}/attempts`, input),
  updateAlert: (id: string, status: AlertStatus) => apiClient.patch<TransmissionAlert>(`/transmission/alerts/${id}`, { status }),
  references: async () => {
    const [elections, zones, places] = await Promise.all([
      apiClient.get<ElectionSummary[]>("/elections"),
      apiClient.get<ElectoralZoneSummary[]>("/electoral-zones"),
      apiClient.get<Paginated<PollingPlaceSummary>>("/polling-places", { query: { pageSize: 100 } }).then((result) => result.items),
    ]);
    return { elections, zones, places };
  },
};
