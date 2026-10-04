import { describe, expect, it } from "vitest";
import {
  calculateIncidentSla,
  getAllowedIncidentTransitions,
} from "./incidents";

describe("incident lifecycle contract", () => {
  it("exposes valid transitions without allowing closed incidents to reopen", () => {
    expect(getAllowedIncidentTransitions("ASSIGNED")).toEqual(["IN_PROGRESS", "RESOLVED", "CANCELLED"]);
    expect(getAllowedIncidentTransitions("CLOSED")).toEqual([]);
  });

  it("calculates on-track, due-soon, overdue and completed SLA states", () => {
    const now = new Date("2026-10-04T12:00:00.000Z");
    expect(calculateIncidentSla("NEW", "2026-10-04T14:00:00.000Z", now).slaState).toBe("ON_TRACK");
    expect(calculateIncidentSla("NEW", "2026-10-04T12:30:00.000Z", now)).toEqual({ slaState: "DUE_SOON", slaRemainingMinutes: 30 });
    expect(calculateIncidentSla("NEW", "2026-10-04T11:30:00.000Z", now)).toEqual({ slaState: "OVERDUE", slaRemainingMinutes: -30 });
    expect(calculateIncidentSla("RESOLVED", "2026-10-04T11:30:00.000Z", now)).toEqual({ slaState: "COMPLETED", slaRemainingMinutes: null });
  });
});
