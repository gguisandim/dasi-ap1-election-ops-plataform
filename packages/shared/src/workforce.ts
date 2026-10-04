export type WorkforceAvailability =
  "AVAILABLE" | "ASSIGNED" | "ON_DUTY" | "UNAVAILABLE" | "OFF_DUTY";

export type CoverageState = "FULL" | "PARTIAL" | "CRITICAL" | "EMPTY";

export interface SpecialtyCoverage {
  specialtyId: string;
  specialtyName: string;
  requiredCount: number;
  assignedCount: number;
  met: boolean;
}

export interface ShiftCoverage {
  requiredOperators: number;
  availableOperators: number;
  percentage: number;
  state: CoverageState;
  assigned: number;
  present: number;
  absent: number;
  onCall: number;
  specialties: SpecialtyCoverage[];
}

export interface WorkforceShiftSummary {
  id: string;
  name: string | null;
  teamId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  requiredOperators: number;
  coverage: ShiftCoverage;
}
