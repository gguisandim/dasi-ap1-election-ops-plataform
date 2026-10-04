import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@eops/database";
import { AuditQueryDto } from "./dto/audit-query.dto";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  private where(query: AuditQueryDto): Prisma.AuditEventWhereInput {
    return {
      actorId: query.actorId,
      action: query.action,
      eventName: query.eventName,
      entityType: query.entityType,
      entityId: query.entityId,
      createdAt: query.from || query.to
        ? { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined }
        : undefined,
      OR: query.search
        ? [
            { eventName: { contains: query.search, mode: "insensitive" } },
            { entityType: { contains: query.search, mode: "insensitive" } },
            { entityId: { contains: query.search, mode: "insensitive" } },
            { actor: { name: { contains: query.search, mode: "insensitive" } } },
            { actor: { email: { contains: query.search, mode: "insensitive" } } },
          ]
        : undefined,
    };
  }

  async findAll(query: AuditQueryDto) {
    const where = this.where(query);
    const [items, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditEvent.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) };
  }

  async findOne(id: string) {
    const event = await this.prisma.auditEvent.findUnique({
      where: { id },
      include: { actor: { select: { id: true, name: true, email: true } } },
    });
    if (!event) throw new NotFoundException("Evento de auditoria não encontrado.");
    return event;
  }

  async summary(query: AuditQueryDto) {
    const where = this.where({ ...query, search: undefined, page: 1, pageSize: 30 });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [total, todayCount, actionRows, entityRows, actorRows] = await Promise.all([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.count({ where: { ...where, createdAt: { gte: today } } }),
      this.prisma.auditEvent.groupBy({ by: ["action"], where, _count: { _all: true }, orderBy: { _count: { action: "desc" } } }),
      this.prisma.auditEvent.groupBy({ by: ["entityType"], where, _count: { _all: true }, orderBy: { _count: { entityType: "desc" } }, take: 5 }),
      this.prisma.auditEvent.groupBy({ by: ["actorId"], where: { ...where, actorId: { not: null } }, _count: { _all: true }, orderBy: { _count: { actorId: "desc" } }, take: 5 }),
    ]);
    const actorIds = actorRows.flatMap((row) => (row.actorId ? [row.actorId] : []));
    const actors = actorIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
      : [];
    const actorById = new Map(actors.map((actor) => [actor.id, actor]));
    return {
      total,
      today: todayCount,
      byAction: actionRows.map((row) => ({ action: row.action, count: row._count._all })),
      topEntities: entityRows.map((row) => ({ entityType: row.entityType, count: row._count._all })),
      topActors: actorRows.map((row) => ({ actor: row.actorId ? actorById.get(row.actorId) ?? null : null, count: row._count._all })),
    };
  }
}
