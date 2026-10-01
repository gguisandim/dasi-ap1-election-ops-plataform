import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CommunicationEventType,
  CommunicationPriority,
  CommunicationStatus,
  Prisma,
} from "@prisma/client";
import { EventBus } from "../../../../../packages/event-bus/src";
import { PrismaService } from "../../../../../packages/database/src";
import type { CommunicationMetrics, CommunicationSummary } from "@eops/shared/communications";
import {
  CancelCommunicationDto,
  CommunicationQueryDto,
  CreateCommunicationDto,
  PublishCommunicationDto,
  ScheduleCommunicationDto,
  UpdateCommunicationDto,
} from "./dto/communication.dto";
import { ReplaceAudiencesDto } from "./dto/communication-audience.dto";
import { validateAudienceShape } from "./helpers/audience";
import {
  canTransition,
  isEditableStatus,
  isOverdueExpiration,
  isUrgentPriority,
  transitionError,
} from "./helpers/communication-status";
import { formatCommunicationCode, nextCommunicationSequence } from "./helpers/communication-code";
import { CommunicationMetricsService } from "./communication-metrics.service";
import { CommunicationRecipientsService } from "./communication-recipients.service";
import { CommunicationTemplatesService } from "./communication-templates.service";
import { CommunicationTimelineService } from "./communication-timeline.service";
import type { CommunicationActor } from "./types";

const URGENT_PRIORITIES: CommunicationPriority[] = [
  CommunicationPriority.HIGH,
  CommunicationPriority.CRITICAL,
];

