import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AssetAssignmentKind,
  AssetCondition,
  AssetMaintenanceStatus,
  AssetMaintenanceType,
  AssetReservationStatus,
  AssetStatus,
  IncidentStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import {
  AssetQueryDto,
  CheckInAssetDto,
  CheckOutAssetDto,
  CompleteMaintenanceDto,
  CreateAssetDto,
  CreateAssetTypeDto,
  CreateMaintenanceDto,
  CreateReservationDto,
  MaintenanceActionDto,
  MaintenanceQueryDto,
  MoveAssetDto,
  ReservationActionDto,
  ReservationQueryDto,
  UpdateAssetDto,
  UpdateAssetTypeDto,
} from "./dto/asset.dto";

const includeLocation = {
  type: true,
  electoralZone: { select: { id: true, number: true, name: true, municipality: true } },
  pollingPlace: { select: { id: true, name: true, city: true } },
} satisfies Prisma.AssetInclude;

const activeMaintenance: AssetMaintenanceStatus[] = [AssetMaintenanceStatus.OPEN, AssetMaintenanceStatus.IN_PROGRESS];
const unavailableConditions: AssetCondition[] = [AssetCondition.DAMAGED, AssetCondition.UNAVAILABLE];
const unavailableStatuses: AssetStatus[] = [AssetStatus.LOST, AssetStatus.RETIRED];
const closedReservationStatuses: AssetReservationStatus[] = [
  AssetReservationStatus.CANCELLED,
  AssetReservationStatus.FULFILLED,
];

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService, private readonly eventBus?: EventBus) {}

  private where(query: AssetQueryDto): Prisma.AssetWhereInput {
    return {
      typeId: query.typeId,
      status: query.status,
      condition: query.condition,
      electoralZoneId: query.zoneId,
      pollingPlaceId: query.pollingPlaceId,
      OR: query.search
        ? [
            { assetTag: { contains: query.search, mode: "insensitive" } },
            { name: { contains: query.search, mode: "insensitive" } },
            { serialNumber: { contains: query.search, mode: "insensitive" } },
            { manufacturer: { contains: query.search, mode: "insensitive" } },
            { model: { contains: query.search, mode: "insensitive" } },
          ]
        : undefined,
    };
  }

  private operationalState(asset: {
    status: AssetStatus;
    condition: AssetCondition;
    assignments?: Array<{ kind: AssetAssignmentKind; endedAt: Date | null; expectedReturnAt: Date | null }>;
    reservations?: Array<{ status: AssetReservationStatus; startsAt: Date; endsAt: Date }>;
    maintenances?: Array<{ status: AssetMaintenanceStatus }>;
  }) {
    const now = new Date();
    const custody = asset.assignments?.find((item) => item.kind === AssetAssignmentKind.CUSTODY && !item.endedAt);
    const maintenance = asset.maintenances?.find((item) => activeMaintenance.includes(item.status));
    const reservation = asset.reservations?.find(
      (item) => item.status === AssetReservationStatus.APPROVED && item.startsAt <= now && item.endsAt >= now,
    );
    if (unavailableStatuses.includes(asset.status) || unavailableConditions.includes(asset.condition)) return "UNAVAILABLE";
    if (maintenance) return "MAINTENANCE";
    if (custody) return custody.expectedReturnAt && custody.expectedReturnAt < now ? "OVERDUE" : "IN_CUSTODY";
    if (reservation) return "RESERVED";
    return asset.status;
  }

  private withOperationalState<T extends Parameters<InventoryService["operationalState"]>[0]>(asset: T) {
    const operationalState = this.operationalState(asset);
    return {
      ...asset,
      operationalState,
      availableActions: {
        checkOut: operationalState === AssetStatus.AVAILABLE || operationalState === "RESERVED",
        checkIn: operationalState === "IN_CUSTODY" || operationalState === "OVERDUE",
        reserve: operationalState === AssetStatus.AVAILABLE,
        openMaintenance: !["MAINTENANCE", "IN_CUSTODY", "OVERDUE"].includes(operationalState),
      },
    };
  }

  private operationalInclude() {
    const now = new Date();
    return {
      ...includeLocation,
      assignments: {
        where: { kind: AssetAssignmentKind.CUSTODY, endedAt: null },
        orderBy: { assignedAt: "desc" as const },
        take: 1,
      },
      reservations: {
        where: { status: AssetReservationStatus.APPROVED, endsAt: { gte: now } },
        orderBy: { startsAt: "asc" as const },
        take: 3,
      },
      maintenances: {
        where: { status: { in: activeMaintenance } },
        orderBy: { openedAt: "desc" as const },
        take: 1,
      },
    } satisfies Prisma.AssetInclude;
  }

  async findAll(query: AssetQueryDto) {
    const where = this.where(query);
    const [items, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        include: this.operationalInclude(),
        orderBy: { assetTag: "asc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.asset.count({ where }),
    ]);
    return {
      items: items.map((item) => this.withOperationalState(item)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async dashboard() {
    const now = new Date();
    const [total, unavailable, maintenance, inTransit, allocated, checkedOut, overdue, reservations, recentMovements] =
      await Promise.all([
        this.prisma.asset.count(),
        this.prisma.asset.count({ where: { condition: { in: [AssetCondition.DAMAGED, AssetCondition.UNAVAILABLE] } } }),
        this.prisma.assetMaintenance.count({ where: { status: { in: activeMaintenance } } }),
        this.prisma.asset.count({ where: { status: AssetStatus.IN_TRANSIT } }),
        this.prisma.asset.count({ where: { status: { in: [AssetStatus.ALLOCATED, AssetStatus.IN_USE] } } }),
        this.prisma.assetAssignment.count({ where: { kind: AssetAssignmentKind.CUSTODY, endedAt: null } }),
        this.prisma.assetAssignment.count({
          where: { kind: AssetAssignmentKind.CUSTODY, endedAt: null, expectedReturnAt: { lt: now } },
        }),
        this.prisma.assetReservation.count({
          where: { status: AssetReservationStatus.APPROVED, startsAt: { lte: now }, endsAt: { gte: now } },
        }),
        this.prisma.assetMovement.findMany({
          include: { asset: { select: { id: true, assetTag: true, name: true } } },
          orderBy: { movedAt: "desc" },
          take: 8,
        }),
      ]);
    return { total, unavailable, maintenance, inTransit, allocated, checkedOut, overdue, reservations, recentMovements };
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        ...includeLocation,
        movements: {
          include: { fromZone: true, fromPollingPlace: true, toZone: true, toPollingPlace: true },
          orderBy: { movedAt: "desc" },
        },
        assignments: { orderBy: { assignedAt: "desc" } },
        reservations: { orderBy: { startsAt: "desc" } },
        maintenances: { orderBy: { openedAt: "desc" } },
        incidents: {
          where: { status: { notIn: [IncidentStatus.CLOSED, IncidentStatus.CANCELLED] } },
          select: { id: true, code: true, title: true, severity: true, status: true },
        },
      },
    });
    if (!asset) throw new NotFoundException("Ativo não encontrado.");
    return this.withOperationalState(asset);
  }

  private async validateLocation(electoralZoneId?: string, pollingPlaceId?: string) {
    const [zone, place] = await Promise.all([
      electoralZoneId ? this.prisma.electoralZone.findUnique({ where: { id: electoralZoneId } }) : null,
      pollingPlaceId ? this.prisma.pollingPlace.findUnique({ where: { id: pollingPlaceId } }) : null,
    ]);
    if (electoralZoneId && !zone) throw new NotFoundException("Zona eleitoral não encontrada.");
    if (pollingPlaceId && !place) throw new NotFoundException("Local de votação não encontrado.");
    if (zone && place && place.electoralZoneId !== zone.id) throw new BadRequestException("O local não pertence à zona informada.");
    return { zone, place };
  }

  async create(dto: CreateAssetDto, actorId?: string) {
    const type = await this.prisma.assetType.findUnique({ where: { id: dto.typeId } });
    if (!type?.active) throw new NotFoundException("Tipo de ativo não encontrado ou inativo.");
    const { place } = await this.validateLocation(dto.electoralZoneId, dto.pollingPlaceId);
    try {
      const asset = await this.prisma.asset.create({
        data: { ...dto, assetTag: dto.assetTag.toUpperCase(), electoralZoneId: place?.electoralZoneId ?? dto.electoralZoneId },
        include: includeLocation,
      });
      await this.eventBus?.emit("asset.created", { entityId: asset.id, actorId, assetTag: asset.assetTag, name: asset.name });
      return asset;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Já existe um ativo com esse patrimônio.");
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateAssetDto, actorId?: string) {
    const current = await this.findOne(id);
    if (dto.typeId) {
      const type = await this.prisma.assetType.findUnique({ where: { id: dto.typeId } });
      if (!type?.active) throw new NotFoundException("Tipo de ativo não encontrado ou inativo.");
    }
    const asset = await this.prisma.asset.update({ where: { id }, data: dto, include: includeLocation });
    if (dto.status && dto.status !== current.status) {
      await this.eventBus?.emit("asset.status_changed", {
        entityId: asset.id,
        actorId,
        assetTag: asset.assetTag,
        from: current.status,
        to: dto.status,
      });
    }
    return asset;
  }

  async move(id: string, dto: MoveAssetDto, actorId?: string) {
    const asset = await this.findOne(id);
    if (asset.assignments.some((item) => item.kind === AssetAssignmentKind.CUSTODY && !item.endedAt)) {
      throw new ConflictException("O ativo deve ser devolvido antes de ser movimentado.");
    }
    if (asset.maintenances.some((item) => activeMaintenance.includes(item.status))) {
      throw new ConflictException("O ativo está em manutenção.");
    }
    const { zone, place } = await this.validateLocation(dto.toZoneId, dto.toPollingPlaceId);
    const toZoneId = place?.electoralZoneId ?? zone?.id;
    const statusAfter = dto.statusAfter ?? (place ? AssetStatus.IN_USE : zone ? AssetStatus.ALLOCATED : AssetStatus.AVAILABLE);
    const originLabel = asset.pollingPlace?.name ?? (asset.electoralZone ? `Zona ${asset.electoralZone.number}` : "Depósito central");
    const destinationLabel = place?.name ?? (zone ? `Zona ${zone.number}` : "Depósito central");
    const movement = await this.prisma.$transaction(async (tx) => {
      await tx.assetAssignment.updateMany({
        where: { assetId: id, kind: AssetAssignmentKind.ALLOCATION, endedAt: null },
        data: { endedAt: new Date() },
      });
      const created = await tx.assetMovement.create({
        data: {
          assetId: id,
          fromZoneId: asset.electoralZoneId,
          fromPollingPlaceId: asset.pollingPlaceId,
          toZoneId,
          toPollingPlaceId: place?.id,
          originLabel,
          destinationLabel,
          responsibleId: dto.responsibleId,
          responsibleName: dto.responsibleName,
          reason: dto.reason,
          statusBefore: asset.status,
          statusAfter,
          movedAt: dto.movedAt ? new Date(dto.movedAt) : undefined,
        },
      });
      await tx.asset.update({
        where: { id },
        data: { electoralZoneId: toZoneId, pollingPlaceId: place?.id ?? null, status: statusAfter },
      });
      await tx.assetAssignment.create({
        data: {
          assetId: id,
          kind: AssetAssignmentKind.ALLOCATION,
          electoralZoneId: toZoneId,
          pollingPlaceId: place?.id,
          assignedToId: dto.responsibleId,
          assignedToName: dto.responsibleName,
        },
      });
      return created;
    });
    await this.eventBus?.emit("asset.moved", {
      entityId: asset.id,
      actorId,
      assetTag: asset.assetTag,
      origin: originLabel,
      destination: destinationLabel,
      responsibleName: dto.responsibleName,
    });
    return movement;
  }

  async listReservations(query: ReservationQueryDto) {
    return this.prisma.assetReservation.findMany({
      where: {
        assetId: query.assetId,
        status: query.status,
        startsAt: query.to ? { lte: new Date(query.to) } : undefined,
        endsAt: query.from ? { gte: new Date(query.from) } : undefined,
      },
      include: { asset: { include: includeLocation } },
      orderBy: { startsAt: "asc" },
    });
  }

  async getReservation(id: string) {
    const reservation = await this.prisma.assetReservation.findUnique({ where: { id }, include: { asset: true } });
    if (!reservation) throw new NotFoundException("Reserva não encontrada.");
    return reservation;
  }

  async createReservation(dto: CreateReservationDto, actorId?: string) {
    const asset = await this.findOne(dto.assetId);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (startsAt >= endsAt) throw new BadRequestException("O fim da reserva deve ser posterior ao início.");
    if (unavailableStatuses.includes(asset.status) || unavailableConditions.includes(asset.condition)) {
      throw new ConflictException("Ativo indisponível para reserva.");
    }
    if (asset.maintenances.some((item) => activeMaintenance.includes(item.status))) {
      throw new ConflictException("Ativo em manutenção.");
    }
    const overlap = await this.prisma.assetReservation.findFirst({
      where: {
        assetId: dto.assetId,
        status: { in: [AssetReservationStatus.REQUESTED, AssetReservationStatus.APPROVED] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (overlap) throw new ConflictException("Já existe reserva concorrente para este período.");
    const reservation = await this.prisma.assetReservation.create({
      data: { ...dto, startsAt, endsAt, createdById: actorId },
      include: { asset: true },
    });
    await this.eventBus?.emit("asset.reservation_requested", {
      entityId: reservation.id,
      actorId,
      assetId: asset.id,
      assetTag: asset.assetTag,
      requesterName: reservation.requesterName,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });
    return reservation;
  }

  async approveReservation(id: string, _dto: ReservationActionDto, actorId?: string) {
    const reservation = await this.getReservation(id);
    if (reservation.status !== AssetReservationStatus.REQUESTED) throw new ConflictException("A reserva não está pendente.");
    const asset = await this.findOne(reservation.assetId);
    if (asset.assignments.some((item) => item.kind === AssetAssignmentKind.CUSTODY && !item.endedAt)) {
      throw new ConflictException("O ativo está em custódia.");
    }
    if (asset.maintenances.some((item) => activeMaintenance.includes(item.status))) {
      throw new ConflictException("O ativo está em manutenção.");
    }
    const overlap = await this.prisma.assetReservation.findFirst({
      where: {
        id: { not: id },
        assetId: reservation.assetId,
        status: AssetReservationStatus.APPROVED,
        startsAt: { lt: reservation.endsAt },
        endsAt: { gt: reservation.startsAt },
      },
    });
    if (overlap) throw new ConflictException("Existe outra reserva aprovada para o período.");
    const updated = await this.prisma.assetReservation.update({
      where: { id },
      data: { status: AssetReservationStatus.APPROVED, approvedById: actorId, approvedAt: new Date() },
      include: { asset: true },
    });
    await this.eventBus?.emit("asset.reservation_approved", {
      entityId: updated.id,
      actorId,
      assetId: updated.assetId,
      assetTag: updated.asset.assetTag,
    });
    return updated;
  }

  async cancelReservation(id: string, dto: ReservationActionDto, actorId?: string) {
    const reservation = await this.getReservation(id);
    if (closedReservationStatuses.includes(reservation.status)) {
      throw new ConflictException("A reserva já foi encerrada.");
    }
    const updated = await this.prisma.assetReservation.update({
      where: { id },
      data: { status: AssetReservationStatus.CANCELLED, cancelledAt: new Date(), notes: dto.notes ?? reservation.notes },
      include: { asset: true },
    });
    await this.eventBus?.emit("asset.reservation_cancelled", {
      entityId: updated.id,
      actorId,
      assetId: updated.assetId,
      assetTag: updated.asset.assetTag,
      reason: dto.notes,
    });
    return updated;
  }

  async checkOut(id: string, dto: CheckOutAssetDto, actorId?: string) {
    const asset = await this.findOne(id);
    if (asset.operationalState !== AssetStatus.AVAILABLE && asset.operationalState !== "RESERVED") {
      throw new ConflictException("Ativo não está disponível para retirada.");
    }
    const reservation = dto.reservationId ? await this.getReservation(dto.reservationId) : null;
    if (asset.operationalState === "RESERVED" && !reservation) {
      throw new ConflictException("Informe a reserva aprovada para retirar este ativo.");
    }
    if (reservation && (reservation.assetId !== id || reservation.status !== AssetReservationStatus.APPROVED)) {
      throw new ConflictException("Reserva inválida para esta retirada.");
    }
    const assignment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.assetAssignment.create({
        data: {
          assetId: id,
          kind: AssetAssignmentKind.CUSTODY,
          assignedToId: dto.responsibleId,
          assignedToName: dto.responsibleName,
          purpose: dto.purpose,
          originLabel: dto.origin,
          destinationLabel: dto.destination,
          expectedReturnAt: dto.expectedReturnAt ? new Date(dto.expectedReturnAt) : undefined,
          conditionOut: dto.conditionOut,
          checkedOutById: actorId,
          checkoutNotes: dto.notes,
        },
      });
      await tx.asset.update({ where: { id }, data: { status: AssetStatus.IN_USE, condition: dto.conditionOut } });
      await tx.assetMovement.create({
        data: {
          assetId: id,
          fromZoneId: asset.electoralZoneId,
          fromPollingPlaceId: asset.pollingPlaceId,
          originLabel: dto.origin,
          destinationLabel: dto.destination,
          responsibleId: dto.responsibleId,
          responsibleName: dto.responsibleName,
          reason: dto.purpose,
          statusBefore: asset.status,
          statusAfter: AssetStatus.IN_USE,
        },
      });
      if (reservation) {
        await tx.assetReservation.update({
          where: { id: reservation.id },
          data: { status: AssetReservationStatus.FULFILLED, fulfilledAt: new Date() },
        });
      }
      return created;
    });
    await this.eventBus?.emit("asset.checked_out", {
      entityId: id,
      actorId,
      assetTag: asset.assetTag,
      responsibleId: dto.responsibleId,
      responsibleName: dto.responsibleName,
      expectedReturnAt: dto.expectedReturnAt,
    });
    return assignment;
  }

  async checkIn(id: string, dto: CheckInAssetDto, actorId?: string) {
    const asset = await this.findOne(id);
    const custody = asset.assignments.find((item) => item.kind === AssetAssignmentKind.CUSTODY && !item.endedAt);
    if (!custody) throw new ConflictException("Não existe retirada ativa para este ativo.");
    const needsMaintenance = dto.problemDetected || unavailableConditions.includes(dto.conditionIn);
    const result = await this.prisma.$transaction(async (tx) => {
      const assignment = await tx.assetAssignment.update({
        where: { id: custody.id },
        data: {
          endedAt: new Date(),
          returnedAt: new Date(),
          returnedTo: dto.returnedTo,
          receivedById: dto.receivedById,
          receivedByName: dto.receivedByName,
          checkedInById: actorId,
          conditionIn: dto.conditionIn,
          problemDetected: dto.problemDetected,
          returnNotes: dto.notes,
        },
      });
      await tx.asset.update({
        where: { id },
        data: { condition: dto.conditionIn, status: needsMaintenance ? AssetStatus.MAINTENANCE : AssetStatus.AVAILABLE },
      });
      await tx.assetMovement.create({
        data: {
          assetId: id,
          originLabel: custody.destinationLabel ?? "Custódia",
          destinationLabel: dto.returnedTo,
          responsibleId: dto.receivedById,
          responsibleName: dto.receivedByName,
          reason: dto.notes ?? "Devolução de ativo",
          statusBefore: asset.status,
          statusAfter: needsMaintenance ? AssetStatus.MAINTENANCE : AssetStatus.AVAILABLE,
        },
      });
      const maintenance = needsMaintenance
        ? await tx.assetMaintenance.create({
            data: {
              assetId: id,
              type: AssetMaintenanceType.CORRECTIVE,
              description: dto.notes ?? "Problema identificado na devolução.",
              responsible: dto.receivedByName,
              openedById: actorId,
            },
          })
        : null;
      return { assignment, maintenance };
    });
    await this.eventBus?.emit("asset.checked_in", {
      entityId: id,
      actorId,
      assetTag: asset.assetTag,
      condition: dto.conditionIn,
      problemDetected: dto.problemDetected,
    });
    if (result.maintenance) {
      await this.eventBus?.emit("asset.maintenance_opened", {
        entityId: result.maintenance.id,
        actorId,
        assetId: id,
        assetTag: asset.assetTag,
        type: result.maintenance.type,
      });
    }
    return result;
  }

  listMaintenance(query: MaintenanceQueryDto) {
    return this.prisma.assetMaintenance.findMany({
      where: { assetId: query.assetId, status: query.status, type: query.type },
      include: { asset: { include: includeLocation } },
      orderBy: { openedAt: "desc" },
    });
  }

  private async getMaintenance(id: string) {
    const maintenance = await this.prisma.assetMaintenance.findUnique({ where: { id }, include: { asset: true } });
    if (!maintenance) throw new NotFoundException("Manutenção não encontrada.");
    return maintenance;
  }

  async createMaintenance(dto: CreateMaintenanceDto, actorId?: string) {
    const asset = await this.findOne(dto.assetId);
    if (asset.assignments.some((item) => item.kind === AssetAssignmentKind.CUSTODY && !item.endedAt)) {
      throw new ConflictException("O ativo deve ser devolvido antes de entrar em manutenção.");
    }
    if (asset.maintenances.some((item) => activeMaintenance.includes(item.status))) {
      throw new ConflictException("Já existe manutenção ativa para este ativo.");
    }
    const maintenance = await this.prisma.$transaction(async (tx) => {
      const created = await tx.assetMaintenance.create({ data: { ...dto, openedById: actorId } });
      await tx.asset.update({ where: { id: dto.assetId }, data: { status: AssetStatus.MAINTENANCE } });
      return created;
    });
    await this.eventBus?.emit("asset.maintenance_opened", {
      entityId: maintenance.id,
      actorId,
      assetId: asset.id,
      assetTag: asset.assetTag,
      type: maintenance.type,
    });
    return maintenance;
  }

  async startMaintenance(id: string, _dto: MaintenanceActionDto, actorId?: string) {
    const maintenance = await this.getMaintenance(id);
    if (maintenance.status !== AssetMaintenanceStatus.OPEN) throw new ConflictException("A manutenção não está aberta.");
    const updated = await this.prisma.assetMaintenance.update({
      where: { id },
      data: { status: AssetMaintenanceStatus.IN_PROGRESS, startedAt: new Date() },
    });
    await this.eventBus?.emit("asset.maintenance_started", {
      entityId: id,
      actorId,
      assetId: maintenance.assetId,
      assetTag: maintenance.asset.assetTag,
    });
    return updated;
  }

  async completeMaintenance(id: string, dto: CompleteMaintenanceDto, actorId?: string) {
    const maintenance = await this.getMaintenance(id);
    if (!activeMaintenance.includes(maintenance.status)) throw new ConflictException("A manutenção já foi encerrada.");
    const updated = await this.prisma.$transaction(async (tx) => {
      const completed = await tx.assetMaintenance.update({
        where: { id },
        data: {
          status: AssetMaintenanceStatus.COMPLETED,
          completedAt: new Date(),
          completedById: actorId,
          result: dto.result,
          notes: dto.notes ?? maintenance.notes,
        },
      });
      await tx.asset.update({
        where: { id: maintenance.assetId },
        data: {
          status: dto.returnToService ? AssetStatus.AVAILABLE : AssetStatus.MAINTENANCE,
          condition: dto.returnToService ? AssetCondition.GOOD : maintenance.asset.condition,
        },
      });
      return completed;
    });
    await this.eventBus?.emit("asset.maintenance_completed", {
      entityId: id,
      actorId,
      assetId: maintenance.assetId,
      assetTag: maintenance.asset.assetTag,
      returnToService: dto.returnToService,
    });
    return updated;
  }

  async cancelMaintenance(id: string, _dto: MaintenanceActionDto, actorId?: string) {
    const maintenance = await this.getMaintenance(id);
    if (!activeMaintenance.includes(maintenance.status)) throw new ConflictException("A manutenção já foi encerrada.");
    const updated = await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.assetMaintenance.update({
        where: { id },
        data: { status: AssetMaintenanceStatus.CANCELLED, cancelledAt: new Date() },
      });
      await tx.asset.update({ where: { id: maintenance.assetId }, data: { status: AssetStatus.AVAILABLE } });
      return cancelled;
    });
    await this.eventBus?.emit("asset.maintenance_cancelled", {
      entityId: id,
      actorId,
      assetId: maintenance.assetId,
      assetTag: maintenance.asset.assetTag,
    });
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.asset.delete({ where: { id } });
  }

  listTypes() {
    return this.prisma.assetType.findMany({ orderBy: { name: "asc" } });
  }

  async createType(dto: CreateAssetTypeDto) {
    try {
      return await this.prisma.assetType.create({ data: { ...dto, key: dto.key.toUpperCase() } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Já existe um tipo com essa chave.");
      }
      throw error;
    }
  }

  async updateType(id: string, dto: UpdateAssetTypeDto) {
    const type = await this.prisma.assetType.findUnique({ where: { id } });
    if (!type) throw new NotFoundException("Tipo de ativo não encontrado.");
    return this.prisma.assetType.update({ where: { id }, data: dto });
  }
}
