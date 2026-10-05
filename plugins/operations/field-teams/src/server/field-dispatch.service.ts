import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FieldDispatchEventType,
  FieldDispatchStatus,
  FieldShiftAssignmentStatus,
  FieldShiftStatus,
  FieldTeamStatus,
  MemberAvailability,
  Prisma,
  TaskPriority,
} from "@prisma/client";
import { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import {
  FIELD_DISPATCH_TERMINAL_STATUSES,
  type FieldDispatchSummary,
} from "@eops/shared/workforce";
import {
  CreateDispatchDto,
  DispatchQueryDto,
  UpdateDispatchStatusDto,
} from "./dto/field-teams.dto";
import {
  deriveDispatchMetrics,
  dispatchRequiredFieldError,
  dispatchTransitionError,
  DISPATCH_TIMESTAMP_FIELDS,
  elapsedMinutes,
  evaluateCapabilityMatch,
  type DispatchRequirement,
} from "./dispatch-rules";

const dispatchListInclude = {
  team: { select: { id: true, name: true, code: true } },
  member: { select: { id: true, name: true } },
  task: { select: { id: true, title: true } },
  incident: { select: { id: true, code: true } },
} satisfies Prisma.FieldDispatchInclude;

const dispatchDetailInclude = {
  ...dispatchListInclude,
  electoralZone: { select: { id: true, number: true, name: true } },
  pollingPlace: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  events: {
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.FieldDispatchInclude;

const dispatchTaskInclude = {
  specialtyRequirements: {
    select: { specialtyId: true, requiredCount: true },
  },
} satisfies Prisma.TaskInclude;

const transitionEventTypes: Record<FieldDispatchStatus, FieldDispatchEventType> = {
  REQUESTED: FieldDispatchEventType.CREATED,
  DISPATCHED: FieldDispatchEventType.DISPATCHED,
  ACCEPTED: FieldDispatchEventType.ACCEPTED,
  REJECTED: FieldDispatchEventType.REJECTED,
  EN_ROUTE: FieldDispatchEventType.DEPARTED,
  ARRIVED: FieldDispatchEventType.ARRIVED,
  IN_PROGRESS: FieldDispatchEventType.STARTED,
  COMPLETED: FieldDispatchEventType.COMPLETED,
  CANCELLED: FieldDispatchEventType.CANCELLED,
};

const transitionLabels: Record<FieldDispatchStatus, string> = {
  REQUESTED: "Dispatch solicitado.",
  DISPATCHED: "Dispatch enviado para a equipe.",
  ACCEPTED: "Dispatch aceito pela equipe.",
  REJECTED: "Dispatch rejeitado pela equipe.",
  EN_ROUTE: "Equipe em deslocamento.",
  ARRIVED: "Equipe no local.",
  IN_PROGRESS: "Atendimento iniciado.",
  COMPLETED: "Atendimento concluído.",
  CANCELLED: "Dispatch cancelado.",
};

type DispatchRecord = Prisma.FieldDispatchGetPayload<{
  include: typeof dispatchListInclude;
}>;

function summarize(
  dispatch: DispatchRecord,
  specialties: string[],
  now = new Date(),
): FieldDispatchSummary {
  return {
    id: dispatch.id,
    title: dispatch.title,
    status: dispatch.status,
    priority: dispatch.priority,
    capabilityMatch: dispatch.capabilityMatch,
    teamId: dispatch.teamId,
    teamName: dispatch.team.name,
    teamCode: dispatch.team.code,
    memberId: dispatch.memberId,
    memberName: dispatch.member?.name ?? null,
    taskId: dispatch.taskId,
    taskTitle: dispatch.task?.title ?? null,
    incidentId: dispatch.incidentId,
    specialties,
    requestedAt: dispatch.requestedAt.toISOString(),
    elapsedMinutes: elapsedMinutes(dispatch.requestedAt, now),
    acceptedAt: dispatch.acceptedAt?.toISOString() ?? null,
    completedAt: dispatch.completedAt?.toISOString() ?? null,
    metrics: deriveDispatchMetrics(dispatch),
  };
}

@Injectable()
export class FieldDispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus?: EventBus,
  ) {}

  async list(query: DispatchQueryDto) {
    const where: Prisma.FieldDispatchWhereInput = {
      teamId: query.teamId,
      memberId: query.memberId,
      taskId: query.taskId,
      incidentId: query.incidentId,
      priority: query.priority,
    };
    if (query.status) where.status = query.status;
    else if (query.active)
      where.status = { notIn: [...FIELD_DISPATCH_TERMINAL_STATUSES] };
    const dispatches = await this.prisma.fieldDispatch.findMany({
      where,
      include: dispatchListInclude,
      orderBy: [{ priority: "desc" }, { requestedAt: "asc" }],
    });
    const specialties = await this.teamSpecialties(
      dispatches.map((item) => item.teamId),
    );
    const now = new Date();
    return dispatches.map((dispatch) =>
      summarize(dispatch, specialties.get(dispatch.teamId) ?? [], now),
    );
  }

  async operationalMetrics(electionId?: string) {
    const now = new Date();
    const teamFilter = electionId ? { team: { electionId } } : {};
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const metricsStart = new Date(now.getTime() - 30 * 86_400_000);
    const [open, completedToday, recent] = await Promise.all([
      this.prisma.fieldDispatch.groupBy({
        by: ["status"],
        where: {
          ...teamFilter,
          status: { notIn: [...FIELD_DISPATCH_TERMINAL_STATUSES] },
        },
        _count: { _all: true },
      }),
      this.prisma.fieldDispatch.count({
        where: {
          ...teamFilter,
          status: FieldDispatchStatus.COMPLETED,
          completedAt: { gte: todayStart },
        },
      }),
      this.prisma.fieldDispatch.findMany({
        where: { ...teamFilter, requestedAt: { gte: metricsStart } },
        select: {
          requestedAt: true,
          dispatchedAt: true,
          acceptedAt: true,
          departedAt: true,
          arrivedAt: true,
          startedAt: true,
          completedAt: true,
        },
      }),
    ]);
    const countOf = (status: FieldDispatchStatus) =>
      open.find((item) => item.status === status)?._count._all ?? 0;
    const metrics = recent.map((item) => deriveDispatchMetrics(item));
    const average = (values: Array<number | null>) => {
      const present = values.filter((value): value is number => value !== null);
      if (!present.length) return null;
      return Math.round(
        present.reduce((total, value) => total + value, 0) / present.length,
      );
    };
    return {
      awaiting: countOf(FieldDispatchStatus.REQUESTED),
      active: open.reduce((total, item) => total + item._count._all, 0),
      enRoute: countOf(FieldDispatchStatus.EN_ROUTE),
      onSite:
        countOf(FieldDispatchStatus.ARRIVED) +
        countOf(FieldDispatchStatus.IN_PROGRESS),
      completedToday,
      averageTimeToAcceptMinutes: average(
        metrics.map((item) => item.timeToAcceptMinutes),
      ),
      averageTimeToArrivalMinutes: average(
        metrics.map((item) => item.timeToArrivalMinutes),
      ),
    };
  }

  async findOne(id: string) {
    const dispatch = await this.prisma.fieldDispatch.findUnique({
      where: { id },
      include: dispatchDetailInclude,
    });
    if (!dispatch) throw new NotFoundException("Dispatch não encontrado.");
    const specialties = await this.teamSpecialties([dispatch.teamId]);
    return {
      ...dispatch,
      specialties: specialties.get(dispatch.teamId) ?? [],
      elapsedMinutes: elapsedMinutes(dispatch.requestedAt),
      metrics: deriveDispatchMetrics(dispatch),
    };
  }

  async create(dto: CreateDispatchDto, actorId: string) {
    const team = await this.prisma.fieldTeam.findUnique({
      where: { id: dto.teamId },
    });
    if (!team) throw new NotFoundException("Equipe não encontrada.");
    const demand = await this.resolveDemand(dto);
    await this.validateLocation(
      dto.electoralZoneId,
      dto.pollingPlaceId,
      team.electionId,
    );
    await this.assertEligible({
      team,
      memberId: dto.memberId ?? null,
      now: new Date(),
    });
    const requirements = await this.resolveRequirements(dto, demand.task);
    const requiredTeamSize =
      demand.task?.requiredTeamSize ?? dto.requiredTeamSize ?? null;
    const availableMembers = await this.availableTeamMembers(dto.teamId);
    const capabilityMatch = evaluateCapabilityMatch(
      requirements,
      requiredTeamSize,
      availableMembers.map((member) => ({
        specialtyIds: member.specialties.map((item) => item.specialtyId),
      })),
    );
    if (
      capabilityMatch &&
      capabilityMatch !== "MATCH" &&
      !dto.capabilityOverrideReason?.trim()
    ) {
      throw new BadRequestException(
        "Informe a justificativa do override de capability.",
      );
    }
    const priority =
      dto.priority ?? demand.task?.priority ?? TaskPriority.MEDIUM;
    const dispatch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.fieldDispatch.create({
        data: {
          teamId: dto.teamId,
          memberId: dto.memberId ?? null,
          taskId: dto.taskId ?? null,
          incidentId: dto.incidentId ?? null,
          priority,
          title: demand.title,
          notes: dto.notes,
          locationLabel: dto.locationLabel,
          electoralZoneId: dto.electoralZoneId ?? null,
          pollingPlaceId: dto.pollingPlaceId ?? null,
          capabilityMatch,
          capabilityOverrideReason: dto.capabilityOverrideReason?.trim(),
          createdById: actorId,
        },
        include: dispatchListInclude,
      });
      await tx.fieldDispatchEvent.create({
        data: {
          dispatchId: created.id,
          type: FieldDispatchEventType.CREATED,
          message: transitionLabels.REQUESTED,
          toStatus: FieldDispatchStatus.REQUESTED,
          actorId,
          metadata: {
            priority,
            capabilityMatch,
            requiredSpecialtyIds: requirements.map((item) => item.specialtyId),
            overrideReason: dto.capabilityOverrideReason?.trim() ?? null,
          },
        },
      });
      return created;
    });
    await this.eventBus?.emit("field_dispatch.created", {
      entityId: dispatch.id,
      actorId,
      teamId: dispatch.teamId,
      memberId: dispatch.memberId,
      taskId: dispatch.taskId,
      incidentId: dispatch.incidentId,
      priority: dispatch.priority,
      title: dispatch.title,
    });
    return summarize(dispatch, await this.specialtyNamesFor(dto.teamId));
  }

  async transition(
    id: string,
    dto: UpdateDispatchStatusDto,
    actorId: string,
  ) {
    const current = await this.prisma.fieldDispatch.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException("Dispatch não encontrado.");
    const transitionError = dispatchTransitionError(current.status, dto.status);
    if (transitionError) throw new BadRequestException(transitionError);
    const requiredError = dispatchRequiredFieldError(dto);
    if (requiredError) throw new BadRequestException(requiredError);

    const memberId =
      dto.status === FieldDispatchStatus.DISPATCHED && dto.memberId !== undefined
        ? dto.memberId || null
        : current.memberId;
    if (dto.status === FieldDispatchStatus.DISPATCHED) {
      await this.assertEligible({
        teamId: current.teamId,
        memberId,
        excludeDispatchId: current.id,
        now: new Date(),
      });
    }
    const at = new Date();
    const reason = dto.reason?.trim();
    const summary = dto.summary?.trim();
    const memberChanged = memberId !== current.memberId;
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.fieldDispatch.update({
        where: { id },
        data: {
          status: dto.status,
          memberId,
          [DISPATCH_TIMESTAMP_FIELDS[dto.status]]: at,
          ...(dto.status === FieldDispatchStatus.REJECTED
            ? { rejectionReason: reason }
            : {}),
          ...(dto.status === FieldDispatchStatus.CANCELLED
            ? { cancellationReason: reason }
            : {}),
          ...(dto.status === FieldDispatchStatus.COMPLETED
            ? { completionSummary: summary, completionResult: dto.result?.trim() }
            : {}),
        } as Prisma.FieldDispatchUpdateInput,
        include: dispatchListInclude,
      });
      await tx.fieldDispatchEvent.create({
        data: {
          dispatchId: id,
          type: transitionEventTypes[dto.status],
          message: dto.notes?.trim()
            ? `${transitionLabels[dto.status]} ${dto.notes.trim()}`
            : transitionLabels[dto.status],
          fromStatus: current.status,
          toStatus: dto.status,
          actorId,
          metadata: {
            ...(reason ? { reason } : {}),
            ...(summary ? { summary } : {}),
            ...(dto.result?.trim() ? { result: dto.result.trim() } : {}),
            ...(dto.notes?.trim() ? { notes: dto.notes.trim() } : {}),
          },
        },
      });
      if (memberChanged) {
        await tx.fieldDispatchEvent.create({
          data: {
            dispatchId: id,
            type: FieldDispatchEventType.ASSIGNED,
            message: saved.member
              ? `Responsável definido: ${saved.member.name}.`
              : "Responsável individual removido.",
            fromStatus: dto.status,
            toStatus: dto.status,
            actorId,
            metadata: { from: current.memberId, to: memberId },
          },
        });
      }
      return saved;
    });
    await this.publish(updated, actorId, reason, summary);
    return summarize(updated, await this.specialtyNamesFor(updated.teamId));
  }

  private async publish(
    dispatch: DispatchRecord & { member?: { name: string } | null },
    actorId: string,
    reason: string | undefined,
    summary: string | undefined,
  ) {
    const entityId = dispatch.id;
    const base = {
      entityId,
      actorId,
      teamId: dispatch.teamId,
      memberId: dispatch.memberId,
      taskId: dispatch.taskId,
    };
    switch (dispatch.status) {
      case FieldDispatchStatus.DISPATCHED:
        await this.eventBus?.emit("field_dispatch.dispatched", {
          ...base,
          priority: dispatch.priority,
        });
        return;
      case FieldDispatchStatus.ACCEPTED:
        await this.eventBus?.emit("field_dispatch.accepted", base);
        return;
      case FieldDispatchStatus.REJECTED:
        await this.eventBus?.emit("field_dispatch.rejected", {
          entityId,
          actorId,
          teamId: dispatch.teamId,
          taskId: dispatch.taskId,
          reason: reason ?? "",
        });
        return;
      case FieldDispatchStatus.EN_ROUTE:
        await this.eventBus?.emit("field_dispatch.departed", base);
        return;
      case FieldDispatchStatus.ARRIVED:
        await this.eventBus?.emit("field_dispatch.arrived", base);
        return;
      case FieldDispatchStatus.IN_PROGRESS:
        await this.eventBus?.emit("field_dispatch.started", base);
        return;
      case FieldDispatchStatus.COMPLETED:
        await this.eventBus?.emit("field_dispatch.completed", {
          ...base,
          summary: summary ?? "",
        });
        return;
      case FieldDispatchStatus.CANCELLED:
        await this.eventBus?.emit("field_dispatch.cancelled", {
          entityId,
          actorId,
          teamId: dispatch.teamId,
          taskId: dispatch.taskId,
          reason: reason ?? "",
        });
        return;
      default:
        return;
    }
  }

  private async resolveDemand(dto: CreateDispatchDto) {
    const [task, incident] = await Promise.all([
      dto.taskId
        ? this.prisma.task.findUnique({
            where: { id: dto.taskId },
            include: dispatchTaskInclude,
          })
        : null,
      dto.incidentId
        ? this.prisma.incident.findUnique({
            where: { id: dto.incidentId },
            select: { id: true, code: true, title: true },
          })
        : null,
    ]);
    if (dto.taskId && !task) throw new NotFoundException("Tarefa não encontrada.");
    if (dto.incidentId && !incident)
      throw new NotFoundException("Incidente não encontrado.");
    const title = dto.title?.trim() || task?.title || incident?.title;
    if (!title)
      throw new BadRequestException(
        "Informe um título ou vincule uma tarefa ou incidente.",
      );
    return { task, incident, title };
  }

  private async resolveRequirements(
    dto: CreateDispatchDto,
    task: Prisma.TaskGetPayload<{ include: typeof dispatchTaskInclude }> | null,
  ): Promise<DispatchRequirement[]> {
    if (task?.specialtyRequirements.length) {
      return task.specialtyRequirements.map((item) => ({
        specialtyId: item.specialtyId,
        requiredCount: item.requiredCount,
      }));
    }
    const specialtyIds = dto.requiredSpecialtyIds ?? [];
    if (!specialtyIds.length) return [];
    const count = await this.prisma.fieldSpecialty.count({
      where: { id: { in: specialtyIds }, active: true },
    });
    if (count !== specialtyIds.length)
      throw new BadRequestException(
        "Uma ou mais especialidades são inválidas.",
      );
    return specialtyIds.map((specialtyId) => ({
      specialtyId,
      requiredCount: 1,
    }));
  }

  private availableTeamMembers(teamId: string) {
    const now = new Date();
    return this.prisma.fieldMember.findMany({
      where: {
        teamId,
        status: {
          notIn: [MemberAvailability.UNAVAILABLE, MemberAvailability.OFF_DUTY],
        },
        unavailability: {
          none: { startsAt: { lte: now }, endsAt: { gt: now } },
        },
      },
      select: { id: true, specialties: { select: { specialtyId: true } } },
    });
  }

  private async assertEligible(input: {
    team?: { id: string; status: FieldTeamStatus };
    teamId?: string;
    memberId?: string | null;
    excludeDispatchId?: string;
    now: Date;
  }) {
    const team = input.team ?? (await this.prisma.fieldTeam.findUnique({
      where: { id: input.teamId },
    }));
    if (!team) throw new NotFoundException("Equipe não encontrada.");
    if (team.status !== FieldTeamStatus.ACTIVE)
      throw new ConflictException("A equipe não está ativa.");
    if (input.memberId) {
      const member = await this.prisma.fieldMember.findUnique({
        where: { id: input.memberId },
      });
      if (!member || member.teamId !== team.id)
        throw new BadRequestException("O membro não pertence à equipe.");
      if (
        member.status === MemberAvailability.UNAVAILABLE ||
        member.status === MemberAvailability.OFF_DUTY
      )
        throw new ConflictException("O membro está indisponível.");
      const unavailable = await this.prisma.fieldMemberUnavailability.findFirst({
        where: {
          memberId: member.id,
          startsAt: { lte: input.now },
          endsAt: { gt: input.now },
        },
        select: { id: true },
      });
      if (unavailable)
        throw new ConflictException(
          "O membro possui indisponibilidade no momento.",
        );
      const absent = await this.prisma.fieldShiftAssignment.findFirst({
        where: {
          memberId: member.id,
          status: FieldShiftAssignmentStatus.ABSENT,
          startsAt: { lte: input.now },
          endsAt: { gt: input.now },
          shift: { status: { not: FieldShiftStatus.CANCELLED } },
        },
        select: { id: true },
      });
      if (absent)
        throw new ConflictException("O membro está ausente em turno ativo.");
    }
    const open = await this.prisma.fieldDispatch.findFirst({
      where: {
        ...(input.memberId
          ? { memberId: input.memberId }
          : { teamId: team.id, memberId: null }),
        status: { notIn: [...FIELD_DISPATCH_TERMINAL_STATUSES] },
        id: input.excludeDispatchId ? { not: input.excludeDispatchId } : undefined,
      },
      select: { id: true },
    });
    if (open)
      throw new ConflictException(
        "Já existe um dispatch ativo para este destino.",
      );
  }

  private async teamSpecialties(teamIds: readonly string[]) {
    const unique = [...new Set(teamIds)];
    if (!unique.length) return new Map<string, string[]>();
    const members = await this.prisma.fieldMember.findMany({
      where: {
        teamId: { in: unique },
        status: {
          notIn: [MemberAvailability.UNAVAILABLE, MemberAvailability.OFF_DUTY],
        },
      },
      select: {
        teamId: true,
        specialties: { select: { specialty: { select: { name: true } } } },
      },
    });
    const result = new Map<string, string[]>();
    for (const member of members) {
      const names = result.get(member.teamId) ?? [];
      for (const item of member.specialties) {
        if (!names.includes(item.specialty.name)) names.push(item.specialty.name);
      }
      result.set(member.teamId, names.sort());
    }
    return result;
  }

  private async specialtyNamesFor(teamId: string) {
    return (await this.teamSpecialties([teamId])).get(teamId) ?? [];
  }

  private async validateLocation(
    zoneId: string | undefined,
    placeId: string | undefined,
    electionId: string,
  ) {
    const [zone, place] = await Promise.all([
      zoneId
        ? this.prisma.electoralZone.findUnique({ where: { id: zoneId } })
        : null,
      placeId
        ? this.prisma.pollingPlace.findUnique({
            where: { id: placeId },
            include: { electoralZone: true },
          })
        : null,
    ]);
    if (zoneId && (!zone || zone.electionId !== electionId))
      throw new BadRequestException("Zona incompatível com o pleito.");
    if (placeId && (!place || place.electoralZone.electionId !== electionId))
      throw new BadRequestException("Local incompatível com o pleito.");
    if (zone && place && place.electoralZoneId !== zone.id)
      throw new BadRequestException("O local não pertence à zona.");
  }
}
