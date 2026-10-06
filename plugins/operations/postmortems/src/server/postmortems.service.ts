import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  IncidentStatus,
  PostmortemActionStatus,
  PostmortemCauseType,
  PostmortemReviewDecision,
  PostmortemStatus,
  PostmortemTimelineSource,
  Prisma,
  UserStatus,
} from "@prisma/client";
import { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import { PERMISSIONS } from "@eops/security";
import {
  POSTMORTEM_ACTIVE_STATUSES,
  availablePostmortemActions,
  canTransitionPostmortem,
  evaluatePostmortemApproval,
  isPostmortemActionOverdue,
  isPostmortemEditable,
  postmortemCode,
  postmortemSubmitBlockers,
  validateCausePlacement,
} from "@eops/shared/postmortems";
import {
  actionCounters,
  averageTimeToPublishHours,
  causesByCategory,
  causesByType,
  incidentsBySeverity,
  lessonsByCategory,
  lessonsByType,
  recurringCauses,
  statusCounters,
} from "./insights";
import {
  handoverCandidates,
  incidentEventCandidates,
  incidentMilestones,
  planTimelineImport,
  resourceRequestCandidates,
  taskCandidates,
  type TimelineCandidate,
} from "./timeline-import";
import type {
  CreateActionDto,
  CreateCauseDto,
  CreateLessonDto,
  CreatePostmortemDto,
  ImportTimelineDto,
  PostmortemQueryDto,
  PublishDto,
  RelatedIncidentDto,
  ReviewDecisionDto,
  ReviewerDto,
  TimelineEntryDto,
  UpdateActionDto,
  UpdateCauseDto,
  UpdateLessonDto,
  UpdatePostmortemDto,
} from "./dto/postmortems.dto";

const actor = { select: { id: true, name: true, email: true } } as const;

const postmortemInclude = {
  primaryIncident: {
    select: {
      id: true,
      code: true,
      title: true,
      severity: true,
      status: true,
      openedAt: true,
      resolvedAt: true,
      closedAt: true,
      electionId: true,
      electoralZoneId: true,
      pollingPlaceId: true,
    },
  },
  createdBy: actor,
  owner: actor,
  publishedBy: actor,
  relatedIncidents: {
    include: {
      incident: {
        select: { id: true, code: true, title: true, severity: true, status: true },
      },
    },
  },
  causes: { orderBy: [{ order: "asc" as const }, { createdAt: "asc" as const }] },
  lessons: { orderBy: { createdAt: "asc" as const } },
  actions: {
    include: {
      ownerUser: { select: { id: true, name: true } },
      task: { select: { id: true, title: true, status: true } },
    },
    orderBy: [{ status: "asc" as const }, { dueAt: "asc" as const }],
  },
  reviewers: { include: { user: { select: { id: true, name: true, status: true } } } },
  reviews: {
    include: { reviewer: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" as const },
  },
  timeline: { orderBy: [{ occurredAt: "asc" as const }, { createdAt: "asc" as const }] },
} satisfies Prisma.PostmortemInclude;

type PostmortemRecord = Prisma.PostmortemGetPayload<{
  include: typeof postmortemInclude;
}>;

export function projectPostmortem(
  record: PostmortemRecord,
  actorId: string,
  permissions: readonly string[],
  now: Date = new Date(),
) {
  const reviewerIds = record.reviewers.map((reviewer) => reviewer.userId);
  const approval = evaluatePostmortemApproval(
    reviewerIds,
    record.reviews.map((review) => ({
      reviewerId: review.reviewerId,
      decision: review.decision,
      createdAt: review.createdAt,
    })),
  );
  return {
    ...record,
    approval,
    actions: record.actions.map((action) => ({
      ...action,
      overdue: isPostmortemActionOverdue(action, now),
    })),
    availableActions: availablePostmortemActions({
      status: record.status,
      createdById: record.createdById,
      ownerId: record.ownerId,
      actorId,
      permissions,
      isReviewer: reviewerIds.includes(actorId),
    }),
  };
}

@Injectable()
export class PostmortemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  /** Incidentes elegíveis: resolvidos ou encerrados, ainda sem postmortem ativo. */
  async eligibleIncidents(electionId?: string) {
    const existing = await this.prisma.postmortem.findMany({
      where: { status: { in: POSTMORTEM_ACTIVE_STATUSES as PostmortemStatus[] } },
      select: { primaryIncidentId: true },
    });
    const taken = new Set(existing.map((row) => row.primaryIncidentId));
    const incidents = await this.prisma.incident.findMany({
      where: {
        electionId,
        isSimulated: false,
        status: { in: [IncidentStatus.RESOLVED, IncidentStatus.CLOSED] },
      },
      select: {
        id: true,
        code: true,
        title: true,
        severity: true,
        status: true,
        openedAt: true,
        resolvedAt: true,
      },
      orderBy: [{ resolvedAt: "desc" }, { openedAt: "desc" }],
      take: 300,
    });
    return incidents.map((incident) => ({
      ...incident,
      hasActivePostmortem: taken.has(incident.id),
    }));
  }

  async references() {
    const [incidents, users, tasks, elections] = await Promise.all([
      this.eligibleIncidents(),
      this.prisma.user.findMany({
        where: { status: UserStatus.ACTIVE },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.task.findMany({
        select: { id: true, title: true, status: true, electionId: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      this.prisma.election.findMany({
        select: { id: true, name: true },
        orderBy: { year: "desc" },
      }),
    ]);
    return { incidents, users, tasks, elections };
  }

  async list(query: PostmortemQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.PostmortemWhereInput = {
      status: query.status,
      ownerId: query.ownerId,
      createdById: query.createdById,
      primaryIncidentId: query.incidentId,
      primaryIncident: query.electionId
        ? { electionId: query.electionId }
        : undefined,
      OR: query.search
        ? [
            { title: { contains: query.search, mode: "insensitive" } },
            { code: { contains: query.search, mode: "insensitive" } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.postmortem.findMany({
        where,
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          publishedAt: true,
          owner: { select: { id: true, name: true } },
          primaryIncident: {
            select: { id: true, code: true, title: true, severity: true },
          },
          _count: { select: { actions: true, lessons: true, causes: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.postmortem.count({ where }),
    ]);
    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async dashboard() {
    const now = new Date();
    const [records, actions, withoutPostmortem] = await Promise.all([
      this.prisma.postmortem.findMany({
        select: { id: true, status: true, createdAt: true, publishedAt: true, primaryIncident: { select: { severity: true } } },
      }),
      this.prisma.postmortemActionItem.findMany({
        select: { status: true, dueAt: true },
      }),
      this.prisma.incident.count({
        where: {
          isSimulated: false,
          severity: { in: ["HIGH", "CRITICAL"] },
          status: { in: [IncidentStatus.RESOLVED, IncidentStatus.CLOSED] },
          postmortems: {
            none: { status: { in: POSTMORTEM_ACTIVE_STATUSES as PostmortemStatus[] } },
          },
        },
      }),
    ]);
    const counters = statusCounters(
      records.map((record) => ({
        id: record.id,
        status: record.status,
        createdAt: record.createdAt,
        publishedAt: record.publishedAt,
        severity: record.primaryIncident.severity,
      })),
    );
    const actionState = actionCounters(actions, now);
    const recentPublished = await this.prisma.postmortem.findMany({
      where: { status: PostmortemStatus.PUBLISHED },
      select: {
        id: true,
        code: true,
        title: true,
        publishedAt: true,
        primaryIncident: { select: { code: true, severity: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: 8,
    });
    return {
      generatedAt: now.toISOString(),
      counters: {
        draft: counters.get(PostmortemStatus.DRAFT) ?? 0,
        inReview: counters.get(PostmortemStatus.IN_REVIEW) ?? 0,
        changesRequested: counters.get(PostmortemStatus.CHANGES_REQUESTED) ?? 0,
        approved: counters.get(PostmortemStatus.APPROVED) ?? 0,
        published: counters.get(PostmortemStatus.PUBLISHED) ?? 0,
        archived: counters.get(PostmortemStatus.ARCHIVED) ?? 0,
        overdueActionItems: actionState.overdue,
      },
      criticalIncidentsWithoutPostmortem: withoutPostmortem,
      recentPublished,
    };
  }

  async insights() {
    const now = new Date();
    const [records, causes, lessons, actions] = await Promise.all([
      this.prisma.postmortem.findMany({
        where: { status: { not: PostmortemStatus.ARCHIVED } },
        select: {
          id: true,
          status: true,
          createdAt: true,
          publishedAt: true,
          primaryIncident: { select: { severity: true } },
        },
      }),
      this.prisma.postmortemCause.findMany({
        where: { postmortem: { status: { not: PostmortemStatus.ARCHIVED } } },
        select: { postmortemId: true, type: true, category: true, statement: true },
      }),
      this.prisma.postmortemLesson.findMany({
        where: { postmortem: { status: { not: PostmortemStatus.ARCHIVED } } },
        select: { type: true, category: true },
      }),
      this.prisma.postmortemActionItem.findMany({
        where: { postmortem: { status: { not: PostmortemStatus.ARCHIVED } } },
        select: { status: true, dueAt: true },
      }),
    ]);

    const shaped = records.map((record) => ({
      id: record.id,
      status: record.status,
      createdAt: record.createdAt,
      publishedAt: record.publishedAt,
      severity: record.primaryIncident.severity,
    }));

    return {
      generatedAt: now.toISOString(),
      sampleSize: shaped.length,
      causesByCategory: causesByCategory(causes),
      causesByType: causesByType(causes),
      recurringCauses: recurringCauses(causes),
      lessonsByType: lessonsByType(lessons),
      lessonsByCategory: lessonsByCategory(lessons),
      incidentsBySeverity: incidentsBySeverity(shaped),
      actionItems: actionCounters(actions, now),
      averageTimeToPublishHours: averageTimeToPublishHours(shaped),
      publishedCount: shaped.filter((row) => row.publishedAt !== null).length,
    };
  }

  async findOne(id: string, actorId: string, permissions: readonly string[]) {
    const record = await this.require(id);
    return projectPostmortem(record, actorId, permissions);
  }

  async create(dto: CreatePostmortemDto, actorId: string) {
    const incident = await this.requireEligibleIncident(dto.primaryIncidentId);
    const active = await this.prisma.postmortem.findFirst({
      where: {
        primaryIncidentId: dto.primaryIncidentId,
        status: { in: POSTMORTEM_ACTIVE_STATUSES as PostmortemStatus[] },
      },
      select: { id: true, code: true },
    });
    if (active)
      throw new ConflictException(
        `Já existe um postmortem ativo para este incidente (${active.code}).`,
      );

    const record = await this.prisma.$transaction(async (tx) => {
      const code = await this.nextCode(tx);
      return tx.postmortem.create({
        data: {
          code,
          title: dto.title.trim(),
          primaryIncidentId: incident.id,
          createdById: actorId,
          ownerId: dto.ownerId ?? actorId,
        },
        include: postmortemInclude,
      });
    });

    await this.eventBus.emit("postmortem.created", {
      entityId: record.id,
      actorId,
      code: record.code,
      title: record.title,
      primaryIncidentId: record.primaryIncidentId,
      status: record.status,
    });
    return projectPostmortem(record, actorId, []);
  }

  async update(
    id: string,
    dto: UpdatePostmortemDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    this.assertEditable(current, actorId, permissions);
    if (dto.ownerId) {
      const owner = await this.prisma.user.findUnique({
        where: { id: dto.ownerId },
        select: { status: true },
      });
      if (!owner || owner.status !== UserStatus.ACTIVE)
        throw new BadRequestException("Selecione um responsável ativo.");
    }
    const record = await this.prisma.postmortem.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        ownerId: dto.ownerId,
        executiveSummary: dto.executiveSummary?.trim(),
        impactSummary: dto.impactSummary?.trim(),
        detectionSummary: dto.detectionSummary?.trim(),
        responseSummary: dto.responseSummary?.trim(),
        resolutionSummary: dto.resolutionSummary?.trim(),
        rootCauseSummary: dto.rootCauseSummary?.trim(),
        lessonsSummary: dto.lessonsSummary?.trim(),
      },
      include: postmortemInclude,
    });
    return projectPostmortem(record, actorId, permissions);
  }

  async addCause(
    id: string,
    dto: CreateCauseDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    this.assertEditable(current, actorId, permissions);
    const placementError = validateCausePlacement(
      dto.parentId ?? null,
      current.causes.map((cause) => ({ id: cause.id, parentId: cause.parentId })),
    );
    if (placementError) throw new BadRequestException(placementError);
    await this.prisma.postmortemCause.create({
      data: {
        postmortemId: id,
        parentId: dto.parentId ?? null,
        type: dto.type,
        category: dto.category,
        statement: dto.statement.trim(),
        evidence: dto.evidence?.trim() || null,
        order: dto.order ?? 0,
      },
    });
    return projectPostmortem(await this.require(id), actorId, permissions);
  }

  async updateCause(
    id: string,
    causeId: string,
    dto: UpdateCauseDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    this.assertEditable(current, actorId, permissions);
    const cause = current.causes.find((entry) => entry.id === causeId);
    if (!cause) throw new NotFoundException("Causa não encontrada.");
    if (dto.parentId !== undefined && dto.parentId !== cause.parentId) {
      if (dto.parentId === causeId)
        throw new BadRequestException("Uma causa não pode ser sua própria superior.");
      const placementError = validateCausePlacement(
        dto.parentId,
        current.causes.map((entry) => ({ id: entry.id, parentId: entry.parentId })),
      );
      if (placementError) throw new BadRequestException(placementError);
    }
    await this.prisma.postmortemCause.update({
      where: { id: causeId },
      data: {
        parentId: dto.parentId,
        type: dto.type,
        category: dto.category,
        statement: dto.statement?.trim(),
        evidence:
          dto.evidence === undefined ? undefined : dto.evidence.trim() || null,
        order: dto.order,
      },
    });
    return projectPostmortem(await this.require(id), actorId, permissions);
  }

  async removeCause(
    id: string,
    causeId: string,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    this.assertEditable(current, actorId, permissions);
    const cause = current.causes.find((entry) => entry.id === causeId);
    if (!cause) throw new NotFoundException("Causa não encontrada.");
    await this.prisma.postmortemCause.delete({ where: { id: causeId } });
    return projectPostmortem(await this.require(id), actorId, permissions);
  }

  async addLesson(
    id: string,
    dto: CreateLessonDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    this.assertEditable(current, actorId, permissions);
    await this.prisma.postmortemLesson.create({
      data: {
        postmortemId: id,
        type: dto.type,
        title: dto.title.trim(),
        description: dto.description.trim(),
        category: dto.category ?? null,
      },
    });
    return projectPostmortem(await this.require(id), actorId, permissions);
  }

  async updateLesson(
    id: string,
    lessonId: string,
    dto: UpdateLessonDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    this.assertEditable(current, actorId, permissions);
    if (!current.lessons.some((lesson) => lesson.id === lessonId))
      throw new NotFoundException("Lição não encontrada.");
    await this.prisma.postmortemLesson.update({
      where: { id: lessonId },
      data: {
        type: dto.type,
        title: dto.title?.trim(),
        description: dto.description?.trim(),
        category: dto.category,
      },
    });
    return projectPostmortem(await this.require(id), actorId, permissions);
  }

  async removeLesson(
    id: string,
    lessonId: string,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    this.assertEditable(current, actorId, permissions);
    if (!current.lessons.some((lesson) => lesson.id === lessonId))
      throw new NotFoundException("Lição não encontrada.");
    await this.prisma.postmortemLesson.delete({ where: { id: lessonId } });
    return projectPostmortem(await this.require(id), actorId, permissions);
  }

  async addAction(
    id: string,
    dto: CreateActionDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    this.assertEditable(current, actorId, permissions);
    if (dto.ownerUserId) await this.requireActiveUser(dto.ownerUserId);
    if (dto.taskId) await this.requireTask(dto.taskId);
    await this.prisma.postmortemActionItem.create({
      data: {
        postmortemId: id,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        priority: dto.priority ?? "MEDIUM",
        ownerUserId: dto.ownerUserId ?? null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        taskId: dto.taskId ?? null,
        createdById: actorId,
      },
    });
    return projectPostmortem(await this.require(id), actorId, permissions);
  }

  async updateAction(
    id: string,
    actionId: string,
    dto: UpdateActionDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    const existing = current.actions.find((entry) => entry.id === actionId);
    if (!existing) throw new NotFoundException("Ação corretiva não encontrada.");
    if (this.isEditable(current, actorId, permissions)) {
      if (dto.ownerUserId) await this.requireActiveUser(dto.ownerUserId);
      if (dto.taskId) await this.requireTask(dto.taskId);
    } else if (!this.canTrackActions(current, actorId, permissions)) {
      throw new ForbiddenException(
        "Você não pode atualizar ações corretivas deste postmortem.",
      );
    } else if (
      dto.title !== undefined ||
      dto.description !== undefined ||
      dto.priority !== undefined ||
      dto.ownerUserId !== undefined ||
      dto.taskId !== undefined ||
      dto.dueAt !== undefined
    ) {
      throw new ForbiddenException(
        "Após o review, apenas o status da ação corretiva pode ser atualizado.",
      );
    }

    await this.prisma.postmortemActionItem.update({
      where: { id: actionId },
      data: {
        title: dto.title?.trim(),
        description:
          dto.description === undefined ? undefined : dto.description.trim() || null,
        priority: dto.priority,
        ownerUserId: dto.ownerUserId,
        dueAt:
          dto.dueAt === undefined ? undefined : dto.dueAt ? new Date(dto.dueAt) : null,
        taskId: dto.taskId,
        status: dto.status,
        completedAt:
          dto.status === undefined
            ? undefined
            : dto.status === PostmortemActionStatus.DONE
              ? new Date()
              : null,
      },
    });
    return projectPostmortem(await this.require(id), actorId, permissions);
  }

  async removeAction(
    id: string,
    actionId: string,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    this.assertEditable(current, actorId, permissions);
    if (!current.actions.some((entry) => entry.id === actionId))
      throw new NotFoundException("Ação corretiva não encontrada.");
    await this.prisma.postmortemActionItem.delete({ where: { id: actionId } });
    return projectPostmortem(await this.require(id), actorId, permissions);
  }

  async setRelatedIncidents(
    id: string,
    dto: RelatedIncidentDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    this.assertEditable(current, actorId, permissions);
    const incidentIds = [...new Set(dto.incidentIds)];
    if (incidentIds.includes(current.primaryIncidentId))
      throw new BadRequestException(
        "O incidente primário não pode ser listado como relacionado.",
      );
    if (incidentIds.length) {
      const found = await this.prisma.incident.findMany({
        where: { id: { in: incidentIds } },
        select: { id: true },
      });
      if (found.length !== incidentIds.length)
        throw new BadRequestException("Um ou mais incidentes não existem.");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.postmortemRelatedIncident.deleteMany({ where: { postmortemId: id } });
      if (incidentIds.length)
        await tx.postmortemRelatedIncident.createMany({
          data: incidentIds.map((incidentId) => ({
            postmortemId: id,
            incidentId,
          })),
        });
    });
    return projectPostmortem(await this.require(id), actorId, permissions);
  }

  async setReviewers(
    id: string,
    dto: ReviewerDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    this.assertEditable(current, actorId, permissions);
    const userIds = [...new Set(dto.userIds)];
    if (userIds.length) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds }, status: UserStatus.ACTIVE },
        select: { id: true },
      });
      if (users.length !== userIds.length)
        throw new BadRequestException(
          "Todos os revisores precisam ser usuários ativos.",
        );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.postmortemReviewer.deleteMany({ where: { postmortemId: id } });
      if (userIds.length)
        await tx.postmortemReviewer.createMany({
          data: userIds.map((userId) => ({ postmortemId: id, userId })),
        });
    });
    return projectPostmortem(await this.require(id), actorId, permissions);
  }

  async addTimelineEntry(
    id: string,
    dto: TimelineEntryDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    this.assertEditable(current, actorId, permissions);
    await this.prisma.postmortemTimelineEntry.create({
      data: {
        postmortemId: id,
        occurredAt: new Date(dto.occurredAt),
        sourceType: PostmortemTimelineSource.MANUAL,
        sourceId: null,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        imported: false,
        createdById: actorId,
      },
    });
    return projectPostmortem(await this.require(id), actorId, permissions);
  }

  async removeTimelineEntry(
    id: string,
    entryId: string,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    this.assertEditable(current, actorId, permissions);
    const entry = current.timeline.find((item) => item.id === entryId);
    if (!entry) throw new NotFoundException("Entrada de timeline não encontrada.");
    if (entry.imported)
      throw new BadRequestException(
        "Entradas importadas são regeneradas a partir da origem.",
      );
    await this.prisma.postmortemTimelineEntry.delete({ where: { id: entryId } });
    return projectPostmortem(await this.require(id), actorId, permissions);
  }

  /**
   * Importa a timeline operacional. Idempotente por (sourceType, sourceId):
   * reimportar não cria duplicata e devolve a contagem de entradas ignoradas.
   */
  async importTimeline(
    id: string,
    dto: ImportTimelineDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    this.assertEditable(current, actorId, permissions);
    const incidentIds = [
      current.primaryIncidentId,
      ...current.relatedIncidents.map((row) => row.incidentId),
    ];

    const [incidents, events, handovers, requests, tasks] = await Promise.all([
      this.prisma.incident.findMany({
        where: { id: { in: incidentIds } },
        select: {
          id: true,
          code: true,
          title: true,
          openedAt: true,
          acknowledgedAt: true,
          escalatedAt: true,
          escalationLevel: true,
          resolvedAt: true,
          closedAt: true,
        },
      }),
      this.prisma.incidentEvent.findMany({
        where: { incidentId: { in: incidentIds } },
        select: { id: true, type: true, message: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.shiftHandover.findMany({
        where: { incidents: { some: { incidentId: { in: incidentIds } } } },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          confirmedAt: true,
          cancelledAt: true,
          createdAt: true,
          shift: { select: { name: true } },
        },
      }),
      this.prisma.resourceRequest.findMany({
        where: { incidentId: { in: incidentIds } },
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
          submittedAt: true,
          approvedAt: true,
          fulfilledAt: true,
          rejectedAt: true,
        },
      }),
      dto.includeTasks
        ? this.prisma.task.findMany({
            where: {
              OR: [
                { dispatches: { some: { incidentId: { in: incidentIds } } } },
                { handoverReferences: { some: { handover: { incidents: { some: { incidentId: { in: incidentIds } } } } } } },
              ],
            },
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              createdAt: true,
              completedAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const candidates: TimelineCandidate[] = [
      ...incidents.flatMap((incident) => incidentMilestones(incident)),
      ...(dto.includeIncidentEvents
        ? incidentEventCandidates(events)
        : []),
      ...handoverCandidates(
        handovers.map((handover) => ({
          id: handover.id,
          status: handover.status,
          submittedAt: handover.submittedAt,
          confirmedAt: handover.confirmedAt,
          cancelledAt: handover.cancelledAt,
          createdAt: handover.createdAt,
          shiftName: handover.shift.name,
        })),
      ),
      ...resourceRequestCandidates(requests),
      ...taskCandidates(tasks),
    ];

    const existing = await this.prisma.postmortemTimelineEntry.findMany({
      where: { postmortemId: id, sourceId: { not: null } },
      select: { sourceType: true, sourceId: true },
    });
    const existingKeys = new Set(
      existing.map((entry) => `${entry.sourceType}:${entry.sourceId}`),
    );
    const plan = planTimelineImport(candidates, existingKeys);

    const created = plan.toCreate.length
      ? await this.prisma.postmortemTimelineEntry.createMany({
          data: plan.toCreate.map((candidate) => ({
            postmortemId: id,
            occurredAt: candidate.occurredAt,
            sourceType: candidate.sourceType,
            sourceId: candidate.sourceId,
            title: candidate.title,
            description: candidate.description,
            imported: true,
            createdById: actorId,
          })),
          skipDuplicates: true,
        })
      : { count: 0 };

    return {
      postmortem: projectPostmortem(await this.require(id), actorId, permissions),
      imported: created.count,
      skipped: plan.skipped,
    };
  }

  async submitForReview(
    id: string,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    if (
      current.status !== PostmortemStatus.DRAFT &&
      current.status !== PostmortemStatus.CHANGES_REQUESTED
    )
      throw new ConflictException(
        "Somente rascunhos ou postmortems com mudanças solicitadas podem ir para review.",
      );
    this.assertOwner(current, actorId, permissions);

    const blockers = postmortemSubmitBlockers({
      incidentStatus: current.primaryIncident.status,
      severity: current.primaryIncident.severity,
      executiveSummary: current.executiveSummary,
      impactSummary: current.impactSummary,
      rootCauseSummary: current.rootCauseSummary,
      rootCauseCount: current.causes.filter(
        (cause) => cause.type === PostmortemCauseType.ROOT_CAUSE,
      ).length,
      lessonCount: current.lessons.length,
      actionCount: current.actions.length,
      reviewerCount: current.reviewers.length,
    });
    if (blockers.length) throw new BadRequestException(blockers);

    const now = new Date();
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.postmortem.update({
        where: { id },
        data: {
          status: PostmortemStatus.IN_REVIEW,
          submittedForReviewAt: now,
        },
      });
      return tx.postmortem.findUniqueOrThrow({
        where: { id },
        include: postmortemInclude,
      });
    });

    await this.eventBus.emit("postmortem.submitted", {
      entityId: id,
      actorId,
      code: record.code,
      title: record.title,
      primaryIncidentId: record.primaryIncidentId,
      from: current.status,
      to: record.status,
      reviewerIds: record.reviewers.map((reviewer) => reviewer.userId),
      submittedForReviewAt: now.toISOString(),
    });
    return projectPostmortem(record, actorId, permissions);
  }

  async review(
    id: string,
    dto: ReviewDecisionDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    if (current.status !== PostmortemStatus.IN_REVIEW)
      throw new ConflictException("Somente postmortems em review aceitam decisão.");
    const reviewer = current.reviewers.find((entry) => entry.userId === actorId);
    if (!reviewer)
      throw new ForbiddenException("Você não é revisor designado deste postmortem.");
    const reviewerUser = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { status: true },
    });
    if (!reviewerUser || reviewerUser.status !== UserStatus.ACTIVE)
      throw new ForbiddenException("Somente usuários ativos podem revisar.");
    if (
      dto.decision === PostmortemReviewDecision.CHANGES_REQUESTED &&
      !dto.comment?.trim()
    )
      throw new BadRequestException(
        "Informe o que precisa mudar ao solicitar ajustes.",
      );

    const now = new Date();
    const reviewerIds = current.reviewers.map((entry) => entry.userId);
    const approval = evaluatePostmortemApproval(reviewerIds, [
      ...current.reviews.map((review) => ({
        reviewerId: review.reviewerId,
        decision: review.decision,
        createdAt: review.createdAt,
      })),
      { reviewerId: actorId, decision: dto.decision, createdAt: now },
    ]);
    const nextStatus =
      dto.decision === PostmortemReviewDecision.CHANGES_REQUESTED
        ? PostmortemStatus.CHANGES_REQUESTED
        : approval.approved
          ? PostmortemStatus.APPROVED
          : PostmortemStatus.IN_REVIEW;

    const record = await this.prisma.$transaction(async (tx) => {
      await tx.postmortemReview.create({
        data: {
          postmortemId: id,
          reviewerId: actorId,
          decision: dto.decision,
          comment: dto.comment?.trim() || null,
        },
      });
      await tx.postmortem.update({
        where: { id },
        data: {
          status: nextStatus,
          approvedAt:
            nextStatus === PostmortemStatus.APPROVED ? now : null,
        },
      });
      return tx.postmortem.findUniqueOrThrow({
        where: { id },
        include: postmortemInclude,
      });
    });

    if (nextStatus === PostmortemStatus.CHANGES_REQUESTED) {
      await this.eventBus.emit("postmortem.changes_requested", {
        entityId: id,
        actorId,
        code: record.code,
        title: record.title,
        ownerId: record.ownerId,
        reviewerId: actorId,
        from: current.status,
        to: record.status,
        comment: dto.comment?.trim(),
      });
    } else if (nextStatus === PostmortemStatus.APPROVED) {
      await this.eventBus.emit("postmortem.approved", {
        entityId: id,
        actorId,
        code: record.code,
        title: record.title,
        ownerId: record.ownerId,
        from: current.status,
        to: record.status,
        approvedAt: now.toISOString(),
      });
    }
    return projectPostmortem(record, actorId, permissions);
  }

  async publish(
    id: string,
    _dto: PublishDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    if (current.status !== PostmortemStatus.APPROVED)
      throw new ConflictException("Somente postmortems aprovados podem ser publicados.");
    const now = new Date();
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.postmortem.update({
        where: { id },
        data: {
          status: PostmortemStatus.PUBLISHED,
          publishedAt: now,
          publishedById: actorId,
        },
      });
      return tx.postmortem.findUniqueOrThrow({
        where: { id },
        include: postmortemInclude,
      });
    });
    await this.eventBus.emit("postmortem.published", {
      entityId: id,
      actorId,
      code: record.code,
      title: record.title,
      ownerId: record.ownerId,
      reviewerIds: record.reviewers.map((reviewer) => reviewer.userId),
      from: current.status,
      to: record.status,
      publishedAt: now.toISOString(),
    });
    return projectPostmortem(record, actorId, permissions);
  }

  async archive(
    id: string,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    const from = current.status;
    if (!canTransitionPostmortem(from, PostmortemStatus.ARCHIVED))
      throw new ConflictException(`Transição ${from} → ARCHIVED não permitida.`);
    const now = new Date();
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.postmortem.update({
        where: { id },
        data: { status: PostmortemStatus.ARCHIVED, archivedAt: now },
      });
      return tx.postmortem.findUniqueOrThrow({
        where: { id },
        include: postmortemInclude,
      });
    });
    await this.eventBus.emit("postmortem.archived", {
      entityId: id,
      actorId,
      code: record.code,
      title: record.title,
      from,
      to: record.status,
      archivedAt: now.toISOString(),
    });
    return projectPostmortem(record, actorId, permissions);
  }

  /**
   * Emite `postmortem.action_overdue` para ações vencidas ainda não sinalizadas.
   * Sem scheduler: a marcação acontece na leitura autenticada do dashboard e é
   * registrada em `overdueNotifiedAt` para nunca repetir.
   */
  async notifyOverdueActions(actorId: string) {
    const now = new Date();
    const overdue = await this.prisma.postmortemActionItem.findMany({
      where: {
        status: { in: [PostmortemActionStatus.OPEN, PostmortemActionStatus.IN_PROGRESS] },
        dueAt: { lt: now },
        overdueNotifiedAt: null,
        postmortem: { status: { not: PostmortemStatus.ARCHIVED } },
      },
      select: {
        id: true,
        title: true,
        dueAt: true,
        ownerUserId: true,
        postmortemId: true,
        postmortem: { select: { code: true, title: true } },
      },
      take: 100,
    });
    for (const item of overdue) {
      await this.prisma.postmortemActionItem.update({
        where: { id: item.id },
        data: { overdueNotifiedAt: now },
      });
      await this.eventBus.emit("postmortem.action_overdue", {
        entityId: item.postmortemId,
        actorId,
        actionItemId: item.id,
        postmortemId: item.postmortemId,
        code: item.postmortem.code,
        title: `${item.title} · ${item.postmortem.title}`,
        ownerUserId: item.ownerUserId,
        dueAt: item.dueAt!.toISOString(),
        overdueAt: now.toISOString(),
      });
    }
    return { notified: overdue.length };
  }

  private isEditable(
    current: PostmortemRecord,
    actorId: string,
    permissions: readonly string[],
  ) {
    return (
      isPostmortemEditable(current.status) &&
      this.isOwner(current, actorId, permissions)
    );
  }

  private isOwner(
    current: PostmortemRecord,
    actorId: string,
    permissions: readonly string[],
  ) {
    return (
      permissions.includes(PERMISSIONS.postmortems.manage) &&
      (current.createdById === actorId || current.ownerId === actorId)
    );
  }

  private canTrackActions(
    current: PostmortemRecord,
    actorId: string,
    permissions: readonly string[],
  ) {
    if (permissions.includes(PERMISSIONS.postmortems.manage)) return true;
    return current.actions.some((action) => action.ownerUserId === actorId);
  }

  private assertEditable(
    current: PostmortemRecord,
    actorId: string,
    permissions: readonly string[],
  ) {
    if (!isPostmortemEditable(current.status))
      throw new ConflictException(
        "O conteúdo só pode ser editado em rascunho ou com mudanças solicitadas.",
      );
    this.assertOwner(current, actorId, permissions);
  }

  private assertOwner(
    current: PostmortemRecord,
    actorId: string,
    permissions: readonly string[],
  ) {
    if (!this.isOwner(current, actorId, permissions))
      throw new ForbiddenException(
        "Somente o responsável pelo postmortem pode executar esta ação.",
      );
  }

  private async require(id: string) {
    const record = await this.prisma.postmortem.findUnique({
      where: { id },
      include: postmortemInclude,
    });
    if (!record) throw new NotFoundException("Postmortem não encontrado.");
    return record;
  }

  private async requireEligibleIncident(incidentId: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: { id: true, status: true, code: true },
    });
    if (!incident) throw new NotFoundException("Incidente não encontrado.");
    if (
      incident.status !== IncidentStatus.RESOLVED &&
      incident.status !== IncidentStatus.CLOSED
    )
      throw new BadRequestException(
        "O postmortem exige um incidente resolvido ou encerrado.",
      );
    return incident;
  }

  private async requireActiveUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (!user || user.status !== UserStatus.ACTIVE)
      throw new BadRequestException("Selecione um usuário ativo.");
  }

  private async requireTask(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true },
    });
    if (!task) throw new BadRequestException("Tarefa vinculada não encontrada.");
  }

  private async nextCode(tx: Prisma.TransactionClient) {
    const year = new Date().getFullYear();
    const prefix = `PM-${year}-`;
    const last = await tx.postmortem.findFirst({
      where: { code: { startsWith: prefix } },
      select: { code: true },
      orderBy: { code: "desc" },
    });
    const sequence = last ? Number(last.code.slice(prefix.length)) + 1 : 1;
    return postmortemCode(year, sequence);
  }
}