const listInclude = {
  election: { select: { id: true, name: true, year: true } },
  category: true,
  tags: { include: { tag: true } },
  audiences: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.CommunicationInclude;

const detailInclude = {
  ...listInclude,
  timeline: { orderBy: { createdAt: "desc" as const }, take: 100 },
} satisfies Prisma.CommunicationInclude;

type CommunicationRecord = Prisma.CommunicationGetPayload<{ include: typeof listInclude }>;

/**
 * Núcleo do domínio de Comunicações Operacionais: CRUD, ciclo de vida,
 * direcionamento e expiração.
 *
 * A leitura/confirmação por destinatário e os indicadores ficam em serviços
 * dedicados, mantendo este arquivo focado em regras de transição.
 */
@Injectable()
export class CommunicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: CommunicationTimelineService,
    private readonly recipients: CommunicationRecipientsService,
    private readonly metrics: CommunicationMetricsService,
    private readonly templates: CommunicationTemplatesService,
    private readonly eventBus?: EventBus,
  ) {}

  // ------------------------------------------------------------------ leitura

  private where(query: CommunicationQueryDto): Prisma.CommunicationWhereInput {
    const priority = query.urgentOnly
      ? { in: URGENT_PRIORITIES }
      : query.priority;
    return {
      status: query.status,
      priority,
      categoryId: query.categoryId,
      electionId: query.electionId,
      authorId: query.authorId,
      tags: query.tag ? { some: { tag: { slug: query.tag } } } : undefined,
      createdAt:
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
            { content: { contains: query.search, mode: "insensitive" } },
            { authorName: { contains: query.search, mode: "insensitive" } },
          ]
        : undefined,
    };
  }

  async findAll(query: CommunicationQueryDto) {
    await this.expireOverdue();
    const where = this.where(query);
    const [items, total] = await Promise.all([
      this.prisma.communication.findMany({
        where,
        include: listInclude,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.communication.count({ where }),
    ]);
    const metricsByCommunication = await this.metrics.forCommunications(
      items.map((item) => item.id),
    );
    return {
      items: items.map((item) => this.present(item, metricsByCommunication.get(item.id))),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  dashboard(electionId?: string) {
    return this.expireOverdue().then(() => this.metrics.dashboard(electionId));
  }

  async findOne(id: string) {
    await this.expireOverdue();
    const communication = await this.prisma.communication.findUnique({
      where: { id },
      include: detailInclude,
    });
    if (!communication) throw new NotFoundException("Comunicado não encontrado.");
    const metrics = await this.metrics.forCommunication(id);
    return {
      ...this.present(communication, metrics),
      timeline: communication.timeline,
    };
  }

  async metricsFor(id: string): Promise<CommunicationMetrics> {
    await this.requireCommunication(id);
    return this.metrics.forCommunication(id);
  }

  async timelineFor(id: string) {
    await this.requireCommunication(id);
    return this.timeline.list(id);
  }

  private present(
    communication: CommunicationRecord,
    metrics?: CommunicationMetrics,
  ): CommunicationSummary {
    return {
      ...communication,
      tags: communication.tags.map((link) => ({
        id: link.tag.id,
        label: link.tag.label,
        slug: link.tag.slug,
      })),
      expired: isOverdueExpiration(communication),
      urgent: isUrgentPriority(communication.priority),
      metrics,
    } as unknown as CommunicationSummary;
  }

  private async requireCommunication(id: string) {
    const communication = await this.prisma.communication.findUnique({
      where: { id },
      include: listInclude,
    });
    if (!communication) throw new NotFoundException("Comunicado não encontrado.");
    return communication;
  }

  /** Resolve o nome de exibição do ator a partir do usuário autenticado. */
  private async resolveActor(input?: { id?: string; email?: string }): Promise<CommunicationActor> {
    if (!input?.id) return { name: input?.email ?? "Sistema" };
    const user = await this.prisma.user.findUnique({
      where: { id: input.id },
      select: { name: true, email: true },
    });
    return { id: input.id, name: user?.name ?? user?.email ?? input.email };
  }

  // -------------------------------------------------------------- ciclo de vida

  /**
   * Aplica a expiração derivada aos comunicados publicados cujo prazo passou.
   *
   * A atualização é condicional (`status: PUBLISHED`) para que execuções
   * concorrentes não gerem eventos duplicados.
   */
  async expireOverdue(now: Date = new Date()): Promise<number> {
    const overdue = await this.prisma.communication.findMany({
      where: { status: CommunicationStatus.PUBLISHED, expiresAt: { lt: now } },
      select: { id: true, code: true, title: true },
    });
    if (overdue.length === 0) return 0;

    let expired = 0;
    for (const communication of overdue) {
      const result = await this.prisma.communication.updateMany({
        where: { id: communication.id, status: CommunicationStatus.PUBLISHED },
        data: { status: CommunicationStatus.EXPIRED },
      });
      if (result.count !== 1) continue;
      expired += 1;
      await this.timeline.record(communication.id, {
        type: CommunicationEventType.EXPIRED,
        message: "Comunicado expirado automaticamente ao ultrapassar o prazo de validade.",
      });
      await this.eventBus?.emit("communication.expired", {
        entityId: communication.id,
        code: communication.code,
        title: communication.title,
        expiredAt: now.toISOString(),
      });
    }
    return expired;
  }

  // ------------------------------------------------------------------ escrita

  private async validateRelations(dto: {
    electionId?: string;
    categoryId?: string | null;
  }) {
    if (dto.electionId) {
      const election = await this.prisma.election.findUnique({
        where: { id: dto.electionId },
        select: { id: true },
      });
      if (!election) throw new NotFoundException("Pleito não encontrado.");
    }
    if (dto.categoryId) {
      const category = await this.prisma.communicationCategory.findUnique({
        where: { id: dto.categoryId },
        select: { id: true, active: true },
      });
      if (!category?.active) {
        throw new NotFoundException("Categoria de comunicado não encontrada ou inativa.");
      }
    }
  }

  private async validateAudiences(dto: ReplaceAudiencesDto) {
    if (dto.audiences.length === 0) {
      throw new BadRequestException(
        "Informe ao menos um direcionamento antes de publicar o comunicado.",
      );
    }
    for (const audience of dto.audiences) {
      const error = validateAudienceShape(audience);
      if (error) throw new BadRequestException(error);
    }
    const ids = (values: Array<string | undefined>) =>
      [...new Set(values.filter((value): value is string => Boolean(value)))];

    const [zones, places, teams, roles, users] = await Promise.all([
      ids(dto.audiences.map((audience) => audience.electoralZoneId)),
      ids(dto.audiences.map((audience) => audience.pollingPlaceId)),
      ids(dto.audiences.map((audience) => audience.fieldTeamId)),
      ids(dto.audiences.map((audience) => audience.fieldRoleId)),
      ids(dto.audiences.map((audience) => audience.userId)),
    ]);

    const checks: Array<{ label: string; found: number; expected: number }> = [];
    const [zoneCount, placeCount, teamCount, roleCount, userCount] = await Promise.all([
      zones.length ? this.prisma.electoralZone.count({ where: { id: { in: zones } } }) : 0,
      places.length ? this.prisma.pollingPlace.count({ where: { id: { in: places } } }) : 0,
      teams.length ? this.prisma.fieldTeam.count({ where: { id: { in: teams } } }) : 0,
      roles.length ? this.prisma.fieldRole.count({ where: { id: { in: roles } } }) : 0,
      users.length ? this.prisma.user.count({ where: { id: { in: users } } }) : 0,
    ]);
    checks.push(
      { label: "zona eleitoral", found: zoneCount, expected: zones.length },
      { label: "local de votação", found: placeCount, expected: places.length },
      { label: "equipe de campo", found: teamCount, expected: teams.length },
      { label: "função operacional", found: roleCount, expected: roles.length },
      { label: "usuário", found: userCount, expected: users.length },
    );
    const missing = checks.find((check) => check.found !== check.expected);
    if (missing) {
      throw new NotFoundException(`Destino de direcionamento não encontrado: ${missing.label}.`);
    }
  }

  private audienceCreateData(audiences: ReplaceAudiencesDto["audiences"]) {
    return audiences.map((audience) => ({
      type: audience.type,
      electoralZoneId: audience.electoralZoneId,
      pollingPlaceId: audience.pollingPlaceId,
      fieldTeamId: audience.fieldTeamId,
      fieldRoleId: audience.fieldRoleId,
      userId: audience.userId,
    }));
  }

  async create(dto: CreateCommunicationDto, actorInput?: { id?: string; email?: string }) {
    const actor = await this.resolveActor(actorInput);
    await this.validateRelations(dto);
    if (dto.audiences?.length) {
      await this.validateAudiences({ audiences: dto.audiences });
    }

    const last = await this.prisma.communication.findFirst({
      orderBy: { code: "desc" },
      select: { code: true },
    });
    const code = formatCommunicationCode(nextCommunicationSequence(last?.code));
    const tagLinks = await this.templates.tagLinksFor(dto.tags ?? []);

    try {
      const communication = await this.prisma.$transaction(async (tx) => {
        const created = await tx.communication.create({
          data: {
            code,
            title: dto.title,
            content: dto.content,
            priority: dto.priority ?? CommunicationPriority.NORMAL,
            electionId: dto.electionId,
            categoryId: dto.categoryId,
            authorId: actor.id,
            authorName: actor.name ?? "Sistema",
            observations: dto.observations,
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
            scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
            tags: { create: tagLinks },
            audiences: { create: this.audienceCreateData(dto.audiences ?? []) },
          },
          include: listInclude,
        });
        await tx.communicationEvent.create({
          data: this.timeline.dataFor(created.id, {
            type: CommunicationEventType.CREATED,
            message: "Comunicado criado.",
            actorId: actor.id,
            actorName: actor.name,
            metadata: { priority: created.priority, code: created.code },
          }),
        });
        return created;
      });

      await this.eventBus?.emit("communication.created", {
        entityId: communication.id,
        actorId: actor.id,
        code: communication.code,
        title: communication.title,
        priority: communication.priority,
        electionId: communication.electionId,
        status: communication.status,
      });

      if (dto.publish) {
        return this.publish(communication.id, {}, actorInput);
      }
      return this.present(communication);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException(
          "Não foi possível gerar um código único para o comunicado. Tente novamente.",
        );
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateCommunicationDto,
    actorInput?: { id?: string; email?: string },
  ) {
    const current = await this.requireCommunication(id);
    if (!isEditableStatus(current.status)) {
      throw new BadRequestException(
        "Comunicados expirados, arquivados ou cancelados não podem ser editados.",
      );
    }
    await this.validateRelations({ categoryId: dto.categoryId });
    const actor = await this.resolveActor(actorInput);

    const tagLinks = dto.tags ? await this.templates.tagLinksFor(dto.tags) : undefined;
    const priorityChanged = dto.priority !== undefined && dto.priority !== current.priority;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (tagLinks) {
        await tx.communicationTagLink.deleteMany({ where: { communicationId: id } });
      }
      const result = await tx.communication.update({
        where: { id },
        data: {
          title: dto.title,
          content: dto.content,
          priority: dto.priority,
          categoryId: dto.categoryId,
          observations: dto.observations,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
          tags: tagLinks ? { create: tagLinks } : undefined,
        },
        include: listInclude,
      });
      await tx.communicationEvent.create({
        data: this.timeline.dataFor(id, {
          type: CommunicationEventType.UPDATED,
          message: priorityChanged
            ? `Comunicado editado. Prioridade alterada de ${current.priority} para ${dto.priority}.`
            : "Comunicado editado.",
          actorId: actor.id,
          actorName: actor.name,
          metadata: priorityChanged
            ? { from: current.priority, to: dto.priority }
            : { fields: Object.keys(dto) },
        }),
      });
      return result;
    });

    return this.present(updated);
  }

  /** Substitui integralmente as regras de direcionamento do comunicado. */
  async replaceAudiences(
    id: string,
    dto: ReplaceAudiencesDto,
    actorInput?: { id?: string; email?: string },
  ) {
    const current = await this.requireCommunication(id);
    if (!isEditableStatus(current.status)) {
      throw new BadRequestException(
        "Comunicados expirados, arquivados ou cancelados não aceitam novos direcionamentos.",
      );
    }
    if (dto.audiences.length === 0) {
      throw new BadRequestException("Informe ao menos um direcionamento.");
    }
    await this.validateAudiences(dto);
    const actor = await this.resolveActor(actorInput);

    await this.prisma.$transaction(async (tx) => {
      await tx.communicationAudience.deleteMany({ where: { communicationId: id } });
      await tx.communicationAudience.createMany({
        data: this.audienceCreateData(dto.audiences).map((audience) => ({
          ...audience,
          communicationId: id,
        })),
      });
      await tx.communicationEvent.create({
        data: this.timeline.dataFor(id, {
          type: CommunicationEventType.UPDATED,
          message: `Direcionamento atualizado (${dto.audiences.length} regra(s)).`,
          actorId: actor.id,
          actorName: actor.name,
        }),
      });
    });

    // Comunicados já publicados precisam refletir o novo público.
    if (current.status === CommunicationStatus.PUBLISHED) {
      await this.recipients.sync(id, actor);
    }
    return this.findOne(id);
  }

  async syncRecipients(id: string, actorInput?: { id?: string; email?: string }) {
    await this.requireCommunication(id);
    const actor = await this.resolveActor(actorInput);
    const result = await this.recipients.sync(id, actor);
    if (result.total === 0) {
      throw new BadRequestException(
        "Nenhuma pessoa foi alcançada pelas regras de direcionamento atuais.",
      );
    }
    return result;
  }

  async publish(
    id: string,
    dto: PublishCommunicationDto,
    actorInput?: { id?: string; email?: string },
  ) {
    const current = await this.requireCommunication(id);
    if (current.status === CommunicationStatus.PUBLISHED) {
      // Publicar duas vezes é idempotente: não duplica entregas nem eventos.
      return this.findOne(id);
    }
    if (!canTransition(current.status, CommunicationStatus.PUBLISHED)) {
      throw new BadRequestException(
        transitionError(current.status, CommunicationStatus.PUBLISHED),
      );
    }
    if (current.audiences.length === 0) {
      throw new BadRequestException(
        "Defina ao menos um direcionamento antes de publicar o comunicado.",
      );
    }
    const actor = await this.resolveActor(actorInput);

    const sync = await this.recipients.sync(id, actor);
    if (sync.total === 0) {
      throw new BadRequestException(
        "Nenhuma pessoa foi alcançada pelas regras de direcionamento. Revise o público antes de publicar.",
      );
    }
    const delivered = await this.recipients.dispatch(id);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.communication.update({
        where: { id },
        data: { status: CommunicationStatus.PUBLISHED, publishedAt: now },
      });
      await tx.communicationEvent.createMany({
        data: [
          this.timeline.dataFor(id, {
            type: CommunicationEventType.PUBLISHED,
            message: dto.note ?? "Comunicado publicado.",
            actorId: actor.id,
            actorName: actor.name,
            metadata: { recipientCount: sync.total },
          }),
          this.timeline.dataFor(id, {
            type: CommunicationEventType.DISPATCHED,
            message: `${delivered} destinatário(s) receberam o comunicado.`,
            actorId: actor.id,
            actorName: actor.name,
          }),
        ],
      });
    });

    await this.eventBus?.emit("communication.published", {
      entityId: id,
      actorId: actor.id,
      code: current.code,
      title: current.title,
      priority: current.priority,
      electionId: current.electionId,
      recipientCount: sync.total,
    });

    return this.findOne(id);
  }

  async schedule(
    id: string,
    dto: ScheduleCommunicationDto,
    actorInput?: { id?: string; email?: string },
  ) {
    const current = await this.requireCommunication(id);
    if (!canTransition(current.status, CommunicationStatus.SCHEDULED)) {
      throw new BadRequestException(
        transitionError(current.status, CommunicationStatus.SCHEDULED),
      );
    }
    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException("Data de agendamento inválida.");
    }
    if (scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException("A data de agendamento deve estar no futuro.");
    }
    const actor = await this.resolveActor(actorInput);

    await this.prisma.$transaction(async (tx) => {
      await tx.communication.update({
        where: { id },
        data: { status: CommunicationStatus.SCHEDULED, scheduledAt },
      });
      await tx.communicationEvent.create({
        data: this.timeline.dataFor(id, {
          type: CommunicationEventType.SCHEDULED,
          message: dto.reason ?? `Comunicado agendado para ${scheduledAt.toISOString()}.`,
          actorId: actor.id,
          actorName: actor.name,
          metadata: { scheduledAt: scheduledAt.toISOString() },
        }),
      });
    });
    return this.findOne(id);
  }

  async cancel(
    id: string,
    dto: CancelCommunicationDto,
    actorInput?: { id?: string; email?: string },
  ) {
    const current = await this.requireCommunication(id);
    if (!canTransition(current.status, CommunicationStatus.CANCELLED)) {
      throw new BadRequestException(
        transitionError(current.status, CommunicationStatus.CANCELLED),
      );
    }
    const actor = await this.resolveActor(actorInput);

    await this.prisma.$transaction(async (tx) => {
      await tx.communication.update({
        where: { id },
        data: { status: CommunicationStatus.CANCELLED, cancelledAt: new Date() },
      });
      await tx.communicationEvent.create({
        data: this.timeline.dataFor(id, {
          type: CommunicationEventType.CANCELLED,
          message: dto.reason ?? "Comunicado cancelado.",
          actorId: actor.id,
          actorName: actor.name,
        }),
      });
    });

    await this.eventBus?.emit("communication.cancelled", {
      entityId: id,
      actorId: actor.id,
      code: current.code,
      title: current.title,
      reason: dto.reason,
    });
    return this.findOne(id);
  }

  async archive(id: string, actorInput?: { id?: string; email?: string }) {
    const current = await this.requireCommunication(id);
    if (!canTransition(current.status, CommunicationStatus.ARCHIVED)) {
      throw new BadRequestException(
        transitionError(current.status, CommunicationStatus.ARCHIVED),
      );
    }
    const actor = await this.resolveActor(actorInput);

    await this.prisma.$transaction(async (tx) => {
      await tx.communication.update({
        where: { id },
        data: { status: CommunicationStatus.ARCHIVED, archivedAt: new Date() },
      });
      await tx.communicationEvent.create({
        data: this.timeline.dataFor(id, {
          type: CommunicationEventType.ARCHIVED,
          message: "Comunicado arquivado.",
          actorId: actor.id,
          actorName: actor.name,
        }),
      });
    });

    await this.eventBus?.emit("communication.archived", {
      entityId: id,
      actorId: actor.id,
      code: current.code,
      title: current.title,
    });
    return this.findOne(id);
  }

  /**
   * Exclusão física apenas para rascunhos/agendados. Comunicados que já
   * alcançaram pessoas são preservados para auditoria — use cancelar/arquivar.
   */
  async remove(id: string) {
    const current = await this.requireCommunication(id);
    if (!isEditableStatus(current.status) || current.publishedAt) {
      throw new BadRequestException(
        "Comunicados publicados não podem ser excluídos. Cancele ou arquive.",
      );
    }
    await this.prisma.communication.delete({ where: { id } });
  }

  /** Dados de apoio para o formulário: pleitos, zonas, locais, equipes e funções. */
  async referenceData(electionId?: string) {
    const [elections, categories, templates, tags, zones, places, teams, roles, users] =
      await Promise.all([
        this.prisma.election.findMany({
          select: { id: true, name: true, year: true, status: true },
          orderBy: { year: "desc" },
        }),
        this.templates.listCategories(),
        this.templates.listTemplates(),
        this.templates.listTags(),
        this.prisma.electoralZone.findMany({
          where: electionId ? { electionId } : {},
          select: { id: true, number: true, name: true, electionId: true },
          orderBy: { number: "asc" },
        }),
        this.prisma.pollingPlace.findMany({
          where: electionId ? { electoralZone: { electionId } } : {},
          select: { id: true, name: true, city: true, electoralZoneId: true },
          orderBy: { name: "asc" },
          take: 500,
        }),
        this.prisma.fieldTeam.findMany({
          where: electionId ? { electionId } : {},
          select: { id: true, name: true, code: true, electionId: true },
          orderBy: { name: "asc" },
        }),
        this.prisma.fieldRole.findMany({
          where: { active: true },
          select: { id: true, name: true, key: true },
          orderBy: { name: "asc" },
        }),
        this.prisma.user.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
          take: 500,
        }),
      ]);
    return { elections, categories, templates, tags, zones, places, teams, roles, users };
  }
}
