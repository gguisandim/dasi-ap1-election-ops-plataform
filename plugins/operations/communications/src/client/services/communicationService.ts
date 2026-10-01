import { apiClient } from "@eops/api-client";
import type { Paginated } from "@eops/shared/common";
import type {
  CommunicationAudienceInput,
  CommunicationCategorySummary,
  CommunicationDashboard,
  CommunicationDeliveryStatus,
  CommunicationFormInput,
  CommunicationMetrics,
  CommunicationPriority,
  CommunicationRecipientSummary,
  CommunicationStatus,
  CommunicationSummary,
  CommunicationTagSummary,
  CommunicationTemplateSummary,
} from "@eops/shared/communications";

export interface CommunicationFilters {
  status?: CommunicationStatus;
  priority?: CommunicationPriority;
  categoryId?: string;
  electionId?: string;
  tag?: string;
  authorId?: string;
  from?: string;
  to?: string;
  urgentOnly?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface RecipientFilters {
  deliveryStatus?: CommunicationDeliveryStatus;
  audienceId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CommunicationEventView {
  id: string;
  type: string;
  message: string;
  actorId: string | null;
  actorName: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface CategoryInput {
  key: string;
  name: string;
  description?: string;
  color?: string;
}

export interface TemplateInput {
  name: string;
  description?: string;
  defaultTitle: string;
  body: string;
  priority?: CommunicationPriority;
  categoryId?: string;
  active?: boolean;
}

export interface ReferenceData {
  elections: Array<{ id: string; name: string; year: number; status: string }>;
  categories: CommunicationCategorySummary[];
  templates: CommunicationTemplateSummary[];
  tags: CommunicationTagSummary[];
  zones: Array<{ id: string; number: number; name: string; electionId: string }>;
  places: Array<{ id: string; name: string; city: string; electoralZoneId: string }>;
  teams: Array<{ id: string; name: string; code: string; electionId: string }>;
  roles: Array<{ id: string; name: string; key: string }>;
  users: Array<{ id: string; name: string; email: string }>;
}

export interface AudienceReplacement {
  audiences: CommunicationAudienceInput[];
}

export const communicationService = {
  list: (query: CommunicationFilters = {}) =>
    apiClient.get<Paginated<CommunicationSummary>>("/communications", { query }),

  dashboard: (electionId?: string) =>
    apiClient.get<CommunicationDashboard>("/communications/dashboard", {
      query: { electionId },
    }),

  get: (id: string) => apiClient.get<CommunicationSummary>(`/communications/${id}`),

  metrics: (id: string) =>
    apiClient.get<CommunicationMetrics>(`/communications/${id}/metrics`),

  timeline: (id: string) =>
    apiClient.get<CommunicationEventView[]>(`/communications/${id}/timeline`),

  recipients: (id: string, query: RecipientFilters = {}) =>
    apiClient.get<Paginated<CommunicationRecipientSummary>>(
      `/communications/${id}/recipients`,
      { query },
    ),

  pendingForMe: () =>
    apiClient.get<CommunicationRecipientSummary[]>("/communications/pending"),

  inbox: () => apiClient.get<CommunicationRecipientSummary[]>("/communications/inbox"),

  create: (input: CommunicationFormInput & { publish?: boolean }) =>
    apiClient.post<CommunicationSummary, typeof input>("/communications", input),

  update: (
    id: string,
    input: Partial<
      Pick<
        CommunicationFormInput,
        "title" | "content" | "priority" | "categoryId" | "observations" | "expiresAt" | "tags"
      >
    >,
  ) => apiClient.patch<CommunicationSummary, typeof input>(`/communications/${id}`, input),

  replaceAudiences: (id: string, input: AudienceReplacement) =>
    apiClient.put<CommunicationSummary, AudienceReplacement>(
      `/communications/${id}/audiences`,
      input,
    ),

  publish: (id: string, note?: string) =>
    apiClient.post<CommunicationSummary, { note?: string }>(`/communications/${id}/publish`, {
      note,
    }),

  schedule: (id: string, scheduledAt: string, reason?: string) =>
    apiClient.post<CommunicationSummary, { scheduledAt: string; reason?: string }>(
      `/communications/${id}/schedule`,
      { scheduledAt, reason },
    ),

  cancel: (id: string, reason?: string) =>
    apiClient.post<CommunicationSummary, { reason?: string }>(`/communications/${id}/cancel`, {
      reason,
    }),

  archive: (id: string) => apiClient.post<CommunicationSummary>(`/communications/${id}/archive`, {}),

  remove: (id: string) => apiClient.delete(`/communications/${id}`),

  syncRecipients: (id: string) =>
    apiClient.post<{ created: number; removed: number; total: number }>(
      `/communications/${id}/recipients/sync`,
      {},
    ),

  markRead: (communicationId: string, recipientId: string) =>
    apiClient.post<CommunicationRecipientSummary>(
      `/communications/${communicationId}/recipients/${recipientId}/read`,
      {},
    ),

  confirm: (communicationId: string, recipientId: string, note?: string) =>
    apiClient.post<CommunicationRecipientSummary, { note?: string }>(
      `/communications/${communicationId}/recipients/${recipientId}/confirm`,
      { note },
    ),

  categories: () =>
    apiClient.get<CommunicationCategorySummary[]>("/communications/categories"),

  createCategory: (input: CategoryInput) =>
    apiClient.post<CommunicationCategorySummary, CategoryInput>(
      "/communications/categories",
      input,
    ),

  updateCategory: (id: string, input: Partial<CategoryInput> & { active?: boolean }) =>
    apiClient.patch<CommunicationCategorySummary, typeof input>(
      `/communications/categories/${id}`,
      input,
    ),

  tags: () =>
    apiClient.get<Array<CommunicationTagSummary & { usageCount: number }>>(
      "/communications/tags",
    ),

  createTag: (label: string) =>
    apiClient.post<CommunicationTagSummary, { label: string }>("/communications/tags", { label }),

  templates: () =>
    apiClient.get<CommunicationTemplateSummary[]>("/communications/templates"),

  createTemplate: (input: TemplateInput) =>
    apiClient.post<CommunicationTemplateSummary, TemplateInput>(
      "/communications/templates",
      input,
    ),

  updateTemplate: (id: string, input: Partial<TemplateInput>) =>
    apiClient.patch<CommunicationTemplateSummary, typeof input>(
      `/communications/templates/${id}`,
      input,
    ),

  removeTemplate: (id: string) => apiClient.delete(`/communications/templates/${id}`),

  referenceData: (electionId?: string) =>
    apiClient.get<ReferenceData>("/communications/reference-data", { query: { electionId } }),
};
