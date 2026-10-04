export type ShiftStatus =
  "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type ShiftAssignmentStatus =
  "SCHEDULED" | "PRESENT" | "ABSENT" | "REPLACED" | "ON_CALL";
export type CoverageStatus = "FULL" | "PARTIAL" | "CRITICAL" | "EMPTY";

export interface ShiftFilters {
  electionId?: string;
  startsFrom?: string;
  startsTo?: string;
  electoralZoneId?: string;
  pollingPlaceId?: string;
  teamId?: string;
  memberId?: string;
  status?: ShiftStatus;
  assignmentStatus?: ShiftAssignmentStatus;
}

export interface ShiftAssignment {
  id: string;
  shiftId: string;
  memberId: string;
  roleId: string | null;
  status: ShiftAssignmentStatus;
  startsAt: string;
  endsAt: string;
  presentAt: string | null;
  absenceReason: string | null;
  absenceRecordedAt: string | null;
  onCallActivatedAt: string | null;
  notes: string | null;
  member: {
    id: string;
    name: string;
    teamId: string;
    team: { id: string; name: string; code: string };
    role: { id: string; name: string };
    specialties: Array<{ specialty: { id: string; name: string } }>;
  };
  role: { id: string; name: string } | null;
}

export interface SpecialtyRequirement {
  id: string;
  specialtyId: string;
  requiredCount: number;
  specialty: { id: string; key: string; name: string };
}

export interface Shift {
  id: string;
  teamId: string;
  memberId: string | null;
  electoralZoneId: string | null;
  pollingPlaceId: string | null;
  name: string | null;
  requiredOperators: number;
  status: ShiftStatus;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  team: {
    id: string;
    name: string;
    code: string;
    electionId: string;
    election: { id: string; name: string; year: number };
  };
  member: { id: string; name: string; role: { name: string } } | null;
  electoralZone: {
    id: string;
    electionId: string;
    number: number;
    name: string;
  } | null;
  pollingPlace: {
    id: string;
    electoralZoneId: string;
    name: string;
    address: string;
  } | null;
  assignments: ShiftAssignment[];
  specialtyRequirements: SpecialtyRequirement[];
  replacements: Array<{
    id: string;
    reason: string | null;
    createdAt: string;
    originalAssignment: { member: { id: string; name: string } };
    substituteAssignment: { member: { id: string; name: string } };
    replacedBy: { id: string; name: string } | null;
  }>;
  history: Array<{
    id: string;
    action: string;
    description: string;
    createdAt: string;
    actor: { id: string; name: string } | null;
    assignment: { member: { id: string; name: string } } | null;
  }>;
  conflicts: Array<{
    id: string;
    type: "SCHEDULE_OVERLAP" | "UNAVAILABLE";
    memberId: string;
    memberName: string;
    startsAt: string;
    endsAt: string;
    message: string;
  }>;
  coverage: {
    requiredOperators: number;
    availableOperators: number;
    percentage: number;
    state: CoverageStatus;
    assigned: number;
    present: number;
    absent: number;
    onCall: number;
    specialties: Array<{
      specialtyId: string;
      specialtyName: string;
      requiredCount: number;
      assignedCount: number;
      met: boolean;
    }>;
  };
}

export interface ShiftTemplate {
  id: string;
  teamId: string;
  name: string;
  startMinute: number;
  durationMinutes: number;
  requiredOperators: number;
  electoralZoneId: string | null;
  pollingPlaceId: string | null;
  notes: string | null;
  active: boolean;
  team: { id: string; name: string; code: string; electionId: string };
  specialtyRequirements: SpecialtyRequirement[];
}

export interface ShiftReferences {
  elections: Array<{ id: string; name: string; year: number }>;
  zones: Array<{
    id: string;
    electionId: string;
    number: number;
    name: string;
  }>;
  places: Array<{ id: string; electoralZoneId: string; name: string }>;
  teams: Array<{
    id: string;
    electionId: string;
    name: string;
    code: string;
    status: string;
  }>;
  members: Array<{
    id: string;
    teamId: string;
    name: string;
    roleId: string;
    status: string;
    role: { name: string };
    specialties: Array<{
      specialty: { id: string; key: string; name: string };
    }>;
  }>;
  roles: Array<{ id: string; name: string }>;
  specialties: Array<{ id: string; key: string; name: string }>;
}

export interface ShiftsDashboard {
  today: number;
  inProgress: number;
  scheduledOperators: number;
  presentOperators: number;
  absences: number;
  replacements: number;
  onCall: number;
  insufficientCoverage: number;
  fullCoverage: number;
  partialCoverage: number;
  criticalCoverage: number;
  conflicts: number;
  attentionShifts: Shift[];
  todaysShifts: Shift[];
}
