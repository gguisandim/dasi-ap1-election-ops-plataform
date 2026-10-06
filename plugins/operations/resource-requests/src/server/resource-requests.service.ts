import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  IncidentStatus,
  Prisma,
  ResourceRequestHistoryAction,
  ResourceRequestItemKind,
  ResourceRequestStatus,
  TaskStatus,
  UserStatus,
} from "@prisma/client";
import { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import { PERMISSIONS } from "@eops/security";
import {
  availableResourceRequestActions,
  canTransitionResourceRequest,
  deriveFulfillmentStatus,
  deriveUrgency,
  isTerminalResourceRequestStatus,
  resourceRequestCode,
  summarizeFulfillment,
  type ResourceRequestStatus as SharedStatus,
} from "@eops/shared/resource-requests";
import {
  linkAllowedForKind,
  missingOperationalLink,
  validateAssetEligibility,
  validateFulfillmentQuantity,
  validateItemQuantity,
  validateItemReferences,
  validateReservationBinding,
  validateRouteEligibility,
  validateTeamEligibility,
  validateVehicleEligibility,
} from "./fulfillment-rules";
import type {
  AddCommentDto,
  AddFulfillmentDto,
  CancelRequestDto,
  CreateRequestDto,
  RejectRequestDto,
  RequestQueryDto,
  TriageRequestDto,
  UpdateRequestDto,
} from "./dto/resource-requests.dto";

const participant = { select: { id: true, name: true, email: true } } as const;

const requestInclude = {
  election: { select: { id: true, name: true, year: true } },
  electoralZone: { select: { id: true, name: true, number: true } },
  pollingPlace: { select: { id: true, name: true } },
  incident: { select: { id: true, code: true, title: true, severity: true, status: true } },
  task: { select: { id: true, title: true, status: true } },
  requestedBy: participant,
  owner: participant,
  items: {
    include: {
      assetType: { select: { id: true, key: true, name: true } },
      fieldTeam: { select: { id: true, code: true, name: true, status: true } },
      vehicle: { select: { id: true, identification: true, plate: true } },
      fulfillments: {
        include: {
          fulfilledBy: participant,
          asset: { select: { id: true, assetTag: true, name: true, status: true } },
          assetReservation: { select: { id: true, status: true } },
          fieldTeam: { select: { id: true, code: true, name: true } },
          vehicle: { select: { id: true, identification: true } },
          route: { select: { id: true, code: true, name: true } },
          task: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "asc" as const },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  history: {
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" as const },
  },
  comments: {
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.ResourceRequestInclude;

type RequestRecord = Prisma.ResourceRequestGetPayload<{
  include: typeof requestInclude;
}>;

export interface ItemProgress {
  id: string;
  kind: ResourceRequestItemKind;
  label: string;
  quantity: number;
  fulfilledQuantity: number;
  remainingQuantity: number;
  satisfied: boolean;
  progressPercent: number;
}

export function computeItemProgress(
  items: ReadonlyArray<{
    id: string;
    kind: ResourceRequestItemKind;
    label: string;
    quantity: number;
    fulfillments: ReadonlyArray<{ quantity: number }>;
  }>,
): ItemProgress[] {
  return items.map((item) => {
    const fulfilledQuantity = item.fulfillments.reduce(
      (total, fulfillment) => total + fulfillment.quantity,
      0,
    );
    const remainingQuantity = Math.max(0, item.quantity - fulfilledQuantity);
    return {
      id: item.id,
      kind: item.kind,
      label: item.label,
      quantity: item.quantity,
      fulfilledQuantity,
      remainingQuantity,
      satisfied: fulfilledQuantity >= item.quantity,
      progressPercent:
        item.quantity === 0
          ? 0
          : Math.min(100, Math.round((fulfilledQuantity / item.quantity) * 100)),
    };
  });
}

/**
 * Projeção usada em listas e filas: calcula derivados, mas não deriva
 * `availableActions`, que depende do ator e pertence apenas ao detalhe.
 */
export function projectRequestSummary(
  record: RequestRecord,
  now: Date = new Date(),
) {
  return {
    ...record,
    ...derivedFields(record, now),
  };
}

/**
 * Projeção de detalhe: acrescenta `availableActions` calculadas no servidor a
 * partir do status, das permissões e do vínculo do ator.
 */
export function projectRequestDetail(
  record: RequestRecord,
  actorId: string,
  permissions: readonly string[],
  now: Date = new Date(),
) {
  return {
    ...record,
    ...derivedFields(record, now),
    availableActions: availableResourceRequestActions({
      status: record.status as SharedStatus,
      requestedById: record.requestedById,
      ownerId: record.ownerId,
      actorId,
      permissions,
    }),
  };
}

function derivedFields(record: RequestRecord, now: Date) {
  const items = computeItemProgress(record.items);
  return {
    items,
    totals: summarizeFulfillment(
      items.map((item) => ({
        quantity: item.quantity,
        fulfilledQuantity: item.fulfilledQuantity,
      })),
    ),
    urgency: deriveUrgency({
      status: record.status as SharedStatus,
      neededAt: record.neededAt,
      now,
    }),
  };
}

@Injectable()
export class ResourceRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async references(electionId?: string) {
    const [elections, zones, places, incidents, tasks, assetTypes, teams, vehicles, users] =
      await Promise.all([
        this.prisma.election.findMany({
          select: { id: true, name: true, year: true, status: true },
          orderBy: { year: "desc" },
        }),
        this.prisma.electoralZone.findMany({
          where: { electionId },
          select: { id: true, name: true, number: true, electionId: true },
          orderBy: { number: "asc" },
        }),
        this.prisma.pollingPlace.findMany({
          where: electionId ? { electoralZone: { electionId } } : undefined,
          select: { id: true, name: true, electoralZoneId: true },
          orderBy: { name: "asc" },
          take: 1000,
        }),
        this.prisma.incident.findMany({
          where: {
            electionId,
            status: { notIn: [IncidentStatus.CLOSED, IncidentStatus.CANCELLED] },
            isSimulated: false,
          },
          select: { id: true, code: true, title: true, severity: true, status: true },
          orderBy: { openedAt: "desc" },
          take: 200,
        }),
        this.prisma.task.findMany({
          where: {
            electionId,
            status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] },
          },
          select: { id: true, title: true, status: true, priority: true },
          orderBy: { createdAt: "desc" },
          take: 200,
        }),
        this.prisma.assetType.findMany({
          where: { active: true },
          select: { id: true, key: true, name: true },
          orderBy: { name: "asc" },
        }),
        this.prisma.fieldTeam.findMany({
          where: { status: "ACTIVE", electionId },
          select: { id: true, code: true, name: true, electionId: true },
          orderBy: { name: "asc" },
        }),
        this.prisma.vehicle.findMany({
          select: { id: true, identification: true, plate: true, status: true },
          orderBy: { identification: "asc" },
        }),
        this.prisma.user.findMany({
          where: { status: UserStatus.ACTIVE },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        }),
      ]);
    return { elections, zones, places, incidents, tasks, assetTypes, teams, vehicles, users };
  }

  async list(query: RequestQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.resourceRequest.findMany({
        where,
        include: requestInclude,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.resourceRequest.count({ where }),
    ]);
    return {
      items: items.map((item) => projectRequestSummary(item)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /** Fila operacional ordenada por urgência, prioridade, prazo e idade. */
  async queue(query: RequestQueryDto) {
    const now = new Date();
    const where = this.buildWhere(query);
    const candidates = await this.prisma.resourceRequest.findMany({
      where,
      include: requestInclude,
      take: 500,
    });
    const projected = candidates
      .map((item) => projectRequestSummary(item, now))
      .filter((item) => !query.overdue || item.urgency === "OVERDUE");
    const urgencyRank = { OVERDUE: 0, DUE_SOON: 1, ON_TRACK: 2, COMPLETED: 3 };
    const priorityRank = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
    projected.sort((left, right) => {
      const urgency =
        urgencyRank[left.urgency] - urgencyRank[right.urgency];
      if (urgency !== 0) return urgency;
      const priority =
        priorityRank[left.priority] - priorityRank[right.priority];
      if (priority !== 0) return priority;
      const leftNeeded = left.neededAt ? left.neededAt.getTime() : null;
      const rightNeeded = right.neededAt ? right.neededAt.getTime() : null;
      if (leftNeeded !== null || rightNeeded !== null) {
        if (leftNeeded === null) return 1;
        if (rightNeeded === null) return -1;
        if (leftNeeded !== rightNeeded) return leftNeeded - rightNeeded;
      }
      return left.createdAt.getTime() - right.createdAt.getTime();
    });
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    return {
      items: projected.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total: projected.length,
      totalPages: Math.max(1, Math.ceil(projected.length / pageSize)),
    };
  }

  async dashboard() {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const [records, fulfilledToday] = await Promise.all([
      this.prisma.resourceRequest.findMany({
        select: {
          status: true,
          priority: true,
          neededAt: true,
          createdAt: true,
          ownerId: true,
          electoralZoneId: true,
          items: { select: { kind: true, quantity: true, fulfillments: { select: { quantity: true } } } },
          owner: { select: { id: true, name: true } },
          electoralZone: { select: { id: true, name: true, number: true } },
        },
      }),
      this.prisma.resourceRequest.count({
        where: {
          status: ResourceRequestStatus.FULFILLED,
          fulfilledAt: { gte: startOfDay },
        },
      }),
    ]);

    const counters = {
      draft: 0,
      submitted: 0,
      awaitingTriage: 0,
      awaitingApproval: 0,
      approved: 0,
      partiallyFulfilled: 0,
      fulfilledToday,
      overdue: 0,
      critical: 0,
    };
    const byPriority = new Map<string, number>();
    const byZone = new Map<string, { zoneId: string; zoneName: string; count: number }>();
    const byItemKind = new Map<string, number>();
    const byOwner = new Map<string, { ownerId: string | null; ownerName: string; count: number }>();

    for (const record of records) {
      const status = record.status as SharedStatus;
      if (status === ResourceRequestStatus.DRAFT) counters.draft += 1;
      if (status === ResourceRequestStatus.SUBMITTED) {
        counters.submitted += 1;
        counters.awaitingTriage += 1;
      }
      if (status === ResourceRequestStatus.TRIAGED) counters.awaitingApproval += 1;
      if (status === ResourceRequestStatus.APPROVED) counters.approved += 1;
      if (status === ResourceRequestStatus.PARTIALLY_FULFILLED)
        counters.partiallyFulfilled += 1;
      if (priorityIsCritical(record.priority, status)) counters.critical += 1;
      if (
        deriveUrgency({ status, neededAt: record.neededAt, now }) === "OVERDUE"
      )
        counters.overdue += 1;

      byPriority.set(
        record.priority,
        (byPriority.get(record.priority) ?? 0) + 1,
      );
      if (record.electoralZone) {
        const key = record.electoralZone.id;
        const current = byZone.get(key) ?? {
          zoneId: record.electoralZone.id,
          zoneName: `${record.electoralZone.number} · ${record.electoralZone.name}`,
          count: 0,
        };
        current.count += 1;
        byZone.set(key, current);
      }
      const ownerKey = record.ownerId ?? "unassigned";
      const currentOwner = byOwner.get(ownerKey) ?? {
        ownerId: record.ownerId,
        ownerName: record.owner?.name ?? "Sem responsável",
        count: 0,
      };
      currentOwner.count += 1;
      byOwner.set(ownerKey, currentOwner);
      for (const item of record.items) {
        byItemKind.set(item.kind, (byItemKind.get(item.kind) ?? 0) + 1);
      }
    }

    return {
      generatedAt: now.toISOString(),
      counters,
      byPriority: [...byPriority.entries()]
        .map(([priority, count]) => ({ priority, count }))
        .sort((left, right) => right.count - left.count),
      byZone: [...byZone.values()].sort((left, right) => right.count - left.count),
      byItemKind: [...byItemKind.entries()]
        .map(([kind, count]) => ({ kind, count }))
        .sort((left, right) => right.count - left.count),
      byOwner: [...byOwner.values()].sort((left, right) => right.count - left.count),
    };
  }

  async findOne(
    id: string,
    actorId: string,
    permissions: readonly string[],
  ) {
    const record = await this.require(id);
    return projectRequestDetail(record, actorId, permissions);
  }

  async create(dto: CreateRequestDto, actorId: string) {
    await this.validateScope(dto);
    this.validateItems(dto.items);
    const record = await this.prisma.$transaction(async (tx) => {
      const code = await this.nextCode(tx);
      return tx.resourceRequest.create({
        data: {
          code,
          electionId: dto.electionId,
          electoralZoneId: dto.electoralZoneId ?? null,
          pollingPlaceId: dto.pollingPlaceId ?? null,
          incidentId: dto.incidentId ?? null,
          taskId: dto.taskId ?? null,
          title: dto.title.trim(),
          description: dto.description.trim(),
          priority: dto.priority ?? "NORMAL",
          status: ResourceRequestStatus.DRAFT,
          requestedById: actorId,
          neededAt: dto.neededAt ? new Date(dto.neededAt) : null,
          items: {
            createMany: {
              data: dto.items.map((item) => ({
                kind: item.kind,
                label: item.label.trim(),
                description: item.description?.trim() || null,
                quantity: item.quantity,
                notes: item.notes?.trim() || null,
                assetTypeId: item.assetTypeId ?? null,
                fieldTeamId: item.fieldTeamId ?? null,
                vehicleId: item.vehicleId ?? null,
              })),
            },
          },
          history: {
            create: {
              actorId,
              action: ResourceRequestHistoryAction.CREATED,
              description: "Solicitação criada como rascunho.",
            },
          },
        },
        include: requestInclude,
      });
    });

    await this.eventBus.emit("resource_request.created", {
      entityId: record.id,
      actorId,
      code: record.code,
      title: record.title,
      electionId: record.electionId,
      priority: record.priority,
      status: record.status,
    });
    return projectRequestDetail(record, actorId, []);
  }

  async update(
    id: string,
    dto: UpdateRequestDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    if (current.status !== ResourceRequestStatus.DRAFT)
      throw new ConflictException("Somente rascunhos podem ser editados.");
    if (current.requestedById !== actorId &&
        !permissions.includes(PERMISSIONS.resourceRequests.manage))
      throw new ForbiddenException("Somente o solicitante pode editar este pedido.");
    if (dto.items) this.validateItems(dto.items);
    await this.validateScope({
      electionId: current.electionId,
      electoralZoneId: dto.electoralZoneId ?? current.electoralZoneId ?? undefined,
      pollingPlaceId: dto.pollingPlaceId ?? current.pollingPlaceId ?? undefined,
      incidentId: current.incidentId ?? undefined,
    });

    const record = await this.prisma.$transaction(async (tx) => {
      await tx.resourceRequest.update({
        where: { id },
        data: {
          title: dto.title?.trim(),
          description: dto.description?.trim(),
          priority: dto.priority,
          neededAt:
            dto.neededAt === undefined
              ? undefined
              : dto.neededAt
                ? new Date(dto.neededAt)
                : null,
          electoralZoneId: dto.electoralZoneId,
          pollingPlaceId: dto.pollingPlaceId,
          taskId: dto.taskId,
        },
      });
      if (dto.items) {
        await tx.resourceRequestItem.deleteMany({ where: { requestId: id } });
        await tx.resourceRequestItem.createMany({
          data: dto.items.map((item) => ({
            requestId: id,
            kind: item.kind,
            label: item.label.trim(),
            description: item.description?.trim() || null,
            quantity: item.quantity,
            notes: item.notes?.trim() || null,
            assetTypeId: item.assetTypeId ?? null,
            fieldTeamId: item.fieldTeamId ?? null,
            vehicleId: item.vehicleId ?? null,
          })),
        });
      }
      await tx.resourceRequestHistory.create({
        data: {
          requestId: id,
          actorId,
          action: ResourceRequestHistoryAction.UPDATED,
          description: "Conteúdo da solicitação atualizado.",
          metadata: { changes: Object.keys(dto) },
        },
      });
      return tx.resourceRequest.findUniqueOrThrow({
        where: { id },
        include: requestInclude,
      });
    });
    return projectRequestDetail(record, actorId, permissions);
  }

  async submit(id: string, actorId: string, permissions: readonly string[]) {
    const current = await this.require(id);
    if (current.requestedById !== actorId)
      throw new ForbiddenException("Somente o solicitante pode submeter o pedido.");
    if (current.items.length === 0)
      throw new BadRequestException("Inclua ao menos um item antes de submeter.");
    return this.transition(current, ResourceRequestStatus.SUBMITTED, actorId, permissions, {
      submittedAt: new Date(),
    });
  }

  async triage(
    id: string,
    dto: TriageRequestDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    if (current.status !== ResourceRequestStatus.SUBMITTED &&
        current.status !== ResourceRequestStatus.TRIAGED)
      throw new ConflictException("Somente pedidos submetidos podem ser triados.");
    if (dto.ownerId) {
      const owner = await this.prisma.user.findUnique({
        where: { id: dto.ownerId },
        select: { status: true },
      });
      if (!owner || owner.status !== UserStatus.ACTIVE)
        throw new BadRequestException("Selecione um responsável ativo.");
    }

    const history: Prisma.ResourceRequestHistoryCreateManyInput[] = [
      {
        requestId: id,
        actorId,
        action: ResourceRequestHistoryAction.TRIAGED,
        description: "Solicitação triada.",
        metadata: { notes: dto.notes?.trim() || null },
      },
    ];
    if (dto.ownerId && dto.ownerId !== current.ownerId)
      history.push({
        requestId: id,
        actorId,
        action: ResourceRequestHistoryAction.OWNER_CHANGED,
        description: "Responsável atualizado.",
        metadata: { from: current.ownerId, to: dto.ownerId },
      });
    if (dto.priority && dto.priority !== current.priority)
      history.push({
        requestId: id,
        actorId,
        action: ResourceRequestHistoryAction.PRIORITY_CHANGED,
        description: "Prioridade ajustada na triagem.",
        metadata: { from: current.priority, to: dto.priority },
      });

    const record = await this.prisma.$transaction(async (tx) => {
      await tx.resourceRequest.update({
        where: { id },
        data: {
          ownerId: dto.ownerId ?? undefined,
          priority: dto.priority ?? undefined,
          triageNotes: dto.notes?.trim() || undefined,
          status:
            current.status === ResourceRequestStatus.SUBMITTED
              ? ResourceRequestStatus.TRIAGED
              : undefined,
          triagedAt:
            current.status === ResourceRequestStatus.SUBMITTED
              ? new Date()
              : undefined,
        },
      });
      await tx.resourceRequestHistory.createMany({ data: history });
      return tx.resourceRequest.findUniqueOrThrow({
        where: { id },
        include: requestInclude,
      });
    });

    const ownerChanged = Boolean(dto.ownerId && dto.ownerId !== current.ownerId);
    await this.eventBus.emit("resource_request.triaged", {
      entityId: id,
      actorId,
      code: record.code,
      title: record.title,
      electionId: record.electionId,
      priority: record.priority,
      ownerId: record.ownerId,
      ownerChanged,
      priorityChanged: record.priority !== current.priority,
      from: current.status,
      to: record.status,
    });
    return projectRequestDetail(record, actorId, permissions);
  }

  async approve(id: string, actorId: string, permissions: readonly string[]) {
    const current = await this.require(id);
    if (current.status !== ResourceRequestStatus.SUBMITTED &&
        current.status !== ResourceRequestStatus.TRIAGED)
      throw new ConflictException("Somente pedidos submetidos ou triados podem ser aprovados.");
    return this.transition(current, ResourceRequestStatus.APPROVED, actorId, permissions, {
      approvedAt: new Date(),
    });
  }

  async reject(
    id: string,
    dto: RejectRequestDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    if (current.status !== ResourceRequestStatus.SUBMITTED &&
        current.status !== ResourceRequestStatus.TRIAGED)
      throw new ConflictException("Somente pedidos submetidos ou triados podem ser rejeitados.");
    if (!dto.reason?.trim())
      throw new BadRequestException("Informe o motivo da rejeição.");
    return this.transition(
      current,
      ResourceRequestStatus.REJECTED,
      actorId,
      permissions,
      { rejectedAt: new Date(), rejectionReason: dto.reason.trim() },
    );
  }

  async cancel(
    id: string,
    dto: CancelRequestDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    const manages = permissions.includes(PERMISSIONS.resourceRequests.manage);
    const owns =
      current.requestedById === actorId || current.ownerId === actorId;
    if (!manages && !owns)
      throw new ForbiddenException("Você não pode cancelar esta solicitação.");
    if (current.status === ResourceRequestStatus.APPROVED && !dto.reason?.trim())
      throw new BadRequestException("Informe o motivo do cancelamento.");
    return this.transition(
      current,
      ResourceRequestStatus.CANCELLED,
      actorId,
      permissions,
      {
        cancelledAt: new Date(),
        cancellationReason: dto.reason?.trim() || null,
      },
    );
  }

  async addFulfillment(
    id: string,
    dto: AddFulfillmentDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    if (!allowedFulfillmentSourceStatus(current.status))
      throw new ConflictException(
        "Somente pedidos aprovados ou parcialmente atendidos recebem atendimento.",
      );
    const item = current.items.find((entry) => entry.id === dto.requestItemId);
    if (!item) throw new NotFoundException("Item da solicitação não encontrado.");
    const fulfilledQuantity = item.fulfillments.reduce(
      (total, fulfillment) => total + fulfillment.quantity,
      0,
    );
    const remainingQuantity = Math.max(0, item.quantity - fulfilledQuantity);
    const quantityError = validateFulfillmentQuantity({
      quantity: dto.quantity,
      remainingQuantity,
    });
    if (quantityError) throw new BadRequestException(quantityError);

    const link = {
      assetId: dto.assetId ?? null,
      assetReservationId: dto.assetReservationId ?? null,
      fieldTeamId: dto.fieldTeamId ?? null,
      vehicleId: dto.vehicleId ?? null,
      routeId: dto.routeId ?? null,
      taskId: dto.taskId ?? null,
    };
    const linkError =
      missingOperationalLink(item.kind, link) ??
      linkAllowedForKind(item.kind, link);
    if (linkError) throw new BadRequestException(linkError);
    await this.validateLinks(link, current.electionId);

    const now = new Date();
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.resourceRequestFulfillment.create({
        data: {
          requestItemId: item.id,
          quantity: dto.quantity,
          fulfilledById: actorId,
          ...link,
          notes: dto.notes?.trim() || null,
        },
      });
      return this.applyFulfillmentStatus(tx, id, actorId, now, {
        action: ResourceRequestHistoryAction.FULFILLMENT_ADDED,
        description: `Atendimento de ${dto.quantity} registrado para "${item.label}".`,
        metadata: { requestItemId: item.id, quantity: dto.quantity },
      });
    });
    await this.emitFulfillmentEvents(current, record, actorId, now);
    return projectRequestDetail(record, actorId, permissions, now);
  }

  async removeFulfillment(
    id: string,
    fulfillmentId: string,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    const item = current.items.find((entry) =>
      entry.fulfillments.some((fulfillment) => fulfillment.id === fulfillmentId),
    );
    if (!item) throw new NotFoundException("Atendimento não encontrado.");
    const fulfillment = item.fulfillments.find(
      (entry) => entry.id === fulfillmentId,
    )!;
    const now = new Date();
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.resourceRequestFulfillment.delete({ where: { id: fulfillmentId } });
      return this.applyFulfillmentStatus(tx, id, actorId, now, {
        action: ResourceRequestHistoryAction.FULFILLMENT_REMOVED,
        description: `Atendimento de ${fulfillment.quantity} removido de "${item.label}".`,
        metadata: { requestItemId: item.id, quantity: fulfillment.quantity },
      });
    });
    return projectRequestDetail(record, actorId, permissions, now);
  }

  async addComment(
    id: string,
    dto: AddCommentDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    await this.require(id);
    const body = dto.body.trim();
    if (!body) throw new BadRequestException("Escreva um comentário.");
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.resourceRequestComment.create({
        data: { requestId: id, authorId: actorId, body },
      });
      await tx.resourceRequestHistory.create({
        data: {
          requestId: id,
          actorId,
          action: ResourceRequestHistoryAction.COMMENT_ADDED,
          description: "Comentário adicionado.",
        },
      });
      return tx.resourceRequest.findUniqueOrThrow({
        where: { id },
        include: requestInclude,
      });
    });
    return projectRequestDetail(record, actorId, permissions);
  }

  private async transition(
    current: RequestRecord,
    to: ResourceRequestStatus,
    actorId: string,
    permissions: readonly string[],
    extra: {
      submittedAt?: Date;
      triagedAt?: Date;
      approvedAt?: Date;
      rejectedAt?: Date;
      cancelledAt?: Date;
      fulfilledAt?: Date;
      rejectionReason?: string | null;
      cancellationReason?: string | null;
    },
  ) {
    const from = current.status as SharedStatus;
    if (!canTransitionResourceRequest(from, to as SharedStatus))
      throw new ConflictException(`Transição ${from} → ${to} não permitida.`);

    const action = transitionAction(to);
    const emittedAt = new Date();
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.resourceRequest.update({
        where: { id: current.id },
        data: { status: to, ...extra },
      });
      await tx.resourceRequestHistory.create({
        data: {
          requestId: current.id,
          actorId,
          action,
          description: transitionDescription(to),
          metadata: { from, to },
        },
      });
      return tx.resourceRequest.findUniqueOrThrow({
        where: { id: current.id },
        include: requestInclude,
      });
    });

    const payload = {
      entityId: record.id,
      actorId,
      code: record.code,
      title: record.title,
      electionId: record.electionId,
      requestedById: record.requestedById,
      from,
      to,
    };
    if (to === ResourceRequestStatus.SUBMITTED)
      await this.eventBus.emit("resource_request.submitted", {
        ...payload,
        priority: record.priority,
        submittedAt: (extra.submittedAt ?? emittedAt).toISOString(),
      });
    else if (to === ResourceRequestStatus.APPROVED)
      await this.eventBus.emit("resource_request.approved", {
        ...payload,
        approvedAt: (extra.approvedAt ?? emittedAt).toISOString(),
      });
    else if (to === ResourceRequestStatus.REJECTED)
      await this.eventBus.emit("resource_request.rejected", {
        ...payload,
        reason: extra.rejectionReason ?? undefined,
        rejectedAt: (extra.rejectedAt ?? emittedAt).toISOString(),
      });
    else if (to === ResourceRequestStatus.CANCELLED)
      await this.eventBus.emit("resource_request.cancelled", {
        ...payload,
        reason: extra.cancellationReason ?? undefined,
        cancelledAt: (extra.cancelledAt ?? emittedAt).toISOString(),
      });

    return projectRequestDetail(record, actorId, permissions);
  }

  /**
   * Recalcula o status derivado do fulfillment dentro da transação. O servidor é
   * a única autoridade sobre PARTIALLY_FULFILLED, FULFILLED e fulfilledAt.
   */
  private async applyFulfillmentStatus(
    tx: Prisma.TransactionClient,
    id: string,
    actorId: string,
    now: Date,
    history: {
      action: ResourceRequestHistoryAction;
      description: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    const items = await tx.resourceRequestItem.findMany({
      where: { requestId: id },
      select: { quantity: true, fulfillments: { select: { quantity: true } } },
    });
    const state = items.map((item) => ({
      quantity: item.quantity,
      fulfilledQuantity: item.fulfillments.reduce(
        (total, fulfillment) => total + fulfillment.quantity,
        0,
      ),
    }));
    const derived = deriveFulfillmentStatus(state);
    const totals = summarizeFulfillment(state);

    const historyRows: Prisma.ResourceRequestHistoryCreateManyInput[] = [
      {
        requestId: id,
        actorId,
        action: history.action,
        description: history.description,
        metadata: history.metadata,
      },
    ];
    if (derived) {
      historyRows.push({
        requestId: id,
        actorId,
        action:
          derived === "FULFILLED"
            ? ResourceRequestHistoryAction.FULFILLED
            : ResourceRequestHistoryAction.PARTIALLY_FULFILLED,
        description:
          derived === "FULFILLED"
            ? "Todos os itens foram atendidos."
            : "Atendimento parcial registrado.",
        metadata: { totals: totals as unknown as Prisma.InputJsonValue },
      });
    }

    const current = await tx.resourceRequest.findUniqueOrThrow({
      where: { id },
      select: { status: true, approvedAt: true, triagedAt: true },
    });
    const wasFulfillmentState =
      current.status === ResourceRequestStatus.FULFILLED ||
      current.status === ResourceRequestStatus.PARTIALLY_FULFILLED;
    const nextStatus =
      derived ??
      (wasFulfillmentState
        ? statusWithoutFulfillment(current)
        : current.status);
    await tx.resourceRequest.update({
      where: { id },
      data: {
        status: nextStatus,
        fulfilledAt:
          nextStatus === ResourceRequestStatus.FULFILLED
            ? now
            : wasFulfillmentState
              ? null
              : undefined,
      },
    });
    await tx.resourceRequestHistory.createMany({ data: historyRows });
    return tx.resourceRequest.findUniqueOrThrow({
      where: { id },
      include: requestInclude,
    });
  }

  private async emitFulfillmentEvents(
    before: RequestRecord,
    record: RequestRecord,
    actorId: string,
    now: Date,
  ) {
    const items = computeItemProgress(record.items);
    const totals = summarizeFulfillment(
      items.map((item) => ({
        quantity: item.quantity,
        fulfilledQuantity: item.fulfilledQuantity,
      })),
    );
    if (record.status === ResourceRequestStatus.FULFILLED) {
      await this.eventBus.emit("resource_request.fulfilled", {
        entityId: record.id,
        actorId,
        code: record.code,
        title: record.title,
        electionId: record.electionId,
        requestedById: record.requestedById,
        from: before.status,
        to: record.status,
        fulfilledAt: (record.fulfilledAt ?? now).toISOString(),
      });
      return;
    }
    if (record.status === ResourceRequestStatus.PARTIALLY_FULFILLED) {
      await this.eventBus.emit("resource_request.partially_fulfilled", {
        entityId: record.id,
        actorId,
        code: record.code,
        title: record.title,
        electionId: record.electionId,
        requestedById: record.requestedById,
        from: before.status,
        to: record.status,
        fulfilledQuantity: totals.totalFulfilled,
        requiredQuantity: totals.totalRequired,
      });
    }
  }

  private async validateLinks(
    link: {
      assetId: string | null;
      assetReservationId: string | null;
      fieldTeamId: string | null;
      vehicleId: string | null;
      routeId: string | null;
      taskId: string | null;
    },
    electionId: string,
  ) {
    const [asset, reservation, team, vehicle, route, task] = await Promise.all([
      link.assetId
        ? this.prisma.asset.findUnique({
            where: { id: link.assetId },
            select: { status: true, condition: true },
          })
        : null,
      link.assetReservationId
        ? this.prisma.assetReservation.findUnique({
            where: { id: link.assetReservationId },
            select: { assetId: true, status: true },
          })
        : null,
      link.fieldTeamId
        ? this.prisma.fieldTeam.findUnique({
            where: { id: link.fieldTeamId },
            select: { status: true, electionId: true },
          })
        : null,
      link.vehicleId
        ? this.prisma.vehicle.findUnique({
            where: { id: link.vehicleId },
            select: { status: true },
          })
        : null,
      link.routeId
        ? this.prisma.distributionRoute.findUnique({
            where: { id: link.routeId },
            select: { electionId: true },
          })
        : null,
      link.taskId
        ? this.prisma.task.findUnique({
            where: { id: link.taskId },
            select: { id: true },
          })
        : null,
    ]);

    if (link.assetId) {
      const error = validateAssetEligibility(asset);
      if (error) throw new BadRequestException(error);
    }
    if (link.assetReservationId) {
      const error = validateReservationBinding(reservation, link.assetId);
      if (error) throw new BadRequestException(error);
    }
    if (link.fieldTeamId) {
      const error = validateTeamEligibility(team, electionId);
      if (error) throw new BadRequestException(error);
    }
    if (link.vehicleId) {
      const error = validateVehicleEligibility(vehicle);
      if (error) throw new BadRequestException(error);
    }
    if (link.routeId) {
      const error = validateRouteEligibility(route, electionId);
      if (error) throw new BadRequestException(error);
    }
    if (link.taskId && !task)
      throw new BadRequestException("Tarefa vinculada não encontrada.");
  }

  private validateItems(items: CreateRequestDto["items"]) {
    if (!items || items.length === 0)
      throw new BadRequestException("Inclua ao menos um item na solicitação.");
    for (const item of items) {
      const error =
        validateItemReferences(item) ?? validateItemQuantity(item.quantity);
      if (error) throw new BadRequestException(error);
      if (!item.label?.trim())
        throw new BadRequestException("Cada item precisa de um rótulo.");
    }
  }

  private async validateScope(dto: {
    electionId: string;
    electoralZoneId?: string;
    pollingPlaceId?: string;
    incidentId?: string;
    taskId?: string;
  }) {
    const [zone, place, incident, task] = await Promise.all([
      dto.electoralZoneId
        ? this.prisma.electoralZone.findUnique({
            where: { id: dto.electoralZoneId },
            select: { electionId: true },
          })
        : null,
      dto.pollingPlaceId
        ? this.prisma.pollingPlace.findUnique({
            where: { id: dto.pollingPlaceId },
            select: { electoralZoneId: true, electoralZone: { select: { electionId: true } } },
          })
        : null,
      dto.incidentId
        ? this.prisma.incident.findUnique({
            where: { id: dto.incidentId },
            select: { electionId: true },
          })
        : null,
      dto.taskId
        ? this.prisma.task.findUnique({
            where: { id: dto.taskId },
            select: { electionId: true },
          })
        : null,
    ]);
    if (dto.electoralZoneId && !zone)
      throw new BadRequestException("Zona eleitoral não encontrada.");
    if (zone && zone.electionId !== dto.electionId)
      throw new BadRequestException("Zona eleitoral pertence a outro pleito.");
    if (dto.pollingPlaceId && !place)
      throw new BadRequestException("Local de votação não encontrado.");
    if (place && place.electoralZone.electionId !== dto.electionId)
      throw new BadRequestException("Local de votação pertence a outro pleito.");
    if (
      place &&
      dto.electoralZoneId &&
      place.electoralZoneId !== dto.electoralZoneId
    )
      throw new BadRequestException(
        "O local de votação não pertence à zona selecionada.",
      );
    if (dto.incidentId) {
      if (!incident) throw new BadRequestException("Incidente não encontrado.");
      if (incident.electionId !== dto.electionId)
        throw new BadRequestException("Incidente pertence a outro pleito.");
    }
    if (dto.taskId) {
      if (!task) throw new BadRequestException("Tarefa não encontrada.");
      if (task.electionId !== dto.electionId)
        throw new BadRequestException("Tarefa pertence a outro pleito.");
    }
  }

  private async require(id: string) {
    const record = await this.prisma.resourceRequest.findUnique({
      where: { id },
      include: requestInclude,
    });
    if (!record) throw new NotFoundException("Solicitação não encontrada.");
    return record;
  }

  /** Sequência legível por ano, gerada dentro da transação de criação. */
  private async nextCode(tx: Prisma.TransactionClient) {
    const year = new Date().getFullYear();
    const prefix = `RR-${year}-`;
    const last = await tx.resourceRequest.findFirst({
      where: { code: { startsWith: prefix } },
      select: { code: true },
      orderBy: { code: "desc" },
    });
    const sequence = last ? Number(last.code.slice(prefix.length)) + 1 : 1;
    return resourceRequestCode(year, sequence);
  }

  private buildWhere(query: RequestQueryDto): Prisma.ResourceRequestWhereInput {
    const search = query.search?.trim();
    return {
      OR: search
        ? [
            { code: { contains: search, mode: "insensitive" } },
            { title: { contains: search, mode: "insensitive" } },
          ]
        : undefined,
      status: query.status,
      priority: query.priority,
      electionId: query.electionId,
      electoralZoneId: query.electoralZoneId,
      pollingPlaceId: query.pollingPlaceId,
      ownerId: query.ownerId,
      requestedById: query.requestedById,
      incidentId: query.incidentId,
      items: query.itemKind ? { some: { kind: query.itemKind } } : undefined,
      neededAt: query.overdue
        ? { lt: new Date() }
        : undefined,
      createdAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
    };
  }
}

