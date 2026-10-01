import { apiClient } from "@eops/api-client";
import type { Paginated } from "@eops/shared/common";
import type {
  RiskCategorySummary,
  RiskDashboard,
  RiskInput,
  RiskLevel,
  RiskMatrixCell,
  RiskMitigationInput,
  RiskMitigationStatus,
  RiskScaleValue,
  RiskStatus,
  RiskSummary,
} from "@eops/shared/risks";

export interface RiskFilters {
  status?: RiskStatus;
  level?: RiskLevel;
  probability?: RiskScaleValue;
  impact?: RiskScaleValue;
  categoryId?: string;
  electionId?: string;
  electoralZoneId?: string;
  pollingPlaceId?: string;
  ownerId?: string;
  responsibleId?: string;
  from?: string;
  to?: string;
  withoutMitigation?: boolean;
  withOverdueMitigation?: boolean;
  matrixProbability?: RiskScaleValue;
  matrixImpact?: RiskScaleValue;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface MaterializeInput {
  actualImpact: string;
  notes?: string;
  incidentId?: string;
  materializedAt?: string;
}

export interface RiskReferenceData {
  elections: Array<{ id: string; name: string; year: number; status: string }>;
  categories: RiskCategorySummary[];
  zones: Array<{ id: string; number: number; name: string; electionId: string }>;
  places: Array<{ id: string; name: string; city: string; electoralZoneId: string }>;
  users: Array<{ id: string; name: string; email: string }>;
  /** Incidentes abertos, usados para vincular a materialização por ID. */
  incidents: Array<{ id: string; code: string; title: string }>;
}

export interface RiskEventView {
  id: string;
  type: string;
  message: string;
  actorName: string | null;
  metadata: unknown;
  createdAt: string;
}

export const riskService = {
  list: (query: RiskFilters = {}) =>
    apiClient.get<Paginated<RiskSummary>>("/risks", { query }),

  dashboard: (electionId?: string) =>
    apiClient.get<RiskDashboard>("/risks/dashboard", { query: { electionId } }),

  matrix: (query: RiskFilters = {}) =>
    apiClient.get<RiskMatrixCell[][]>("/risks/matrix", { query }),

  referenceData: () => apiClient.get<RiskReferenceData>("/risks/reference-data"),

  get: (id: string) => apiClient.get<RiskSummary>(`/risks/${id}`),

  timeline: (id: string) => apiClient.get<RiskEventView[]>(`/risks/${id}/timeline`),

  create: (input: RiskInput & { mitigations?: RiskMitigationInput[] }) =>
    apiClient.post<RiskSummary, typeof input>("/risks", input),

  update: (id: string, input: Partial<RiskInput>) =>
    apiClient.patch<RiskSummary, typeof input>(`/risks/${id}`, input),

  replaceMitigations: (id: string, mitigations: RiskMitigationInput[]) =>
    apiClient.put<RiskSummary, { mitigations: RiskMitigationInput[] }>(
      `/risks/${id}/mitigations`,
      { mitigations },
    ),

  materialize: (id: string, input: MaterializeInput) =>
    apiClient.post<RiskSummary, MaterializeInput>(`/risks/${id}/materialize`, input),

  close: (id: string) => apiClient.post<RiskSummary>(`/risks/${id}/close`, {}),

  remove: (id: string) => apiClient.delete(`/risks/${id}`),

  categories: () => apiClient.get<RiskCategorySummary[]>("/risks/categories"),

  createCategory: (input: { key: string; name: string; description?: string; color?: string }) =>
    apiClient.post<RiskCategorySummary, typeof input>("/risks/categories", input),

  updateCategory: (
    id: string,
    input: { name?: string; description?: string; color?: string; active?: boolean },
  ) => apiClient.patch<RiskCategorySummary, typeof input>(`/risks/categories/${id}`, input),
};

export type { RiskMitigationStatus };
