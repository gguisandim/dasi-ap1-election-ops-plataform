import { apiClient } from "@eops/api-client";
import type { Shift, ShiftFilters, ShiftReferences, ShiftsDashboard } from "../../types";

export const shiftsService = {
  references: () => apiClient.get<ShiftReferences>("/shifts/references"),
  dashboard: (query: ShiftFilters = {}) => apiClient.get<ShiftsDashboard>("/shifts/dashboard", { query }),
  shifts: (query: ShiftFilters = {}) => apiClient.get<Shift[]>("/shifts", { query }),
  shift: (id: string) => apiClient.get<Shift>(`/shifts/${id}`),
  create: (input: { electionId: string; teamId: string; name: string; startsAt: string; endsAt: string; requiredOperators: number; electoralZoneId?: string; pollingPlaceId?: string; notes?: string }) => apiClient.post<Shift>("/shifts", input),
  update: (id: string, input: { name?: string; startsAt?: string; endsAt?: string; requiredOperators?: number; electoralZoneId?: string; pollingPlaceId?: string; notes?: string }) => apiClient.patch<Shift>(`/shifts/${id}`, input),
  assign: (id: string, input: { memberId: string; roleId?: string; status?: "SCHEDULED" | "ON_CALL"; notes?: string }) => apiClient.post(`/shifts/${id}/assignments`, input),
  presence: (id: string, assignmentId: string) => apiClient.post(`/shifts/${id}/assignments/${assignmentId}/presence`, {}),
  absence: (id: string, assignmentId: string, reason?: string) => apiClient.post(`/shifts/${id}/assignments/${assignmentId}/absence`, { reason }),
  activateOnCall: (id: string, assignmentId: string) => apiClient.post(`/shifts/${id}/assignments/${assignmentId}/on-call/activate`, {}),
  replace: (id: string, assignmentId: string, input: { substituteMemberId: string; roleId?: string; reason?: string }) => apiClient.post(`/shifts/${id}/assignments/${assignmentId}/replace`, input),
  start: (id: string) => apiClient.post<Shift>(`/shifts/${id}/start`, {}),
  complete: (id: string) => apiClient.post<Shift>(`/shifts/${id}/complete`, {}),
  cancel: (id: string) => apiClient.post<Shift>(`/shifts/${id}/cancel`, {}),
};
