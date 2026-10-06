import { UserStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import { NotificationSubscriber } from "./notification.subscriber";

describe("NotificationSubscriber", () => {
  it("selects active recipients by permission and enabled preference", async () => {
    const bus = new EventBus();
    const prisma = {
      user: { findMany: vi.fn().mockResolvedValue([{ id: "assignee-1" }]) },
      notification: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    } as unknown as PrismaService;
    const subscriber = new NotificationSubscriber(bus, prisma);
    subscriber.onModuleInit();

    await bus.emit("incident.assigned", {
      entityId: "incident-1",
      actorId: "actor-1",
      code: "INC-1",
      assignedToId: "assignee-1",
      assignedToName: "Equipe Técnica",
      to: "Equipe Técnica",
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: UserStatus.ACTIVE,
        roles: { some: { role: { permissions: { some: { permission: { key: "incidents.read" } } } } } },
        notificationPreferences: { none: { eventName: "incident.assigned", enabled: false } },
      }),
      select: { id: true },
    });
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ userId: "assignee-1", eventName: "incident.assigned", entityId: "incident-1" })],
    });
  });

  it("does not persist notifications when no eligible active user exists", async () => {
    const bus = new EventBus();
    const prisma = {
      user: { findMany: vi.fn().mockResolvedValue([]) },
      notification: { createMany: vi.fn() },
    } as unknown as PrismaService;
    const subscriber = new NotificationSubscriber(bus, prisma);
    subscriber.onModuleInit();
    await bus.emit("incident.escalated", { entityId: "incident-1", actorId: "actor-1", code: "INC-1", from: 0, to: 1, reason: "SLA" });
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it("applies the directed handover audience together with RBAC and preferences", async () => {
    const bus = new EventBus();
    const prisma = {
      user: { findMany: vi.fn().mockResolvedValue([{ id: "recipient-1" }]) },
      notification: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    } as unknown as PrismaService;
    const subscriber = new NotificationSubscriber(bus, prisma);
    subscriber.onModuleInit();

    await bus.emit("shift_handover.submitted", {
      entityId: "handover-1",
      actorId: "sender-1",
      shiftId: "shift-1",
      shiftName: "Turno central",
      senderUserId: "sender-1",
      recipientUserId: "recipient-1",
      from: "DRAFT",
      to: "PENDING_CONFIRMATION",
      submittedAt: "2026-10-05T12:00:00.000Z",
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: { in: ["recipient-1"] },
        status: UserStatus.ACTIVE,
        roles: { some: { role: { permissions: { some: { permission: { key: "shift-handovers.read" } } } } } },
        notificationPreferences: { none: { eventName: "shift_handover.submitted", enabled: false } },
      }),
      select: { id: true },
    });
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ userId: "recipient-1", entityType: "ShiftHandover" })],
    });
  });
});
