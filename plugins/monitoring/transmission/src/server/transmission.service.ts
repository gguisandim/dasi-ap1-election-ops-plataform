import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConnectivityStatus, Prisma, TransmissionAlertStatus, TransmissionAlertType, TransmissionAttemptResult, TransmissionEventType, TransmissionStatus } from "@prisma/client";
import { PrismaService } from "../../../../../packages/database/src";
import { EventBus } from "../../../../../packages/event-bus/src";
import { CreateTransmissionPointDto, RegisterAttemptDto, TransmissionQueryDto, UpdateAlertDto, UpdateConnectivityDto, UpdateTransmissionPointDto } from "./dto/transmission.dto";

const pointInclude = {
  election: { select: { id: true, name: true, year: true } },
  electoralZone: { select: { id: true, number: true, name: true, municipality: true } },
  pollingPlace: { select: { id: true, name: true, address: true, city: true } },
  attempts: { orderBy: { number: "desc" as const } },
  timeline: { orderBy: { createdAt: "desc" as const } },
  alerts: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.TransmissionPointInclude;

@Injectable()
export class TransmissionService {
  constructor(private readonly prisma: PrismaService, private readonly eventBus?: EventBus) {}

  private where(query: TransmissionQueryDto): Prisma.TransmissionPointWhereInput {
    return { electionId: query.electionId, electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId, status: query.status };
  }

  findAll(query: TransmissionQueryDto) { return this.prisma.transmissionPoint.findMany({ where: this.where(query), include: pointInclude, orderBy: [{ priority: "asc" }, { queuedAt: "asc" }] }); }
  queue(query: TransmissionQueryDto) { return this.prisma.transmissionPoint.findMany({ where: { ...this.where(query), status: query.status ?? { in: [TransmissionStatus.WAITING, TransmissionStatus.QUEUED, TransmissionStatus.RETRYING, TransmissionStatus.TRANSMITTING] } }, include: pointInclude, orderBy: [{ priority: "asc" }, { queuedAt: "asc" }] }); }
  alerts(query: TransmissionQueryDto) { return this.prisma.transmissionAlert.findMany({ where: { status: { not: TransmissionAlertStatus.RESOLVED }, point: this.where(query) }, include: { point: { include: { electoralZone: true, pollingPlace: true } } }, orderBy: { createdAt: "desc" } }); }

  async dashboard(query: TransmissionQueryDto) {
    const points = await this.prisma.transmissionPoint.findMany({ where: this.where(query), select: { status: true, electoralZoneId: true } });
    const zones = new Map<string, TransmissionStatus[]>();
    for (const point of points) zones.set(point.electoralZoneId, [...(zones.get(point.electoralZoneId) ?? []), point.status]);
    const completed = points.filter((point) => point.status === TransmissionStatus.SUCCESS).length;
    return {
      totalExpected: points.length,
      completed,
      pending: points.filter((point) => point.status === TransmissionStatus.WAITING || point.status === TransmissionStatus.QUEUED || point.status === TransmissionStatus.RETRYING).length,
      failed: points.filter((point) => point.status === TransmissionStatus.FAILED || point.status === TransmissionStatus.OFFLINE).length,
      transmitting: points.filter((point) => point.status === TransmissionStatus.TRANSMITTING).length,
      completionPercentage: points.length ? Math.round((completed / points.length) * 1000) / 10 : 0,
      completeZones: [...zones.values()].filter((statuses) => statuses.length > 0 && statuses.every((status) => status === TransmissionStatus.SUCCESS)).length,
      zonesWithFailure: [...zones.values()].filter((statuses) => statuses.some((status) => status === TransmissionStatus.FAILED || status === TransmissionStatus.OFFLINE)).length,
    };
  }

  async findOne(id: string) {
    const point = await this.prisma.transmissionPoint.findUnique({ where: { id }, include: pointInclude });
    if (!point) throw new NotFoundException("Ponto de transmissão não encontrado.");
    return point;
  }

  private async validateReferences(dto: CreateTransmissionPointDto) {
    const [election, zone, place] = await Promise.all([
      this.prisma.election.findUnique({ where: { id: dto.electionId } }),
      this.prisma.electoralZone.findUnique({ where: { id: dto.electoralZoneId } }),
      this.prisma.pollingPlace.findUnique({ where: { id: dto.pollingPlaceId } }),
    ]);
    if (!election) throw new NotFoundException("Pleito não encontrado.");
    if (!zone || zone.electionId !== election.id) throw new BadRequestException("Zona incompatível com o pleito.");
    if (!place || place.electoralZoneId !== zone.id) throw new BadRequestException("Local incompatível com a zona.");
  }

  async create(dto: CreateTransmissionPointDto) {
    await this.validateReferences(dto);
    try {
      const status = dto.queuedAt && !dto.status ? TransmissionStatus.QUEUED : dto.status;
      const point = await this.prisma.transmissionPoint.create({ data: { ...dto, identification: dto.identification.toUpperCase(), status, queuedAt: dto.queuedAt ? new Date(dto.queuedAt) : undefined, operationalDeadline: dto.operationalDeadline ? new Date(dto.operationalDeadline) : undefined, timeline: { create: { type: TransmissionEventType.QUEUED, message: "Ponto incluído na fila operacional." } } }, include: pointInclude });
      if (point.operationalDeadline && point.operationalDeadline.getTime() - Date.now() <= 60 * 60 * 1000) await this.createAlert(point, TransmissionAlertType.DEADLINE_NEAR, "Transmissão pendente próxima do limite operacional.");
      if (point.connectivity === ConnectivityStatus.OFFLINE) await this.createAlert(point, TransmissionAlertType.POINT_OFFLINE, "Ponto criado sem conectividade.");
      return this.findOne(point.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Identificação de ponto já cadastrada.");
      throw error;
    }
  }

  async update(id: string, dto: UpdateTransmissionPointDto) {
    await this.findOne(id);
    const point = await this.prisma.transmissionPoint.update({ where: { id }, data: { status: dto.status, observations: dto.observations, priority: dto.priority, queuedAt: dto.queuedAt ? new Date(dto.queuedAt) : undefined, operationalDeadline: dto.operationalDeadline ? new Date(dto.operationalDeadline) : undefined } });
    if (dto.status === TransmissionStatus.QUEUED) await this.prisma.transmissionTimelineEvent.create({ data: { pointId: id, type: TransmissionEventType.QUEUED, message: "Ponto reposicionado na fila operacional." } });
    return this.findOne(point.id);
  }

  async updateConnectivity(id: string, dto: UpdateConnectivityDto, actorId?: string) {
    const current = await this.findOne(id);
    const checkedAt = dto.checkedAt ? new Date(dto.checkedAt) : new Date();
    const point = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.transmissionPoint.update({ where: { id }, data: { connectivity: dto.connectivity, latencyMs: dto.latencyMs, lastCheckedAt: checkedAt, lastActivity: checkedAt, connectionMethod: dto.connectionMethod, status: dto.connectivity === ConnectivityStatus.OFFLINE && current.status !== TransmissionStatus.SUCCESS ? TransmissionStatus.OFFLINE : undefined } });
      await tx.transmissionTimelineEvent.create({ data: { pointId: id, type: TransmissionEventType.CONNECTIVITY_CHANGED, message: `Conectividade alterada de ${current.connectivity} para ${dto.connectivity}.`, metadata: { latencyMs: dto.latencyMs, method: dto.connectionMethod } } });
      return updated;
    });
    if (current.connectivity !== dto.connectivity) await this.eventBus?.emit("transmission.connectivity_changed", { entityId: id, actorId, identification: current.identification, from: current.connectivity, to: dto.connectivity });
    if (dto.connectivity === ConnectivityStatus.OFFLINE) await this.createAlert(point, TransmissionAlertType.POINT_OFFLINE, "Ponto de transmissão offline.", actorId);
    else await this.prisma.transmissionAlert.updateMany({ where: { pointId: id, type: TransmissionAlertType.POINT_OFFLINE, status: { not: TransmissionAlertStatus.RESOLVED } }, data: { status: TransmissionAlertStatus.RESOLVED, resolvedAt: checkedAt } });
    return this.findOne(id);
  }

  async registerAttempt(id: string, dto: RegisterAttemptDto, actorId?: string) {
    const point = await this.findOne(id);
    const startedAt = new Date(dto.startedAt); const endedAt = new Date(dto.endedAt);
    if (endedAt <= startedAt) throw new BadRequestException("O fim da tentativa deve ocorrer após o início.");
    if (dto.result !== TransmissionAttemptResult.SUCCESS && !dto.error) throw new BadRequestException("Informe o erro da tentativa.");
    const number = point.attemptCount + 1;
    const durationMs = endedAt.getTime() - startedAt.getTime();
    const success = dto.result === TransmissionAttemptResult.SUCCESS;
    const nextStatus = success ? TransmissionStatus.SUCCESS : number >= 3 ? TransmissionStatus.FAILED : TransmissionStatus.RETRYING;
    await this.prisma.$transaction(async (tx) => {
      await tx.transmissionAttempt.create({ data: { pointId: id, number, startedAt, endedAt, result: dto.result, durationMs, error: dto.error } });
      await tx.transmissionPoint.update({ where: { id }, data: { status: nextStatus, attemptCount: number, lastError: success ? null : dto.error, lastActivity: endedAt } });
      await tx.transmissionTimelineEvent.createMany({ data: [
        { pointId: id, type: number === 1 ? TransmissionEventType.STARTED : TransmissionEventType.RETRY, message: `Tentativa ${number} iniciada.` },
        { pointId: id, type: success ? TransmissionEventType.SUCCESS : TransmissionEventType.FAILED, message: success ? `Transmissão concluída na tentativa ${number}.` : `Tentativa ${number} falhou: ${dto.error}.` },
      ] });
    });
    if (success) {
      await this.prisma.transmissionAlert.updateMany({ where: { pointId: id, type: { in: [TransmissionAlertType.REPEATED_FAILURE, TransmissionAlertType.TOO_MANY_ATTEMPTS, TransmissionAlertType.TRANSMISSION_DELAYED, TransmissionAlertType.DEADLINE_NEAR] }, status: { not: TransmissionAlertStatus.RESOLVED } }, data: { status: TransmissionAlertStatus.RESOLVED, resolvedAt: endedAt } });
      await this.eventBus?.emit("transmission.completed", { entityId: id, actorId, identification: point.identification, electionId: point.electionId, electoralZoneId: point.electoralZoneId, attemptNumber: number });
    }
    else await this.eventBus?.emit("transmission.failed", { entityId: id, actorId, identification: point.identification, electionId: point.electionId, electoralZoneId: point.electoralZoneId, attemptNumber: number, error: dto.error! });
    if (!success && number >= 2) await this.createAlert(point, TransmissionAlertType.REPEATED_FAILURE, `${number} falhas consecutivas de transmissão.`, actorId);
    if (!success && number >= 3) await this.createAlert(point, TransmissionAlertType.TOO_MANY_ATTEMPTS, `Ponto atingiu ${number} tentativas.`, actorId);
    if (!success && point.operationalDeadline && endedAt > point.operationalDeadline) await this.createAlert(point, TransmissionAlertType.TRANSMISSION_DELAYED, "Transmissão ainda pendente após o limite operacional.", actorId);
    return this.findOne(id);
  }

  private async createAlert(point: { id: string; identification: string }, type: TransmissionAlertType, message: string, actorId?: string) {
    const existing = await this.prisma.transmissionAlert.findFirst({ where: { pointId: point.id, type, status: { not: TransmissionAlertStatus.RESOLVED } } });
    if (existing) return existing;
    const alert = await this.prisma.transmissionAlert.create({ data: { pointId: point.id, type, message } });
    await this.prisma.transmissionTimelineEvent.create({ data: { pointId: point.id, type: TransmissionEventType.ALERT_CREATED, message, metadata: { alertId: alert.id, alertType: type } } });
    await this.eventBus?.emit("transmission.alert_created", { entityId: alert.id, actorId, pointId: point.id, identification: point.identification, alertType: type, message });
    return alert;
  }

  async updateAlert(id: string, dto: UpdateAlertDto) {
    const alert = await this.prisma.transmissionAlert.findUnique({ where: { id } });
    if (!alert) throw new NotFoundException("Alerta não encontrado.");
    return this.prisma.transmissionAlert.update({ where: { id }, data: { status: dto.status, resolvedAt: dto.status === TransmissionAlertStatus.RESOLVED ? new Date() : null } });
  }
}
