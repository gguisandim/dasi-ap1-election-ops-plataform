import { ShiftHandoverStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@eops/security";
import {
  allowedLifecycleTransition,
  availableHandoverActions,
  normalizeReferenceIds,
} from "./shift-handovers.service";

describe("shift handover rules", () => {
  it("normalizes duplicate and blank reference ids", () => {
    expect(normalizeReferenceIds(["incident-1", " incident-1 ", "", "incident-2"])).toEqual(["incident-1", "incident-2"]);
  });

  it.each([
    [ShiftHandoverStatus.DRAFT, ShiftHandoverStatus.PENDING_CONFIRMATION, true],
    [ShiftHandoverStatus.DRAFT, ShiftHandoverStatus.CANCELLED, true],
    [ShiftHandoverStatus.PENDING_CONFIRMATION, ShiftHandoverStatus.CONFIRMED, true],
    [ShiftHandoverStatus.PENDING_CONFIRMATION, ShiftHandoverStatus.CANCELLED, true],
    [ShiftHandoverStatus.DRAFT, ShiftHandoverStatus.CONFIRMED, false],
  ])("validates lifecycle %s -> %s", (from, to, expected) => {
    expect(allowedLifecycleTransition(from, to)).toBe(expected);
  });

  it("allows the draft sender to edit, submit and cancel", () => {
    expect(availableHandoverActions({ status: ShiftHandoverStatus.DRAFT, senderUserId: "sender", recipientUserId: "recipient" } as never, "sender", [PERMISSIONS.shiftHandovers.manage])).toEqual(["edit", "submit", "cancel"]);
  });

  it("allows only the pending recipient to confirm", () => {
    expect(availableHandoverActions({ status: ShiftHandoverStatus.PENDING_CONFIRMATION, senderUserId: "sender", recipientUserId: "recipient" } as never, "recipient", [PERMISSIONS.shiftHandovers.confirm])).toEqual(["confirm"]);
  });

  it("allows the pending sender to cancel but not confirm", () => {
    expect(availableHandoverActions({ status: ShiftHandoverStatus.PENDING_CONFIRMATION, senderUserId: "sender", recipientUserId: "recipient" } as never, "sender", [PERMISSIONS.shiftHandovers.manage])).toEqual(["cancel"]);
  });

  it("exposes no mutation on terminal states", () => {
    expect(availableHandoverActions({ status: ShiftHandoverStatus.CONFIRMED, senderUserId: "sender", recipientUserId: "recipient" } as never, "sender", [PERMISSIONS.shiftHandovers.manage, PERMISSIONS.shiftHandovers.confirm])).toEqual([]);
  });
});
