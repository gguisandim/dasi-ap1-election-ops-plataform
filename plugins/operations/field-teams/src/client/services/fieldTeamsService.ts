import { apiClient } from "@eops/api-client";
import type { ElectionSummary, ElectoralZoneSummary, PollingPlaceSummary } from "@eops/shared/elections";
import type { Paginated } from "@eops/shared/common";
import type { AllocationStatus, CheckType, FieldAllocation, FieldCheck, FieldDashboard, FieldFilters, FieldMember, FieldRole, FieldShift, FieldSpecialty, FieldTeam, MemberAvailability, TeamStatus } from "../../types";

export const fieldTeamsService = {
  teams: (query: FieldFilters = {}) => apiClient.get<FieldTeam[]>("/field-teams", { query }),
  dashboard: (query: FieldFilters = {}) => apiClient.get<FieldDashboard>("/field-teams/dashboard", { query }),
  team: (id: string) => apiClient.get<FieldTeam>(`/field-teams/${id}`),
  createTeam: (input: { name: string; code: string; electionId: string; responsibleName: string; status?: TeamStatus; notes?: string }) => apiClient.post<FieldTeam>("/field-teams", input),
  updateTeam: (id: string, input: Partial<{ name: string; responsibleName: string; status: TeamStatus; notes: string }>) => apiClient.patch<FieldTeam>(`/field-teams/${id}`, input),
  members: (query: { teamId?: string; status?: MemberAvailability } = {}) => apiClient.get<FieldMember[]>("/field-teams/members", { query }),
  createMember: (input: { teamId: string; roleId: string; name: string; phone?: string; email?: string; status?: MemberAvailability; specialtyIds?: string[] }) => apiClient.post<FieldMember>("/field-teams/members", input),
  updateMember: (id: string, input: Partial<{ teamId: string; roleId: string; name: string; phone: string; email: string; status: MemberAvailability; specialtyIds: string[] }>) => apiClient.patch<FieldMember>(`/field-teams/members/${id}`, input),
  roles: () => apiClient.get<FieldRole[]>("/field-teams/roles"),
  specialties: () => apiClient.get<FieldSpecialty[]>("/field-teams/specialties"),
  createRole: (input: { key: string; name: string; description?: string }) => apiClient.post<FieldRole>("/field-teams/roles", input),
  createSpecialty: (input: { key: string; name: string; description?: string }) => apiClient.post<FieldSpecialty>("/field-teams/specialties", input),
  shifts: (query: FieldFilters = {}) => apiClient.get<FieldShift[]>("/field-teams/shifts", { query }),
  createShift: (input: { teamId: string; memberId?: string; electoralZoneId?: string; pollingPlaceId?: string; startsAt: string; endsAt: string; notes?: string }) => apiClient.post<FieldShift>("/field-teams/shifts", input),
  allocations: (query: FieldFilters = {}) => apiClient.get<FieldAllocation[]>("/field-teams/allocations", { query }),
  createAllocation: (input: { electionId: string; teamId?: string; memberId?: string; electoralZoneId?: string; pollingPlaceId?: string; routeId?: string; activity?: string; startsAt: string; endsAt?: string; status?: AllocationStatus; notes?: string }) => apiClient.post<FieldAllocation>("/field-teams/allocations", input),
  checks: (query: FieldFilters = {}) => apiClient.get<FieldCheck[]>("/field-teams/checks", { query }),
  createCheck: (input: { memberId: string; electoralZoneId?: string; pollingPlaceId?: string; type: CheckType; occurredAt?: string; notes?: string }) => apiClient.post<FieldCheck>("/field-teams/checks", input),
  references: async () => {
    const [elections, zones, places, routes] = await Promise.all([
      apiClient.get<ElectionSummary[]>("/elections"), apiClient.get<ElectoralZoneSummary[]>("/electoral-zones"),
      apiClient.get<Paginated<PollingPlaceSummary>>("/polling-places", { query: { pageSize: 100 } }).then((result) => result.items),
      apiClient.get<Array<{ id: string; code: string; name: string; electionId: string; electoralZoneId: string }>>("/routes"),
    ]);
    return { elections, zones, places, routes };
  },
};
