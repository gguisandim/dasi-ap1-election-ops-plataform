import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { FieldShiftStatus, ShiftHandoverStatus, UserStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import type { EventBus } from "@eops/event-bus";
import { ShiftHandoversService } from "./shift-handovers.service";

const shift = {
  id: "shift-1",
  name: "Turno central",
  status: FieldShiftStatus.IN_PROGRESS,
  startsAt: new Date("2026-10-05T08:00:00Z"),
  endsAt: new Date("2026-10-05T14:00:00Z"),
  electoralZoneId: "zone-1",
  pollingPlaceId: "place-1",
  team: { id: "team-1", name: "Equipe Alfa", electionId: "election-1" },
};

function setup(overrides: Record<string, unknown> = {}) {
  const record = {
    id: "handover-1",
    shiftId: shift.id,
    senderUserId: "sender-1",
    recipientUserId: "recipient-1",
    summary: "Operação estável",
    status: ShiftHandoverStatus.DRAFT,
    shift,
    incidents: [], tasks: [], assets: [], history: [],
    ...overrides,
  };
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue({ status: UserStatus.ACTIVE }) },
    fieldShift: { findUnique: vi.fn().mockResolvedValue(shift) },
    incident: { findMany: vi.fn().mockResolvedValue([]) },
    task: { findMany: vi.fn().mockResolvedValue([]) },
    asset: { findMany: vi.fn().mockResolvedValue([]) },
    shiftHandover: {
      create: vi.fn().mockResolvedValue(record),
      findUnique: vi.fn().mockResolvedValue(record),
    },
  } as unknown as PrismaService;
  const eventBus = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventBus;
  return { service: new ShiftHandoversService(prisma, eventBus), prisma, eventBus };
}

describe("ShiftHandoversService authorization and integrity", () => {
  it("derives the sender and event actor from the authenticated session", async () => {
    const { service, prisma, eventBus } = setup();
    await service.create({ shiftId: shift.id, recipientUserId: "recipient-1", summary: "Operação estável" }, "sender-1", ["shift-handovers.manage"]);
    expect(prisma.shiftHandover.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ senderUserId: "sender-1" }) }));
    expect(eventBus.emit).toHaveBeenCalledWith("shift_handover.created", expect.objectContaining({ actorId: "sender-1", senderUserId: "sender-1" }));
  });

  it("rejects a recipient equal to the authenticated sender", async () => {
    const { service } = setup();
    await expect(service.create({ shiftId: shift.id, recipientUserId: "sender-1", summary: "Resumo" }, "sender-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an inactive recipient", async () => {
    const { service, prisma } = setup();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ status: UserStatus.INACTIVE } as never);
    await expect(service.create({ shiftId: shift.id, recipientUserId: "recipient-1", summary: "Resumo" }, "sender-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an incident from a different election", async () => {
    const { service, prisma } = setup();
    vi.mocked(prisma.incident.findMany).mockResolvedValue([{ id: "incident-1", electionId: "other-election", electoralZoneId: "zone-1", pollingPlaceId: "place-1" }] as never);
    await expect(service.create({ shiftId: shift.id, recipientUserId: "recipient-1", summary: "Resumo", incidentIds: ["incident-1"] }, "sender-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects confirmation by a user other than the recipient", async () => {
    const { service } = setup({ status: ShiftHandoverStatus.PENDING_CONFIRMATION });
    await expect(service.confirm("handover-1", "intruder-1")).rejects.toBeInstanceOf(ForbiddenException);
  });
});
