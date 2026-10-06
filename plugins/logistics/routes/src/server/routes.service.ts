import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AssetAssignmentKind,
  AssetCondition,
  AssetMaintenanceStatus,
  AssetStatus,
  DeliveryStatus,
  LogisticsEventType,
  Prisma,
  RouteExceptionReason,
  RouteStatus,
  RouteStopStatus,
  VehicleStatus,
} from "@prisma/client";
import { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import {
  CreateBatchDto,
  CreateDeliveryDto,
  CreateRouteDto,
  CreateRouteExceptionDto,
  CreateVehicleDto,
  ReorderStopsDto,
  ResolveRouteExceptionDto,
  RouteQueryDto,
  StopActionDto,
  TransitionRouteDto,
  UpdateDeliveryDto,
  UpdateRouteDto,
} from "./dto/routes.dto";

const routeInclude = {
  election: { select: { id: true, name: true, year: true } },
  electoralZone: { select: { id: true, number: true, name: true, municipality: true } },
  vehicle: true,
  stops: {
    include: { pollingPlace: { select: { id: true, name: true, address: true } } },
    orderBy: { order: "asc" as const },
  },
  deliveries: {
    include: {
      pollingPlace: { select: { id: true, name: true } },
      items: { include: { asset: { select: { id: true, assetTag: true, name: true, status: true, condition: true } } } },
    },
    orderBy: { createdAt: "desc" as const },
  },
  batches: {
    include: { deliveries: { select: { id: true, status: true, pollingPlaceId: true, items: { select: { quantity: true } } } } },
    orderBy: { code: "asc" as const },
  },
  history: { orderBy: { createdAt: "desc" as const } },
  exceptions: {
    include: { stop: { select: { id: true, order: true, description: true } }, delivery: { select: { id: true, status: true } } },
    orderBy: { occurredAt: "desc" as const },
  },
} satisfies Prisma.DistributionRouteInclude;

const terminalRouteStatuses: RouteStatus[] = [RouteStatus.COMPLETED, RouteStatus.CANCELLED];
const editableRouteStatuses: RouteStatus[] = [RouteStatus.PLANNED, RouteStatus.READY];
const runningRouteStatuses: RouteStatus[] = [RouteStatus.IN_PROGRESS, RouteStatus.DELAYED];
const movingRouteStatuses: RouteStatus[] = [RouteStatus.DISPATCHED, RouteStatus.IN_PROGRESS, RouteStatus.DELAYED];
const preDispatchValidationStatuses: RouteStatus[] = [RouteStatus.READY, RouteStatus.DISPATCHED];
const pendingDeliveryStatuses: DeliveryStatus[] = [DeliveryStatus.PENDING, DeliveryStatus.IN_TRANSIT];
const unavailableVehicleStatuses: VehicleStatus[] = [VehicleStatus.MAINTENANCE, VehicleStatus.UNAVAILABLE];
const exceptionStopStatuses: RouteStopStatus[] = [RouteStopStatus.FAILED, RouteStopStatus.SKIPPED];
const unavailableAssetStatuses: AssetStatus[] = [AssetStatus.MAINTENANCE, AssetStatus.IN_USE];
const unavailableAssetConditions: AssetCondition[] = [AssetCondition.DAMAGED, AssetCondition.UNAVAILABLE];

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService, private readonly eventBus?: EventBus) {}

  async findAll(query: RouteQueryDto) {
    const where: Prisma.DistributionRouteWhereInput = {
      electionId: query.electionId,
      electoralZoneId: query.zoneId,
      status: query.status,
      responsibleName: query.responsible ? { contains: query.responsible, mode: "insensitive" } : undefined,
      plannedDeparture:
        query.from || query.to
          ? { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined }
          : undefined,
    };
    const items = await this.prisma.distributionRoute.findMany({
      where,
      include: routeInclude,
      orderBy: { plannedDeparture: "asc" },
    });
    return items.map((route) => this.withOperationalMetrics(route));
  }

  async dashboard(query: RouteQueryDto) {
    const items = await this.findAll(query);
    const deliveries = items.flatMap((route) => route.deliveries);
    return {
      total: items.length,
      ready: items.filter((route) => route.status === RouteStatus.READY).length,
      dispatched: items.filter((route) => route.status === RouteStatus.DISPATCHED).length,
      inProgress: items.filter((route) => runningRouteStatuses.includes(route.status)).length,
      atRisk: items.filter((route) => route.deliveryRisk === "AT_RISK").length,
      delayed: items.filter((route) => route.deliveryRisk === "DELAYED").length,
      completed: items.filter((route) => route.status === RouteStatus.COMPLETED).length,
      pendingDeliveries: deliveries.filter((delivery) => pendingDeliveryStatuses.includes(delivery.status)).length,
      failedDeliveries: deliveries.filter((delivery) => delivery.status === DeliveryStatus.FAILED).length,
      openExceptions: items.reduce((sum, route) => sum + route.openExceptions, 0),
      assetsInTransit: items.reduce((sum, route) => sum + (route.status === RouteStatus.IN_PROGRESS ? route.assetsInTransit : 0), 0),
    };
  }

  async findOne(id: string) {
    const route = await this.prisma.distributionRoute.findUnique({ where: { id }, include: routeInclude });
    if (!route) throw new NotFoundException("Rota não encontrada.");
    return this.withOperationalMetrics(route);
  }

  private withOperationalMetrics<
    T extends {
      plannedDeparture: Date;
      plannedArrival: Date;
      actualArrival: Date | null;
      status: RouteStatus;
      vehicle: { capacity: number | null } | null;
      stops: Array<{ eta: Date; actualAt: Date | null; status: RouteStopStatus }>;
      deliveries: Array<{ status: DeliveryStatus; items: Array<{ assetId: string | null; quantity: number }> }>;
      batches: Array<{
        deliveries: Array<{ status: DeliveryStatus; pollingPlaceId: string; items: Array<{ quantity: number }> }>;
      }>;
      exceptions: Array<{ resolvedAt: Date | null }>;
    },
  >(route: T) {
    const now = new Date();
    const active = !terminalRouteStatuses.includes(route.status);
    const routeReference = route.actualArrival ?? (active ? now : route.plannedArrival);
    const routeDelay = Math.max(0, Math.floor((routeReference.getTime() - route.plannedArrival.getTime()) / 60_000));
    const stopDelays = route.stops.map((stop) => {
      const reference = stop.actualAt ?? (active && stop.status === RouteStopStatus.PENDING ? now : stop.eta);
      return Math.max(0, Math.floor((reference.getTime() - stop.eta.getTime()) / 60_000));
    });
    const delayMinutes = Math.max(routeDelay, ...stopDelays, 0);
    const loadUnits = route.deliveries.flatMap((delivery) => delivery.items).reduce((sum, item) => sum + item.quantity, 0);
    const assetsInTransit = new Set(
      route.deliveries.flatMap((delivery) => delivery.items).map((item) => item.assetId).filter(Boolean),
    ).size;
    const nextEta = route.stops.find((stop) => stop.status === RouteStopStatus.PENDING)?.eta;
    const deliveryRisk =
      !active
        ? "ON_TIME"
        : route.status === RouteStatus.DELAYED || delayMinutes > 0
        ? "DELAYED"
        : active && nextEta && nextEta.getTime() - now.getTime() < 30 * 60_000
          ? "AT_RISK"
          : "ON_TIME";
    return {
      ...route,
      delayMinutes,
      deliveryRisk,
      loadUnits,
      assetsInTransit,
      capacityExceeded: route.vehicle?.capacity != null && loadUnits > route.vehicle.capacity,
      openExceptions: route.exceptions.filter((item) => !item.resolvedAt).length,
      availableActions: this.availableRouteActions(route.status),
      batches: route.batches.map((batch) => ({
        ...batch,
        itemCount: batch.deliveries.flatMap((delivery) => delivery.items).reduce((sum, item) => sum + item.quantity, 0),
        placesCount: new Set(batch.deliveries.map((delivery) => delivery.pollingPlaceId)).size,
        pendingCount: batch.deliveries.filter((delivery) => pendingDeliveryStatuses.includes(delivery.status)).length,
        completedCount: batch.deliveries.filter((delivery) => delivery.status === DeliveryStatus.DELIVERED).length,
        failedCount: batch.deliveries.filter((delivery) => delivery.status === DeliveryStatus.FAILED).length,
      })),
    };
  }

  private availableRouteActions(status: RouteStatus) {
    const transitions: Record<RouteStatus, RouteStatus[]> = {
      PLANNED: [RouteStatus.READY, RouteStatus.CANCELLED],
      READY: [RouteStatus.PLANNED, RouteStatus.DISPATCHED, RouteStatus.CANCELLED],
      DISPATCHED: [RouteStatus.IN_PROGRESS, RouteStatus.CANCELLED],
      IN_PROGRESS: [RouteStatus.DELAYED, RouteStatus.COMPLETED, RouteStatus.CANCELLED],
      DELAYED: [RouteStatus.IN_PROGRESS, RouteStatus.COMPLETED, RouteStatus.CANCELLED],
      COMPLETED: [],
      CANCELLED: [],
    };
    return transitions[status];
  }

  private async validateRouteReferences(dto: Pick<CreateRouteDto, "electionId" | "electoralZoneId" | "vehicleId" | "stops">) {
    const [election, zone, vehicle] = await Promise.all([
      this.prisma.election.findUnique({ where: { id: dto.electionId } }),
      this.prisma.electoralZone.findUnique({ where: { id: dto.electoralZoneId } }),
      dto.vehicleId ? this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } }) : null,
    ]);
    if (!election) throw new NotFoundException("Pleito não encontrado.");
    if (!zone || zone.electionId !== election.id) throw new BadRequestException("A zona não pertence ao pleito informado.");
    if (dto.vehicleId && !vehicle) throw new NotFoundException("Veículo não encontrado.");
    if (vehicle && unavailableVehicleStatuses.includes(vehicle.status)) {
      throw new ConflictException("Veículo indisponível para esta rota.");
    }
    const placeIds = [...new Set((dto.stops ?? []).map((stop) => stop.pollingPlaceId).filter((id): id is string => Boolean(id)))];
    if (placeIds.length) {
      const count = await this.prisma.pollingPlace.count({ where: { id: { in: placeIds }, electoralZoneId: zone.id } });
      if (count !== placeIds.length) throw new BadRequestException("Uma ou mais paradas não pertencem à zona da rota.");
    }
  }

  async create(dto: CreateRouteDto, actorId?: string) {
    if (new Date(dto.plannedArrival) <= new Date(dto.plannedDeparture)) {
      throw new BadRequestException("A chegada planejada deve ocorrer após a saída.");
    }
    await this.validateRouteReferences(dto);
    try {
      const route = await this.prisma.$transaction(async (tx) => {
        const created = await tx.distributionRoute.create({
          data: {
            code: dto.code.toUpperCase(),
            name: dto.name,
            electionId: dto.electionId,
            electoralZoneId: dto.electoralZoneId,
            description: dto.description,
            originName: dto.originName,
            originLatitude: dto.originLatitude,
            originLongitude: dto.originLongitude,
            destinationName: dto.destinationName,
            destinationLatitude: dto.destinationLatitude,
            destinationLongitude: dto.destinationLongitude,
            plannedDeparture: new Date(dto.plannedDeparture),
            plannedArrival: new Date(dto.plannedArrival),
            responsibleName: dto.responsibleName,
            driverName: dto.driverName,
            vehicleId: dto.vehicleId,
            notes: dto.notes,
            status: RouteStatus.PLANNED,
            stops: { create: (dto.stops ?? []).map((stop) => ({ ...stop, eta: new Date(stop.eta) })) },
          },
        });
        await tx.routeHistoryEvent.create({
          data: { routeId: created.id, type: LogisticsEventType.ROUTE_CREATED, message: `Rota ${created.code} criada.`, actorId },
        });
        if (dto.vehicleId) await tx.vehicle.update({ where: { id: dto.vehicleId }, data: { status: VehicleStatus.ASSIGNED } });
        return created;
      });
      await this.eventBus?.emit("route.created", {
        entityId: route.id,
        actorId,
        code: route.code,
        name: route.name,
        electionId: route.electionId,
        electoralZoneId: route.electoralZoneId,
      });
      return this.findOne(route.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Já existe uma rota com esse código ou ordem de parada repetida.");
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateRouteDto, _actorId?: string) {
    const current = await this.findOne(id);
    if (!editableRouteStatuses.includes(current.status)) throw new ConflictException("A rota não pode mais ser editada.");
    const departure = dto.plannedDeparture ? new Date(dto.plannedDeparture) : current.plannedDeparture;
    const arrival = dto.plannedArrival ? new Date(dto.plannedArrival) : current.plannedArrival;
    if (arrival <= departure) throw new BadRequestException("A chegada planejada deve ocorrer após a saída.");
    if (dto.vehicleId && dto.vehicleId !== current.vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
      if (!vehicle || unavailableVehicleStatuses.includes(vehicle.status)) {
        throw new ConflictException("Veículo indisponível para esta rota.");
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.distributionRoute.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          plannedDeparture: departure,
          plannedArrival: arrival,
          responsibleName: dto.responsibleName,
          driverName: dto.driverName,
          vehicle: dto.vehicleId ? { connect: { id: dto.vehicleId } } : undefined,
          notes: dto.notes,
        },
      });
      if (current.vehicleId && dto.vehicleId && current.vehicleId !== dto.vehicleId) {
        await tx.vehicle.update({ where: { id: current.vehicleId }, data: { status: VehicleStatus.AVAILABLE } });
      }
      if (dto.vehicleId) await tx.vehicle.update({ where: { id: dto.vehicleId }, data: { status: VehicleStatus.ASSIGNED } });
    });
    return this.findOne(id);
  }

  private async validateReady(route: Awaited<ReturnType<RoutesService["findOne"]>>) {
    if (!route.vehicleId) throw new ConflictException("Associe um veículo antes de liberar a rota.");
    if (!route.driverName) throw new ConflictException("Informe o motorista antes de liberar a rota.");
    if (!route.stops.length) throw new ConflictException("A rota deve possuir ao menos uma parada.");
    if (!route.deliveries.length) throw new ConflictException("A rota deve possuir ao menos uma entrega.");
    if (route.capacityExceeded) throw new ConflictException("A carga excede a capacidade cadastrada do veículo.");
    const assetIds = route.deliveries.flatMap((delivery) => delivery.items.map((item) => item.assetId)).filter((id): id is string => Boolean(id));
    if (assetIds.length) {
      const blocked = await this.prisma.asset.findFirst({
        where: {
          id: { in: assetIds },
          OR: [
            { status: { in: [AssetStatus.MAINTENANCE, AssetStatus.IN_USE] } },
            { condition: { in: [AssetCondition.DAMAGED, AssetCondition.UNAVAILABLE] } },
            { maintenances: { some: { status: { in: [AssetMaintenanceStatus.OPEN, AssetMaintenanceStatus.IN_PROGRESS] } } } },
            { assignments: { some: { kind: AssetAssignmentKind.CUSTODY, endedAt: null } } },
          ],
        },
      });
      if (blocked) throw new ConflictException(`O ativo ${blocked.assetTag} não está elegível para despacho.`);
    }
  }

  async transition(id: string, dto: TransitionRouteDto, actorId?: string) {
    const route = await this.findOne(id);
    if (!route.availableActions.includes(dto.status)) throw new ConflictException("Transição de status inválida.");
    if (dto.status === RouteStatus.CANCELLED && !dto.reason) throw new BadRequestException("Informe o motivo do cancelamento.");
    if (preDispatchValidationStatuses.includes(dto.status)) await this.validateReady(route);
    const now = new Date();
    const typeByStatus: Partial<Record<RouteStatus, LogisticsEventType>> = {
      READY: LogisticsEventType.ROUTE_READY,
      DISPATCHED: LogisticsEventType.ROUTE_DISPATCHED,
      IN_PROGRESS: LogisticsEventType.ROUTE_STARTED,
      COMPLETED: LogisticsEventType.ROUTE_ARRIVED,
      CANCELLED: LogisticsEventType.ROUTE_CANCELLED,
      DELAYED: LogisticsEventType.DELAY_DETECTED,
    };
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.distributionRoute.update({
        where: { id },
        data: {
          status: dto.status,
          actualDeparture: dto.status === RouteStatus.IN_PROGRESS ? now : undefined,
          actualArrival: dto.status === RouteStatus.COMPLETED ? now : undefined,
        },
      });
      const eventType = typeByStatus[dto.status];
      if (eventType) {
        await tx.routeHistoryEvent.create({
          data: {
            routeId: id,
            type: eventType,
            actorId,
            message: `Rota ${route.code}: ${route.status} → ${dto.status}.${dto.reason ? ` ${dto.reason}` : ""}`,
            metadata: { from: route.status, to: dto.status, reason: dto.reason },
          },
        });
      }
      if (route.vehicleId) {
        const vehicleStatus = terminalRouteStatuses.includes(dto.status)
          ? VehicleStatus.AVAILABLE
          : movingRouteStatuses.includes(dto.status)
            ? VehicleStatus.IN_TRANSIT
            : VehicleStatus.ASSIGNED;
        await tx.vehicle.update({ where: { id: route.vehicleId }, data: { status: vehicleStatus } });
      }
      return result;
    });
    if (dto.status === RouteStatus.READY) await this.eventBus?.emit("route.ready", { entityId: id, actorId, code: route.code });
    if (dto.status === RouteStatus.DISPATCHED) {
      await this.eventBus?.emit("route.dispatched", { entityId: id, actorId, code: route.code, dispatchedAt: now.toISOString() });
    }
    if (dto.status === RouteStatus.IN_PROGRESS) {
      await this.eventBus?.emit("route.started", { entityId: id, actorId, code: route.code, departedAt: now.toISOString() });
    }
    if (dto.status === RouteStatus.COMPLETED) {
      await this.eventBus?.emit("route.completed", { entityId: id, actorId, code: route.code, arrivedAt: now.toISOString() });
    }
    if (dto.status === RouteStatus.CANCELLED) {
      await this.eventBus?.emit("route.cancelled", { entityId: id, actorId, code: route.code, reason: dto.reason! });
    }
    return { ...updated, availableActions: this.availableRouteActions(updated.status) };
  }

  async stopAction(routeId: string, stopId: string, dto: StopActionDto, actorId?: string) {
    const route = await this.findOne(routeId);
    if (terminalRouteStatuses.includes(route.status)) throw new ConflictException("A rota já foi encerrada.");
    const stop = route.stops.find((item) => item.id === stopId);
    if (!stop) throw new NotFoundException("Parada não encontrada.");
    if (exceptionStopStatuses.includes(dto.status) && !dto.reason) {
      throw new BadRequestException("Informe o motivo da exceção.");
    }
    const allowed: Record<RouteStopStatus, RouteStopStatus[]> = {
      PENDING: [RouteStopStatus.ARRIVED, RouteStopStatus.FAILED, RouteStopStatus.SKIPPED],
      ARRIVED: [RouteStopStatus.COMPLETED, RouteStopStatus.FAILED],
      COMPLETED: [],
      FAILED: [],
      SKIPPED: [],
    };
    if (!allowed[stop.status].includes(dto.status)) throw new ConflictException("Transição da parada inválida.");
    const now = new Date();
    const eventType: Record<RouteStopStatus, LogisticsEventType> = {
      PENDING: LogisticsEventType.NOTE_ADDED,
      ARRIVED: LogisticsEventType.STOP_ARRIVED,
      COMPLETED: LogisticsEventType.STOP_COMPLETED,
      FAILED: LogisticsEventType.STOP_FAILED,
      SKIPPED: LogisticsEventType.STOP_SKIPPED,
    };
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.routeStop.update({
        where: { id: stopId },
        data: { status: dto.status, actualAt: now, notes: dto.notes ?? dto.reason ?? stop.notes },
      });
      await tx.routeHistoryEvent.create({
        data: {
          routeId,
          type: eventType[dto.status],
          message: `Parada ${stop.order}: ${dto.status}.${dto.reason ? ` ${dto.reason}` : ""}`,
          actorId,
          metadata: { stopId, from: stop.status, to: dto.status, reason: dto.reason },
        },
      });
      if (exceptionStopStatuses.includes(dto.status)) {
        await tx.routeException.create({
          data: { routeId, stopId, reason: RouteExceptionReason.OTHER, notes: dto.reason, actorId },
        });
      }
      return result;
    });
    const eventPayload = { entityId: stopId, actorId, routeId, pollingPlaceId: stop.pollingPlaceId ?? "" };
    if (dto.status === RouteStopStatus.ARRIVED) await this.eventBus?.emit("route.stop_arrived", eventPayload);
    if (dto.status === RouteStopStatus.COMPLETED) await this.eventBus?.emit("route.stop_completed", eventPayload);
    if (dto.status === RouteStopStatus.FAILED) await this.eventBus?.emit("route.stop_failed", { ...eventPayload, reason: dto.reason! });
    if (dto.status === RouteStopStatus.SKIPPED) await this.eventBus?.emit("route.stop_skipped", { ...eventPayload, reason: dto.reason! });
    return updated;
  }

  async reorderStops(routeId: string, dto: ReorderStopsDto, actorId?: string) {
    const route = await this.findOne(routeId);
    if (!editableRouteStatuses.includes(route.status)) throw new ConflictException("Paradas só podem ser reordenadas durante o planejamento.");
    const currentIds = route.stops.map((stop) => stop.id).sort();
    if (dto.stopIds.length !== currentIds.length || [...dto.stopIds].sort().some((id, index) => id !== currentIds[index])) {
      throw new BadRequestException("A nova ordem deve conter todas as paradas da rota uma única vez.");
    }
    await this.prisma.$transaction(async (tx) => {
      for (let index = 0; index < dto.stopIds.length; index += 1) {
        await tx.routeStop.update({ where: { id: dto.stopIds[index] }, data: { order: -(index + 1) } });
      }
      for (let index = 0; index < dto.stopIds.length; index += 1) {
        await tx.routeStop.update({ where: { id: dto.stopIds[index] }, data: { order: index + 1 } });
      }
      await tx.routeHistoryEvent.create({
        data: {
          routeId,
          type: LogisticsEventType.STOPS_REORDERED,
          message: `Paradas da rota ${route.code} reordenadas.`,
          actorId,
          metadata: { stopIds: dto.stopIds },
        },
      });
    });
    await this.eventBus?.emit("route.stops_reordered", { entityId: routeId, actorId, code: route.code, stopIds: dto.stopIds });
    return this.findOne(routeId);
  }

  listVehicles() {
    return this.prisma.vehicle.findMany({ orderBy: { identification: "asc" } });
  }

  async createVehicle(dto: CreateVehicleDto) {
    try {
      return await this.prisma.vehicle.create({ data: { ...dto, plate: dto.plate.toUpperCase() } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Identificação ou placa já cadastrada.");
      }
      throw error;
    }
  }

  async createBatch(dto: CreateBatchDto) {
    const route = await this.findOne(dto.routeId);
    if (!editableRouteStatuses.includes(route.status)) throw new ConflictException("A carga da rota já foi fechada.");
    try {
      return await this.prisma.deliveryBatch.create({ data: { ...dto, code: dto.code.toUpperCase() } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Código de lote já cadastrado.");
      }
      throw error;
    }
  }

  private async validateDeliveryAssets(dto: CreateDeliveryDto) {
    const assetIds = dto.items.map((item) => item.assetId).filter((id): id is string => Boolean(id));
    if (!assetIds.length) return;
    if (new Set(assetIds).size !== assetIds.length) throw new ConflictException("O mesmo ativo não pode ser repetido na entrega.");
    const assets = await this.prisma.asset.findMany({
      where: { id: { in: assetIds } },
      include: {
        maintenances: { where: { status: { in: [AssetMaintenanceStatus.OPEN, AssetMaintenanceStatus.IN_PROGRESS] } } },
        assignments: { where: { kind: AssetAssignmentKind.CUSTODY, endedAt: null } },
      },
    });
    if (assets.length !== assetIds.length) throw new NotFoundException("Um ou mais ativos da carga não foram encontrados.");
    const blocked = assets.find(
      (asset) =>
        unavailableAssetStatuses.includes(asset.status) ||
        unavailableAssetConditions.includes(asset.condition) ||
        asset.maintenances.length > 0 ||
        asset.assignments.length > 0,
    );
    if (blocked) throw new ConflictException(`O ativo ${blocked.assetTag} não está disponível para a rota.`);
    const duplicate = await this.prisma.deliveryItem.findFirst({
      where: {
        assetId: { in: assetIds },
        delivery: { routeId: { not: dto.routeId }, route: { status: { notIn: terminalRouteStatuses } } },
      },
      include: { asset: true },
    });
    if (duplicate) throw new ConflictException(`O ativo ${duplicate.asset?.assetTag ?? duplicate.assetId} já pertence a outra rota ativa.`);
  }

  async createDelivery(dto: CreateDeliveryDto) {
    const [route, place, batch] = await Promise.all([
      this.prisma.distributionRoute.findUnique({ where: { id: dto.routeId } }),
      this.prisma.pollingPlace.findUnique({ where: { id: dto.pollingPlaceId } }),
      dto.batchId ? this.prisma.deliveryBatch.findUnique({ where: { id: dto.batchId } }) : null,
    ]);
    if (!route) throw new NotFoundException("Rota não encontrada.");
    if (!editableRouteStatuses.includes(route.status)) throw new ConflictException("A carga da rota já foi fechada.");
    if (!place || place.electoralZoneId !== route.electoralZoneId) {
      throw new BadRequestException("O local da entrega não pertence à zona da rota.");
    }
    if (dto.batchId && (!batch || batch.routeId !== route.id)) throw new BadRequestException("O lote não pertence à rota.");
    if (!dto.items.length) throw new BadRequestException("A entrega deve possuir ao menos um item.");
    await this.validateDeliveryAssets(dto);
    const currentLoad = await this.prisma.deliveryItem.aggregate({
      where: { delivery: { routeId: dto.routeId } },
      _sum: { quantity: true },
    });
    if (route.vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({ where: { id: route.vehicleId } });
      const incoming = dto.items.reduce((sum, item) => sum + item.quantity, 0);
      if (vehicle?.capacity != null && (currentLoad._sum.quantity ?? 0) + incoming > vehicle.capacity) {
        throw new ConflictException("A carga excede a capacidade cadastrada do veículo.");
      }
    }
    return this.prisma.delivery.create({
      data: {
        routeId: dto.routeId,
        batchId: dto.batchId,
        pollingPlaceId: dto.pollingPlaceId,
        receiverName: dto.receiverName,
        notes: dto.notes,
        items: { create: dto.items },
      },
      include: { items: true, pollingPlace: true },
    });
  }

  async updateDelivery(id: string, dto: UpdateDeliveryDto, actorId?: string) {
    const current = await this.prisma.delivery.findUnique({ where: { id }, include: { route: true } });
    if (!current) throw new NotFoundException("Entrega não encontrada.");
    if (terminalRouteStatuses.includes(current.route.status)) throw new ConflictException("A rota já foi encerrada.");
    if (dto.status === DeliveryStatus.FAILED && !dto.failureReason) throw new BadRequestException("Informe a justificativa da falha.");
    const deliveredAt = dto.status === DeliveryStatus.DELIVERED ? new Date() : undefined;
    const delivery = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.delivery.update({ where: { id }, data: { ...dto, deliveredAt, handledById: actorId } });
      if (dto.status === DeliveryStatus.DELIVERED) {
        await tx.routeHistoryEvent.create({
          data: {
            routeId: current.routeId,
            type: LogisticsEventType.DELIVERY_COMPLETED,
            message: `Entrega ${id} concluída.`,
            actorId,
            metadata: { deliveryId: id, receiverName: dto.receiverName, proofUrl: dto.proofUrl },
          },
        });
      }
      if (dto.status === DeliveryStatus.FAILED) {
        await tx.routeHistoryEvent.create({
          data: {
            routeId: current.routeId,
            type: LogisticsEventType.DELIVERY_FAILED,
            message: `Entrega ${id} falhou: ${dto.failureReason}.`,
            actorId,
            metadata: { deliveryId: id },
          },
        });
        await tx.routeException.create({
          data: {
            routeId: current.routeId,
            deliveryId: id,
            reason: RouteExceptionReason.OTHER,
            notes: dto.failureReason,
            actorId,
          },
        });
      }
      return updated;
    });
    if (dto.status === DeliveryStatus.DELIVERED) {
      await this.eventBus?.emit("delivery.completed", {
        entityId: id,
        actorId,
        routeId: current.routeId,
        pollingPlaceId: current.pollingPlaceId,
      });
    }
    if (dto.status === DeliveryStatus.FAILED) {
      await this.eventBus?.emit("delivery.failed", {
        entityId: id,
        actorId,
        routeId: current.routeId,
        pollingPlaceId: current.pollingPlaceId,
        reason: dto.failureReason!,
      });
    }
    return delivery;
  }

  async createException(routeId: string, dto: CreateRouteExceptionDto, actorId?: string) {
    const route = await this.findOne(routeId);
    if (terminalRouteStatuses.includes(route.status)) throw new ConflictException("A rota já foi encerrada.");
    if (dto.stopId && !route.stops.some((stop) => stop.id === dto.stopId)) throw new BadRequestException("Parada não pertence à rota.");
    if (dto.deliveryId && !route.deliveries.some((delivery) => delivery.id === dto.deliveryId)) {
      throw new BadRequestException("Entrega não pertence à rota.");
    }
    const exception = await this.prisma.$transaction(async (tx) => {
      const created = await tx.routeException.create({ data: { routeId, ...dto, actorId } });
      await tx.routeHistoryEvent.create({
        data: {
          routeId,
          type: LogisticsEventType.EXCEPTION_CREATED,
          message: `Exceção registrada: ${dto.reason}.${dto.notes ? ` ${dto.notes}` : ""}`,
          actorId,
          metadata: { exceptionId: created.id, reason: dto.reason, stopId: dto.stopId, deliveryId: dto.deliveryId },
        },
      });
      return created;
    });
    await this.eventBus?.emit("route.exception_created", {
      entityId: exception.id,
      actorId,
      routeId,
      reason: exception.reason,
      description: exception.notes ?? exception.reason,
    });
    return exception;
  }

  async resolveException(routeId: string, exceptionId: string, dto: ResolveRouteExceptionDto, actorId?: string) {
    const exception = await this.prisma.routeException.findFirst({ where: { id: exceptionId, routeId } });
    if (!exception) throw new NotFoundException("Exceção não encontrada.");
    if (exception.resolvedAt) throw new ConflictException("A exceção já foi resolvida.");
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.routeException.update({
        where: { id: exceptionId },
        data: { resolvedAt: new Date(), resolvedById: actorId, resolution: dto.resolution },
      });
      await tx.routeHistoryEvent.create({
        data: {
          routeId,
          type: LogisticsEventType.EXCEPTION_RESOLVED,
          message: `Exceção resolvida: ${dto.resolution}`,
          actorId,
          metadata: { exceptionId },
        },
      });
      return result;
    });
    await this.eventBus?.emit("route.exception_resolved", {
      entityId: exceptionId,
      actorId,
      routeId,
      resolution: dto.resolution,
    });
    return updated;
  }
}
