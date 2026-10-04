import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  IncidentEventType,
  IncidentSeverity,
  IncidentStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import {
  calculateIncidentSla,
  getAllowedIncidentTransitions,
  type IncidentSlaState,
} from "@eops/shared/incidents";
import {
  AddIncidentCommentDto,
  AssignIncidentDto,
  ChangeIncidentStatusDto,
  CreateIncidentCategoryDto,
  CreateIncidentDto,
  EscalateIncidentDto,
  IncidentQueryDto,
  UpdateIncidentCategoryDto,
  UpdateIncidentDto,
} from "./dto/incident.dto";

const activeStatuses: IncidentStatus[] = [
  IncidentStatus.NEW,
  IncidentStatus.TRIAGED,
  IncidentStatus.ASSIGNED,
  IncidentStatus.IN_PROGRESS,
];
const terminalStatuses: IncidentStatus[] = [IncidentStatus.CLOSED, IncidentStatus.CANCELLED];
const permissionSpecificStatuses: IncidentStatus[] = [IncidentStatus.RESOLVED, IncidentStatus.CLOSED];

const includeRelations = {
  category: true,
  election: { select: { id: true, name: true, year: true } },
  electoralZone: { select: { id: true, number: true, name: true } },
  pollingPlace: { select: { id: true, name: true, city: true } },
  asset: { select: { id: true, assetTag: true, name: true, status: true, condition: true } },
} satisfies Prisma.IncidentInclude;

function defaultSla(severity: IncidentSeverity) {
  const hours: Record<IncidentSeverity, number> = { LOW: 24, MEDIUM: 8, HIGH: 4, CRITICAL: 1 };
  return new Date(Date.now() + hours[severity] * 60 * 60 * 1000);
}

function eventForStatus(status: IncidentStatus): IncidentEventType {
  if (status === IncidentStatus.RESOLVED) return IncidentEventType.RESOLVED;
  if (status === IncidentStatus.CLOSED) return IncidentEventType.CLOSED;
  if (status === IncidentStatus.CANCELLED) return IncidentEventType.CANCELLED;
  if (status === IncidentStatus.IN_PROGRESS) return IncidentEventType.REOPENED;
  return IncidentEventType.STATUS_CHANGED;
}

const severityPriority: Record<IncidentSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const slaPriority: Record<IncidentSlaState, number> = {
  OVERDUE: 3,
  DUE_SOON: 2,
  ON_TRACK: 1,
  COMPLETED: 0,
};

function enrich<T extends { status: IncidentStatus; slaDeadline: Date | null }>(incident: T, now = new Date()) {
  const sla = calculateIncidentSla(incident.status, incident.slaDeadline, now);
  return { ...incident, ...sla, slaOverdue: sla.slaState === "OVERDUE" };
}

