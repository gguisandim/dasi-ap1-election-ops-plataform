import { apiClient } from "@eops/api-client";
import type { Paginated } from "@eops/shared/common";

export interface AuditActor { id: string; name: string; email: string; }
export interface AuditEvent { id: string; action: string; eventName: string | null; entityType: string; entityId: string | null; actorId: string | null; oldData: unknown; newData: unknown; metadata: unknown; createdAt: string; actor: AuditActor | null; }
export interface AuditQuery { action?: string; eventName?: string; entityType?: string; entityId?: string; actorId?: string; search?: string; from?: string; to?: string; page?: number; pageSize?: number; }
export interface AuditSummary { total: number; today: number; byAction: { action: string; count: number }[]; topEntities: { entityType: string; count: number }[]; topActors: { actor: AuditActor | null; count: number }[]; }

export const auditService = {
  list: (query: AuditQuery) => apiClient.get<Paginated<AuditEvent>>("/audit", { query }),
  summary: (query: AuditQuery = {}) => apiClient.get<AuditSummary>("/audit/summary", { query }),
  get: (id: string) => apiClient.get<AuditEvent>(`/audit/${id}`),
};
