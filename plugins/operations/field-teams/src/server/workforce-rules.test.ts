import { FieldShiftAssignmentStatus, MemberAvailability } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { FieldTeamsService, resolveAvailability } from "./field-teams.service";

describe("workforce availability", () => {
  it("prioritizes an overlapping unavailability period", () => {
    expect(resolveAvailability(MemberAvailability.AVAILABLE, true, [])).toBe(
      MemberAvailability.UNAVAILABLE,
    );
  });

  it("derives on-duty and assigned states from shift assignments", () => {
    expect(
      resolveAvailability(MemberAvailability.AVAILABLE, false, [
        {
          status: FieldShiftAssignmentStatus.PRESENT,
          onCallActivatedAt: null,
        },
      ]),
    ).toBe(MemberAvailability.ON_DUTY);
    expect(
      resolveAvailability(MemberAvailability.AVAILABLE, false, [
        {
          status: FieldShiftAssignmentStatus.SCHEDULED,
          onCallActivatedAt: null,
        },
      ]),
    ).toBe(MemberAvailability.ASSIGNED);
  });

  it("does not expose a second shift creation owner", () => {
    expect("createShift" in FieldTeamsService.prototype).toBe(false);
    expect("shifts" in FieldTeamsService.prototype).toBe(false);
  });
});
