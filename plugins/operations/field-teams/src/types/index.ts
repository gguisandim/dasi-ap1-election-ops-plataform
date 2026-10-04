export type TeamStatus = "ACTIVE" | "STANDBY" | "INACTIVE";
export type MemberAvailability =
  "AVAILABLE" | "ASSIGNED" | "ON_DUTY" | "UNAVAILABLE" | "OFF_DUTY";
export type AllocationStatus =
  "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type CheckType = "CHECK_IN" | "CHECK_OUT";
export const MEMBER_STATUS_LABELS: Record<MemberAvailability, string> = {
  AVAILABLE: "Disponível",
  ASSIGNED: "Alocado",
  ON_DUTY: "Em serviço",
  UNAVAILABLE: "Indisponível",
  OFF_DUTY: "Fora de serviço",
};
export interface FieldRole {
  id: string;
  key: string;
  name: string;
  description: string | null;
  active: boolean;
}
export type FieldSpecialty = FieldRole;
export interface MemberUnavailability {
  id: string;
  memberId: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  notes: string | null;
  actor: { id: string; name: string } | null;
}
export interface FieldMember {
  id: string;
  teamId: string;
  roleId: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: MemberAvailability;
  effectiveStatus?: MemberAvailability;
  role: FieldRole;
  team?: {
    id: string;
    name: string;
    code: string;
    election?: { id: string; name: string };
  };
  specialties: Array<{ specialty: FieldSpecialty }>;
  unavailability: MemberUnavailability[];
}
export interface FieldShift {
  id: string;
  teamId: string;
  memberId: string | null;
  electoralZoneId: string | null;
  pollingPlaceId: string | null;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  team: { id: string; name: string; code: string };
  member: FieldMember | null;
  electoralZone: { id: string; number: number; name: string } | null;
  pollingPlace: { id: string; name: string } | null;
}
export interface FieldAllocation {
  id: string;
  electionId: string;
  teamId: string | null;
  memberId: string | null;
  electoralZoneId: string | null;
  pollingPlaceId: string | null;
  routeId: string | null;
  activity: string | null;
  startsAt: string;
  endsAt: string | null;
  status: AllocationStatus;
  notes: string | null;
  team: { id: string; name: string; code: string } | null;
  member: FieldMember | null;
  electoralZone: { id: string; number: number; name: string } | null;
  pollingPlace: { id: string; name: string } | null;
}
export interface FieldCheck {
  id: string;
  memberId: string;
  electoralZoneId: string | null;
  pollingPlaceId: string | null;
  type: CheckType;
  occurredAt: string;
  notes: string | null;
  member: FieldMember;
  electoralZone: { id: string; number: number; name: string } | null;
  pollingPlace: { id: string; name: string } | null;
}
export interface TeamCapability {
  id: string;
  key: string;
  name: string;
  memberCount: number;
  members: Array<{ id: string; name: string; status: MemberAvailability }>;
}
export interface FieldTeam {
  id: string;
  name: string;
  code: string;
  electionId: string;
  responsibleName: string;
  status: TeamStatus;
  notes: string | null;
  election: { id: string; name: string; year: number };
  members: FieldMember[];
  allocations: FieldAllocation[];
}
export interface FieldDashboard {
  activeTeams: number;
  availablePeople: number;
  unavailablePeople: number;
  onDutyPeople: number;
  unallocatedPeople: number;
  peopleWithoutSpecialties: number;
  uncoveredZones: number;
  uncoveredPlaces: number;
}
export interface FieldFilters {
  electionId?: string;
  status?: TeamStatus;
  zoneId?: string;
  pollingPlaceId?: string;
}
