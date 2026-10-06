import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@eops/database";
import { AuditQueryDto } from "./dto/audit-query.dto";
import {
  buildAuditDiff,
  canReadCategory,
  categoryForEntityType,
  deriveCategory,
  partitionCategories,
  sanitizeAuditValue,
  type CategoryAccess,
} from "./audit.rules";

const MAX_WINDOW_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;
const ACTOR_SELECT = { select: { id: true, name: true, email: true } } as const;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  private where(query: AuditQueryDto): Prisma.AuditEventWhereInput {
    this.assertWindow(query.from, query.to);
    return {
      actorId: query.actorId,
      action: query.action,
      eventName: query.eventName ? { contains: query.eventName, mode: "insensitive" } : undefined,
      entityType: query.entityType,
      entityId: query.entityId,
      category: query.category,
      severity: query.severity,
      electionId: query.electionId,
      electoralZoneId: query.electoralZoneId,
      correlationId: query.correlationId,
      createdAt: { gte: new Date(query.from), lte: new Date(query.to) },
      OR: query.search
        ? [
            { eventName: { contains: query.search, mode: "insensitive" } },
            { entityType: { contains: query.search, mode: "insensitive" } },
            { entityId: { contains: query.search, mode: "insensitive" } },
            { category: { contains: query.search, mode: "insensitive" } },
            { correlationId: { contains: query.search, mode: "insensitive" } },
            { actor: { name: { contains: query.search, mode: "insensitive" } } },
            { actor: { email: { contains: query.search, mode: "insensitive" } } },
          ]
        : undefined,
    };
  }

  private assertWindow(from: string, to: string) {
    const start = new Date(from).getTime();
    const end = new Date(to).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
      throw new BadRequestException("Período inválido: 'to' deve ser maior ou igual a 'from'.");
    }
    if (end - start > MAX_WINDOW_DAYS * DAY_MS) {
      throw new BadRequestException(`Janela máxima de consulta é de ${MAX_WINDOW_DAYS} dias.`);
    }
  }

  /** Categorias presentes no escopo, para decidir o que o perfil pode ver. */
  private async resolveAccess(
    where: Prisma.AuditEventWhereInput,
    permissions: readonly string[],
  ): Promise<CategoryAccess> {
    const rows = await this.prisma.auditEvent.groupBy({
      by: ["category"],
      where,
      _count: { _all: true },
    });
    return partitionCategories(
      rows.map((row) => row.category),
      permissions,
    );
  }

  private restrictToCategories(
    where: Prisma.AuditEventWhereInput,
    allowed: string[],
  ): Prisma.AuditEventWhereInput {
    return { ...where, category: { in: allowed } };
  }

  /** Combina restrições sem sobrescrever filtros já presentes no escopo. */
  private and(
    where: Prisma.AuditEventWhereInput,
    extra: Prisma.AuditEventWhereInput,
  ): Prisma.AuditEventWhereInput {
    return { AND: [where, extra] };
  }

  /** Reaplica sanitização na leitura (defesa em profundidade). */
  private redact<T extends { oldData: unknown; newData: unknown; metadata: unknown }>(row: T) {
    return {
      ...row,
      oldData: sanitizeAuditValue(row.oldData),
      newData: sanitizeAuditValue(row.newData),
      metadata: sanitizeAuditValue(row.metadata),
    };
  }

  async findAll(query: AuditQueryDto, permissions: readonly string[] = []) {
    const base = this.where(query);
    const access = await this.resolveAccess(base, permissions);
    const where = this.restrictToCategories(base, access.allowed);
    const [items, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        include: { actor: ACTOR_SELECT },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditEvent.count({ where }),
    ]);
    return {
      items: items.map((item) => this.redact(item)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
      restrictedCategories: access.restricted,
    };
  }

  async findOne(id: string) {
    const event = await this.prisma.auditEvent.findUnique({
      where: { id },
      include: { actor: ACTOR_SELECT },
    });
    if (!event) throw new NotFoundException("Evento de auditoria não encontrado.");
    return this.redact(event);
  }

  async diff(id: string) {
    const event = await this.prisma.auditEvent.findUnique({
      where: { id },
      select: { id: true, eventName: true, entityType: true, entityId: true, oldData: true, newData: true },
    });
    if (!event) throw new NotFoundException("Evento de auditoria não encontrado.");
    const difference = buildAuditDiff(event.oldData, event.newData);
    return {
      id: event.id,
      eventName: event.eventName,
      entityType: event.entityType,
      entityId: event.entityId,
      ...difference,
    };
  }

  async summary(query: AuditQueryDto, permissions: readonly string[] = []) {
    const base = this.where(query);
    const access = await this.resolveAccess(base, permissions);
    const where = this.restrictToCategories(base, access.allowed);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [total, todayCount, actionRows, categoryRows, severityRows, entityRows, actorRows] = await Promise.all([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.count({ where: this.and(where, { createdAt: { gte: today } }) }),
      this.prisma.auditEvent.groupBy({ by: ["action"], where, _count: { _all: true }, orderBy: { _count: { action: "desc" } } }),
      this.prisma.auditEvent.groupBy({ by: ["category"], where: this.and(where, { category: { not: null } }), _count: { _all: true }, orderBy: { _count: { category: "desc" } } }),
      this.prisma.auditEvent.groupBy({ by: ["severity"], where: this.and(where, { severity: { not: null } }), _count: { _all: true }, orderBy: { _count: { severity: "desc" } } }),
      this.prisma.auditEvent.groupBy({ by: ["entityType"], where, _count: { _all: true }, orderBy: { _count: { entityType: "desc" } }, take: 5 }),
      this.prisma.auditEvent.groupBy({ by: ["actorId"], where: this.and(where, { actorId: { not: null } }), _count: { _all: true }, orderBy: { _count: { actorId: "desc" } }, take: 5 }),
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
      byCategory: categoryRows.map((row) => ({ key: row.category, count: row._count._all })),
      bySeverity: severityRows.map((row) => ({ key: row.severity, count: row._count._all })),
      topEntities: entityRows.map((row) => ({ entityType: row.entityType, count: row._count._all })),
      topActors: actorRows.map((row) => ({ actor: row.actorId ? actorById.get(row.actorId) ?? null : null, count: row._count._all })),
      restrictedCategories: access.restricted,
    };
  }

  private async facets(where: Prisma.AuditEventWhereInput) {
    const [byAction, byCategory, bySeverity, actorRows] = await Promise.all([
      this.prisma.auditEvent.groupBy({ by: ["action"], where, _count: { _all: true }, orderBy: { _count: { action: "desc" } } }),
      this.prisma.auditEvent.groupBy({ by: ["category"], where: this.and(where, { category: { not: null } }), _count: { _all: true }, orderBy: { _count: { category: "desc" } } }),
      this.prisma.auditEvent.groupBy({ by: ["severity"], where: this.and(where, { severity: { not: null } }), _count: { _all: true }, orderBy: { _count: { severity: "desc" } } }),
      this.prisma.auditEvent.groupBy({ by: ["actorId"], where: this.and(where, { actorId: { not: null } }), _count: { _all: true }, orderBy: { _count: { actorId: "desc" } }, take: 20 }),
    ]);
    const actorIds = actorRows.flatMap((row) => (row.actorId ? [row.actorId] : []));
    const actors = actorIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
      : [];
    const actorById = new Map(actors.map((actor) => [actor.id, actor]));
    return {
      byAction: byAction.map((row) => ({ key: row.action, count: row._count._all })),
      byCategory: byCategory.map((row) => ({ key: row.category as string, count: row._count._all })),
      bySeverity: bySeverity.map((row) => ({ key: row.severity as string, count: row._count._all })),
      byActor: actorRows.map((row) => ({
        id: row.actorId as string,
        name: actorById.get(row.actorId as string)?.name ?? null,
        count: row._count._all,
      })),
    };
  }

  async explorer(query: AuditQueryDto, permissions: readonly string[] = []) {
    const base = this.where(query);
    const access = await this.resolveAccess(base, permissions);
    const where = this.restrictToCategories(base, access.allowed);
    const [items, total, facets] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        include: { actor: ACTOR_SELECT },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditEvent.count({ where }),
      this.facets(where),
    ]);
    return {
      items: items.map((item) => this.redact(item)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
      facets,
      restrictedCategories: access.restricted,
    };
  }

  async categories(query: AuditQueryDto, permissions: readonly string[] = []) {
    const base = this.where(query);
    const access = await this.resolveAccess(base, permissions);
    const where = this.restrictToCategories(base, access.allowed);
    const [categoryRows, severityRows] = await Promise.all([
      this.prisma.auditEvent.groupBy({ by: ["category"], where: this.and(where, { category: { not: null } }), _count: { _all: true }, orderBy: { _count: { category: "desc" } } }),
      this.prisma.auditEvent.groupBy({ by: ["severity"], where: this.and(where, { severity: { not: null } }), _count: { _all: true }, orderBy: { severity: "asc" } }),
    ]);
    return {
      categories: categoryRows.map((row) => ({ key: row.category as string, count: row._count._all })),
      severities: severityRows.map((row) => ({ key: row.severity as string, count: row._count._all })),
      restrictedCategories: access.restricted,
    };
  }

  async actors(query: AuditQueryDto, permissions: readonly string[] = []) {
    const base = this.where(query);
    const access = await this.resolveAccess(base, permissions);
    const where = this.restrictToCategories(base, access.allowed);
    const rows = await this.prisma.auditEvent.groupBy({
      by: ["actorId"],
      where: { ...where, actorId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { actorId: "desc" } },
      take: 50,
    });
    const actorIds = rows.flatMap((row) => (row.actorId ? [row.actorId] : []));
    const actors = actorIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
      : [];
    const actorById = new Map(actors.map((actor) => [actor.id, actor]));
    return {
      items: rows.map((row) => ({
        id: row.actorId as string,
        name: actorById.get(row.actorId as string)?.name ?? null,
        email: actorById.get(row.actorId as string)?.email ?? null,
        count: row._count._all,
      })),
      restrictedCategories: access.restricted,
    };
  }

  async entityTimeline(entityType: string, entityId: string, permissions: readonly string[] = []) {
    const scoped: Prisma.AuditEventWhereInput = { entityType, entityId };
    const rows = await this.prisma.auditEvent.groupBy({ by: ["category"], where: scoped, _count: { _all: true } });
    const access = partitionCategories(
      [...rows.map((row) => row.category), categoryForEntityType(entityType)],
      permissions,
    );
    if (access.restricted.length) {
      throw new ForbiddenException("Entidade de categoria restrita para o seu perfil.");
    }
    const where = this.restrictToCategories(scoped, access.allowed);
    const [items, total] = await Promise.all([
      this.prisma.auditEvent.findMany({ where, include: { actor: ACTOR_SELECT }, orderBy: { createdAt: "asc" }, take: 500 }),
      this.prisma.auditEvent.count({ where }),
    ]);
    return { entityType, entityId, total, items: items.map((item) => this.redact(item)), restrictedCategories: access.restricted };
  }

  async correlation(correlationId: string, permissions: readonly string[] = []) {
    const base: Prisma.AuditEventWhereInput = { correlationId };
    const access = await this.resolveAccess(base, permissions);
    const where = this.restrictToCategories(base, access.allowed);
    const [events, notifications] = await Promise.all([
      this.prisma.auditEvent.findMany({ where, include: { actor: ACTOR_SELECT }, orderBy: { createdAt: "asc" }, take: 500 }),
      this.prisma.notification.findMany({
        where: { correlationId },
        orderBy: { createdAt: "asc" },
        take: 200,
        select: { id: true, userId: true, type: true, title: true, message: true, eventName: true, entityType: true, entityId: true, correlationId: true, createdAt: true, readAt: true },
      }),
    ]);
    const visibleNotifications = notifications.filter((notification) =>
      canReadCategory(deriveCategory(notification.eventName, notification.entityType ?? ""), permissions),
    );
    return {
      correlationId,
      events: events.map((event) => this.redact(event)),
      notifications: visibleNotifications,
      restrictedCategories: access.restricted,
    };
  }
}
