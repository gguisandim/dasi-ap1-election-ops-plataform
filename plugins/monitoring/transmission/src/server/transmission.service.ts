import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConnectivityStatus, Prisma, TransmissionAlertStatus, TransmissionAlertType, TransmissionAttemptResult, TransmissionEventType, TransmissionStatus } from "@prisma/client";
import { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import { AlertsQueryDto, BulkRetryDto, CreateTransmissionPointDto, RegisterAttemptDto, RetryPointDto, TransmissionQueryDto, UpdateAlertDto, UpdateConnectivityDto, UpdateTransmissionPointDto } from "./dto/transmission.dto";

const pointInclude = {
  election: { select: { id: true, name: true, year: true } },
  electoralZone: { select: { id: true, number: true, name: true, municipality: true } },
  pollingPlace: { select: { id: true, name: true, address: true, city: true } },
  attempts: { orderBy: { number: "desc" as const } },
  timeline: { orderBy: { createdAt: "desc" as const } },
  alerts: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.TransmissionPointInclude;

export type DeadlineState = "ON_TRACK" | "DUE_SOON" | "OVERDUE" | "COMPLETED";
/** Janela de "prazo próximo"; coincide com o critério do alerta DEADLINE_NEAR (1 hora). */
export const DUE_SOON_WINDOW_MS = 60 * 60 * 1000;
export const RETRY_ELIGIBLE_STATUSES: TransmissionStatus[] = [TransmissionStatus.FAILED, TransmissionStatus.OFFLINE, TransmissionStatus.RETRYING, TransmissionStatus.WAITING];

/** Estado de prazo derivado; nunca persistido. */
export function deriveDeadlineState(status: TransmissionStatus, operationalDeadline: Date | string | null | undefined, now: Date = new Date()): DeadlineState {
  if (status === TransmissionStatus.SUCCESS) return "COMPLETED";
  if (!operationalDeadline) return "ON_TRACK";
  const deadline = operationalDeadline instanceof Date ? operationalDeadline : new Date(operationalDeadline);
  if (now.getTime() > deadline.getTime()) return "OVERDUE";
  if (deadline.getTime() - now.getTime() <= DUE_SOON_WINDOW_MS) return "DUE_SOON";
  return "ON_TRACK";
}

/** Tentativas consecutivas não-SUCCESS a partir da mais recente. */
export function calculateFailureStreak(attempts: Array<{ result: TransmissionAttemptResult; number?: number }>): number {
  const ordered = attempts.some((attempt) => attempt.number != null)
    ? [...attempts].sort((left, right) => (right.number ?? 0) - (left.number ?? 0))
    : attempts;
  let streak = 0;
  for (const attempt of ordered) { if (attempt.result === TransmissionAttemptResult.SUCCESS) break; streak += 1; }
  return streak;
}

function parseConnectivityFromMessage(message: string): ConnectivityStatus | null {
  const match = message.match(/\b(ONLINE|DEGRADED|OFFLINE|UNKNOWN)\s*\.?$/);
  return match ? (match[1] as ConnectivityStatus) : null;
}

const rate = (part: number, total: number) => (total ? Math.round((part / total) * 1000) / 10 : 0);
const average = (values: number[]) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0);

@Injectable()
export class TransmissionService {
  constructor(private readonly prisma: PrismaService, private readonly eventBus?: EventBus) {}

  private where(query: TransmissionQueryDto): Prisma.TransmissionPointWhereInput {
    return { electionId: query.electionId, electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId, status: query.status };
  }

  findAll(query: TransmissionQueryDto) { return this.prisma.transmissionPoint.findMany({ where: this.where(query), include: pointInclude, orderBy: [{ priority: "asc" }, { queuedAt: "asc" }] }); }
  queue(query: TransmissionQueryDto) { return this.prisma.transmissionPoint.findMany({ where: { ...this.where(query), status: query.status ?? { in: [TransmissionStatus.WAITING, TransmissionStatus.QUEUED, TransmissionStatus.RETRYING, TransmissionStatus.TRANSMITTING] } }, include: pointInclude, orderBy: [{ priority: "asc" }, { queuedAt: "asc" }] }); }
  alerts(query: AlertsQueryDto) {
    const point: Prisma.TransmissionPointWhereInput = { electionId: query.electionId, electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId };
    const status: Prisma.TransmissionAlertWhereInput = query.status ? { status: query.status } : query.includeResolved ? {} : { status: { not: TransmissionAlertStatus.RESOLVED } };
    return this.prisma.transmissionAlert.findMany({ where: { ...status, point }, include: { point: { include: { electoralZone: true, pollingPlace: true } } }, orderBy: { createdAt: "desc" } });
  }

  private async counts(where: Prisma.TransmissionPointWhereInput) {
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const [points, attemptsToday] = await Promise.all([
      this.prisma.transmissionPoint.findMany({ where, select: { id: true, identification: true, status: true, connectivity: true, latencyMs: true, operationalDeadline: true, electoralZoneId: true, pollingPlaceId: true, electoralZone: { select: { id: true, number: true, name: true } }, pollingPlace: { select: { id: true, name: true } } } }),
      this.prisma.transmissionAttempt.count({ where: { point: where, startedAt: { gte: startOfToday } } }),
    ]);
    return { points, attemptsToday };
  }

  async dashboard(query: TransmissionQueryDto) {
    const { points, attemptsToday } = await this.counts(this.where(query));
    const zones = new Map<string, TransmissionStatus[]>();
    for (const point of points) zones.set(point.electoralZoneId, [...(zones.get(point.electoralZoneId) ?? []), point.status]);
    const completed = points.filter((point) => point.status === TransmissionStatus.SUCCESS).length;
    const failed = points.filter((point) => point.status === TransmissionStatus.FAILED || point.status === TransmissionStatus.OFFLINE).length;
    const deadlineRisk = points.filter((point) => { const state = deriveDeadlineState(point.status, point.operationalDeadline); return state === "DUE_SOON" || state === "OVERDUE"; }).length;
    return {
      totalExpected: points.length,
      completed,
      pending: points.filter((point) => point.status === TransmissionStatus.WAITING || point.status === TransmissionStatus.QUEUED || point.status === TransmissionStatus.RETRYING).length,
      failed,
      transmitting: points.filter((point) => point.status === TransmissionStatus.TRANSMITTING).length,
      completionPercentage: points.length ? Math.round((completed / points.length) * 1000) / 10 : 0,
      completeZones: [...zones.values()].filter((statuses) => statuses.length > 0 && statuses.every((status) => status === TransmissionStatus.SUCCESS)).length,
      zonesWithFailure: [...zones.values()].filter((statuses) => statuses.some((status) => status === TransmissionStatus.FAILED || status === TransmissionStatus.OFFLINE)).length,
      successRate: rate(completed, points.length),
      failureRate: rate(failed, points.length),
      deadlineRisk,
      offlineLocations: points.filter((point) => point.connectivity === ConnectivityStatus.OFFLINE).length,
      averageLatencyMs: average(points.map((point) => point.latencyMs).filter((value): value is number => value != null)),
      attemptsToday,
    };
  }

  async noc(query: TransmissionQueryDto, now: Date = new Date()) {
    const { points, attemptsToday } = await this.counts(this.where(query));
    const byStatus = Object.fromEntries(Object.values(TransmissionStatus).map((status) => [status, 0])) as Record<TransmissionStatus, number>;
    const byDeadlineState: Record<DeadlineState, number> = { ON_TRACK: 0, DUE_SOON: 0, OVERDUE: 0, COMPLETED: 0 };
    const states = new Map<string, DeadlineState>();
    for (const point of points) {
      byStatus[point.status] += 1;
      const state = deriveDeadlineState(point.status, point.operationalDeadline, now);
      states.set(point.id, state);
      byDeadlineState[state] += 1;
    }
    const success = points.filter((point) => point.status === TransmissionStatus.SUCCESS).length;
    const failed = points.filter((point) => point.status === TransmissionStatus.FAILED || point.status === TransmissionStatus.OFFLINE).length;
    const offline = points.filter((point) => point.connectivity === ConnectivityStatus.OFFLINE).length;

    type Agg = { id: string; number: number; name: string; total: number; success: number; failed: number; offline: number; deadlineRisk: number; latencies: number[] };
    const zoneMap = new Map<string, Agg>();
    const placeMap = new Map<string, { pollingPlaceId: string; name: string; zoneId: string; total: number; success: number; failed: number; offline: number; deadlineRisk: number }>();
    for (const point of points) {
      const state = states.get(point.id)!;
      const risky = state === "DUE_SOON" || state === "OVERDUE";
      const isSuccess = point.status === TransmissionStatus.SUCCESS;
      const isFailed = point.status === TransmissionStatus.FAILED || point.status === TransmissionStatus.OFFLINE;
      const isOffline = point.connectivity === ConnectivityStatus.OFFLINE;
      const zone = zoneMap.get(point.electoralZoneId) ?? { id: point.electoralZone.id, number: point.electoralZone.number, name: point.electoralZone.name, total: 0, success: 0, failed: 0, offline: 0, deadlineRisk: 0, latencies: [] };
      zone.total += 1; if (isSuccess) zone.success += 1; if (isFailed) zone.failed += 1; if (isOffline) zone.offline += 1; if (risky) zone.deadlineRisk += 1; if (point.latencyMs != null) zone.latencies.push(point.latencyMs);
      zoneMap.set(point.electoralZoneId, zone);
      const place = placeMap.get(point.pollingPlaceId) ?? { pollingPlaceId: point.pollingPlace.id, name: point.pollingPlace.name, zoneId: point.electoralZoneId, total: 0, success: 0, failed: 0, offline: 0, deadlineRisk: 0 };
      place.total += 1; if (isSuccess) place.success += 1; if (isFailed) place.failed += 1; if (isOffline) place.offline += 1; if (risky) place.deadlineRisk += 1;
      placeMap.set(point.pollingPlaceId, place);
    }

    const riskRank = (point: (typeof points)[number], state: DeadlineState) => state === "OVERDUE" ? 0 : state === "DUE_SOON" ? 1 : (point.status === TransmissionStatus.FAILED || point.status === TransmissionStatus.OFFLINE) ? 2 : point.connectivity === ConnectivityStatus.OFFLINE ? 3 : 4;
    const needsAttention = points
      .map((point) => ({ point, state: states.get(point.id)!, rank: riskRank(point, states.get(point.id)!) }))
      .filter((item) => item.rank < 4)
      .sort((left, right) => left.rank - right.rank || (left.point.operationalDeadline?.getTime() ?? Number.MAX_SAFE_INTEGER) - (right.point.operationalDeadline?.getTime() ?? Number.MAX_SAFE_INTEGER))
      .slice(0, 12)
      .map(({ point, state }) => ({ id: point.id, identification: point.identification, status: point.status, deadlineState: state, connectivity: point.connectivity, latencyMs: point.latencyMs, operationalDeadline: point.operationalDeadline, zoneId: point.electoralZoneId, zoneNumber: point.electoralZone.number, pollingPlaceId: point.pollingPlaceId, pollingPlaceName: point.pollingPlace.name }));

    return {
      totals: { total: points.length, success, queued: byStatus.WAITING + byStatus.QUEUED + byStatus.RETRYING, transmitting: byStatus.TRANSMITTING, failed, offline },
      rates: { successRate: rate(success, points.length), failureRate: rate(failed, points.length) },
      latency: { averageLatencyMs: average(points.map((point) => point.latencyMs).filter((value): value is number => value != null)) },
      volume: { attemptsToday },
      risk: { deadlineRisk: byDeadlineState.DUE_SOON + byDeadlineState.OVERDUE, overdue: byDeadlineState.OVERDUE, dueSoon: byDeadlineState.DUE_SOON },
      byStatus,
      byDeadlineState,
      byZone: [...zoneMap.values()].sort((left, right) => left.number - right.number).map((zone) => ({ zoneId: zone.id, number: zone.number, name: zone.name, total: zone.total, success: zone.success, failed: zone.failed, offline: zone.offline, deadlineRisk: zone.deadlineRisk, successRate: rate(zone.success, zone.total), averageLatencyMs: average(zone.latencies) })),
      byPlace: [...placeMap.values()].sort((left, right) => left.name.localeCompare(right.name)),
      needsAttention,
    };
  }

  async findOne(id: string) {
    const point = await this.prisma.transmissionPoint.findUnique({ where: { id }, include: pointInclude });
    if (!point) throw new NotFoundException("Ponto de transmissão não encontrado.");
    return point;
  }

  async connectivityHistory(id: string) {
    const point = await this.prisma.transmissionPoint.findUnique({ where: { id }, select: { id: true, connectivity: true, latencyMs: true, lastCheckedAt: true } });
    if (!point) throw new NotFoundException("Ponto de transmissão não encontrado.");
    const [events, attempts] = await Promise.all([
      this.prisma.transmissionTimelineEvent.findMany({ where: { pointId: id, type: TransmissionEventType.CONNECTIVITY_CHANGED }, orderBy: { createdAt: "asc" } }),
      this.prisma.transmissionAttempt.findMany({ where: { pointId: id }, orderBy: { number: "asc" }, select: { number: true, result: true, endedAt: true } }),
    ]);
    const entries = events.map((event) => {
      const metadata = (event.metadata ?? {}) as { connectivity?: ConnectivityStatus; latencyMs?: number | null };
      return { at: event.createdAt, connectivity: metadata.connectivity ?? parseConnectivityFromMessage(event.message) ?? point.connectivity, latencyMs: metadata.latencyMs ?? null };
    });
    const successes = attempts.filter((attempt) => attempt.result === TransmissionAttemptResult.SUCCESS);
    return {
      entries,
      current: { connectivity: point.connectivity, latencyMs: point.latencyMs },
      lastCheckedAt: point.lastCheckedAt ?? (entries.length ? entries[entries.length - 1].at : null),
      lastSuccessAt: successes.length ? successes[successes.length - 1].endedAt : null,
      failureStreak: calculateFailureStreak(attempts),
    };
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
      if (point.operationalDeadline && point.operationalDeadline.getTime() - Date.now() <= DUE_SOON_WINDOW_MS) await this.createAlert(point, TransmissionAlertType.DEADLINE_NEAR, "Transmissão pendente próxima do limite operacional.");
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
      await tx.transmissionTimelineEvent.create({ data: { pointId: id, type: TransmissionEventType.CONNECTIVITY_CHANGED, message: `Conectividade alterada de ${current.connectivity} para ${dto.connectivity}.`, metadata: { connectivity: dto.connectivity, latencyMs: dto.latencyMs, method: dto.connectionMethod } } });
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

  async updateAlert(id: string, dto: UpdateAlertDto, actorId?: string) {
    const alert = await this.prisma.transmissionAlert.findUnique({ where: { id }, include: { point: { select: { id: true, identification: true } } } });
    if (!alert) throw new NotFoundException("Alerta não encontrado.");
    const allowed: Record<TransmissionAlertStatus, TransmissionAlertStatus[]> = {
      [TransmissionAlertStatus.OPEN]: [TransmissionAlertStatus.ACKNOWLEDGED, TransmissionAlertStatus.RESOLVED],
      [TransmissionAlertStatus.ACKNOWLEDGED]: [TransmissionAlertStatus.RESOLVED],
      [TransmissionAlertStatus.RESOLVED]: [],
    };
    if (!allowed[alert.status].includes(dto.status)) throw new BadRequestException(`Transição de alerta inválida: ${alert.status} → ${dto.status}.`);
    const now = new Date();
    const acknowledging = dto.status === TransmissionAlertStatus.ACKNOWLEDGED;
    const resolving = dto.status === TransmissionAlertStatus.RESOLVED;
    const updated = await this.prisma.transmissionAlert.update({ where: { id }, data: {
      status: dto.status,
      notes: dto.notes ?? alert.notes,
      acknowledgedAt: acknowledging && !alert.acknowledgedAt ? now : undefined,
      acknowledgedById: acknowledging && !alert.acknowledgedById ? actorId : undefined,
      resolvedAt: resolving ? now : undefined,
      resolvedById: resolving ? actorId : undefined,
    } });
    if (acknowledging || resolving) {
      const payload = { entityId: alert.id, actorId, alertId: alert.id, pointId: alert.pointId, identification: alert.point.identification, alertType: alert.type };
      await this.eventBus?.emit(acknowledging ? "transmission.alert_acknowledged" : "transmission.alert_resolved", payload);
    }
    return updated;
  }

  private async applyRetry(ids: string[], reason?: string) {
    await this.prisma.$transaction(async (tx) => {
      for (const id of ids) {
        await tx.transmissionPoint.update({ where: { id }, data: { status: TransmissionStatus.QUEUED, lastError: null, queuedAt: new Date() } });
        await tx.transmissionTimelineEvent.create({ data: { pointId: id, type: TransmissionEventType.RETRY, message: reason ? `Retry operacional solicitado: ${reason}` : "Retry operacional solicitado.", metadata: { reason: reason ?? null } } });
      }
    });
  }

  async retry(id: string, dto: RetryPointDto, actorId?: string) {
    const point = await this.findOne(id);
    if (!RETRY_ELIGIBLE_STATUSES.includes(point.status)) throw new BadRequestException(`Ponto com status ${point.status} não é elegível para retry.`);
    await this.applyRetry([id], dto.reason);
    await this.eventBus?.emit("transmission.retry_requested", { entityId: id, actorId, pointIds: [id], count: 1, reason: dto.reason });
    return this.findOne(id);
  }

  async retryBulk(dto: BulkRetryDto, actorId?: string) {
    const ids = [...new Set(dto.ids)];
    const points = await this.prisma.transmissionPoint.findMany({ where: { id: { in: ids } }, select: { id: true, status: true } });
    const found = new Map(points.map((point) => [point.id, point.status]));
    for (const id of ids) {
      const status = found.get(id);
      if (!status) throw new NotFoundException(`Ponto de transmissão não encontrado: ${id}.`);
      if (!RETRY_ELIGIBLE_STATUSES.includes(status)) throw new BadRequestException(`Ponto ${id} com status ${status} não é elegível para retry.`);
    }
    await this.applyRetry(ids, dto.reason);
    await this.eventBus?.emit("transmission.retry_requested", { entityId: ids[0], actorId, pointIds: ids, count: ids.length, reason: dto.reason });
    return this.prisma.transmissionPoint.findMany({ where: { id: { in: ids } }, include: pointInclude, orderBy: [{ priority: "asc" }, { queuedAt: "asc" }] });
  }
}
