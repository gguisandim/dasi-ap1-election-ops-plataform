import { apiClient } from "@eops/api-client";
import type { FieldDispatchSummary } from "@eops/shared/workforce";
import type { Task, TaskFilters, TaskReferences, TasksDashboard } from "../../types";

export const tasksService = {
  references: () => apiClient.get<TaskReferences>("/tasks/references"),
  dashboard: (query: TaskFilters = {}) => apiClient.get<TasksDashboard>("/tasks/dashboard", { query }),
  tasks: (query: TaskFilters = {}) => apiClient.get<Task[]>("/tasks", { query }),
  task: (id: string) => apiClient.get<Task>(`/tasks/${id}`),
  /** Especialidades e despachos vêm da API pública de Field Teams. */
  fieldSpecialties: () => apiClient.get<Array<{ id: string; key: string; name: string }>>("/field-teams/specialties"),
  taskDispatches: (taskId: string) => apiClient.get<FieldDispatchSummary[]>("/field-teams/dispatches", { query: { taskId } }),
  create: (input: { title: string; description?: string; electionId: string; electoralZoneId?: string; pollingPlaceId?: string; assigneeId?: string; priority: string; executionMode?: string; dueAt?: string }) => apiClient.post<Task>("/tasks", input),
  update: (id: string, input: Record<string, unknown>) => apiClient.patch<Task>(`/tasks/${id}`, input),
  comment: (id: string, content: string) => apiClient.post(`/tasks/${id}/comments`, { content }),
  addDependency: (id: string, dependsOnId: string) => apiClient.post<Task>(`/tasks/${id}/dependencies`, { dependsOnId }),
  removeDependency: (id: string, dependsOnId: string) => apiClient.delete<Task>(`/tasks/${id}/dependencies/${dependsOnId}`),
};