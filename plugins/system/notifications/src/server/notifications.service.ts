import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../../../packages/database/src";
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}
  async list(userId: string) {
    const [items, unread] = await Promise.all([this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 }), this.prisma.notification.count({ where: { userId, readAt: null } })]);
    return { items, unread };
  }
  async read(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) throw new NotFoundException("Notificação não encontrada.");
    return this.prisma.notification.update({ where: { id }, data: { readAt: notification.readAt ?? new Date() } });
  }
  async readAll(userId: string) { await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } }); }
}
