export type AssignmentState = "SCHEDULED" | "PRESENT" | "ABSENT" | "REPLACED" | "ON_CALL";

export interface ScheduleInterval {
  id?: string;
  memberId: string;
  startsAt: Date;
  endsAt: Date;
  status: AssignmentState;
}

export function hasScheduleConflict(candidate: ScheduleInterval, existing: readonly ScheduleInterval[]) {
  return existing.some((assignment) =>
    assignment.id !== candidate.id &&
    assignment.memberId === candidate.memberId &&
    assignment.status !== "ABSENT" &&
    assignment.status !== "REPLACED" &&
    candidate.startsAt < assignment.endsAt &&
    assignment.startsAt < candidate.endsAt,
  );
}

export function planReplacement(
  original: ScheduleInterval & { id: string },
  substituteMemberId: string,
) {
  if (original.status === "ABSENT" || original.status === "REPLACED") {
    throw new Error("Esta alocação não pode mais ser substituída.");
  }
  if (original.memberId === substituteMemberId) {
    throw new Error("O substituto deve ser diferente do operador original.");
  }
  return {
    originalAssignmentId: original.id,
    memberId: substituteMemberId,
    startsAt: original.startsAt,
    endsAt: original.endsAt,
  };
}