function changedValues(current: Record<string, unknown>, dto: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(dto)
      .filter(([, value]) => value !== undefined)
      .filter(([key, value]) => {
        const previous = current[key];
        if (previous instanceof Date && typeof value === "string") return previous.toISOString() !== new Date(value).toISOString();
        return previous !== value;
      })
      .map(([key, value]) => [key, { from: current[key] ?? null, to: value ?? null }]),
  );
}

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus?: EventBus,
  ) {}

  private where(query: IncidentQueryDto): Prisma.IncidentWhereInput {
    return {
      status: query.status,
      severity: query.severity,
      categoryId: query.categoryId,
      electionId: query.electionId,
      electoralZoneId: query.zoneId,
      pollingPlaceId: query.pollingPlaceId,
      assignedToId: query.assignedToId,
      openedAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
      OR: query.search
        ? [
            { code: { contains: query.search, mode: "insensitive" } },
            { title: { contains: query.search, mode: "insensitive" } },
            { description: { contains: query.search, mode: "insensitive" } },
          ]
        : undefined,
    };
  }

  async findAll(query: IncidentQueryDto) {
    const where = this.where(query);
    const [items, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        include: includeRelations,
        orderBy: [{ severity: "desc" }, { openedAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.incident.count({ where }),
    ]);
    const now = new Date();
    return {
      items: items.map((item) => enrich(item, now)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async queue(query: IncidentQueryDto) {
    const where: Prisma.IncidentWhereInput = {
      ...this.where(query),
      status: { in: activeStatuses },
    };
    const now = new Date();
    const candidates = await this.prisma.incident.findMany({ where, include: includeRelations });
    const ranked = candidates
      .map((item) => {
        const result = enrich(item, now);
        const priorityReasons = [
          item.escalationLevel > 0 ? `Escalado nível ${item.escalationLevel}` : null,
          item.severity === IncidentSeverity.CRITICAL ? "Severidade crítica" : null,
          result.slaState === "OVERDUE" ? "SLA vencido" : null,
          result.slaState === "DUE_SOON" ? "SLA próximo" : null,
          !item.acknowledgedAt ? "Aguardando reconhecimento" : null,
          !item.assignedToId && !item.assignedToName ? "Sem responsável" : null,
        ].filter((reason): reason is string => Boolean(reason));
        const priorityScore =
          item.escalationLevel * 10_000 +
          severityPriority[item.severity] * 1_000 +
          slaPriority[result.slaState] * 100 +
          (!item.acknowledgedAt ? 20 : 0) +
          (!item.assignedToId && !item.assignedToName ? 10 : 0);
        return { ...result, priorityReasons, priorityScore };
      })
      .sort((left, right) => right.priorityScore - left.priorityScore || left.openedAt.getTime() - right.openedAt.getTime());
    const start = (query.page - 1) * query.pageSize;
    return {
      items: ranked.slice(start, start + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total: ranked.length,
      totalPages: Math.ceil(ranked.length / query.pageSize),
    };
  }

  async dashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();
    const dueSoon = new Date(now.getTime() + 60 * 60 * 1000);
    const [
      open,
      critical,
      inProgress,
      resolvedToday,
      slaOverdue,
      untriaged,
      unassigned,
      acknowledgementPending,
      dueSoonCount,
      bySeverityRows,
      byStatusRows,
      resolved,
    ] = await Promise.all([
      this.prisma.incident.count({ where: { status: { in: activeStatuses } } }),
      this.prisma.incident.count({ where: { severity: IncidentSeverity.CRITICAL, status: { in: activeStatuses } } }),
      this.prisma.incident.count({ where: { status: IncidentStatus.IN_PROGRESS } }),
      this.prisma.incident.count({ where: { resolvedAt: { gte: today } } }),
      this.prisma.incident.count({ where: { status: { in: activeStatuses }, slaDeadline: { lt: now } } }),
      this.prisma.incident.count({ where: { status: IncidentStatus.NEW } }),
      this.prisma.incident.count({ where: { status: { in: activeStatuses }, assignedToId: null, assignedToName: null } }),
      this.prisma.incident.count({ where: { status: { in: activeStatuses }, acknowledgedAt: null } }),
      this.prisma.incident.count({ where: { status: { in: activeStatuses }, slaDeadline: { gte: now, lte: dueSoon } } }),
      this.prisma.incident.groupBy({ by: ["severity"], _count: { _all: true } }),
      this.prisma.incident.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.incident.findMany({ where: { resolvedAt: { not: null } }, select: { openedAt: true, resolvedAt: true } }),
    ]);
    const bySeverity = Object.fromEntries(Object.values(IncidentSeverity).map((value) => [value, 0])) as Record<IncidentSeverity, number>;
    const byStatus = Object.fromEntries(Object.values(IncidentStatus).map((value) => [value, 0])) as Record<IncidentStatus, number>;
    for (const row of bySeverityRows) bySeverity[row.severity] = row._count._all;
    for (const row of byStatusRows) byStatus[row.status] = row._count._all;
    const durations = resolved
      .filter((item): item is typeof item & { resolvedAt: Date } => Boolean(item.resolvedAt))
      .map((item) => (item.resolvedAt.getTime() - item.openedAt.getTime()) / 60_000);
    return {
      open,
      critical,
      inProgress,
      resolvedToday,
      slaOverdue,
      untriaged,
      unassigned,
      acknowledgementPending,
      dueSoon: dueSoonCount,
      bySeverity,
      byStatus,
      meanResolutionMinutes: durations.length
        ? Math.round(durations.reduce((total, duration) => total + duration, 0) / durations.length)
        : null,
    };
  }

  async findOne(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        ...includeRelations,
        events: { orderBy: { createdAt: "desc" } },
        assignments: { orderBy: { assignedAt: "desc" } },
      },
    });
    if (!incident) throw new NotFoundException("Incidente não encontrado.");
    return enrich(incident);
  }

  private async validateRelations(
    dto: Pick<CreateIncidentDto, "electionId" | "electoralZoneId" | "pollingPlaceId" | "categoryId" | "assetId">,
  ) {
    const [election, category, zone, place, asset] = await Promise.all([
      this.prisma.election.findUnique({ where: { id: dto.electionId } }),
      this.prisma.incidentCategory.findUnique({ where: { id: dto.categoryId } }),
      dto.electoralZoneId ? this.prisma.electoralZone.findUnique({ where: { id: dto.electoralZoneId } }) : null,
      dto.pollingPlaceId
        ? this.prisma.pollingPlace.findUnique({ where: { id: dto.pollingPlaceId }, include: { electoralZone: true } })
        : null,
      dto.assetId ? this.prisma.asset.findUnique({ where: { id: dto.assetId } }) : null,
    ]);
    if (!election) throw new NotFoundException("Pleito não encontrado.");
    if (!category || !category.active) throw new NotFoundException("Categoria de incidente não encontrada ou inativa.");
    if (dto.electoralZoneId && (!zone || zone.electionId !== dto.electionId)) throw new BadRequestException("A zona não pertence ao pleito informado.");
    if (dto.pollingPlaceId && (!place || place.electoralZone.electionId !== dto.electionId)) throw new BadRequestException("O local não pertence ao pleito informado.");
    if (place && dto.electoralZoneId && place.electoralZoneId !== dto.electoralZoneId) throw new BadRequestException("O local não pertence à zona informada.");
    if (dto.assetId && !asset) throw new NotFoundException("Ativo não encontrado.");
  }

  async create(dto: CreateIncidentDto, actorId?: string) {
    await this.validateRelations(dto);
    const sequence = (await this.prisma.incident.count()) + 1;
    const code = `INC-${String(sequence).padStart(5, "0")}`;
    try {
      const incident = await this.prisma.$transaction(async (tx) => {
        const created = await tx.incident.create({
          data: {
            ...dto,
            createdById: actorId,
            code,
            slaDeadline: dto.slaDeadline ? new Date(dto.slaDeadline) : defaultSla(dto.severity),
          },
          include: includeRelations,
        });
        await tx.incidentEvent.create({
          data: { incidentId: created.id, type: IncidentEventType.INCIDENT_CREATED, message: "Incidente criado.", actorId },
        });
        return created;
      });
      await this.eventBus?.emit("incident.created", {
        entityId: incident.id,
        actorId,
        code: incident.code,
        title: incident.title,
        severity: incident.severity,
        electionId: incident.electionId,
        pollingPlaceId: incident.pollingPlaceId ?? undefined,
      });
      return enrich(incident);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Não foi possível gerar um código único para o incidente. Tente novamente.");
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateIncidentDto, actorId?: string) {
    const current = await this.findOne(id);
    if (dto.categoryId) {
      const category = await this.prisma.incidentCategory.findUnique({ where: { id: dto.categoryId } });
      if (!category?.active) throw new NotFoundException("Categoria de incidente não encontrada ou inativa.");
    }
    if (dto.assetId) {
      const asset = await this.prisma.asset.findUnique({ where: { id: dto.assetId } });
      if (!asset) throw new NotFoundException("Ativo não encontrado.");
    }
    const changes = changedValues(current as unknown as Record<string, unknown>, dto as unknown as Record<string, unknown>);
    if (!Object.keys(changes).length) return current;
    const incident = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.incident.update({
        where: { id },
        data: { ...dto, slaDeadline: dto.slaDeadline ? new Date(dto.slaDeadline) : undefined },
        include: includeRelations,
      });
      await tx.incidentEvent.create({
        data: {
          incidentId: id,
          type: dto.severity && dto.severity !== current.severity ? IncidentEventType.SEVERITY_CHANGED : IncidentEventType.UPDATED,
          message: dto.severity && dto.severity !== current.severity
            ? `Severidade alterada de ${current.severity} para ${dto.severity}.`
            : "Dados do incidente atualizados.",
          actorId,
          metadata: changes as Prisma.InputJsonValue,
        },
      });
      return updated;
    });
    await this.eventBus?.emit("incident.updated", { entityId: id, actorId, code: incident.code, changes });
    if (dto.severity && dto.severity !== current.severity) {
      await this.eventBus?.emit("incident.severity_changed", {
        entityId: id,
        actorId,
        code: incident.code,
        from: current.severity,
        to: dto.severity,
      });
    }
    return enrich(incident);
  }

  async changeStatus(id: string, dto: ChangeIncidentStatusDto, actorId?: string) {
    if (permissionSpecificStatuses.includes(dto.status)) {
      throw new BadRequestException("Use a ação específica para resolver ou fechar o incidente.");
    }
    return this.transition(id, dto.status, actorId, dto.comment);
  }

  resolve(id: string, reason: string | undefined, actorId: string) {
    return this.transition(id, IncidentStatus.RESOLVED, actorId, reason);
  }

  reopen(id: string, reason: string | undefined, actorId: string) {
    return this.transition(id, IncidentStatus.IN_PROGRESS, actorId, reason);
  }

  close(id: string, reason: string | undefined, actorId: string) {
    return this.transition(id, IncidentStatus.CLOSED, actorId, reason);
  }

  private async transition(id: string, target: IncidentStatus, actorId?: string, reason?: string) {
    const current = await this.findOne(id);
    if (current.status === target) return current;
    if (!getAllowedIncidentTransitions(current.status).includes(target)) {
      throw new BadRequestException(`Transição de ${current.status} para ${target} não permitida.`);
    }
    const now = new Date();
    const incident = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.incident.update({
        where: { id },
        data: {
          status: target,
          resolvedAt: target === IncidentStatus.RESOLVED ? now : target === IncidentStatus.IN_PROGRESS && current.status === IncidentStatus.RESOLVED ? null : undefined,
          closedAt: target === IncidentStatus.CLOSED ? now : undefined,
        },
        include: includeRelations,
      });
      await tx.incidentEvent.create({
        data: {
          incidentId: id,
          type: eventForStatus(target),
          message: reason ?? `Status alterado de ${current.status} para ${target}.`,
          actorId,
          metadata: { from: current.status, to: target, reason: reason ?? null },
        },
      });
      return updated;
    });
    const payload = { entityId: id, actorId, code: incident.code, from: current.status, to: target, reason };
    if (target === IncidentStatus.RESOLVED) await this.eventBus?.emit("incident.resolved", { ...payload, title: incident.title });
    else if (target === IncidentStatus.CLOSED) await this.eventBus?.emit("incident.closed", payload);
    else if (target === IncidentStatus.CANCELLED) await this.eventBus?.emit("incident.cancelled", payload);
    else if (target === IncidentStatus.IN_PROGRESS && current.status === IncidentStatus.RESOLVED) await this.eventBus?.emit("incident.reopened", payload);
    else await this.eventBus?.emit("incident.status_changed", payload);
    return enrich(incident);
  }

  async acknowledge(id: string, actorId: string) {
    const current = await this.findOne(id);
    if (current.acknowledgedAt) throw new ConflictException("Incidente já foi reconhecido.");
    if (terminalStatuses.includes(current.status)) {
      throw new BadRequestException("Incidente encerrado não pode ser reconhecido.");
    }
    const acknowledgedAt = new Date();
    const incident = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.incident.update({
        where: { id },
        data: { acknowledgedAt, acknowledgedById: actorId },
        include: includeRelations,
      });
      await tx.incidentEvent.create({
        data: {
          incidentId: id,
          type: IncidentEventType.ACKNOWLEDGED,
          message: "Incidente reconhecido pelo operador.",
          actorId,
          metadata: { acknowledgedAt: acknowledgedAt.toISOString() },
        },
      });
      return updated;
    });
    await this.eventBus?.emit("incident.acknowledged", {
      entityId: id,
      actorId,
      code: incident.code,
      acknowledgedAt: acknowledgedAt.toISOString(),
    });
    return enrich(incident);
  }

  async escalate(id: string, dto: EscalateIncidentDto, actorId: string) {
    const current = await this.findOne(id);
    if (terminalStatuses.includes(current.status)) {
      throw new BadRequestException("Incidente encerrado não pode ser escalado.");
    }
    if (dto.level <= current.escalationLevel) {
      throw new BadRequestException("O novo nível deve ser maior que o nível atual.");
    }
    const escalatedAt = new Date();
    const incident = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.incident.update({
        where: { id },
        data: {
          escalationLevel: dto.level,
          escalatedAt,
          escalatedById: actorId,
          escalationReason: dto.reason,
        },
        include: includeRelations,
      });
      await tx.incidentEvent.create({
        data: {
          incidentId: id,
          type: IncidentEventType.ESCALATED,
          message: `Incidente escalado para o nível ${dto.level}: ${dto.reason}`,
          actorId,
          metadata: { from: current.escalationLevel, to: dto.level, reason: dto.reason },
        },
      });
      return updated;
    });
    await this.eventBus?.emit("incident.escalated", {
      entityId: id,
      actorId,
      code: incident.code,
      from: current.escalationLevel,
      to: dto.level,
      reason: dto.reason,
    });
    return enrich(incident);
  }

  async assign(id: string, dto: AssignIncidentDto, actorId?: string) {
    const current = await this.findOne(id);
    if (terminalStatuses.includes(current.status)) {
      throw new BadRequestException("Incidentes encerrados ou cancelados não podem ser atribuídos.");
    }
    const incident = await this.prisma.$transaction(async (tx) => {
      await tx.incidentAssignment.updateMany({ where: { incidentId: id, endedAt: null }, data: { endedAt: new Date() } });
      const updated = await tx.incident.update({
        where: { id },
        data: {
          assignedToId: dto.assignedToId,
          assignedToName: dto.assignedToName,
          status: current.status === IncidentStatus.IN_PROGRESS ? undefined : IncidentStatus.ASSIGNED,
        },
        include: includeRelations,
      });
      await tx.incidentAssignment.create({ data: { incidentId: id, ...dto, assignedById: actorId } });
      await tx.incidentEvent.create({
        data: { incidentId: id, type: IncidentEventType.ASSIGNED, message: `Incidente atribuído a ${dto.assignedToName}.`, actorId },
      });
      return updated;
    });
    await this.eventBus?.emit("incident.assigned", {
      entityId: id,
      actorId,
      code: incident.code,
      assignedToId: dto.assignedToId,
      assignedToName: dto.assignedToName,
      from: current.assignedToName ?? undefined,
      to: dto.assignedToName,
      reason: dto.reason,
    });
    return enrich(incident);
  }

  async addComment(id: string, dto: AddIncidentCommentDto, actorId?: string) {
    const current = await this.findOne(id);
    const comment = await this.prisma.incidentEvent.create({
      data: { incidentId: id, type: IncidentEventType.COMMENT_ADDED, message: dto.message, actorId },
    });
    await this.eventBus?.emit("incident.comment_added", {
      entityId: id,
      actorId,
      code: current.code,
      message: dto.message,
    });
    return comment;
  }

  async remove(id: string, actorId?: string) {
    await this.transition(id, IncidentStatus.CANCELLED, actorId, "Incidente cancelado.");
  }

  listCategories() {
    return this.prisma.incidentCategory.findMany({ orderBy: { name: "asc" } });
  }

  async createCategory(dto: CreateIncidentCategoryDto, actorId: string) {
    try {
      const category = await this.prisma.incidentCategory.create({ data: { ...dto, key: dto.key.toUpperCase() } });
      await this.eventBus?.emit("incident.category_created", {
        entityId: category.id,
        actorId,
        key: category.key,
        name: category.name,
      });
      return category;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Já existe uma categoria com essa chave.");
      }
      throw error;
    }
  }

  async updateCategory(id: string, dto: UpdateIncidentCategoryDto, actorId: string) {
    const category = await this.prisma.incidentCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException("Categoria não encontrada.");
    const changes = changedValues(category as unknown as Record<string, unknown>, dto as unknown as Record<string, unknown>);
    const updated = await this.prisma.incidentCategory.update({ where: { id }, data: dto });
    if (Object.keys(changes).length) {
      await this.eventBus?.emit("incident.category_updated", {
        entityId: id,
        actorId,
        key: updated.key,
        changes,
      });
    }
    return updated;
  }
}
