export type WorkforceAvailability =
  "AVAILABLE" | "ASSIGNED" | "ON_DUTY" | "UNAVAILABLE" | "OFF_DUTY";

export type CoverageState = "FULL" | "PARTIAL" | "CRITICAL" | "EMPTY";

/**
 * Designação de turno que conta como cobertura operacional efetiva.
 *
 * `ON_CALL` só conta quando efetivamente acionado. Esta é a definição
 * compartilhada de cobertura: consumidores externos ao plugin de escalas devem
 * usar este predicado em vez de reimplementar o filtro.
 */
export function isOperationalShiftAssignment(assignment: {
  status: string;
  onCallActivatedAt?: Date | string | null;
}): boolean {
  if (assignment.status === "SCHEDULED" || assignment.status === "PRESENT")
    return true;
  return assignment.status === "ON_CALL" && Boolean(assignment.onCallActivatedAt);
}

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

/**
 * Execução operacional em campo. Field Teams é o owner de Dispatch; Tasks é o
 * owner de Task e Shifts permanece o owner de Shift.
 */
export type FieldDispatchStatus =
  | "REQUESTED"
  | "DISPATCHED"
  | "ACCEPTED"
  | "EN_ROUTE"
  | "ARRIVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export type FieldDispatchPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type CapabilityMatch = "MATCH" | "PARTIAL" | "NO_MATCH";

export type FieldOperationalState =
  | "AVAILABLE"
  | "DISPATCHED"
  | "EN_ROUTE"
  | "ON_SITE"
  | "IN_PROGRESS";

export const FIELD_DISPATCH_TERMINAL_STATUSES: readonly FieldDispatchStatus[] = [
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
];

export const FIELD_DISPATCH_TRANSITIONS: Record<
  FieldDispatchStatus,
  readonly FieldDispatchStatus[]
> = {
  REQUESTED: ["DISPATCHED", "REJECTED", "CANCELLED"],
  DISPATCHED: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["EN_ROUTE", "CANCELLED"],
  EN_ROUTE: ["ARRIVED", "CANCELLED"],
  ARRIVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};

export function canTransitionDispatch(
  from: FieldDispatchStatus,
  to: FieldDispatchStatus,
): boolean {
  return FIELD_DISPATCH_TRANSITIONS[from].includes(to);
}

export function isActiveDispatchStatus(status: FieldDispatchStatus): boolean {
  return !FIELD_DISPATCH_TERMINAL_STATUSES.includes(status);
}

export function dispatchOperationalState(
  status: FieldDispatchStatus,
): FieldOperationalState {
  if (status === "IN_PROGRESS") return "IN_PROGRESS";
  if (status === "ARRIVED") return "ON_SITE";
  if (status === "EN_ROUTE" || status === "ACCEPTED") return "EN_ROUTE";
  return "DISPATCHED";
}

export interface FieldDispatchMetrics {
  timeToAcceptMinutes: number | null;
  travelMinutes: number | null;
  timeToArrivalMinutes: number | null;
  executionMinutes: number | null;
  totalMinutes: number | null;
}

export interface FieldDispatchSummary {
  id: string;
  title: string;
  status: FieldDispatchStatus;
  priority: FieldDispatchPriority;
  capabilityMatch: CapabilityMatch | null;
  teamId: string;
  teamName: string;
  teamCode: string;
  memberId: string | null;
  memberName: string | null;
  taskId: string | null;
  taskTitle: string | null;
  incidentId: string | null;
  specialties: string[];
  requestedAt: string;
  elapsedMinutes: number;
  acceptedAt: string | null;
  completedAt: string | null;
  metrics: FieldDispatchMetrics;
}
