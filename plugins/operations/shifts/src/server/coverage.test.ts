import { FieldShiftAssignmentStatus, MemberAvailability } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculateCoverage, countAssignmentConflicts } from "./shifts.service";

function coverage(input: {
  required: number;
  assignments?: Array<{
    memberId: string;
    status: FieldShiftAssignmentStatus;
    specialties?: string[];
    activated?: boolean;
  }>;
  requirements?: Array<{ specialtyId: string; requiredCount: number }>;
}) {
  return calculateCoverage({
    requiredOperators: input.required,
    assignments: (input.assignments ?? []).map((assignment) => ({
      memberId: assignment.memberId,
      status: assignment.status,
      onCallActivatedAt: assignment.activated ? new Date() : null,
      member: {
        specialties: (assignment.specialties ?? []).map((specialtyId) => ({
          specialtyId,
        })),
      },
    })),
    specialtyRequirements: (input.requirements ?? []).map((requirement) => ({
      ...requirement,
      specialty: { name: requirement.specialtyId },
    })),
  } as unknown as Parameters<typeof calculateCoverage>[0]);
}

describe("shift coverage", () => {
  it("reports FULL when headcount and skills are covered", () => {
    expect(
      coverage({
        required: 2,
        assignments: [
          {
            memberId: "a",
            status: FieldShiftAssignmentStatus.SCHEDULED,
            specialties: ["network"],
          },
          {
            memberId: "b",
            status: FieldShiftAssignmentStatus.PRESENT,
            specialties: ["fiber"],
          },
        ],
        requirements: [{ specialtyId: "network", requiredCount: 1 }],
      }).state,
    ).toBe("FULL");
  });

  it("reports CRITICAL for a skill gap even with sufficient headcount", () => {
    const result = coverage({
      required: 1,
      assignments: [
        { memberId: "a", status: FieldShiftAssignmentStatus.SCHEDULED },
      ],
      requirements: [{ specialtyId: "electric", requiredCount: 1 }],
    });
    expect(result.state).toBe("CRITICAL");
    expect(result.specialties[0]?.met).toBe(false);
  });

  it("distinguishes EMPTY and PARTIAL coverage", () => {
    expect(coverage({ required: 4 }).state).toBe("EMPTY");
    expect(
      coverage({
        required: 4,
        assignments: [
          { memberId: "a", status: FieldShiftAssignmentStatus.SCHEDULED },
          { memberId: "b", status: FieldShiftAssignmentStatus.SCHEDULED },
        ],
      }).state,
    ).toBe("PARTIAL");
  });

  it("counts activated on-call only", () => {
    const result = coverage({
      required: 1,
      assignments: [
        { memberId: "a", status: FieldShiftAssignmentStatus.ON_CALL },
        {
          memberId: "b",
          status: FieldShiftAssignmentStatus.ON_CALL,
          activated: true,
        },
      ],
    });
    expect(result.availableOperators).toBe(1);
    expect(result.onCall).toBe(2);
  });
});

describe("availability ownership", () => {
  it("keeps Prisma enum values compatible with shared workforce states", () => {
    expect(MemberAvailability.AVAILABLE).toBe("AVAILABLE");
  });
});

describe("dashboard conflicts", () => {
  it("counts overlapping assignments for the same member across shifts", () => {
    const assignment = (
      id: string,
      memberId: string,
      startsAt: string,
      endsAt: string,
    ) => ({
      id,
      memberId,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      status: FieldShiftAssignmentStatus.SCHEDULED,
    });
    expect(
      countAssignmentConflicts([
        {
          id: "shift-a",
          assignments: [
            assignment(
              "a",
              "member-1",
              "2026-10-04T08:00:00Z",
              "2026-10-04T12:00:00Z",
            ),
          ],
        },
        {
          id: "shift-b",
          assignments: [
            assignment(
              "b",
              "member-1",
              "2026-10-04T10:00:00Z",
              "2026-10-04T14:00:00Z",
            ),
          ],
        },
        {
          id: "shift-c",
          assignments: [
            assignment(
              "c",
              "member-2",
              "2026-10-04T10:00:00Z",
              "2026-10-04T14:00:00Z",
            ),
          ],
        },
      ]),
    ).toBe(1);
  });
});
