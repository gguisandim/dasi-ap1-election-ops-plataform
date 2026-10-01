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
import { PrismaService } from "../../../../../packages/database/src";
import { EventBus } from "../../../../../packages/event-bus/src";
import {
  AddIncidentCommentDto,
  AssignIncidentDto,
  ChangeIncidentStatusDto,
  CreateIncidentCategoryDto,
  CreateIncidentDto,
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

const transitions: Record<IncidentStatus, IncidentStatus[]> = {
  NEW: [IncidentStatus.TRIAGED, IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS, IncidentStatus.CANCELLED],
  TRIAGED: [IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS, IncidentStatus.CANCELLED],
  ASSIGNED: [IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED, IncidentStatus.CANCELLED],
  IN_PROGRESS: [IncidentStatus.RESOLVED, IncidentStatus.CANCELLED],
  RESOLVED: [IncidentStatus.IN_PROGRESS, IncidentStatus.CLOSED],
  CLOSED: [],
  CANCELLED: [],
};

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
  if (status === IncidentStatus.IN_PROGRESS) return IncidentEventType.REOPENED;
  return IncidentEventType.STATUS_CHANGED;
}

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService, private readonly eventBus?: EventBus) {}

  private where(query: IncidentQueryDto): Prisma.IncidentWhereInput {
    return {
      status: query.status,
      severity: query.severity,
      categoryId: query.categoryId,
      electionId: query.electionId,
      electoralZoneId: query.zoneId,
      pollingPlaceId: query.pollingPlaceId,
      assignedToId: query.assignedToId,
      openedAt: query.from || query.to ? { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined } : undefined,
      OR: query.search ? [
        { code: { contains: query.search, mode: "insensitive" } },
        { title: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
      ] : undefined,
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
      items: items.map((item) => ({ ...item, slaOverdue: Boolean(item.slaDeadline && item.slaDeadline < now && activeStatuses.includes(item.status)) })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async dashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();
    const [open, critical, inProgress, resolvedToday, slaOverdue] = await Promise.all([
      this.prisma.incident.count({ where: { status: { in: activeStatuses } } }),
      this.prisma.incident.count({ where: { severity: IncidentSeverity.CRITICAL, status: { in: activeStatuses } } }),
      this.prisma.incident.count({ where: { status: IncidentStatus.IN_PROGRESS } }),
      this.prisma.incident.count({ where: { resolvedAt: { gte: today } } }),
      this.prisma.incident.count({ where: { status: { in: activeStatuses }, slaDeadline: { lt: now } } }),
    ]);
    return { open, critical, inProgress, resolvedToday, slaOverdue };
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
    return { ...incident, slaOverdue: Boolean(incident.slaDeadline && incident.slaDeadline < new Date() && activeStatuses.includes(incident.status)) };
  }

  private async validateRelations(dto: Pick<CreateIncidentDto, "electionId" | "electoralZoneId" | "pollingPlaceId" | "categoryId" | "assetId">) {
    const [election, category, zone, place, asset] = await Promise.all([
      this.prisma.election.findUnique({ where: { id: dto.electionId } }),
      this.prisma.incidentCategory.findUnique({ where: { id: dto.categoryId } }),
      dto.electoralZoneId ? this.prisma.electoralZone.findUnique({ where: { id: dto.electoralZoneId } }) : null,
      dto.pollingPlaceId ? this.prisma.pollingPlace.findUnique({ where: { id: dto.pollingPlaceId }, include: { electoralZone: true } }) : null,
      dto.assetId ? this.prisma.asset.findUnique({ where: { id: dto.assetId } }) : null,
    ]);
    if (!election) throw new NotFoundException("Pleito não encontrado.");
    if (!category || !category.active) throw new NotFoundException("Categoria de incidente não encontrada ou inativa.");
    if (dto.electoralZoneId && (!zone || zone.electionId !== dto.electionId)) throw new BadRequestException("A zona não pertence ao pleito informado.");
    if (dto.pollingPlaceId && (!place || place.electoralZone.electionId !== dto.electionId)) throw new BadRequestException("O local não pertence ao pleito informado.");
    if (place && dto.electoralZoneId && place.electoralZoneId !== dto.electoralZoneId) throw new BadRequestException("O local não pertence à zona informada.");
    if (dto.assetId && !asset) throw new NotFoundException("Ativo não encontrado.");
  }

  async create(dto: CreateIncidentDto) {
    await this.validateRelations(dto);
    const sequence = (await this.prisma.incident.count()) + 1;
    const code = `INC-${String(sequence).padStart(5, "0")}`;
    try {
      const incident = await this.prisma.$transaction(async (tx) => {
        const incident = await tx.incident.create({
          data: {
            ...dto,
            code,
            slaDeadline: dto.slaDeadline ? new Date(dto.slaDeadline) : defaultSla(dto.severity),
          },
          include: includeRelations,
        });
        await tx.incidentEvent.create({
          data: { incidentId: incident.id, type: IncidentEventType.INCIDENT_CREATED, message: "Incidente criado.", actorId: dto.createdById },
        });
        return incident;
      });
      await this.eventBus?.emit("incident.created", { entityId: incident.id, actorId: dto.createdById, code: incident.code, title: incident.title, severity: incident.severity, electionId: incident.electionId, pollingPlaceId: incident.pollingPlaceId ?? undefined });
      return incident;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Não foi possível gerar um código único para o incidente. Tente novamente.");
      throw error;
    }
  }

  async update(id: string, dto: UpdateIncidentDto) {
    const current = await this.findOne(id);
    if (dto.categoryId) {
      const category = await this.prisma.incidentCategory.findUnique({ where: { id: dto.categoryId } });
      if (!category?.active) throw new NotFoundException("Categoria de incidente não encontrada ou inativa.");
    }
    if (dto.assetId) {
      const asset = await this.prisma.asset.findUnique({ where: { id: dto.assetId } });
      if (!asset) throw new NotFoundException("Ativo não encontrado.");
    }
    const incident = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.incident.update({
        where: { id },
        data: { ...dto, slaDeadline: dto.slaDeadline ? new Date(dto.slaDeadline) : undefined },
        include: includeRelations,
      });
      if (dto.severity && dto.severity !== current.severity) {
        await tx.incidentEvent.create({ data: { incidentId: id, type: IncidentEventType.SEVERITY_CHANGED, message: `Severidade alterada de ${current.severity} para ${dto.severity}.`, metadata: { from: current.severity, to: dto.severity } } });
      }
      return updated;
    });
    return incident;
  }

  async changeStatus(id: string, dto: ChangeIncidentStatusDto) {
    const current = await this.findOne(id);
    if (current.status === dto.status) return current;
    if (!transitions[current.status].includes(dto.status)) throw new BadRequestException(`Transição de ${current.status} para ${dto.status} não permitida.`);
    const now = new Date();
    const incident = await this.prisma.$transaction(async (tx) => {
      const incident = await tx.incident.update({
        where: { id },
        data: {
          status: dto.status,
          resolvedAt: dto.status === IncidentStatus.RESOLVED ? now : dto.status === IncidentStatus.IN_PROGRESS && current.status === IncidentStatus.RESOLVED ? null : undefined,
          closedAt: dto.status === IncidentStatus.CLOSED ? now : undefined,
        },
        include: includeRelations,
      });
      await tx.incidentEvent.create({
        data: {
          incidentId: id,
          type: eventForStatus(dto.status),
          message: dto.comment ?? `Status alterado de ${current.status} para ${dto.status}.`,
          actorId: dto.actorId,
          metadata: { from: current.status, to: dto.status },
        },
      });
      return incident;
    });
    if (dto.status === IncidentStatus.RESOLVED) await this.eventBus?.emit("incident.resolved", { entityId: incident.id, actorId: dto.actorId, code: incident.code, title: incident.title });
    return incident;
  }

  async assign(id: string, dto: AssignIncidentDto) {
    const current = await this.findOne(id);
    const immutableStatuses: IncidentStatus[] = [IncidentStatus.CLOSED, IncidentStatus.CANCELLED];
    if (immutableStatuses.includes(current.status)) throw new BadRequestException("Incidentes encerrados ou cancelados não podem ser atribuídos.");
    const incident = await this.prisma.$transaction(async (tx) => {
      await tx.incidentAssignment.updateMany({ where: { incidentId: id, endedAt: null }, data: { endedAt: new Date() } });
      const incident = await tx.incident.update({
        where: { id },
        data: { assignedToId: dto.assignedToId, assignedToName: dto.assignedToName, status: current.status === IncidentStatus.IN_PROGRESS ? undefined : IncidentStatus.ASSIGNED },
        include: includeRelations,
      });
      await tx.incidentAssignment.create({ data: { incidentId: id, ...dto } });
      await tx.incidentEvent.create({ data: { incidentId: id, type: IncidentEventType.ASSIGNED, message: `Incidente atribuído a ${dto.assignedToName}.`, actorId: dto.assignedById } });
      return incident;
    });
    await this.eventBus?.emit("incident.assigned", { entityId: incident.id, actorId: dto.assignedById, code: incident.code, assignedToName: dto.assignedToName });
    return incident;
  }

  async addComment(id: string, dto: AddIncidentCommentDto) {
    await this.findOne(id);
    return this.prisma.incidentEvent.create({ data: { incidentId: id, type: IncidentEventType.COMMENT_ADDED, message: dto.message, actorId: dto.actorId } });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.incident.delete({ where: { id } });
  }

  listCategories() {
    return this.prisma.incidentCategory.findMany({ orderBy: { name: "asc" } });
  }

  async createCategory(dto: CreateIncidentCategoryDto) {
    try {
      return await this.prisma.incidentCategory.create({ data: { ...dto, key: dto.key.toUpperCase() } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Já existe uma categoria com essa chave.");
      throw error;
    }
  }

  async updateCategory(id: string, dto: UpdateIncidentCategoryDto) {
    const category = await this.prisma.incidentCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException("Categoria não encontrada.");
    return this.prisma.incidentCategory.update({ where: { id }, data: dto });
  }
}
