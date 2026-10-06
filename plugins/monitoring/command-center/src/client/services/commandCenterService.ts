import { apiClient } from "@eops/api-client";
import type {
  AttentionResponse,
  ContinuitySection,
  LogisticsSection,
  OperationalScopeInput,
  OperationalSummary,
  OperationalZoneSituation,
  SavedView,
  SavedViewInput,
  SnapshotComparison,
  SnapshotDetail,
  SnapshotSummary,
  WorkforceSection,
} from "../../types";

export const commandCenterService = {
  /** Pleitos disponíveis: API pública do plugin de eleições. */
  elections: () =>
    apiClient.get<Array<{ id: string; name: string }>>("/elections"),
  /** Sessão atual: API pública de autenticação. */
  currentUser: () =>
    apiClient.get<{ permissions: string[] }>("/auth/me"),
  summary: (scope: OperationalScopeInput = {}) =>
    apiClient.get<OperationalSummary>("/command-center/summary", { query: scope }),
  attention: (scope: OperationalScopeInput = {}) =>
    apiClient.get<AttentionResponse>("/command-center/attention", { query: scope }),
  zones: (scope: OperationalScopeInput = {}) =>
    apiClient.get<{
      generatedAt: string;
      zones: OperationalZoneSituation[];
    }>("/command-center/zones", { query: scope }),
  workforce: (scope: OperationalScopeInput = {}) =>
    apiClient.get<WorkforceSection>("/command-center/workforce", { query: scope }),
  logistics: (scope: OperationalScopeInput = {}) =>
    apiClient.get<LogisticsSection>("/command-center/logistics", { query: scope }),
  continuity: (scope: OperationalScopeInput = {}) =>
    apiClient.get<ContinuitySection>("/command-center/continuity", { query: scope }),

  views: () => apiClient.get<SavedView[]>("/command-center/views"),
  createView: (input: SavedViewInput) =>
    apiClient.post<SavedView>("/command-center/views", input),
  updateView: (id: string, input: Partial<SavedViewInput>) =>
    apiClient.patch<SavedView>(`/command-center/views/${id}`, input),
  removeView: (id: string) => apiClient.delete<{ id: string }>(`/command-center/views/${id}`),

  snapshots: (query: OperationalScopeInput & { page?: number; pageSize?: number } = {}) =>
    apiClient.get<{
      items: SnapshotSummary[];
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    }>("/command-center/snapshots", { query }),
  snapshot: (id: string) =>
    apiClient.get<SnapshotDetail>(`/command-center/snapshots/${id}`),
  compareSnapshot: (id: string) =>
    apiClient.get<SnapshotComparison>(`/command-center/snapshots/${id}/compare`),
  createSnapshot: (input: { name: string; description?: string } & OperationalScopeInput) =>
    apiClient.post<SnapshotDetail>("/command-center/snapshots", input),
};

export const SOURCE_ORDER = [
  "INCIDENT",
  "TRANSMISSION",
  "PREPARATION",
  "SHIFT_COVERAGE",
  "FIELD_DISPATCH",
  "SHIFT_HANDOVER",
  "ROUTE",
  "ASSET",
  "RESOURCE_REQUEST",
] as const;

export function formatAge(ageSeconds: number): string {
  if (ageSeconds < 60) return `${ageSeconds}s`;
  const minutes = Math.floor(ageSeconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
