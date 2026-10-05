import { apiClient } from "@eops/api-client";
import type {
  ChecklistFilters,
  ChecklistItemStatus,
  ChecklistOverviewRow,
  ChecklistTemplate,
  PreparationChecklist,
  PreparationDashboard,
  PreparationReferences,
} from "../../types";

export const preparationChecklistsService = {
  references: () => apiClient.get<PreparationReferences>("/preparation-checklists/references"),
  dashboard: (query: ChecklistFilters = {}) => apiClient.get<PreparationDashboard>("/preparation-checklists/dashboard", { query }),
  templates: (active?: boolean) => apiClient.get<ChecklistTemplate[]>("/preparation-checklists/templates", { query: { active } }),
  createTemplate: (input: { name: string; description?: string; items: Array<{ title: string; description?: string; order: number; required: boolean; evidenceRequired: boolean }> }) => apiClient.post<ChecklistTemplate>("/preparation-checklists/templates", input),
  setTemplateActive: (id: string, active: boolean) => apiClient.patch<ChecklistTemplate>(`/preparation-checklists/templates/${id}`, { active }),
  checklists: (query: ChecklistFilters = {}) => apiClient.get<PreparationChecklist[]>("/preparation-checklists", { query }),
  overview: (query: ChecklistFilters = {}) => apiClient.get<ChecklistOverviewRow[]>("/preparation-checklists/overview", { query }),
  checklist: (id: string) => apiClient.get<PreparationChecklist>(`/preparation-checklists/${id}`),
  createChecklist: (input: { electionId: string; electoralZoneId: string; pollingPlaceId: string; templateId: string; assigneeId: string; dueAt?: string }) => apiClient.post<PreparationChecklist>("/preparation-checklists", input),
  setAssignee: (id: string, assigneeId: string | null) => apiClient.patch<PreparationChecklist>(`/preparation-checklists/${id}/assignee`, { assigneeId }),
  setDueDate: (id: string, dueAt: string | null) => apiClient.patch<PreparationChecklist>(`/preparation-checklists/${id}/due-date`, { dueAt }),
  updateItem: (itemId: string, input: { status: ChecklistItemStatus; assigneeId?: string | null; observation?: string; dueAt?: string | null }) => apiClient.patch<PreparationChecklist>(`/preparation-checklists/items/${itemId}`, input),
  addEvidence: (itemId: string, input: { description: string; url: string }) => apiClient.post<PreparationChecklist>(`/preparation-checklists/items/${itemId}/evidences`, input),
  approve: (id: string) => apiClient.post<PreparationChecklist>(`/preparation-checklists/${id}/approve`, {}),
  revokeApproval: (id: string) => apiClient.post<PreparationChecklist>(`/preparation-checklists/${id}/revoke-approval`, {}),
};
