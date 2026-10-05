import type {
  CapabilityMatch,
  FieldDispatchMetrics,
  FieldDispatchStatus,
} from "@eops/shared/workforce";
import { FIELD_DISPATCH_TRANSITIONS } from "@eops/shared/workforce";

export const DISPATCH_TIMESTAMP_FIELDS: Record<FieldDispatchStatus, string> = {
  REQUESTED: "requestedAt",
  DISPATCHED: "dispatchedAt",
  ACCEPTED: "acceptedAt",
  REJECTED: "rejectedAt",
  EN_ROUTE: "departedAt",
  ARRIVED: "arrivedAt",
  IN_PROGRESS: "startedAt",
  COMPLETED: "completedAt",
  CANCELLED: "cancelledAt",
};

/** Devolve a mensagem de erro da transição ou `null` quando ela é válida. */
export function dispatchTransitionError(
  from: FieldDispatchStatus,
  to: FieldDispatchStatus,
): string | null {
  if (from === to) return `A demanda já está em ${from}.`;
  if (!FIELD_DISPATCH_TRANSITIONS[from].includes(to)) {
    return `Transição inválida de ${from} para ${to}.`;
  }
  return null;
}

export interface DispatchTransitionInput {
  status: FieldDispatchStatus;
  reason?: string;
  summary?: string;
}

/** Devolve a mensagem de erro do campo obrigatório ou `null` quando está presente. */
export function dispatchRequiredFieldError(
  input: DispatchTransitionInput,
): string | null {
  const reason = input.reason?.trim();
  if (input.status === "REJECTED" || input.status === "CANCELLED") {
    if (!reason || reason.length < 3) {
      return input.status === "REJECTED"
        ? "Informe o motivo da rejeição."
        : "Informe o motivo do cancelamento.";
    }
  }
  if (input.status === "COMPLETED") {
    const summary = input.summary?.trim();
    if (!summary || summary.length < 3) {
      return "Informe o resumo da conclusão.";
    }
  }
  return null;
}

export interface DispatchTimestampSource {
  requestedAt: Date;
  dispatchedAt: Date | null;
  acceptedAt: Date | null;
  departedAt: Date | null;
  arrivedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

function minutesBetween(later: Date | null, earlier: Date | null) {
  if (!later || !earlier) return null;
  return Math.max(0, Math.round((later.getTime() - earlier.getTime()) / 60_000));
}

/**
 * Métricas operacionais derivadas dos timestamps de transição. Nada é
 * persistido: cada campo é nulo quando os timestamps de origem não existem.
 */
export function deriveDispatchMetrics(
  source: DispatchTimestampSource,
): FieldDispatchMetrics {
  return {
    timeToAcceptMinutes: minutesBetween(
      source.acceptedAt,
      source.dispatchedAt ?? source.requestedAt,
    ),
    travelMinutes: minutesBetween(source.arrivedAt, source.departedAt),
    timeToArrivalMinutes: minutesBetween(source.arrivedAt, source.acceptedAt),
    executionMinutes: minutesBetween(source.completedAt, source.startedAt),
    totalMinutes: minutesBetween(source.completedAt, source.requestedAt),
  };
}

export interface DispatchRequirement {
  specialtyId: string;
  requiredCount: number;
}

export interface CapabilityMember {
  specialtyIds: readonly string[];
}

/**
 * Compara os requisitos da demanda com as capabilities da equipe.
 * Sem requisito aplicável o resultado é nulo (não se aplica).
 */
export function evaluateCapabilityMatch(
  requirements: readonly DispatchRequirement[],
  requiredTeamSize: number | null,
  availableMembers: readonly CapabilityMember[],
): CapabilityMatch | null {
  const sizeCheck = requiredTeamSize ? 1 : 0;
  const totalChecks = requirements.length + sizeCheck;
  if (totalChecks === 0) return null;
  const metSpecialties = requirements.filter(
    (requirement) =>
      availableMembers.filter((member) =>
        member.specialtyIds.includes(requirement.specialtyId),
      ).length >= requirement.requiredCount,
  ).length;
  const metChecks =
    metSpecialties +
    (requiredTeamSize && availableMembers.length >= requiredTeamSize ? 1 : 0);
  if (metChecks === totalChecks) return "MATCH";
  if (metChecks === 0) return "NO_MATCH";
  return "PARTIAL";
}

export function elapsedMinutes(since: Date, now = new Date()) {
  return Math.max(0, Math.round((now.getTime() - since.getTime()) / 60_000));
}
