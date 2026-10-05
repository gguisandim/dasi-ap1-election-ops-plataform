import { apiClient } from "@eops/api-client";
import type { CurrentUser } from "@eops/shared/auth";
import type { FieldDispatchSummary } from "@eops/shared/workforce";
import type {
  BulkTaskUpdate,
  Task,
  TaskChecklistItem,
  TaskDependencyGraph,
  TaskFilters,
  TaskLabel,
  TaskMilestone,
  TaskReferences,
  TaskSavedFilter,
  TasksDashboard,
  TaskWorkload,
} from "../../types";

export const tasksService = {
  references: () => apiClient.get<TaskReferences>("/tasks/references"),
  dashboard: (query: TaskFilters = {}) => apiClient.get<TasksDashboard>("/tasks/dashboard", { query }),
  workload: (query: TaskFilters = {}) => apiClient.get<TaskWorkload>("/tasks/workload", { query }),
  tasks: (query: TaskFilters = {}) => apiClient.get<Task[]>("/tasks", { query }),
  task: (id: string) => apiClient.get<Task>(`/tasks/${id}`),
  dependencies: (id: string) => apiClient.get<TaskDependencyGraph>(`/tasks/${id}/dependencies`),
  /** Especialidades e despachos vêm da API pública de Field Teams. */
  fieldSpecialties: () => apiClient.get<Array<{ id: string; key: string; name: string }>>("/field-teams/specialties"),
  taskDispatches: (taskId: string) => apiClient.get<FieldDispatchSummary[]>("/field-teams/dispatches", { query: { taskId } }),
  /** Usuário atual via API pública de autenticação, para gating de ações no frontend. */
  currentUser: () => apiClient.get<CurrentUser>("/auth/me"),
  create: (input: { title: string; description?: string; electionId: string; electoralZoneId?: string; pollingPlaceId?: string; assigneeId?: string; priority: string; executionMode?: string; dueAt?: string; parentId?: string }) => apiClient.post<Task>("/tasks", input),
  update: (id: string, input: Record<string, unknown>) => apiClient.patch<Task>(`/tasks/${id}`, input),
  bulkUpdate: (input: BulkTaskUpdate) => apiClient.patch<{ count: number; fields: string[] }>("/tasks/bulk", input),
  comment: (id: string, content: string) => apiClient.post(`/tasks/${id}/comments`, { content }),
  addDependency: (id: string, dependsOnId: string) => apiClient.post<Task>(`/tasks/${id}/dependencies`, { dependsOnId }),
  removeDependency: (id: string, dependsOnId: string) => apiClient.delete<Task>(`/tasks/${id}/dependencies/${dependsOnId}`),
  subtasks: (id: string) => apiClient.get<Task[]>(`/tasks/${id}/subtasks`),
  createSubtask: (id: string, input: { title: string; description?: string; priority?: string; assigneeId?: string; dueAt?: string }) => apiClient.post<Task>(`/tasks/${id}/subtasks`, input),
  addChecklistItem: (id: string, input: { title: string }) => apiClient.post<TaskChecklistItem>(`/tasks/${id}/checklist-items`, input),
  updateChecklistItem: (itemId: string, input: { title?: string; done?: boolean }) => apiClient.patch<TaskChecklistItem>(`/tasks/checklist-items/${itemId}`, input),
  deleteChecklistItem: (itemId: string) => apiClient.delete(`/tasks/checklist-items/${itemId}`),
  labels: () => apiClient.get<TaskLabel[]>("/tasks/labels"),
  createLabel: (name: string) => apiClient.post<TaskLabel>("/tasks/labels", { name }),
  deleteLabel: (id: string) => apiClient.delete(`/tasks/labels/${id}`),
  milestones: (electionId?: string) => apiClient.get<TaskMilestone[]>("/tasks/milestones", { query: { electionId } }),
  createMilestone: (input: { electionId: string; name: string; description?: string; dueAt?: string }) => apiClient.post<TaskMilestone>("/tasks/milestones", input),
  updateMilestone: (id: string, input: { name?: string; description?: string | null; dueAt?: string | null }) => apiClient.patch<TaskMilestone>(`/tasks/milestones/${id}`, input),
  savedFilters: () => apiClient.get<TaskSavedFilter[]>("/tasks/saved-filters"),
  createSavedFilter: (name: string, filters: TaskFilters) => apiClient.post<TaskSavedFilter>("/tasks/saved-filters", { name, filters }),
  deleteSavedFilter: (id: string) => apiClient.delete(`/tasks/saved-filters/${id}`),
};
