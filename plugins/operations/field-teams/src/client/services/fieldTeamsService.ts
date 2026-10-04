import { apiClient } from "@eops/api-client";
import type {
  ElectionSummary,
  ElectoralZoneSummary,
  PollingPlaceSummary,
} from "@eops/shared/elections";
import type { Paginated } from "@eops/shared/common";
import type {
  AllocationStatus,
  CheckType,
  FieldAllocation,
  FieldCheck,
  FieldDashboard,
  FieldFilters,
  FieldMember,
  FieldRole,
  FieldSpecialty,
  FieldTeam,
  MemberAvailability,
  MemberUnavailability,
  TeamCapability,
  TeamStatus,
} from "../../types";
import type { WorkforceShiftSummary } from "@eops/shared/workforce";

export const fieldTeamsService = {
  teams: (query: FieldFilters = {}) =>
    apiClient.get<FieldTeam[]>("/field-teams", { query }),
  dashboard: (query: FieldFilters = {}) =>
    apiClient.get<FieldDashboard>("/field-teams/dashboard", { query }),
  team: (id: string) => apiClient.get<FieldTeam>(`/field-teams/${id}`),
  createTeam: (input: {
    name: string;
    code: string;
    electionId: string;
    responsibleName: string;
    status?: TeamStatus;
    notes?: string;
  }) => apiClient.post<FieldTeam>("/field-teams", input),
  updateTeam: (
    id: string,
    input: Partial<{
      name: string;
      responsibleName: string;
      status: TeamStatus;
      notes: string;
    }>,
  ) => apiClient.patch<FieldTeam>(`/field-teams/${id}`, input),
  members: (query: { teamId?: string; status?: MemberAvailability } = {}) =>
    apiClient.get<FieldMember[]>("/field-teams/members", { query }),
  member: (id: string) =>
    apiClient.get<FieldMember>(`/field-teams/members/${id}`),
  availability: (
    query: { teamId?: string; startsAt?: string; endsAt?: string } = {},
  ) => apiClient.get<FieldMember[]>("/field-teams/availability", { query }),
  capabilities: (teamId: string) =>
    apiClient.get<TeamCapability[]>(`/field-teams/${teamId}/capabilities`),
  createMember: (input: {
    teamId: string;
    roleId: string;
    name: string;
    phone?: string;
    email?: string;
    status?: MemberAvailability;
    specialtyIds?: string[];
  }) => apiClient.post<FieldMember>("/field-teams/members", input),
  updateMember: (
    id: string,
    input: Partial<{
      teamId: string;
      roleId: string;
      name: string;
      phone: string;
      email: string;
      status: MemberAvailability;
      specialtyIds: string[];
    }>,
  ) => apiClient.patch<FieldMember>(`/field-teams/members/${id}`, input),
  roles: () => apiClient.get<FieldRole[]>("/field-teams/roles"),
  specialties: () =>
    apiClient.get<FieldSpecialty[]>("/field-teams/specialties"),
  createRole: (input: { key: string; name: string; description?: string }) =>
    apiClient.post<FieldRole>("/field-teams/roles", input),
  createSpecialty: (input: {
    key: string;
    name: string;
    description?: string;
  }) => apiClient.post<FieldSpecialty>("/field-teams/specialties", input),
  upcomingShifts: (
    query: {
      teamId?: string;
      memberId?: string;
      startsFrom?: string;
      startsTo?: string;
    } = {},
  ) => apiClient.get<WorkforceShiftSummary[]>("/shifts", { query }),
  createUnavailability: (
    memberId: string,
    input: { startsAt: string; endsAt: string; reason: string; notes?: string },
  ) =>
    apiClient.post<MemberUnavailability>(
      `/field-teams/members/${memberId}/unavailability`,
      input,
    ),
  updateUnavailability: (
    memberId: string,
    periodId: string,
    input: Partial<{
      startsAt: string;
      endsAt: string;
      reason: string;
      notes: string;
    }>,
  ) =>
    apiClient.patch<MemberUnavailability>(
      `/field-teams/members/${memberId}/unavailability/${periodId}`,
      input,
    ),
  removeUnavailability: (memberId: string, periodId: string) =>
    apiClient.delete<{ id: string; removed: boolean }>(
      `/field-teams/members/${memberId}/unavailability/${periodId}`,
    ),
  allocations: (query: FieldFilters = {}) =>
    apiClient.get<FieldAllocation[]>("/field-teams/allocations", { query }),
  createAllocation: (input: {
    electionId: string;
    teamId?: string;
    memberId?: string;
    electoralZoneId?: string;
    pollingPlaceId?: string;
    routeId?: string;
    activity?: string;
    startsAt: string;
    endsAt?: string;
    status?: AllocationStatus;
    notes?: string;
  }) => apiClient.post<FieldAllocation>("/field-teams/allocations", input),
  checks: (query: FieldFilters = {}) =>
    apiClient.get<FieldCheck[]>("/field-teams/checks", { query }),
  createCheck: (input: {
    memberId: string;
    electoralZoneId?: string;
    pollingPlaceId?: string;
    type: CheckType;
    occurredAt?: string;
    notes?: string;
  }) => apiClient.post<FieldCheck>("/field-teams/checks", input),
  references: async () => {
    const [elections, zones, places, routes] = await Promise.all([
      apiClient.get<ElectionSummary[]>("/elections"),
      apiClient.get<ElectoralZoneSummary[]>("/electoral-zones"),
      apiClient
        .get<Paginated<PollingPlaceSummary>>("/polling-places", {
          query: { pageSize: 100 },
        })
        .then((result) => result.items),
      apiClient.get<
        Array<{
          id: string;
          code: string;
          name: string;
          electionId: string;
          electoralZoneId: string;
        }>
      >("/routes"),
    ]);
    return { elections, zones, places, routes };
  },
};
