import { apiClient } from "@eops/api-client";
import type {
  Shift,
  ShiftFilters,
  ShiftReferences,
  ShiftsDashboard,
  ShiftTemplate,
} from "../../types";

type RequirementInput = { specialtyId: string; requiredCount: number };

export const shiftsService = {
  references: () => apiClient.get<ShiftReferences>("/shifts/references"),
  dashboard: (query: ShiftFilters = {}) =>
    apiClient.get<ShiftsDashboard>("/shifts/dashboard", { query }),
  shifts: (query: ShiftFilters = {}) =>
    apiClient.get<Shift[]>("/shifts", { query }),
  shift: (id: string) => apiClient.get<Shift>(`/shifts/${id}`),
  calendar: (query: ShiftFilters = {}) =>
    apiClient.get<{
      startsFrom: string | null;
      startsTo: string | null;
      items: Shift[];
    }>("/shifts/calendar", { query }),
  coverage: (query: ShiftFilters = {}) =>
    apiClient.get<{
      startsFrom: string | null;
      startsTo: string | null;
      items: Array<{
        shiftId: string;
        name: string;
        startsAt: string;
        endsAt: string;
        status: string;
        team: Shift["team"];
        electoralZone: Shift["electoralZone"];
        pollingPlace: Shift["pollingPlace"];
        coverage: Shift["coverage"];
      }>;
    }>("/shifts/coverage", { query }),
  templates: (query: { teamId?: string; active?: boolean } = {}) =>
    apiClient.get<ShiftTemplate[]>("/shifts/templates", { query }),
  createTemplate: (input: {
    teamId: string;
    name: string;
    startMinute: number;
    durationMinutes: number;
    requiredOperators: number;
    electoralZoneId?: string;
    pollingPlaceId?: string;
    notes?: string;
    specialtyRequirements?: RequirementInput[];
  }) => apiClient.post<ShiftTemplate>("/shifts/templates", input),
  updateTemplate: (
    id: string,
    input: Partial<{
      name: string;
      startMinute: number;
      durationMinutes: number;
      requiredOperators: number;
      electoralZoneId: string;
      pollingPlaceId: string;
      notes: string;
      active: boolean;
      specialtyRequirements: RequirementInput[];
    }>,
  ) => apiClient.patch<ShiftTemplate>(`/shifts/templates/${id}`, input),
  createFromTemplate: (templateId: string, date: string) =>
    apiClient.post<Shift>("/shifts/from-template", { templateId, date }),
  create: (input: {
    electionId: string;
    teamId: string;
    name: string;
    startsAt: string;
    endsAt: string;
    requiredOperators: number;
    electoralZoneId?: string;
    pollingPlaceId?: string;
    notes?: string;
    specialtyRequirements?: RequirementInput[];
  }) => apiClient.post<Shift>("/shifts", input),
  update: (
    id: string,
    input: {
      name?: string;
      startsAt?: string;
      endsAt?: string;
      requiredOperators?: number;
      electoralZoneId?: string;
      pollingPlaceId?: string;
      notes?: string;
      specialtyRequirements?: RequirementInput[];
    },
  ) => apiClient.patch<Shift>(`/shifts/${id}`, input),
  copy: (
    id: string,
    input: { startsAt: string; endsAt: string; copyAssignments?: boolean },
  ) => apiClient.post<Shift>(`/shifts/${id}/copy`, input),
  assign: (
    id: string,
    input: {
      memberId: string;
      roleId?: string;
      status?: "SCHEDULED" | "ON_CALL";
      notes?: string;
    },
  ) => apiClient.post(`/shifts/${id}/assignments`, input),
  presence: (id: string, assignmentId: string) =>
    apiClient.post(`/shifts/${id}/assignments/${assignmentId}/presence`, {}),
  absence: (id: string, assignmentId: string, reason?: string) =>
    apiClient.post(`/shifts/${id}/assignments/${assignmentId}/absence`, {
      reason,
    }),
  activateOnCall: (id: string, assignmentId: string) =>
    apiClient.post(
      `/shifts/${id}/assignments/${assignmentId}/on-call/activate`,
      {},
    ),
  replace: (
    id: string,
    assignmentId: string,
    input: { substituteMemberId: string; roleId?: string; reason?: string },
  ) =>
    apiClient.post(`/shifts/${id}/assignments/${assignmentId}/replace`, input),
  start: (id: string) => apiClient.post<Shift>(`/shifts/${id}/start`, {}),
  complete: (id: string) => apiClient.post<Shift>(`/shifts/${id}/complete`, {}),
  cancel: (id: string) => apiClient.post<Shift>(`/shifts/${id}/cancel`, {}),
};
