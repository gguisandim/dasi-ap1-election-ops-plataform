import { describe, expect, it } from "vitest";
import type { DomainEvent } from "@eops/event-bus";
import { handoverAudience } from "./notification.subscriber";

const event = <K extends "shift_handover.submitted" | "shift_handover.confirmed" | "shift_handover.cancelled">(
  name: K,
  actorId: string,
): DomainEvent<K> => ({
  name,
  occurredAt: new Date("2026-10-05T12:00:00Z"),
  payload: {
    entityId: "handover-1",
    actorId,
    shiftId: "shift-1",
    shiftName: "Turno central",
    senderUserId: "sender",
    recipientUserId: "recipient",
    from: "DRAFT",
    to: "PENDING_CONFIRMATION",
    submittedAt: "2026-10-05T12:00:00.000Z",
  },
} as DomainEvent<K>);

describe("shift handover notification audience", () => {
  it("targets only the recipient when submitted", () => {
    expect(handoverAudience(event("shift_handover.submitted", "sender") as never)).toEqual(["recipient"]);
  });

  it("targets only the sender when confirmed", () => {
    expect(handoverAudience(event("shift_handover.confirmed", "recipient") as never)).toEqual(["sender"]);
  });

  it("targets the non-actor counterpart when cancelled", () => {
    expect(handoverAudience(event("shift_handover.cancelled", "sender") as never)).toEqual(["recipient"]);
  });
});
