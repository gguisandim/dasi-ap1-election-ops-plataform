import { apiClient } from "@eops/api-client";
import type { Paginated } from "@eops/shared/common";

export interface AuditActor { id: string; name: string; email: string; }
export interface AuditEvent {
  id: string;
  action: string;
  eventName: string | null;
  entityType: string;
  entityId: string | null;
  category: string | null;
  severity: string | null;
  correlationId: string | null;
  electionId: string | null;
  electoralZoneId: string | null;
  actorId: string | null;
  oldData: unknown;
  newData: unknown;
  metadata: unknown;
  createdAt: string;
  actor: AuditActor | null;
}
export interface AuditQuery {
  category?: string;
  severity?: string;
  eventName?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  electionId?: string;
  electoralZoneId?: string;
  correlationId?: string;
  search?: string;
  from: string;
  to: string;
  page?: number;
  pageSize?: number;
}
export interface AuditCount { key: string; count: number; }
export interface AuditSummary {
  total: number;
  today: number;
  byAction: { action: string; count: number }[];
  byCategory: AuditCount[];
  bySeverity: AuditCount[];
  topEntities: { entityType: string; count: number }[];
  topActors: { actor: AuditActor | null; count: number }[];
  restrictedCategories: string[];
}
export interface AuditFacets {
  byAction: AuditCount[];
  byCategory: AuditCount[];
  bySeverity: AuditCount[];
  byActor: { id: string; name: string | null; count: number }[];
}
export interface AuditExplorerResult extends Paginated<AuditEvent> {
  facets: AuditFacets;
  restrictedCategories: string[];
}
export interface AuditDiffEntry { field: string; before: unknown; after: unknown; }
export interface AuditDiff {
  id: string;
  eventName: string | null;
  entityType: string;
  entityId: string | null;
  changed: AuditDiffEntry[];
  unchanged: number;
  truncated: boolean;
}
export interface AuditNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  eventName: string | null;
  entityType: string | null;
  entityId: string | null;
  correlationId: string | null;
  createdAt: string;
  readAt: string | null;
}
export interface AuditCorrelation {
  correlationId: string;
  events: AuditEvent[];
  notifications: AuditNotification[];
  restrictedCategories: string[];
}
export interface AuditEntityTimeline {
  entityType: string;
  entityId: string;
  total: number;
  items: AuditEvent[];
  restrictedCategories: string[];
}
export interface AuditCategories {
  categories: AuditCount[];
  severities: AuditCount[];
  restrictedCategories: string[];
}
export interface AuditActors {
  items: { id: string; name: string | null; email: string | null; count: number }[];
  restrictedCategories: string[];
}

/** Período default do explorer: últimos 30 dias, dentro da janela máxima da API. */
export function defaultPeriod(days = 30) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export const auditService = {
  list: (query: AuditQuery) => apiClient.get<Paginated<AuditEvent> & { restrictedCategories: string[] }>("/audit", { query }),
  summary: (query: AuditQuery) => apiClient.get<AuditSummary>("/audit/summary", { query }),
  explorer: (query: AuditQuery) => apiClient.get<AuditExplorerResult>("/audit/explorer", { query }),
  categories: (query: AuditQuery) => apiClient.get<AuditCategories>("/audit/categories", { query }),
  actors: (query: AuditQuery) => apiClient.get<AuditActors>("/audit/actors", { query }),
  get: (id: string) => apiClient.get<AuditEvent>(`/audit/${id}`),
  diff: (id: string) => apiClient.get<AuditDiff>(`/audit/${id}/diff`),
  entityTimeline: (entityType: string, entityId: string) =>
    apiClient.get<AuditEntityTimeline>(`/audit/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`),
  correlation: (correlationId: string) =>
    apiClient.get<AuditCorrelation>(`/audit/correlation/${encodeURIComponent(correlationId)}`),
};
