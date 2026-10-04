import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@eops/database";
import { NOTIFICATION_EVENT_CATALOG } from "@eops/event-bus";
import type { NotificationQueryDto, UpdateNotificationPreferencesDto } from "./dto/notification.dto";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: NotificationQueryDto) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      readAt: query.readState === "READ"
        ? { not: null }
        : query.readState === "UNREAD"
          ? null
          : undefined,
      type: query.type,
      eventName: query.eventName,
      createdAt: query.from || query.to
        ? { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined }
        : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) };
  }

  async unreadCount(userId: string) {
    return { count: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  private async owned(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) throw new NotFoundException("Notificação não encontrada.");
    return notification;
  }

  async read(userId: string, id: string) {
    const notification = await this.owned(userId, id);
    return this.prisma.notification.update({ where: { id }, data: { readAt: notification.readAt ?? new Date() } });
  }

  async unread(userId: string, id: string) {
    await this.owned(userId, id);
    return this.prisma.notification.update({ where: { id }, data: { readAt: null } });
  }

  async readAll(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }

  async preferences(userId: string) {
    const stored = await this.prisma.notificationPreference.findMany({ where: { userId } });
    const enabledByEvent = new Map(stored.map((preference) => [preference.eventName, preference.enabled]));
    return NOTIFICATION_EVENT_CATALOG.map((definition) => ({
      ...definition,
      enabled: enabledByEvent.get(definition.eventName) ?? true,
    }));
  }

  async updatePreferences(userId: string, dto: UpdateNotificationPreferencesDto) {
    const allowed = new Set<string>(NOTIFICATION_EVENT_CATALOG.map((item) => item.eventName));
    const unknown = dto.preferences.find((item) => !allowed.has(item.eventName));
    if (unknown) throw new BadRequestException(`Evento não configurável: ${unknown.eventName}`);
    await this.prisma.$transaction(
      dto.preferences.map((preference) => this.prisma.notificationPreference.upsert({
        where: { userId_eventName: { userId, eventName: preference.eventName } },
        create: { userId, eventName: preference.eventName, enabled: preference.enabled },
        update: { enabled: preference.enabled },
      })),
    );
    return this.preferences(userId);
  }
}