function priorityIsCritical(
  priority: string,
  status: SharedStatus,
): boolean {
  return priority === "CRITICAL" && !isTerminalResourceRequestStatus(status);
}

/**
 * Estados que aceitam atendimento. A tabela normativa de transições só admite
 * APPROVED → PARTIALLY_FULFILLED|FULFILLED e PARTIALLY_FULFILLED → FULFILLED:
 * um pedido precisa ser aprovado antes de ser atendido.
 */
export function allowedFulfillmentSourceStatus(status: ResourceRequestStatus) {
  return (
    status === ResourceRequestStatus.APPROVED ||
    status === ResourceRequestStatus.PARTIALLY_FULFILLED
  );
}

/**
 * Status para o qual o pedido volta quando todos os atendimentos são removidos.
 * Determinístico e coerente com a trilha já registrada no próprio pedido.
 */
export function statusWithoutFulfillment(record: {
  approvedAt: Date | null;
  triagedAt: Date | null;
}): ResourceRequestStatus {
  if (record.approvedAt) return ResourceRequestStatus.APPROVED;
  if (record.triagedAt) return ResourceRequestStatus.TRIAGED;
  return ResourceRequestStatus.SUBMITTED;
}

function transitionAction(to: ResourceRequestStatus): ResourceRequestHistoryAction {
  switch (to) {
    case ResourceRequestStatus.SUBMITTED:
      return ResourceRequestHistoryAction.SUBMITTED;
    case ResourceRequestStatus.TRIAGED:
      return ResourceRequestHistoryAction.TRIAGED;
    case ResourceRequestStatus.APPROVED:
      return ResourceRequestHistoryAction.APPROVED;
    case ResourceRequestStatus.REJECTED:
      return ResourceRequestHistoryAction.REJECTED;
    case ResourceRequestStatus.CANCELLED:
      return ResourceRequestHistoryAction.CANCELLED;
    case ResourceRequestStatus.FULFILLED:
      return ResourceRequestHistoryAction.FULFILLED;
    case ResourceRequestStatus.PARTIALLY_FULFILLED:
      return ResourceRequestHistoryAction.PARTIALLY_FULFILLED;
    default:
      return ResourceRequestHistoryAction.UPDATED;
  }
}

function transitionDescription(to: ResourceRequestStatus): string {
  switch (to) {
    case ResourceRequestStatus.SUBMITTED:
      return "Solicitação submetida para triagem.";
    case ResourceRequestStatus.TRIAGED:
      return "Solicitação triada.";
    case ResourceRequestStatus.APPROVED:
      return "Solicitação aprovada.";
    case ResourceRequestStatus.REJECTED:
      return "Solicitação rejeitada.";
    case ResourceRequestStatus.CANCELLED:
      return "Solicitação cancelada.";
    case ResourceRequestStatus.FULFILLED:
      return "Solicitação atendida.";
    case ResourceRequestStatus.PARTIALLY_FULFILLED:
      return "Solicitação parcialmente atendida.";
    default:
      return "Solicitação atualizada.";
  }
}

