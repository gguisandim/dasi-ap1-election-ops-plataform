import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConnectivityStatus, Prisma, TransmissionAlertStatus, TransmissionAlertType, TransmissionAttemptResult, TransmissionEventType, TransmissionFailoverStatus, TransmissionStatus } from "@prisma/client";
import { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import { PERMISSIONS } from "@eops/security";
import {
  buildIntervals,
  connectivityDurations,
  deadlineRiskPercent,
  isCircuitActiveStatus,
  providerPerformance,
  recoverySeconds,
  summarizeIntervals,
  transitionDurationSeconds,
  uptimePercentFromDurations,
  type ConnectivityDurations,
  type ProviderPerformanceInput,
  type TimeWindow,
  type TransmissionInterval,
} from "@eops/shared/transmission";
import {
  AlertsQueryDto,
  BulkRetryDto,
  CancelFailoverDto,
  ConnectivityRecoveryDto,
  CorrelationQueryDto,
  CreateCircuitDto,
  CreateProviderDto,
  CreateTransmissionPointDto,
  ProvidersQueryDto,
  RecoverFailoverDto,
  RegisterAttemptDto,
  RetryPointDto,
  SlaQueryDto,
  StartFailoverDto,
  StateHistoryQueryDto,
  TransmissionQueryDto,
  UpdateAlertDto,
  UpdateCircuitDto,
  UpdateConnectivityDto,
  UpdateProviderDto,
  UpdateTransmissionPointDto,
} from "./dto/transmission.dto";

const providerSelect = { id: true, code: true, name: true, active: true } as const;
const circuitSelect = { id: true, code: true, name: true, technology: true, status: true, isPrimary: true, provider: { select: providerSelect } } as const;

const pointInclude = {
  election: { select: { id: true, name: true, year: true } },
  electoralZone: { select: { id: true, number: true, name: true, municipality: true } },
  pollingPlace: { select: { id: true, name: true, address: true, city: true } },
  attempts: { orderBy: { number: "desc" as const } },
  timeline: { orderBy: { createdAt: "desc" as const } },
  alerts: { orderBy: { createdAt: "desc" as const } },
  circuits: { include: { provider: { select: providerSelect } }, orderBy: [{ isPrimary: "desc" as const }, { createdAt: "asc" as const }] },
  failovers: { orderBy: { startedAt: "desc" as const }, take: 20, include: { toCircuit: { select: circuitSelect }, fromCircuit: { select: circuitSelect } } },
} satisfies Prisma.TransmissionPointInclude;

/** Janela padrao das visoes de SLA/analytics quando `from`/`to` nao sao informados. */
const DEFAULT_SLA_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Limite por secao da correlacao derivada (SPEC 3.6). */
const CORRELATION_SECTION_LIMIT = 20;

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
    const current = await this.requirePoint(id);
    const checkedAt = dto.checkedAt ? new Date(dto.checkedAt) : new Date();
    const changed = current.connectivity !== dto.connectivity;
    const { point, transition } = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.transmissionPoint.update({ where: { id }, data: { connectivity: dto.connectivity, latencyMs: dto.latencyMs, lastCheckedAt: checkedAt, lastActivity: checkedAt, connectionMethod: dto.connectionMethod, status: dto.connectivity === ConnectivityStatus.OFFLINE && current.status !== TransmissionStatus.SUCCESS ? TransmissionStatus.OFFLINE : undefined } });
      await tx.transmissionTimelineEvent.create({ data: { pointId: id, type: TransmissionEventType.CONNECTIVITY_CHANGED, message: `Conectividade alterada de ${current.connectivity} para ${dto.connectivity}.`, metadata: { connectivity: dto.connectivity, latencyMs: dto.latencyMs, method: dto.connectionMethod } } });
      const transition = changed ? await this.recordTransition(tx, { pointId: id, circuitId: null, from: current.connectivity, to: dto.connectivity, reason: dto.reason, actorId, occurredAt: checkedAt }) : null;
      return { point: updated, transition };
    });
    if (changed) {
      await this.eventBus?.emit("transmission.connectivity_changed", { entityId: id, actorId, identification: current.identification, from: current.connectivity, to: dto.connectivity });
      if (transition) await this.eventBus?.emit("transmission.state_transition", { entityId: transition.id, actorId, pointId: id, identification: current.identification, from: current.connectivity, to: dto.connectivity, reason: dto.reason });
    }
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

  // ---------------------------------------------------------------------------
  // Conectividade e historico de estado (SPEC 3.3)
  // ---------------------------------------------------------------------------

  /** Carrega o minimo do ponto ou lanca 404. */
  private async requirePoint(id: string) {
    const point = await this.prisma.transmissionPoint.findUnique({ where: { id }, select: { id: true, identification: true, electionId: true, electoralZoneId: true, pollingPlaceId: true, connectivity: true, status: true } });
    if (!point) throw new NotFoundException("Ponto de transmissão não encontrado.");
    return point;
  }

  /** Janela de SLA; `null`/ausente usa os ultimos 7 dias. Janela invalida -> 400. */
  private slaWindow(from?: string, to?: string): TimeWindow {
    const toMs = to ? new Date(to).getTime() : Date.now();
    const fromMs = from ? new Date(from).getTime() : toMs - DEFAULT_SLA_WINDOW_MS;
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs >= toMs) throw new BadRequestException("Janela de SLA inválida.");
    return { from: fromMs, to: toMs };
  }

  /**
   * Registra uma transicao de conectividade e fecha o intervalo anterior do
   * MESMO escopo: ponto quando `circuitId` e null, ponto+circuito caso contrario.
   * `durationSeconds` da transicao anterior e sempre calculado aqui e `from = to`
   * e rejeitado (409) — nao existe historico de nao-mudanca (SPEC 3.3).
   */
  private async recordTransition(
    client: Prisma.TransactionClient,
    input: { pointId: string; circuitId?: string | null; from: ConnectivityStatus; to: ConnectivityStatus; reason?: string; actorId?: string; occurredAt: Date },
  ) {
    if (input.from === input.to) throw new ConflictException(`Transição sem mudança de estado (${input.from}) não é registrada.`);
    const circuitId = input.circuitId ?? null;
    const previous = await client.transmissionStateTransition.findFirst({ where: { pointId: input.pointId, circuitId, occurredAt: { lt: input.occurredAt } }, orderBy: { occurredAt: "desc" }, select: { id: true, occurredAt: true } });
    if (previous) {
      const durationSeconds = transitionDurationSeconds(previous.occurredAt, input.occurredAt);
      if (durationSeconds !== null) await client.transmissionStateTransition.update({ where: { id: previous.id }, data: { durationSeconds } });
    }
    return client.transmissionStateTransition.create({ data: { pointId: input.pointId, circuitId, from: input.from, to: input.to, reason: input.reason, actorId: input.actorId, occurredAt: input.occurredAt } });
  }

  async stateHistory(id: string, query: StateHistoryQueryDto) {
    await this.requirePoint(id);
    return this.prisma.transmissionStateTransition.findMany({
      where: {
        pointId: id,
        ...(query.circuitId ? { circuitId: query.circuitId } : {}),
        ...(query.from || query.to ? { occurredAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } } : {}),
      },
      orderBy: { occurredAt: "desc" },
      take: query.limit ?? 100,
      include: { circuit: { select: { id: true, code: true, name: true } } },
    });
  }

  /** Recuperacao de conectividade: volta o ponto para ONLINE (ou o estado informado). */
  async recovery(id: string, dto: ConnectivityRecoveryDto, actorId: string) {
    const point = await this.requirePoint(id);
    const target = dto.connectivity ?? ConnectivityStatus.ONLINE;
    const now = new Date();
    const changed = point.connectivity !== target;
    const transition = await this.prisma.$transaction(async (tx) => {
      await tx.transmissionPoint.update({ where: { id }, data: { connectivity: target, latencyMs: dto.latencyMs, lastCheckedAt: now, lastActivity: now, connectionMethod: dto.connectionMethod } });
      if (!changed) return null;
      return this.recordTransition(tx, { pointId: id, circuitId: null, from: point.connectivity, to: target, reason: dto.reason ?? "Recuperação de conectividade", actorId, occurredAt: now });
    });
    if (changed) {
      await this.eventBus?.emit("transmission.connectivity_changed", { entityId: id, actorId, identification: point.identification, from: point.connectivity, to: target });
      if (transition) await this.eventBus?.emit("transmission.state_transition", { entityId: transition.id, actorId, pointId: id, identification: point.identification, from: point.connectivity, to: target, reason: dto.reason ?? "Recuperação de conectividade" });
    }
    await this.prisma.transmissionAlert.updateMany({ where: { pointId: id, type: TransmissionAlertType.POINT_OFFLINE, status: { not: TransmissionAlertStatus.RESOLVED } }, data: { status: TransmissionAlertStatus.RESOLVED, resolvedAt: now } });
    return this.findOne(id);
  }

  // ---------------------------------------------------------------------------
  // Provedores (SPEC 3.2 / 3.7)
  // ---------------------------------------------------------------------------

  async listProviders(query: ProvidersQueryDto = {}) {
    const providers = await this.prisma.transmissionProvider.findMany({ where: query.active === undefined ? {} : { active: query.active }, include: { _count: { select: { circuits: true } } }, orderBy: { name: "asc" } });
    return providers.map(({ _count, ...provider }) => ({ ...provider, circuitCount: _count.circuits }));
  }

  async createProvider(dto: CreateProviderDto, actorId: string) {
    try {
      const provider = await this.prisma.transmissionProvider.create({ data: { code: dto.code.toUpperCase(), name: dto.name, contact: dto.contact, slaTargetUptimePercent: dto.slaTargetUptimePercent, notes: dto.notes, active: dto.active ?? true } });
      await this.eventBus?.emit("transmission.provider_updated", { entityId: provider.id, actorId, code: provider.code, name: provider.name, active: provider.active });
      return provider;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Código de provedor já cadastrado.");
      throw error;
    }
  }

  async updateProvider(id: string, dto: UpdateProviderDto, actorId: string) {
    const existing = await this.prisma.transmissionProvider.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException("Provedor não encontrado.");
    const provider = await this.prisma.transmissionProvider.update({ where: { id }, data: { name: dto.name, contact: dto.contact, slaTargetUptimePercent: dto.slaTargetUptimePercent, notes: dto.notes, active: dto.active } });
    await this.eventBus?.emit("transmission.provider_updated", { entityId: provider.id, actorId, code: provider.code, name: provider.name, active: provider.active });
    return provider;
  }

  private async assertProvider(id: string) {
    const provider = await this.prisma.transmissionProvider.findUnique({ where: { id }, select: { id: true } });
    if (!provider) throw new BadRequestException("Provedor informado não existe.");
  }

  /** Regra: no maximo um circuito com isPrimary = true e status ativo por ponto. */
  private async assertNoActivePrimary(pointId: string, ignoreCircuitId?: string) {
    const existing = await this.prisma.transmissionCircuit.findFirst({
      where: { pointId, isPrimary: true, status: { in: [ConnectivityStatus.ONLINE, ConnectivityStatus.DEGRADED] }, ...(ignoreCircuitId ? { id: { not: ignoreCircuitId } } : {}) },
      select: { id: true, code: true },
    });
    if (existing) throw new ConflictException(`O ponto já possui um circuito primário ativo (${existing.code}).`);
  }

  // ---------------------------------------------------------------------------
  // Circuitos (SPEC 3.2 / 3.7)
  // ---------------------------------------------------------------------------

  async listCircuits(pointId: string) {
    await this.requirePoint(pointId);
    return this.prisma.transmissionCircuit.findMany({ where: { pointId }, include: { provider: { select: providerSelect } }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] });
  }

  async createCircuit(pointId: string, dto: CreateCircuitDto, actorId: string) {
    const point = await this.requirePoint(pointId);
    const status = dto.status ?? ConnectivityStatus.UNKNOWN;
    const isPrimary = dto.isPrimary ?? true;
    if (isPrimary && isCircuitActiveStatus(status)) await this.assertNoActivePrimary(pointId);
    if (dto.providerId) await this.assertProvider(dto.providerId);
    try {
      const circuit = await this.prisma.transmissionCircuit.create({ data: { pointId, providerId: dto.providerId, code: dto.code.toUpperCase(), name: dto.name, technology: dto.technology, bandwidthMbps: dto.bandwidthMbps, isPrimary, status, notes: dto.notes }, include: { provider: { select: providerSelect } } });
      await this.eventBus?.emit("transmission.circuit_created", { entityId: circuit.id, actorId, pointId, identification: point.identification, code: circuit.code, isPrimary: circuit.isPrimary });
      return circuit;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Código de circuito já cadastrado.");
      throw error;
    }
  }

  async updateCircuit(circuitId: string, dto: UpdateCircuitDto, actorId: string) {
    const circuit = await this.prisma.transmissionCircuit.findUnique({ where: { id: circuitId }, include: { point: { select: { id: true, identification: true, connectivity: true } } } });
    if (!circuit) throw new NotFoundException("Circuito não encontrado.");
    if (dto.status !== undefined && dto.status === circuit.status) throw new ConflictException(`Transição sem mudança de estado do circuito (${circuit.status}) não é registrada.`);
    const nextStatus = dto.status ?? circuit.status;
    const nextPrimary = dto.isPrimary ?? circuit.isPrimary;
    if (nextPrimary && isCircuitActiveStatus(nextStatus)) await this.assertNoActivePrimary(circuit.pointId, circuit.id);
    if (dto.providerId) await this.assertProvider(dto.providerId);
    const statusChanged = dto.status !== undefined;
    const now = new Date();
    const { circuit: updated, pointTransition } = await this.prisma.$transaction(async (tx) => {
      const result = await tx.transmissionCircuit.update({ where: { id: circuitId }, data: { name: dto.name, technology: dto.technology, bandwidthMbps: dto.bandwidthMbps, isPrimary: dto.isPrimary, status: dto.status, providerId: dto.providerId, notes: dto.notes, deactivatedAt: statusChanged ? (nextStatus === ConnectivityStatus.OFFLINE ? now : null) : undefined } });
      let pointTransition = null;
      if (statusChanged) {
        await this.recordTransition(tx, { pointId: circuit.pointId, circuitId, from: circuit.status, to: nextStatus, reason: "Mudança de status do circuito", actorId, occurredAt: now });
        if (nextPrimary && circuit.point.connectivity !== nextStatus) {
          await tx.transmissionPoint.update({ where: { id: circuit.pointId }, data: { connectivity: nextStatus, lastCheckedAt: now } });
          pointTransition = await this.recordTransition(tx, { pointId: circuit.pointId, circuitId: null, from: circuit.point.connectivity, to: nextStatus, reason: "Circuito primário atualizado", actorId, occurredAt: now });
        }
      }
      return { circuit: result, pointTransition };
    });
    if (statusChanged) {
      await this.eventBus?.emit("transmission.circuit_status_changed", { entityId: circuitId, actorId, pointId: circuit.pointId, code: circuit.code, from: circuit.status, to: nextStatus });
      if (pointTransition) await this.eventBus?.emit("transmission.state_transition", { entityId: pointTransition.id, actorId, pointId: circuit.pointId, identification: circuit.point.identification, from: circuit.point.connectivity, to: nextStatus, circuitId, reason: "Circuito primário atualizado" });
    }
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Failover (SPEC 3.4 / 3.7)
  // ---------------------------------------------------------------------------

  async listFailovers(pointId: string) {
    await this.requirePoint(pointId);
    return this.prisma.transmissionFailover.findMany({ where: { pointId }, include: { toCircuit: { select: circuitSelect }, fromCircuit: { select: circuitSelect } }, orderBy: { startedAt: "desc" }, take: 100 });
  }

  async startFailover(pointId: string, dto: StartFailoverDto, actorId: string) {
    const point = await this.requirePoint(pointId);
    const toCircuit = await this.prisma.transmissionCircuit.findUnique({ where: { id: dto.toCircuitId }, select: { id: true, pointId: true, code: true, status: true } });
    if (!toCircuit || toCircuit.pointId !== pointId) throw new BadRequestException("Circuito de destino inválido para o ponto.");
    if (!isCircuitActiveStatus(toCircuit.status)) throw new BadRequestException("O circuito de destino precisa estar ativo (ONLINE ou DEGRADED).");
    const fromCircuit = dto.fromCircuitId
      ? await this.prisma.transmissionCircuit.findUnique({ where: { id: dto.fromCircuitId }, select: { id: true, pointId: true, status: true } })
      : await this.prisma.transmissionCircuit.findFirst({ where: { pointId, isPrimary: true, status: { in: [ConnectivityStatus.ONLINE, ConnectivityStatus.DEGRADED] } }, orderBy: { activatedAt: "desc" }, select: { id: true, pointId: true, status: true } });
    if (fromCircuit && fromCircuit.pointId !== pointId) throw new BadRequestException("Circuito de origem inválido para o ponto.");
    if (fromCircuit && fromCircuit.id === toCircuit.id) throw new BadRequestException("O circuito de destino deve ser diferente da origem.");
    const active = await this.prisma.transmissionFailover.findFirst({ where: { pointId, status: TransmissionFailoverStatus.ACTIVE }, select: { id: true } });
    if (active) throw new ConflictException("Já existe um failover ativo para este ponto.");
    const now = new Date();
    const { failover, transition } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transmissionFailover.create({ data: { pointId, fromCircuitId: fromCircuit?.id ?? null, toCircuitId: toCircuit.id, reason: dto.reason, status: TransmissionFailoverStatus.ACTIVE, startedAt: now, notes: dto.notes } });
      let transition = null;
      if (point.connectivity !== toCircuit.status) {
        await tx.transmissionPoint.update({ where: { id: pointId }, data: { connectivity: toCircuit.status, lastCheckedAt: now } });
        transition = await this.recordTransition(tx, { pointId, circuitId: null, from: point.connectivity, to: toCircuit.status, reason: `Failover: ${dto.reason}`, actorId, occurredAt: now });
      }
      return { failover: created, transition };
    });
    await this.eventBus?.emit("transmission.failover_started", { entityId: failover.id, actorId, pointId, identification: point.identification, toCircuitCode: toCircuit.code, reason: dto.reason });
    if (transition) await this.eventBus?.emit("transmission.state_transition", { entityId: transition.id, actorId, pointId, identification: point.identification, from: point.connectivity, to: toCircuit.status, reason: `Failover: ${dto.reason}` });
    return failover;
  }

  async recoverFailover(pointId: string, failoverId: string, dto: RecoverFailoverDto, actorId: string) {
    const failover = await this.prisma.transmissionFailover.findUnique({ where: { id: failoverId }, include: { fromCircuit: { select: { id: true, status: true } }, toCircuit: { select: { id: true, status: true } } } });
    if (!failover || failover.pointId !== pointId) throw new NotFoundException("Failover não encontrado para o ponto.");
    if (failover.status !== TransmissionFailoverStatus.ACTIVE) throw new ConflictException("Somente failover ativo pode ser recuperado.");
    const point = await this.requirePoint(pointId);
    const target = dto.connectivity ?? failover.fromCircuit?.status ?? ConnectivityStatus.ONLINE;
    const now = new Date();
    const transition = await this.prisma.$transaction(async (tx) => {
      await tx.transmissionFailover.update({ where: { id: failoverId }, data: { status: TransmissionFailoverStatus.RECOVERED, recoveredAt: now, recoveredById: actorId, notes: dto.notes ?? failover.notes } });
      let created = null;
      if (point.connectivity !== target) {
        await tx.transmissionPoint.update({ where: { id: pointId }, data: { connectivity: target, lastCheckedAt: now } });
        created = await this.recordTransition(tx, { pointId, circuitId: null, from: point.connectivity, to: target, reason: "Recuperação de failover", actorId, occurredAt: now });
      }
      await tx.transmissionCircuit.update({ where: { id: failover.toCircuitId }, data: { deactivatedAt: now } });
      return created;
    });
    await this.eventBus?.emit("transmission.failover_recovered", { entityId: failoverId, actorId, pointId, identification: point.identification });
    if (transition) await this.eventBus?.emit("transmission.state_transition", { entityId: transition.id, actorId, pointId, identification: point.identification, from: point.connectivity, to: target, reason: "Recuperação de failover" });
    return this.prisma.transmissionFailover.findUnique({ where: { id: failoverId } });
  }

  async cancelFailover(pointId: string, failoverId: string, dto: CancelFailoverDto) {
    const failover = await this.prisma.transmissionFailover.findUnique({ where: { id: failoverId }, select: { id: true, pointId: true, status: true } });
    if (!failover || failover.pointId !== pointId) throw new NotFoundException("Failover não encontrado para o ponto.");
    if (failover.status !== TransmissionFailoverStatus.ACTIVE) throw new ConflictException("Somente failover ativo pode ser cancelado.");
    return this.prisma.transmissionFailover.update({ where: { id: failoverId }, data: { status: TransmissionFailoverStatus.CANCELLED, cancelledAt: new Date(), notes: dto.reason } });
  }

  // ---------------------------------------------------------------------------
  // SLA e analytics (SPEC 3.5)
  // ---------------------------------------------------------------------------

  /**
   * Reconstroi, no escopo, os intervalos de conectividade do PONTO (circuitId null)
   * e agrega duracoes. Trechos sem leitura contam como UNKNOWN (nunca uptime).
   */
  private async computeScopeSla(query: SlaQueryDto, window: TimeWindow) {
    const points = await this.prisma.transmissionPoint.findMany({ where: this.where(query), select: { id: true, identification: true, status: true, operationalDeadline: true, electoralZoneId: true, pollingPlaceId: true, electoralZone: { select: { id: true, number: true, name: true } }, pollingPlace: { select: { id: true, name: true } } } });
    const ids = points.map((point) => point.id);
    const transitions = ids.length
      ? await this.prisma.transmissionStateTransition.findMany({ where: { pointId: { in: ids }, circuitId: null, occurredAt: { lte: new Date(window.to) } }, orderBy: { occurredAt: "asc" }, select: { pointId: true, to: true, occurredAt: true } })
      : [];
    const byPoint = new Map<string, { to: ConnectivityStatus; occurredAt: Date }[]>();
    for (const transition of transitions) {
      const list = byPoint.get(transition.pointId) ?? [];
      list.push({ to: transition.to, occurredAt: transition.occurredAt });
      byPoint.set(transition.pointId, list);
    }
    const durations: ConnectivityDurations = { windowMs: 0, onlineMs: 0, degradedMs: 0, offlineMs: 0, unknownMs: 0 };
    const recoverySamples: number[] = [];
    const intervalsByPoint = new Map<string, TransmissionInterval[]>();
    for (const point of points) {
      const intervals = buildIntervals(byPoint.get(point.id) ?? [], window.to);
      intervalsByPoint.set(point.id, intervals);
      const value = connectivityDurations(intervals, window);
      durations.windowMs += value.windowMs; durations.onlineMs += value.onlineMs; durations.degradedMs += value.degradedMs; durations.offlineMs += value.offlineMs; durations.unknownMs += value.unknownMs;
      const sample = recoverySeconds(intervals);
      if (sample !== null) recoverySamples.push(sample);
    }
    return { points, durations, recoverySamples, intervalsByPoint };
  }

  async pointSla(id: string, query: SlaQueryDto) {
    const point = await this.requirePoint(id);
    const window = this.slaWindow(query.from, query.to);
    const transitions = await this.prisma.transmissionStateTransition.findMany({ where: { pointId: id, circuitId: null, occurredAt: { lte: new Date(window.to) } }, orderBy: { occurredAt: "asc" }, select: { to: true, occurredAt: true } });
    const intervals = buildIntervals(transitions, window.to);
    return { pointId: point.id, identification: point.identification, window: this.windowResponse(window), ...summarizeIntervals(intervals, window), recoverySeconds: recoverySeconds(intervals), transitions: transitions.length };
  }

  async slaOverview(query: SlaQueryDto) {
    const window = this.slaWindow(query.from, query.to);
    const { points, durations, recoverySamples, intervalsByPoint } = await this.computeScopeSla(query, window);
    const observedMs = Math.max(0, durations.windowMs - durations.unknownMs);
    return {
      window: this.windowResponse(window),
      pointCount: points.length,
      observedPointCount: [...intervalsByPoint.values()].filter((intervals) => intervals.length > 0).length,
      uptimePercent: uptimePercentFromDurations(durations),
      observedMinutes: minutes(observedMs),
      onlineMinutes: minutes(durations.onlineMs),
      degradedMinutes: minutes(durations.degradedMs),
      downtimeMinutes: minutes(durations.offlineMs),
      unknownMinutes: minutes(durations.unknownMs),
      recoverySeconds: recoverySamples.length ? Math.round(recoverySamples.reduce((sum, value) => sum + value, 0) / recoverySamples.length) : null,
      deadlineRiskPercent: deadlineRiskPercent(points, new Date()),
    };
  }

  async analytics(query: SlaQueryDto) {
    const window = this.slaWindow(query.from, query.to);
    const now = new Date();
    const { points, durations, recoverySamples, intervalsByPoint } = await this.computeScopeSla(query, window);
    const ids = points.map((point) => point.id);
    const empty = {
      window: this.windowResponse(window),
      pointCount: points.length,
      uptimePercent: uptimePercentFromDurations(durations),
      observedMinutes: minutes(Math.max(0, durations.windowMs - durations.unknownMs)),
      downtimeMinutes: minutes(durations.offlineMs),
      degradedMinutes: minutes(durations.degradedMs),
      unknownMinutes: minutes(durations.unknownMs),
      recoverySeconds: recoverySamples.length ? Math.round(recoverySamples.reduce((sum, value) => sum + value, 0) / recoverySamples.length) : null,
      mttrSeconds: null as number | null,
      deadlineRiskPercent: deadlineRiskPercent(points, now),
      byZone: [] as unknown[],
      byProvider: [] as unknown[],
      topOffenders: [] as unknown[],
    };
    if (ids.length === 0) return empty;

    const [circuitTransitions, circuits, failovers, alerts] = await Promise.all([
      this.prisma.transmissionStateTransition.findMany({ where: { pointId: { in: ids }, circuitId: { not: null }, occurredAt: { lte: new Date(window.to) } }, orderBy: { occurredAt: "asc" }, select: { circuitId: true, to: true, occurredAt: true } }),
      this.prisma.transmissionCircuit.findMany({ where: { pointId: { in: ids } }, select: { id: true, pointId: true, provider: { select: { id: true, code: true, name: true, slaTargetUptimePercent: true } } } }),
      this.prisma.transmissionFailover.findMany({ where: { pointId: { in: ids }, startedAt: { gte: new Date(window.from), lte: new Date(window.to) } }, select: { id: true, toCircuitId: true, fromCircuitId: true, status: true, startedAt: true, recoveredAt: true } }),
      this.prisma.transmissionAlert.findMany({ where: { pointId: { in: ids }, status: { not: TransmissionAlertStatus.RESOLVED } }, select: { pointId: true } }),
    ]);

    // Uptime por zona (soma ponderada por tempo observado dos pontos da zona).
    type ZoneAgg = { zoneId: string; number: number; name: string; pointCount: number; durations: ConnectivityDurations };
    const zoneMap = new Map<string, ZoneAgg>();
    for (const point of points) {
      const aggregated = connectivityDurations(intervalsByPoint.get(point.id) ?? [], window);
      const zone = zoneMap.get(point.electoralZoneId) ?? { zoneId: point.electoralZone.id, number: point.electoralZone.number, name: point.electoralZone.name, pointCount: 0, durations: { windowMs: 0, onlineMs: 0, degradedMs: 0, offlineMs: 0, unknownMs: 0 } };
      zone.pointCount += 1;
      zone.durations.windowMs += aggregated.windowMs; zone.durations.onlineMs += aggregated.onlineMs; zone.durations.degradedMs += aggregated.degradedMs; zone.durations.offlineMs += aggregated.offlineMs; zone.durations.unknownMs += aggregated.unknownMs;
      zoneMap.set(point.electoralZoneId, zone);
    }
    const byZone = [...zoneMap.values()].sort((left, right) => left.number - right.number).map((zone) => {
      const zonePoints = points.filter((point) => point.electoralZoneId === zone.zoneId);
      return {
        zoneId: zone.zoneId,
        number: zone.number,
        name: zone.name,
        pointCount: zone.pointCount,
        uptimePercent: uptimePercentFromDurations(zone.durations),
        downtimeMinutes: minutes(zone.durations.offlineMs),
        unknownMinutes: minutes(zone.durations.unknownMs),
        deadlineRiskPercent: deadlineRiskPercent(zonePoints, now),
      };
    });

    // MTTR: media (recoveredAt - startedAt) dos failovers recuperados na janela.
    const recovered = failovers.filter((failover) => failover.status === TransmissionFailoverStatus.RECOVERED && failover.recoveredAt !== null);
    const mttrSeconds = recovered.length ? Math.round(recovered.reduce((sum, failover) => sum + (failover.recoveredAt!.getTime() - failover.startedAt.getTime()) / 1000, 0) / recovered.length) : null;

    // Performance por provedor: intervalos do CIRCUITO e contadores escopados.
    const circuitIntervals = new Map<string, { to: ConnectivityStatus; occurredAt: Date }[]>();
    for (const transition of circuitTransitions) {
      if (!transition.circuitId) continue;
      const list = circuitIntervals.get(transition.circuitId) ?? [];
      list.push({ to: transition.to, occurredAt: transition.occurredAt });
      circuitIntervals.set(transition.circuitId, list);
    }
    const providerMeta = new Map<string, { id: string; code: string; name: string; slaTargetUptimePercent: number | null }>();
    const circuitIdsByProvider = new Map<string, string[]>();
    const pointsByProvider = new Map<string, Set<string>>();
    for (const circuit of circuits) {
      if (!circuit.provider) continue;
      const provider = circuit.provider;
      providerMeta.set(provider.id, { id: provider.id, code: provider.code, name: provider.name, slaTargetUptimePercent: provider.slaTargetUptimePercent === null ? null : Number(provider.slaTargetUptimePercent) });
      circuitIdsByProvider.set(provider.id, [...(circuitIdsByProvider.get(provider.id) ?? []), circuit.id]);
      pointsByProvider.set(provider.id, (pointsByProvider.get(provider.id) ?? new Set()).add(circuit.pointId));
    }
    const providerInputs: ProviderPerformanceInput[] = [...providerMeta.values()].map((provider) => {
      const ownedCircuits = new Set(circuitIdsByProvider.get(provider.id) ?? []);
      const ownedPoints = pointsByProvider.get(provider.id) ?? new Set<string>();
      return {
        providerId: provider.id,
        code: provider.code,
        name: provider.name,
        slaTargetUptimePercent: provider.slaTargetUptimePercent,
        circuits: (circuitIdsByProvider.get(provider.id) ?? []).map((circuitId) => ({ circuitId, intervals: buildIntervals(circuitIntervals.get(circuitId) ?? [], window.to) })),
        incidentCount: alerts.filter((alert) => ownedPoints.has(alert.pointId)).length,
        failoverCount: failovers.filter((failover) => ownedCircuits.has(failover.toCircuitId) || (failover.fromCircuitId !== null && ownedCircuits.has(failover.fromCircuitId))).length,
      };
    });
    const byProvider = providerPerformance(providerInputs, window);

    const topOffenders = points
      .map((point) => {
        const aggregated = connectivityDurations(intervalsByPoint.get(point.id) ?? [], window);
        const observedMs = Math.max(0, aggregated.windowMs - aggregated.unknownMs);
        return { pointId: point.id, identification: point.identification, zoneId: point.electoralZoneId, zoneNumber: point.electoralZone.number, pollingPlaceId: point.pollingPlaceId, pollingPlaceName: point.pollingPlace.name, offlineMinutes: minutes(aggregated.offlineMs), uptimePercent: observedMs > 0 ? Math.round((aggregated.onlineMs / observedMs) * 1000) / 10 : null };
      })
      .filter((entry) => entry.offlineMinutes > 0)
      .sort((left, right) => right.offlineMinutes - left.offlineMinutes)
      .slice(0, 5);

    return { ...empty, mttrSeconds, byZone, byProvider, topOffenders };
  }

  // ---------------------------------------------------------------------------
  // Correlacao derivada (SPEC 3.6) — somente leitura, nenhuma escrita cross-domain
  // ---------------------------------------------------------------------------

  async correlation(query: CorrelationQueryDto, permissions: readonly string[]) {
    const point = await this.prisma.transmissionPoint.findUnique({
      where: { id: query.pointId },
      select: { id: true, identification: true, electionId: true, electoralZoneId: true, pollingPlaceId: true, electoralZone: { select: { id: true, number: true, name: true } }, pollingPlace: { select: { id: true, name: true } } },
    });
    if (!point) throw new NotFoundException("Ponto de transmissão não encontrado.");
    const window = this.slaWindow(query.from, query.to);
    const electionId = query.electionId ?? point.electionId;
    const range = { gte: new Date(window.from), lte: new Date(window.to) };
    const can = (permission: string) => permissions.includes(permission);

    const incidentIds = await this.correlatedIncidentIds(point, electionId, range);
    const [incidents, resourceRequests, postmortems, handovers] = await Promise.all([
      can(PERMISSIONS.incidents.read) ? this.loadCorrelatedIncidents(point, electionId, range) : Promise.resolve(null),
      can(PERMISSIONS.resourceRequests.read) ? this.loadCorrelatedResourceRequests(point, electionId, range) : Promise.resolve(null),
      can(PERMISSIONS.postmortems.read) ? this.loadCorrelatedPostmortems(incidentIds) : Promise.resolve(null),
      can(PERMISSIONS.shiftHandovers.read) ? this.loadCorrelatedHandovers(point, range) : Promise.resolve(null),
    ]);

    return {
      point: { id: point.id, identification: point.identification, electionId: point.electionId, electoralZoneId: point.electoralZoneId, pollingPlaceId: point.pollingPlaceId, pollingPlaceName: point.pollingPlace.name, zoneNumber: point.electoralZone.number },
      window: this.windowResponse(window),
      incidents: incidents ? { available: true as const, total: incidents.total, items: incidents.items.map((incident) => ({ id: incident.id, code: incident.code, title: incident.title, severity: incident.severity, status: incident.status, occurredAt: incident.openedAt, resolvedAt: incident.resolvedAt, deepLink: `/incidents/${incident.id}` })) } : { available: false as const },
      resourceRequests: resourceRequests ? { available: true as const, total: resourceRequests.total, items: resourceRequests.items.map((request) => ({ id: request.id, code: request.code, title: request.title, status: request.status, priority: request.priority, occurredAt: request.createdAt, neededAt: request.neededAt, deepLink: `/resource-requests/${request.id}` })) } : { available: false as const },
      postmortems: postmortems ? { available: true as const, total: postmortems.total, items: postmortems.items.map((postmortem) => ({ id: postmortem.id, code: postmortem.code, title: postmortem.title, status: postmortem.status, publishedAt: postmortem.publishedAt, deepLink: `/postmortems/${postmortem.id}` })) } : { available: false as const },
      handovers: handovers ? { available: true as const, total: handovers.total, items: handovers.items.map((handover) => ({ id: handover.id, status: handover.status, occurredAt: handover.createdAt, submittedAt: handover.submittedAt, confirmedAt: handover.confirmedAt, shiftName: handover.shift.name, deepLink: `/shift-handovers/${handover.id}` })) } : { available: false as const },
      attentionItems: can(PERMISSIONS.commandCenter.read)
        ? { available: true as const, route: "/command-center", filters: { electionId: point.electionId, electoralZoneId: point.electoralZoneId, pollingPlaceId: point.pollingPlaceId } }
        : { available: false as const },
    };
  }

  private windowResponse(window: TimeWindow) {
    return { from: new Date(window.from).toISOString(), to: new Date(window.to).toISOString() };
  }

  private correlatedIncidentWhere(point: { electionId: string; electoralZoneId: string; pollingPlaceId: string }, electionId: string, range: { gte: Date; lte: Date }): Prisma.IncidentWhereInput {
    return { electionId, isSimulated: false, openedAt: range, OR: [{ pollingPlaceId: point.pollingPlaceId }, { electoralZoneId: point.electoralZoneId }] };
  }

  private async correlatedIncidentIds(point: { electionId: string; electoralZoneId: string; pollingPlaceId: string }, electionId: string, range: { gte: Date; lte: Date }) {
    const rows = await this.prisma.incident.findMany({ where: this.correlatedIncidentWhere(point, electionId, range), select: { id: true }, take: 500 });
    return rows.map((row) => row.id);
  }

  private async loadCorrelatedIncidents(point: { electionId: string; electoralZoneId: string; pollingPlaceId: string }, electionId: string, range: { gte: Date; lte: Date }) {
    const where = this.correlatedIncidentWhere(point, electionId, range);
    const [items, total] = await Promise.all([
      this.prisma.incident.findMany({ where, orderBy: { openedAt: "desc" }, take: CORRELATION_SECTION_LIMIT, select: { id: true, code: true, title: true, severity: true, status: true, openedAt: true, resolvedAt: true } }),
      this.prisma.incident.count({ where }),
    ]);
    return { items, total };
  }

  private async loadCorrelatedResourceRequests(point: { pollingPlaceId: string }, electionId: string, range: { gte: Date; lte: Date }) {
    const where: Prisma.ResourceRequestWhereInput = { electionId, pollingPlaceId: point.pollingPlaceId, createdAt: range };
    const [items, total] = await Promise.all([
      this.prisma.resourceRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: CORRELATION_SECTION_LIMIT, select: { id: true, code: true, title: true, status: true, priority: true, neededAt: true, createdAt: true } }),
      this.prisma.resourceRequest.count({ where }),
    ]);
    return { items, total };
  }

  private async loadCorrelatedPostmortems(incidentIds: string[]) {
    if (incidentIds.length === 0) return { items: [], total: 0 };
    const where: Prisma.PostmortemWhereInput = { OR: [{ primaryIncidentId: { in: incidentIds } }, { timeline: { some: { sourceType: "INCIDENT_EVENT", sourceId: { in: incidentIds } } } }] };
    const [items, total] = await Promise.all([
      this.prisma.postmortem.findMany({ where, orderBy: { createdAt: "desc" }, take: CORRELATION_SECTION_LIMIT, select: { id: true, code: true, title: true, status: true, publishedAt: true } }),
      this.prisma.postmortem.count({ where }),
    ]);
    return { items, total };
  }

  private async loadCorrelatedHandovers(point: { pollingPlaceId: string }, range: { gte: Date; lte: Date }) {
    const where: Prisma.ShiftHandoverWhereInput = { createdAt: range, shift: { pollingPlaceId: point.pollingPlaceId } };
    const [items, total] = await Promise.all([
      this.prisma.shiftHandover.findMany({ where, orderBy: { createdAt: "desc" }, take: CORRELATION_SECTION_LIMIT, select: { id: true, status: true, submittedAt: true, confirmedAt: true, createdAt: true, shift: { select: { id: true, name: true } } } }),
      this.prisma.shiftHandover.count({ where }),
    ]);
    return { items, total };
  }
}

function minutes(ms: number): number {
  return Math.round((ms / 60000) * 10) / 10;
}
