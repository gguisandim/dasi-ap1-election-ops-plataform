import { apiClient } from "@eops/api-client";
import type { CurrentUser } from "@eops/shared/auth";
import type { ElectionSummary, ElectoralZoneSummary, PollingPlaceSummary } from "@eops/shared/elections";
import type { Paginated } from "@eops/shared/common";
import type { AlertFilters, AlertStatus, AttemptResult, CircuitInput, ConnectivityHistory, ConnectivityStatus, FailoverInput, PointSla, RecoveryInput, SlaOverview, SlaQuery, TransmissionAlert, TransmissionAnalytics, TransmissionCircuit, TransmissionCorrelation, TransmissionDashboard, TransmissionFailover, TransmissionFilters, TransmissionInput, TransmissionNoc, TransmissionPoint, TransmissionProvider, TransmissionProviderInput, TransmissionStateTransition } from "../types";

export const transmissionService = {
  list: (query: TransmissionFilters = {}) => apiClient.get<TransmissionPoint[]>("/transmission", { query }),
  queue: (query: TransmissionFilters = {}) => apiClient.get<TransmissionPoint[]>("/transmission/queue", { query }),
  dashboard: (query: TransmissionFilters = {}) => apiClient.get<TransmissionDashboard>("/transmission/dashboard", { query }),
  noc: (query: TransmissionFilters = {}) => apiClient.get<TransmissionNoc>("/transmission/noc", { query }),
  alerts: (query: AlertFilters = {}) => apiClient.get<TransmissionAlert[]>("/transmission/alerts", { query }),
  get: (id: string) => apiClient.get<TransmissionPoint>(`/transmission/${id}`),
  connectivityHistory: (id: string) => apiClient.get<ConnectivityHistory>(`/transmission/${id}/connectivity-history`),
  create: (input: TransmissionInput) => apiClient.post<TransmissionPoint, TransmissionInput>("/transmission", input),
  update: (id: string, input: Partial<TransmissionInput>) => apiClient.patch<TransmissionPoint, typeof input>(`/transmission/${id}`, input),
  connectivity: (id: string, input: { connectivity: ConnectivityStatus; latencyMs?: number; checkedAt?: string; connectionMethod?: string; reason?: string }) => apiClient.patch<TransmissionPoint>(`/transmission/${id}/connectivity`, input),
  attempt: (id: string, input: { startedAt: string; endedAt: string; result: AttemptResult; error?: string }) => apiClient.post<TransmissionPoint>(`/transmission/${id}/attempts`, input),
  retry: (id: string, reason?: string) => apiClient.post<TransmissionPoint>(`/transmission/${id}/retry`, { reason }),
  retryBulk: (ids: string[], reason: string) => apiClient.post<TransmissionPoint[]>("/transmission/retry", { ids, reason }),
  updateAlert: (id: string, status: AlertStatus, notes?: string) => apiClient.patch<TransmissionAlert, { status: AlertStatus; notes?: string }>(`/transmission/alerts/${id}`, { status, notes }),

  // SLA, histórico de estado, analytics e correlação (leitura).
  sla: (query: SlaQuery = {}) => apiClient.get<SlaOverview>("/transmission/sla", { query }),
  pointSla: (id: string, query: SlaQuery = {}) => apiClient.get<PointSla>(`/transmission/${id}/sla`, { query }),
  analytics: (query: SlaQuery = {}) => apiClient.get<TransmissionAnalytics>("/transmission/analytics", { query }),
  stateHistory: (id: string, query: { circuitId?: string; from?: string; to?: string; limit?: number } = {}) => apiClient.get<TransmissionStateTransition[]>(`/transmission/${id}/state-history`, { query }),
  correlation: (query: { pointId: string; electionId?: string; from?: string; to?: string }) => apiClient.get<TransmissionCorrelation>("/transmission/correlation", { query }),

  // Provedores e circuitos.
  providers: (query: { active?: boolean } = {}) => apiClient.get<TransmissionProvider[]>("/transmission/providers", { query }),
  createProvider: (input: TransmissionProviderInput) => apiClient.post<TransmissionProvider, TransmissionProviderInput>("/transmission/providers", input),
  updateProvider: (id: string, input: Partial<TransmissionProviderInput>) => apiClient.patch<TransmissionProvider, typeof input>(`/transmission/providers/${id}`, input),
  circuits: (pointId: string) => apiClient.get<TransmissionCircuit[]>(`/transmission/${pointId}/circuits`),
  createCircuit: (pointId: string, input: CircuitInput) => apiClient.post<TransmissionCircuit, CircuitInput>(`/transmission/${pointId}/circuits`, input),
  updateCircuit: (circuitId: string, input: Partial<CircuitInput>) => apiClient.patch<TransmissionCircuit, typeof input>(`/transmission/circuits/${circuitId}`, input),

  // Failover e recuperação de conectividade.
  failovers: (pointId: string) => apiClient.get<TransmissionFailover[]>(`/transmission/${pointId}/failovers`),
  startFailover: (pointId: string, input: FailoverInput) => apiClient.post<TransmissionFailover, FailoverInput>(`/transmission/${pointId}/failover`, input),
  recoverFailover: (pointId: string, failoverId: string, input: { connectivity?: ConnectivityStatus; notes?: string } = {}) => apiClient.post<TransmissionFailover>(`/transmission/${pointId}/failover/${failoverId}/recover`, input),
  cancelFailover: (pointId: string, failoverId: string, reason?: string) => apiClient.post<TransmissionFailover>(`/transmission/${pointId}/failover/${failoverId}/cancel`, { reason }),
  recovery: (id: string, input: RecoveryInput = {}) => apiClient.post<TransmissionPoint>(`/transmission/${id}/recovery`, input),
  currentUser: () => apiClient.get<CurrentUser>("/auth/me"),
  references: async () => {
    const [elections, zones, places] = await Promise.all([
      apiClient.get<ElectionSummary[]>("/elections"),
      apiClient.get<ElectoralZoneSummary[]>("/electoral-zones"),
      apiClient.get<Paginated<PollingPlaceSummary>>("/polling-places", { query: { pageSize: 100 } }).then((result) => result.items),
    ]);
    return { elections, zones, places };
  },
};
