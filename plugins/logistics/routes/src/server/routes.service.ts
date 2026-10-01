import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DeliveryStatus, LogisticsEventType, Prisma, RouteStatus, RouteStopStatus, VehicleStatus } from "@prisma/client";
import { PrismaService } from "../../../../../packages/database/src";
import { EventBus } from "../../../../../packages/event-bus/src";
import { CreateBatchDto, CreateDeliveryDto, CreateRouteDto, CreateVehicleDto, RouteQueryDto, UpdateDeliveryDto, UpdateRouteDto, UpdateStopDto } from "./dto/routes.dto";

const routeInclude = {
  election: { select: { id: true, name: true, year: true } },
  electoralZone: { select: { id: true, number: true, name: true, municipality: true } },
  vehicle: true,
  stops: { include: { pollingPlace: { select: { id: true, name: true, address: true } } }, orderBy: { order: "asc" as const } },
  deliveries: { include: { pollingPlace: { select: { id: true, name: true } }, items: { include: { asset: { select: { id: true, assetTag: true, name: true } } } } }, orderBy: { createdAt: "desc" as const } },
  batches: { include: { deliveries: { select: { id: true, status: true, pollingPlaceId: true, items: { select: { quantity: true } } } } }, orderBy: { code: "asc" as const } },
  history: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.DistributionRouteInclude;

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService, private readonly eventBus?: EventBus) {}

  async findAll(query: RouteQueryDto) {
    const where: Prisma.DistributionRouteWhereInput = {
      electionId: query.electionId,
      electoralZoneId: query.zoneId,
      status: query.status,
      responsibleName: query.responsible ? { contains: query.responsible, mode: "insensitive" } : undefined,
      plannedDeparture: query.from || query.to ? { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined } : undefined,
    };
    const items = await this.prisma.distributionRoute.findMany({ where, include: routeInclude, orderBy: { plannedDeparture: "asc" } });
    return items.map((route) => this.withOperationalMetrics(route));
  }

  async dashboard(query: RouteQueryDto) {
    const items = await this.findAll(query);
    const deliveries = items.flatMap((route) => route.deliveries);
    return {
      total: items.length,
      inProgress: items.filter((route) => route.status === RouteStatus.IN_PROGRESS || route.status === RouteStatus.DELAYED).length,
      delayed: items.filter((route) => route.delayMinutes > 0).length,
      completed: items.filter((route) => route.status === RouteStatus.COMPLETED).length,
      pendingDeliveries: deliveries.filter((delivery) => delivery.status === DeliveryStatus.PENDING || delivery.status === DeliveryStatus.IN_TRANSIT).length,
      failedDeliveries: deliveries.filter((delivery) => delivery.status === DeliveryStatus.FAILED).length,
    };
  }

  async findOne(id: string) {
    const route = await this.prisma.distributionRoute.findUnique({ where: { id }, include: routeInclude });
    if (!route) throw new NotFoundException("Rota não encontrada.");
    return this.withOperationalMetrics(route);
  }

  private withOperationalMetrics<T extends { plannedArrival: Date; actualArrival: Date | null; status: RouteStatus; stops: Array<{ eta: Date; actualAt: Date | null; status: RouteStopStatus }>; batches: Array<{ deliveries: Array<{ status: DeliveryStatus; pollingPlaceId: string; items: Array<{ quantity: number }> }> }> }>(route: T) {
    const now = new Date();
    const active = route.status !== RouteStatus.COMPLETED && route.status !== RouteStatus.CANCELLED;
    const routeReference = route.actualArrival ?? (active ? now : route.plannedArrival);
    const routeDelay = Math.max(0, Math.floor((routeReference.getTime() - route.plannedArrival.getTime()) / 60000));
    const stopDelays = route.stops.map((stop) => {
      const reference = stop.actualAt ?? (active && stop.status === RouteStopStatus.PENDING ? now : stop.eta);
      return Math.max(0, Math.floor((reference.getTime() - stop.eta.getTime()) / 60000));
    });
    return {
      ...route,
      delayMinutes: Math.max(routeDelay, ...stopDelays, 0),
      batches: route.batches.map((batch) => ({
        ...batch,
        itemCount: batch.deliveries.flatMap((delivery) => delivery.items).reduce((sum, item) => sum + item.quantity, 0),
        placesCount: new Set(batch.deliveries.map((delivery) => delivery.pollingPlaceId)).size,
        pendingCount: batch.deliveries.filter((delivery) => delivery.status === DeliveryStatus.PENDING || delivery.status === DeliveryStatus.IN_TRANSIT).length,
        completedCount: batch.deliveries.filter((delivery) => delivery.status === DeliveryStatus.DELIVERED).length,
        failedCount: batch.deliveries.filter((delivery) => delivery.status === DeliveryStatus.FAILED).length,
      })),
    };
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
    const placeIds = [...new Set((dto.stops ?? []).map((stop) => stop.pollingPlaceId).filter((id): id is string => Boolean(id)))];
    if (placeIds.length) {
      const count = await this.prisma.pollingPlace.count({ where: { id: { in: placeIds }, electoralZoneId: zone.id } });
      if (count !== placeIds.length) throw new BadRequestException("Uma ou mais paradas não pertencem à zona da rota.");
    }
  }

  async create(dto: CreateRouteDto, actorId?: string) {
    if (new Date(dto.plannedArrival) <= new Date(dto.plannedDeparture)) throw new BadRequestException("A chegada planejada deve ocorrer após a saída.");
    await this.validateRouteReferences(dto);
    try {
      const route = await this.prisma.$transaction(async (tx) => {
        const created = await tx.distributionRoute.create({
          data: {
            code: dto.code.toUpperCase(), name: dto.name, electionId: dto.electionId, electoralZoneId: dto.electoralZoneId,
            description: dto.description, originName: dto.originName, originLatitude: dto.originLatitude, originLongitude: dto.originLongitude,
            destinationName: dto.destinationName, destinationLatitude: dto.destinationLatitude, destinationLongitude: dto.destinationLongitude,
            plannedDeparture: new Date(dto.plannedDeparture), plannedArrival: new Date(dto.plannedArrival), responsibleName: dto.responsibleName,
            driverName: dto.driverName, vehicleId: dto.vehicleId, notes: dto.notes, status: dto.status,
            stops: { create: (dto.stops ?? []).map((stop) => ({ ...stop, eta: new Date(stop.eta) })) },
          },
        });
        await tx.routeHistoryEvent.create({ data: { routeId: created.id, type: LogisticsEventType.ROUTE_CREATED, message: `Rota ${created.code} criada.`, actorId } });
        if (dto.vehicleId) await tx.vehicle.update({ where: { id: dto.vehicleId }, data: { status: VehicleStatus.ASSIGNED } });
        return created;
      });
      await this.eventBus?.emit("route.created", { entityId: route.id, actorId, code: route.code, name: route.name, electionId: route.electionId, electoralZoneId: route.electoralZoneId });
      return this.findOne(route.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Já existe uma rota com esse código ou ordem de parada repetida.");
      throw error;
    }
  }

  async update(id: string, dto: UpdateRouteDto, actorId?: string) {
    const current = await this.findOne(id);
    if (dto.plannedDeparture && dto.plannedArrival && new Date(dto.plannedArrival) <= new Date(dto.plannedDeparture)) throw new BadRequestException("A chegada planejada deve ocorrer após a saída.");
    const data: Prisma.DistributionRouteUpdateInput = {
      name: dto.name, description: dto.description, plannedDeparture: dto.plannedDeparture ? new Date(dto.plannedDeparture) : undefined,
      plannedArrival: dto.plannedArrival ? new Date(dto.plannedArrival) : undefined, responsibleName: dto.responsibleName,
      driverName: dto.driverName, vehicle: dto.vehicleId ? { connect: { id: dto.vehicleId } } : undefined, notes: dto.notes, status: dto.status,
      actualDeparture: dto.actualDeparture ? new Date(dto.actualDeparture) : undefined, actualArrival: dto.actualArrival ? new Date(dto.actualArrival) : undefined,
    };
    const updated = await this.prisma.$transaction(async (tx) => {
      const route = await tx.distributionRoute.update({ where: { id }, data });
      const event = this.routeStatusEvent(current.status, dto.status);
      if (event) await tx.routeHistoryEvent.create({ data: { routeId: id, type: event.type, message: event.message(route.code), actorId } });
      return route;
    });
    if (current.vehicleId && dto.vehicleId && current.vehicleId !== dto.vehicleId) await this.prisma.vehicle.update({ where: { id: current.vehicleId }, data: { status: VehicleStatus.AVAILABLE } });
    if (dto.vehicleId) await this.prisma.vehicle.update({ where: { id: dto.vehicleId }, data: { status: dto.status === RouteStatus.COMPLETED ? VehicleStatus.AVAILABLE : VehicleStatus.ASSIGNED } });
    if (current.status !== dto.status && dto.status === RouteStatus.IN_PROGRESS) await this.eventBus?.emit("route.started", { entityId: id, actorId, code: updated.code, departedAt: (updated.actualDeparture ?? new Date()).toISOString() });
    if (current.status !== dto.status && dto.status === RouteStatus.COMPLETED) await this.eventBus?.emit("route.completed", { entityId: id, actorId, code: updated.code, arrivedAt: (updated.actualArrival ?? new Date()).toISOString() });
    return this.findOne(id);
  }

  private routeStatusEvent(from: RouteStatus, to?: RouteStatus) {
    if (!to || from === to) return undefined;
    if (to === RouteStatus.IN_PROGRESS) return { type: LogisticsEventType.ROUTE_STARTED, message: (code: string) => `Rota ${code} iniciada.` };
    if (to === RouteStatus.COMPLETED) return { type: LogisticsEventType.ROUTE_ARRIVED, message: (code: string) => `Rota ${code} concluída.` };
    if (to === RouteStatus.CANCELLED) return { type: LogisticsEventType.ROUTE_CANCELLED, message: (code: string) => `Rota ${code} cancelada.` };
    if (to === RouteStatus.DELAYED) return { type: LogisticsEventType.DELAY_DETECTED, message: (code: string) => `Atraso registrado na rota ${code}.` };
    return undefined;
  }

  async updateStop(routeId: string, stopId: string, dto: UpdateStopDto, actorId?: string) {
    const stop = await this.prisma.routeStop.findFirst({ where: { id: stopId, routeId } });
    if (!stop) throw new NotFoundException("Parada não encontrada.");
    const actualAt = dto.actualAt ? new Date(dto.actualAt) : dto.status === RouteStopStatus.PENDING ? undefined : new Date();
    const updated = await this.prisma.routeStop.update({ where: { id: stopId }, data: { status: dto.status, actualAt, notes: dto.notes } });
    if (actualAt && actualAt > stop.eta) await this.prisma.routeHistoryEvent.create({ data: { routeId, type: LogisticsEventType.DELAY_DETECTED, message: `Parada ${stop.order} concluída com ${Math.floor((actualAt.getTime() - stop.eta.getTime()) / 60000)} min de atraso.`, actorId, metadata: { stopId } } });
    return updated;
  }

  listVehicles() { return this.prisma.vehicle.findMany({ orderBy: { identification: "asc" } }); }
  async createVehicle(dto: CreateVehicleDto) {
    try { return await this.prisma.vehicle.create({ data: { ...dto, plate: dto.plate.toUpperCase() } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Identificação ou placa já cadastrada."); throw error; }
  }

  async createBatch(dto: CreateBatchDto) {
    await this.findOne(dto.routeId);
    try { return await this.prisma.deliveryBatch.create({ data: { ...dto, code: dto.code.toUpperCase() } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Código de lote já cadastrado."); throw error; }
  }

  async createDelivery(dto: CreateDeliveryDto) {
    const [route, place, batch] = await Promise.all([
      this.prisma.distributionRoute.findUnique({ where: { id: dto.routeId } }),
      this.prisma.pollingPlace.findUnique({ where: { id: dto.pollingPlaceId } }),
      dto.batchId ? this.prisma.deliveryBatch.findUnique({ where: { id: dto.batchId } }) : null,
    ]);
    if (!route) throw new NotFoundException("Rota não encontrada.");
    if (!place || place.electoralZoneId !== route.electoralZoneId) throw new BadRequestException("O local da entrega não pertence à zona da rota.");
    if (dto.batchId && (!batch || batch.routeId !== route.id)) throw new BadRequestException("O lote não pertence à rota.");
    if (!dto.items.length) throw new BadRequestException("A entrega deve possuir ao menos um item.");
    return this.prisma.delivery.create({ data: { routeId: dto.routeId, batchId: dto.batchId, pollingPlaceId: dto.pollingPlaceId, receiverName: dto.receiverName, notes: dto.notes, items: { create: dto.items } }, include: { items: true, pollingPlace: true } });
  }

  async updateDelivery(id: string, dto: UpdateDeliveryDto, actorId?: string) {
    const current = await this.prisma.delivery.findUnique({ where: { id }, include: { route: true } });
    if (!current) throw new NotFoundException("Entrega não encontrada.");
    if (dto.status === DeliveryStatus.FAILED && !dto.failureReason) throw new BadRequestException("Informe a justificativa da falha.");
    const deliveredAt = dto.deliveredAt ? new Date(dto.deliveredAt) : dto.status === DeliveryStatus.DELIVERED ? new Date() : undefined;
    const delivery = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.delivery.update({ where: { id }, data: { ...dto, deliveredAt } });
      if (dto.status === DeliveryStatus.DELIVERED) await tx.routeHistoryEvent.create({ data: { routeId: current.routeId, type: LogisticsEventType.DELIVERY_COMPLETED, message: `Entrega ${id} concluída.`, actorId, metadata: { deliveryId: id } } });
      if (dto.status === DeliveryStatus.FAILED) await tx.routeHistoryEvent.create({ data: { routeId: current.routeId, type: LogisticsEventType.DELIVERY_FAILED, message: `Entrega ${id} falhou: ${dto.failureReason}.`, actorId, metadata: { deliveryId: id } } });
      return updated;
    });
    if (dto.status === DeliveryStatus.DELIVERED) await this.eventBus?.emit("delivery.completed", { entityId: id, actorId, routeId: current.routeId, pollingPlaceId: current.pollingPlaceId });
    if (dto.status === DeliveryStatus.FAILED) await this.eventBus?.emit("delivery.failed", { entityId: id, actorId, routeId: current.routeId, pollingPlaceId: current.pollingPlaceId, reason: dto.failureReason! });
    return delivery;
  }
}
