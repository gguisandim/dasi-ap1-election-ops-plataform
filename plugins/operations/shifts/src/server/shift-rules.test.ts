import { describe, expect, it } from "vitest";
import { hasScheduleConflict, planReplacement, type ScheduleInterval } from "./shift-rules";

const interval = (id: string, memberId: string, startsAt: string, endsAt: string, status: ScheduleInterval["status"] = "SCHEDULED"): ScheduleInterval => ({
  id,
  memberId,
  startsAt: new Date(startsAt),
  endsAt: new Date(endsAt),
  status,
});

describe("schedule conflict rules", () => {
  it("detects an overlapping interval for the same member", () => {
    const candidate = interval("new", "member-1", "2026-10-04T12:00:00Z", "2026-10-04T16:00:00Z");
    expect(hasScheduleConflict(candidate, [interval("old", "member-1", "2026-10-04T10:00:00Z", "2026-10-04T13:00:00Z")])).toBe(true);
  });

  it("allows adjacent intervals and assignments belonging to another member", () => {
    const candidate = interval("new", "member-1", "2026-10-04T12:00:00Z", "2026-10-04T16:00:00Z");
    expect(hasScheduleConflict(candidate, [
      interval("adjacent", "member-1", "2026-10-04T08:00:00Z", "2026-10-04T12:00:00Z"),
      interval("other", "member-2", "2026-10-04T12:30:00Z", "2026-10-04T13:30:00Z"),
    ])).toBe(false);
  });

  it("ignores absences and preserved replaced assignments", () => {
    const candidate = interval("new", "member-1", "2026-10-04T12:00:00Z", "2026-10-04T16:00:00Z");
    expect(hasScheduleConflict(candidate, [
      interval("absent", "member-1", "2026-10-04T13:00:00Z", "2026-10-04T15:00:00Z", "ABSENT"),
      interval("replaced", "member-1", "2026-10-04T13:00:00Z", "2026-10-04T15:00:00Z", "REPLACED"),
    ])).toBe(false);
  });
});

describe("assignment replacement", () => {
  it("keeps the original interval and member reference for audit history", () => {
    const original = interval("original", "member-1", "2026-10-04T12:00:00Z", "2026-10-04T16:00:00Z");
    expect(planReplacement({ ...original, id: "original" }, "member-2")).toEqual({
      originalAssignmentId: "original",
      memberId: "member-2",
      startsAt: original.startsAt,
      endsAt: original.endsAt,
    });
  });

  it("rejects replacing an assignment with itself or replacing it twice", () => {
    const original = interval("original", "member-1", "2026-10-04T12:00:00Z", "2026-10-04T16:00:00Z");
    expect(() => planReplacement({ ...original, id: "original" }, "member-1")).toThrow();
    expect(() => planReplacement({ ...original, id: "original", status: "REPLACED" }, "member-2")).toThrow();
  });
});
