import { apiClient } from "@eops/api-client";
import type { Paginated } from "@eops/shared/common";
import type {
  EvidenceDashboard,
  EvidenceLinkInput,
  EvidenceLinkType,
  EvidenceStatus,
  EvidenceSummary,
  EvidenceTagSummary,
  EvidenceType,
  EvidenceVersionSummary,
} from "@eops/shared/evidence";

export interface EvidenceFilters {
  type?: EvidenceType;
  status?: EvidenceStatus;
  electionId?: string;
  authorId?: string;
  tag?: string;
  linkType?: EvidenceLinkType;
  linkTargetId?: string;
  from?: string;
  to?: string;
  withoutLinks?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface EvidenceTypeRule {
  imageOnly: boolean;
  maxSizeBytes: number;
}

export interface EvidenceReferenceData {
  elections: Array<{ id: string; name: string; year: number; status: string }>;
  tags: EvidenceTagSummary[];
  storageDriver: string;
  maxUploadBytes: number;
  typeRules: Record<EvidenceType, EvidenceTypeRule>;
}

export interface EvidenceUploadInput {
  title: string;
  description?: string;
  type: EvidenceType;
  electionId?: string;
  origin?: string;
  observations?: string;
  capturedAt?: string;
  tags: string[];
  /** Vínculos no formato `TIPO:idDoRegistro`. */
  linkTokens: string[];
}

export interface EvidenceEventView {
  id: string;
  type: string;
  message: string;
  actorName: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface EvidenceIntegrityReport {
  total: number;
  available: number;
  missing: number[];
  versions: Array<{ version: number; checksum: string; available: boolean }>;
}

/** Monta o `FormData` do upload; campos vazios são omitidos. */
function buildForm(input: EvidenceUploadInput, file: File): FormData {
  const form = new FormData();
  form.append("file", file);
  form.append("title", input.title);
  form.append("type", input.type);
  if (input.description) form.append("description", input.description);
  if (input.electionId) form.append("electionId", input.electionId);
  if (input.origin) form.append("origin", input.origin);
  if (input.observations) form.append("observations", input.observations);
  if (input.capturedAt) form.append("capturedAt", input.capturedAt);
  if (input.tags.length) form.append("tags", input.tags.join(","));
  if (input.linkTokens.length) form.append("links", input.linkTokens.join(","));
  return form;
}

export const evidenceService = {
  list: (query: EvidenceFilters = {}) =>
    apiClient.get<Paginated<EvidenceSummary>>("/evidence", { query }),

  gallery: (query: EvidenceFilters = {}) =>
    apiClient.get<EvidenceSummary[]>("/evidence/gallery", { query }),

  dashboard: (electionId?: string) =>
    apiClient.get<EvidenceDashboard>("/evidence/dashboard", { query: { electionId } }),

  referenceData: () => apiClient.get<EvidenceReferenceData>("/evidence/reference-data"),

  get: (id: string) => apiClient.get<EvidenceSummary>(`/evidence/${id}`),

  timeline: (id: string) => apiClient.get<EvidenceEventView[]>(`/evidence/${id}/timeline`),

  integrity: (id: string) =>
    apiClient.get<EvidenceIntegrityReport>(`/evidence/${id}/integrity`),

  versions: (id: string) =>
    apiClient.get<EvidenceVersionSummary[]>(`/evidence/${id}/versions`),

  /** Conteúdo binário da versão corrente, usado em miniaturas e no modal. */
  fileBlob: (id: string, versionId?: string) =>
    apiClient.getBlob(
      versionId ? `/evidence/${id}/versions/${versionId}/download` : `/evidence/${id}/file`,
    ),

  create: (input: EvidenceUploadInput, file: File) =>
    apiClient.postForm<EvidenceSummary>("/evidence", buildForm(input, file)),

  addVersion: (id: string, file: File, reason: string, description?: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("reason", reason);
    if (description) form.append("description", description);
    return apiClient.postForm<EvidenceSummary>(`/evidence/${id}/versions`, form);
  },

  update: (
    id: string,
    input: Partial<
      Pick<
        EvidenceUploadInput,
        "title" | "description" | "type" | "electionId" | "origin" | "observations" | "capturedAt" | "tags"
      >
    >,
  ) => apiClient.patch<EvidenceSummary, typeof input>(`/evidence/${id}`, input),

  replaceLinks: (id: string, links: EvidenceLinkInput[]) =>
    apiClient.put<EvidenceSummary, { links: EvidenceLinkInput[] }>(`/evidence/${id}/links`, {
      links,
    }),

  archive: (id: string) => apiClient.post<EvidenceSummary>(`/evidence/${id}/archive`, {}),
  restore: (id: string) => apiClient.post<EvidenceSummary>(`/evidence/${id}/restore`, {}),
  remove: (id: string) => apiClient.delete(`/evidence/${id}`),

  tags: () => apiClient.get<EvidenceTagSummary[]>("/evidence/tags"),
  createTag: (label: string) =>
    apiClient.post<EvidenceTagSummary, { label: string }>("/evidence/tags", { label }),
};
