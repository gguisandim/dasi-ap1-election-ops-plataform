import { apiClient } from "@eops/api-client";
import type { Task, TaskFilters, TaskReferences, TasksDashboard } from "../../types";

export const tasksService = {
  references: () => apiClient.get<TaskReferences>("/tasks/references"),
  dashboard: (query: TaskFilters = {}) => apiClient.get<TasksDashboard>("/tasks/dashboard", { query }),
  tasks: (query: TaskFilters = {}) => apiClient.get<Task[]>("/tasks", { query }),
  task: (id: string) => apiClient.get<Task>(`/tasks/${id}`),
  create: (input: { title: string; description?: string; electionId: string; electoralZoneId?: string; pollingPlaceId?: string; assigneeId?: string; priority: string; dueAt?: string }) => apiClient.post<Task>("/tasks", input),
  update: (id: string, input: Record<string, unknown>) => apiClient.patch<Task>(`/tasks/${id}`, input),
  comment: (id: string, content: string) => apiClient.post(`/tasks/${id}/comments`, { content }),
  addDependency: (id: string, dependsOnId: string) => apiClient.post<Task>(`/tasks/${id}/dependencies`, { dependsOnId }),
  removeDependency: (id: string, dependsOnId: string) => apiClient.delete<Task>(`/tasks/${id}/dependencies/${dependsOnId}`),
};