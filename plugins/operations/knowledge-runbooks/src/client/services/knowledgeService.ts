import { apiClient } from "@eops/api-client";
import type { Paginated } from "@eops/shared/common";
import type {
  KnowledgeArticleInput,
  KnowledgeArticleKind,
  KnowledgeArticleSummary,
  KnowledgeArticleStatus,
  KnowledgeArticleVersionSummary,
  KnowledgeCategorySummary,
  KnowledgeDashboard,
  KnowledgeTagSummary,
  RunbookRecommendation,
  RunbookStepInput,
  RunbookStepSummary,
  RunbookUsageOutcome,
  RunbookUsageSummary,
} from "@eops/shared/knowledge";

export interface KnowledgeFilters {
  kind?: KnowledgeArticleKind;
  status?: KnowledgeArticleStatus;
  categoryId?: string;
  tag?: string;
  incidentCategoryKey?: string;
  incidentSeverity?: string;
  staleOnly?: boolean;
  unusedOnly?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface RecommendationQuery {
  incidentId?: string;
  categoryKey?: string;
  severity?: string;
  assetTypeKey?: string;
  text?: string;
  limit?: number;
}

export interface UsageQuery {
  articleId?: string;
  incidentId?: string;
  outcome?: RunbookUsageOutcome;
  page?: number;
  pageSize?: number;
}

export interface UsageInput {
  incidentId?: string;
  incidentCode?: string;
  outcome: RunbookUsageOutcome;
  stepsCompleted?: number;
  notes?: string;
  finishedAt?: string;
}

export interface KnowledgeReferenceData {
  categories: KnowledgeCategorySummary[];
  tags: KnowledgeTagSummary[];
  incidentCategories: Array<{ key: string; name: string }>;
  assetTypes: Array<{ key: string; name: string }>;
  incidents: Array<{ id: string; code: string; title: string; severity: string }>;
}

export interface KnowledgeMetrics {
  mostUsed: Array<{
    id: string;
    code: string;
    title: string;
    usageCount: number;
    resolvedCount: number;
    successRate: number;
    updatedAt: string;
  }>;
  outcomes: {
    total: number;
    resolved: number;
    partiallyResolved: number;
    notResolved: number;
    successRate: number;
  };
  coverage: Array<{ categoryId: string | null; name: string; runbooks: number }>;
  unused: Array<{ id: string; code: string; title: string; publishedAt: string | null }>;
  stale: KnowledgeArticleSummary[];
}

export const knowledgeService = {
  list: (query: KnowledgeFilters = {}) =>
    apiClient.get<Paginated<KnowledgeArticleSummary>>("/knowledge", { query }),

  dashboard: () => apiClient.get<KnowledgeDashboard>("/knowledge/dashboard"),

  metrics: () => apiClient.get<KnowledgeMetrics>("/knowledge/metrics"),

  referenceData: () =>
    apiClient.get<KnowledgeReferenceData>("/knowledge/reference-data"),

  get: (id: string) => apiClient.get<KnowledgeArticleSummary>(`/knowledge/${id}`),

  versions: (id: string) =>
    apiClient.get<KnowledgeArticleVersionSummary[]>(`/knowledge/${id}/versions`),

  usagesFor: (id: string) =>
    apiClient.get<RunbookUsageSummary[]>(`/knowledge/${id}/usages`),

  usages: (query: UsageQuery = {}) =>
    apiClient.get<Paginated<RunbookUsageSummary>>("/knowledge/usages", { query }),

  recommendations: (query: RecommendationQuery) =>
    apiClient.get<RunbookRecommendation[]>("/knowledge/recommendations", { query }),

  create: (input: KnowledgeArticleInput & { steps?: RunbookStepInput[] }) =>
    apiClient.post<KnowledgeArticleSummary, typeof input>("/knowledge", input),

  update: (id: string, input: Partial<KnowledgeArticleInput>) =>
    apiClient.patch<KnowledgeArticleSummary, typeof input>(`/knowledge/${id}`, input),

  replaceSteps: (id: string, steps: RunbookStepInput[]) =>
    apiClient.put<KnowledgeArticleSummary, { steps: RunbookStepInput[] }>(
      `/knowledge/${id}/steps`,
      { steps },
    ),

  publish: (id: string) => apiClient.post<KnowledgeArticleSummary>(`/knowledge/${id}/publish`, {}),
  review: (id: string) => apiClient.post<KnowledgeArticleSummary>(`/knowledge/${id}/review`, {}),
  archive: (id: string) => apiClient.post<KnowledgeArticleSummary>(`/knowledge/${id}/archive`, {}),
  remove: (id: string) => apiClient.delete(`/knowledge/${id}`),

  registerUsage: (id: string, input: UsageInput) =>
    apiClient.post<RunbookUsageSummary, UsageInput>(`/knowledge/${id}/usages`, input),

  categories: () => apiClient.get<KnowledgeCategorySummary[]>("/knowledge/categories"),

  createCategory: (input: { key: string; name: string; description?: string; color?: string }) =>
    apiClient.post<KnowledgeCategorySummary, typeof input>("/knowledge/categories", input),

  updateCategory: (
    id: string,
    input: { name?: string; description?: string; color?: string; active?: boolean },
  ) => apiClient.patch<KnowledgeCategorySummary, typeof input>(`/knowledge/categories/${id}`, input),

  tags: () =>
    apiClient.get<Array<KnowledgeTagSummary & { usageCount: number }>>("/knowledge/tags"),

  createTag: (label: string) =>
    apiClient.post<KnowledgeTagSummary, { label: string }>("/knowledge/tags", { label }),
};

export type { RunbookStepSummary };
