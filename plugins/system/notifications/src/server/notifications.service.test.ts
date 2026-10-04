import { BadRequestException, NotFoundException } from "@nestjs/common";
import { NotificationType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import type { NotificationQueryDto } from "./dto/notification.dto";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  it("lists only the current user notifications with filters and pagination", async () => {
    const prisma = {
      notification: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;
    const result = await new NotificationsService(prisma).list("user-1", {
      readState: "UNREAD" as NotificationQueryDto["readState"],
      type: NotificationType.CRITICAL,
      eventName: "incident.escalated",
      page: 2,
      pageSize: 10,
    });
    expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: "user-1", readAt: null, type: NotificationType.CRITICAL, eventName: "incident.escalated" }),
      skip: 10,
      take: 10,
    }));
    expect(result).toMatchObject({ page: 2, pageSize: 10, total: 0 });
  });

  it("rejects read operations for a notification owned by another user", async () => {
    const prisma = {
      notification: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    await expect(new NotificationsService(prisma).read("user-1", "notification-2")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns enabled-by-default preferences from the public catalog", async () => {
    const prisma = {
      notificationPreference: { findMany: vi.fn().mockResolvedValue([{ eventName: "incident.comment_added", enabled: false }]) },
    } as unknown as PrismaService;
    const preferences = await new NotificationsService(prisma).preferences("user-1");
    expect(preferences.find((item) => item.eventName === "incident.created")?.enabled).toBe(true);
    expect(preferences.find((item) => item.eventName === "incident.comment_added")?.enabled).toBe(false);
  });

  it("rejects preferences for events outside the public catalog", async () => {
    const prisma = {} as PrismaService;
    await expect(new NotificationsService(prisma).updatePreferences("user-1", {
      preferences: [{ eventName: "unknown.event", enabled: false }],
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("marks unread and read-all only inside the authenticated user's ownership", async () => {
    const prisma = {
      notification: {
        findFirst: vi.fn().mockResolvedValue({ id: "notification-1", userId: "user-1", readAt: new Date() }),
        update: vi.fn().mockResolvedValue({ id: "notification-1", readAt: null }),
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    } as unknown as PrismaService;
    const service = new NotificationsService(prisma);
    await service.unread("user-1", "notification-1");
    await service.readAll("user-1");
    expect(prisma.notification.findFirst).toHaveBeenCalledWith({ where: { id: "notification-1", userId: "user-1" } });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({ where: { userId: "user-1", readAt: null }, data: { readAt: expect.any(Date) } });
  });
});
