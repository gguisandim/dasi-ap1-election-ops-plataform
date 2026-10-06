import { BadRequestException, Injectable } from "@nestjs/common";
import { AssetCondition, AssetStatus, IncidentSeverity, IncidentStatus, MonitoringStatus, RouteStatus, TaskStatus, TransmissionStatus } from "@prisma/client";
import PDFDocument from "pdfkit";
import { PrismaService } from "@eops/database";
import {
  REPORT_METRICS,
  assertReportGranularity,
  assertReportMetric,
  assertWindowWithinLimit,
  dispatchMeanMinutes,
  escalationRatePercent,
  fulfillmentMeanMinutes,
  meanResolutionMinutes,
  meanResponseMinutes,
  mttrMinutes,
  per1000Voters,
  perPlace,
  slaCompliancePercent,
  deadlineMisses,
  transmissionDowntimeMinutes,
  transmissionUptimePercent,
  type IncidentTimingRow,
  type ReportGranularity,
  type ReportMetric,
  type SeriesPoint,
  type TransmissionTransitionRow,
} from "@eops/shared/reports";
import { ReportQueryDto } from "./dto/report-query.dto";
import { IncidentsReportQueryDto } from "./dto/incidents-report-query.dto";
import {
  DrilldownQueryDto,
  ExportJsonQueryDto,
  SlaQueryDto,
  TimeseriesQueryDto,
  ZonesQueryDto,
} from "./dto/analytics.dto";
import {
  aggregateFor,
  drilldownFor,
  loadMetricRows,
  metricZoneOf,
  seriesFor,
  type ReportsScope,
} from "./reports-metrics";

const DAY_MS = 86_400_000;

function invalid(error: unknown): BadRequestException {
  return new BadRequestException(
    error instanceof Error ? error.message : "Parametros invalidos.",
  );
}

function inWindow(at: Date | null, from: Date, to: Date): boolean {
  return at !== null && at.getTime() >= from.getTime() && at.getTime() <= to.getTime();
}

/** Ranking de competição (1, 2, 2, 4) sobre valores decrescentes; null fica null. */
function competitionRanks(values: ReadonlyArray<number | null>): Array<number | null> {
  const distinct = [...new Set(values.filter((value): value is number => value !== null))].sort((a, b) => b - a);
  return values.map((value) => (value === null ? null : distinct.indexOf(value) + 1));
}

function countBy<T>(items: T[], key: (item: T) => string) {
  return Object.entries(items.reduce<Record<string, number>>((result, item) => { const value = key(item); result[value] = (result[value] ?? 0) + 1; return result; }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function rate(part: number, total: number) { return total ? Math.round((part / total) * 1000) / 10 : 0; }
function averageMinutes(items: number[]) { return items.length ? Math.round(items.reduce((sum, value) => sum + value, 0) / items.length) : 0; }
function average(items: number[]) { return items.length ? items.reduce((sum, value) => sum + value, 0) / items.length : 0; }

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private filters(query: ReportQueryDto) {
    const period = query.from || query.to ? { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined } : undefined;
    const incidentStatus = Object.values(IncidentStatus).includes(query.status as IncidentStatus) ? query.status as IncidentStatus : undefined;
    const assetStatus = Object.values(AssetStatus).includes(query.status as AssetStatus) ? query.status as AssetStatus : undefined;
    const routeStatus = Object.values(RouteStatus).includes(query.status as RouteStatus) ? query.status as RouteStatus : undefined;
    const transmissionStatus = Object.values(TransmissionStatus).includes(query.status as TransmissionStatus) ? query.status as TransmissionStatus : undefined;
    const taskStatus = Object.values(TaskStatus).includes(query.status as TaskStatus) ? query.status as TaskStatus : undefined;
    return { period, incidentStatus, assetStatus, routeStatus, transmissionStatus, taskStatus };
  }

  private readonly openIncidentStatuses = new Set<IncidentStatus>([IncidentStatus.NEW, IncidentStatus.TRIAGED, IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS]);

  /** Incidentes simulados ficam fora por padrão; isolamento explícito (I4). */
  private simulationFilter(query: { includeSimulated?: boolean }) {
    return query.includeSimulated ? {} : { isSimulated: false };
  }

  private previousWindow(query: ReportQueryDto) {
    if (!query.from || !query.to) return null;
    const from = new Date(query.from); const to = new Date(query.to); const duration = to.getTime() - from.getTime();
    if (!(duration > 0)) return null;
    return { gte: new Date(from.getTime() - duration), lt: from };
  }

  private async compare(query: ReportQueryDto, current: Record<string, number>, load: (window: { gte: Date; lt: Date }) => Promise<Record<string, number>>) {
    const window = this.previousWindow(query);
    if (!window) return { available: false, current, previous: null };
    return { available: true, current, previous: await load(window) };
  }

  private async geography(query: ReportQueryDto) {
    const [zones, places] = await Promise.all([
      this.prisma.electoralZone.findMany({ where: { id: query.zoneId, electionId: query.electionId }, select: { id: true, number: true, name: true }, orderBy: { number: "asc" } }),
      this.prisma.pollingPlace.findMany({ where: { id: query.pollingPlaceId, electoralZoneId: query.zoneId, electoralZone: { electionId: query.electionId } }, select: { id: true, name: true, electoralZoneId: true }, orderBy: { name: "asc" } }),
    ]);
    return { zones, places };
  }

  private envelope(query: ReportQueryDto, summary: unknown, breakdown: unknown, comparison: unknown) {
    return { generatedAt: new Date().toISOString(), period: { from: query.from ?? null, to: query.to ?? null }, filters: query, summary, breakdown, comparison };
  }

  async operations(query: ReportQueryDto) {
    const { period, incidentStatus, assetStatus, routeStatus, transmissionStatus, taskStatus } = this.filters(query);
    const { zones, places } = await this.geography(query);
    const scope = { electionId: query.electionId, electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId };
    const [incidents, transmissions, teams, tasks, assets, routes, allocations] = await Promise.all([
      this.prisma.incident.findMany({ where: { ...scope, ...this.simulationFilter(query), categoryId: query.categoryId, status: incidentStatus, openedAt: period }, select: { id: true, electoralZoneId: true, pollingPlaceId: true, status: true, severity: true } }),
      this.prisma.transmissionPoint.findMany({ where: { ...scope, status: transmissionStatus, lastActivity: period }, select: { id: true, electoralZoneId: true, pollingPlaceId: true, status: true } }),
      this.prisma.fieldTeam.findMany({ where: { electionId: query.electionId, status: "ACTIVE" }, select: { id: true } }),
      this.prisma.task.findMany({ where: { ...scope, status: taskStatus, createdAt: period }, select: { id: true, electoralZoneId: true, pollingPlaceId: true, status: true, dueAt: true } }),
      this.prisma.asset.findMany({ where: { electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId, status: assetStatus, electoralZone: query.electionId ? { electionId: query.electionId } : undefined }, select: { id: true, electoralZoneId: true, pollingPlaceId: true, status: true, condition: true } }),
      this.prisma.distributionRoute.findMany({ where: { electionId: query.electionId, electoralZoneId: query.zoneId, status: routeStatus, plannedDeparture: period }, select: { id: true, electoralZoneId: true, status: true, plannedArrival: true } }),
      this.prisma.fieldAllocation.findMany({ where: { ...scope, status: "ACTIVE" }, select: { id: true, teamId: true, electoralZoneId: true, pollingPlaceId: true } }),
    ]);
    const now = new Date();
    const success = transmissions.filter((point) => point.status === TransmissionStatus.SUCCESS).length;
    const availableAssets = assets.filter((asset) => asset.status === AssetStatus.AVAILABLE && asset.condition === AssetCondition.GOOD).length;
    const activeRoutes = routes.filter((route) => route.status === RouteStatus.IN_PROGRESS || route.status === RouteStatus.DELAYED).length;
    const delayedRoutes = routes.filter((route) => route.status === RouteStatus.DELAYED || (route.status !== RouteStatus.COMPLETED && route.status !== RouteStatus.CANCELLED && route.plannedArrival < now)).length;
    const summary = {
      incidents: incidents.length,
      openIncidents: incidents.filter((item) => this.openIncidentStatuses.has(item.status)).length,
      criticalIncidents: incidents.filter((item) => item.severity === IncidentSeverity.CRITICAL).length,
      transmissionPoints: transmissions.length,
      transmissionSuccessRate: rate(success, transmissions.length),
      activeTeams: teams.length,
      activeAllocations: allocations.length,
      tasks: tasks.length,
      tasksOverdue: tasks.filter((task) => task.status !== TaskStatus.DONE && task.status !== TaskStatus.CANCELLED && task.dueAt && task.dueAt < now).length,
      assets: assets.length,
      availableAssets,
      routes: routes.length,
      activeRoutes,
      delayedRoutes,
    };
    const byZone = zones.map((zone) => {
      const zoneIncidents = incidents.filter((item) => item.electoralZoneId === zone.id);
      const zoneTransmissions = transmissions.filter((item) => item.electoralZoneId === zone.id);
      return { id: zone.id, label: `Zona ${zone.number} · ${zone.name}`, incidents: zoneIncidents.length, openIncidents: zoneIncidents.filter((item) => this.openIncidentStatuses.has(item.status)).length, transmissionPoints: zoneTransmissions.length, transmissionSuccessRate: rate(zoneTransmissions.filter((item) => item.status === TransmissionStatus.SUCCESS).length, zoneTransmissions.length), activeTeams: new Set(allocations.filter((item) => item.electoralZoneId === zone.id).map((item) => item.teamId).filter(Boolean)).size, tasks: tasks.filter((item) => item.electoralZoneId === zone.id).length, assets: assets.filter((item) => item.electoralZoneId === zone.id).length, routes: routes.filter((item) => item.electoralZoneId === zone.id).length };
    });
    const byPlace = places.map((place) => ({ id: place.id, label: place.name, zoneId: place.electoralZoneId, incidents: incidents.filter((item) => item.pollingPlaceId === place.id).length, openIncidents: incidents.filter((item) => item.pollingPlaceId === place.id && this.openIncidentStatuses.has(item.status)).length, transmissionPoints: transmissions.filter((item) => item.pollingPlaceId === place.id).length, assets: assets.filter((item) => item.pollingPlaceId === place.id).length }));
    const comparison = await this.compare(query, { incidents: incidents.length, tasks: tasks.length, routes: routes.length }, async (window) => {
      const [previousIncidents, previousTasks, previousRoutes] = await Promise.all([
        this.prisma.incident.count({ where: { ...scope, ...this.simulationFilter(query), categoryId: query.categoryId, status: incidentStatus, openedAt: window } }),
        this.prisma.task.count({ where: { ...scope, status: taskStatus, createdAt: window } }),
        this.prisma.distributionRoute.count({ where: { electionId: query.electionId, electoralZoneId: query.zoneId, status: routeStatus, plannedDeparture: window } }),
      ]);
      return { incidents: previousIncidents, tasks: previousTasks, routes: previousRoutes };
    });
    return this.envelope(query, summary, { byZone, byPlace }, comparison);
  }

  async executive(query: ReportQueryDto) {
    const { period, incidentStatus, assetStatus, routeStatus, transmissionStatus } = this.filters(query);
    const placeWhere = { id: query.pollingPlaceId, electoralZoneId: query.zoneId, electoralZone: { electionId: query.electionId } };
    const incidentWhere = { electionId: query.electionId, electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId, ...this.simulationFilter(query), categoryId: query.categoryId, status: incidentStatus, openedAt: period };
    const assetWhere = { electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId, status: assetStatus, electoralZone: query.electionId ? { electionId: query.electionId } : undefined };
    const routeWhere = { electionId: query.electionId, electoralZoneId: query.zoneId, status: routeStatus, plannedDeparture: period };
    const transmissionWhere = { electionId: query.electionId, electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId, status: transmissionStatus, createdAt: period };
    const [elections, zones, places, incidents, assets, movements, routes, transmissions, fieldTeams, fieldAllocations] = await Promise.all([
      this.prisma.election.findMany({ where: { id: query.electionId }, select: { id: true, name: true, year: true } }),
      this.prisma.electoralZone.findMany({ where: { id: query.zoneId, electionId: query.electionId }, select: { id: true, number: true, name: true } }),
      this.prisma.pollingPlace.findMany({ where: placeWhere, select: { id: true, name: true, electoralZoneId: true, monitoringStatus: true } }),
      this.prisma.incident.findMany({ where: incidentWhere, select: { id: true, electoralZoneId: true, pollingPlaceId: true, severity: true, status: true, openedAt: true, resolvedAt: true, slaDeadline: true, category: { select: { name: true } } } }),
      this.prisma.asset.findMany({ where: assetWhere, select: { id: true, electoralZoneId: true, pollingPlaceId: true, status: true, condition: true, type: { select: { name: true } } } }),
      this.prisma.assetMovement.findMany({ where: { movedAt: period, asset: assetWhere }, select: { id: true, movedAt: true, destinationLabel: true } }),
      this.prisma.distributionRoute.findMany({ where: routeWhere, select: { id: true, electoralZoneId: true, status: true, plannedArrival: true, actualArrival: true, deliveries: { select: { status: true } } } }),
      this.prisma.transmissionPoint.findMany({ where: transmissionWhere, select: { id: true, electoralZoneId: true, pollingPlaceId: true, status: true, connectivity: true, lastActivity: true } }),
      this.prisma.fieldTeam.findMany({ where: { electionId: query.electionId, status: "ACTIVE" }, select: { id: true } }),
      this.prisma.fieldAllocation.findMany({ where: { electionId: query.electionId, electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId, status: "ACTIVE" }, select: { teamId: true, electoralZoneId: true, pollingPlaceId: true } }),
    ]);
    const openStatuses = new Set<IncidentStatus>([IncidentStatus.NEW, IncidentStatus.TRIAGED, IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS]);
    const resolved = incidents.filter((item) => item.resolvedAt);
    const averageResolutionMinutes = resolved.length ? Math.round(resolved.reduce((sum, item) => sum + (item.resolvedAt!.getTime() - item.openedAt.getTime()) / 60000, 0) / resolved.length) : 0;
    const slaEligible = resolved.filter((item) => item.slaDeadline);
    const slaPercentage = slaEligible.length ? Math.round((slaEligible.filter((item) => item.resolvedAt! <= item.slaDeadline!).length / slaEligible.length) * 1000) / 10 : 0;
    const now = new Date();
    const delayedRoutes = routes.filter((route) => route.status === RouteStatus.DELAYED || (route.status !== RouteStatus.COMPLETED && route.status !== RouteStatus.CANCELLED && route.plannedArrival < now));
    const transmissionCompleted = transmissions.filter((point) => point.status === TransmissionStatus.SUCCESS).length;
    const operationalPlaces = places.filter((place) => place.monitoringStatus !== MonitoringStatus.OFFLINE).length;
    const availableAssets = assets.filter((asset) => asset.status === AssetStatus.AVAILABLE && asset.condition === AssetCondition.GOOD).length;
    const byZone = zones.map((zone) => {
      const zonePlaces = places.filter((item) => item.electoralZoneId === zone.id);
      const zoneTransmissions = transmissions.filter((item) => item.electoralZoneId === zone.id);
      return { id: zone.id, label: `Zona ${zone.number} · ${zone.name}`, places: zonePlaces.length, criticalPlaces: zonePlaces.filter((item) => item.monitoringStatus === MonitoringStatus.CRITICAL || item.monitoringStatus === MonitoringStatus.OFFLINE).length, openIncidents: incidents.filter((item) => item.electoralZoneId === zone.id && openStatuses.has(item.status)).length, assets: assets.filter((item) => item.electoralZoneId === zone.id).length, routesInProgress: routes.filter((item) => item.electoralZoneId === zone.id && (item.status === RouteStatus.IN_PROGRESS || item.status === RouteStatus.DELAYED)).length, transmissionPercentage: zoneTransmissions.length ? Math.round(zoneTransmissions.filter((item) => item.status === TransmissionStatus.SUCCESS).length / zoneTransmissions.length * 1000) / 10 : 0, activeTeams: new Set(fieldAllocations.filter((item) => item.electoralZoneId === zone.id).map((item) => item.teamId).filter(Boolean)).size };
    });
    const byPlace = places.map((place) => { const localTransmissions = transmissions.filter((item) => item.pollingPlaceId === place.id); return { id: place.id, label: place.name, zoneId: place.electoralZoneId, monitoringStatus: place.monitoringStatus, openIncidents: incidents.filter((item) => item.pollingPlaceId === place.id && openStatuses.has(item.status)).length, assets: assets.filter((item) => item.pollingPlaceId === place.id).length, transmissionStatus: localTransmissions[0]?.status ?? null }; });
    const history = await this.history(query, incidents.length, transmissionCompleted);
    return {
      generatedAt: new Date().toISOString(), filters: query, elections,
      executive: { operationalPlaces, criticalPlaces: places.length - operationalPlaces, openIncidents: incidents.filter((item) => openStatuses.has(item.status)).length, slaPercentage, availableAssets, unavailableAssets: assets.length - availableAssets, transmissionPercentage: transmissions.length ? Math.round(transmissionCompleted / transmissions.length * 1000) / 10 : 0, routesInProgress: routes.filter((item) => item.status === RouteStatus.IN_PROGRESS || item.status === RouteStatus.DELAYED).length, delayedDeliveries: delayedRoutes.flatMap((route) => route.deliveries).filter((delivery) => delivery.status === "PENDING" || delivery.status === "IN_TRANSIT").length, activeTeams: fieldTeams.length, teamsAvailable: true },
      incidents: { total: incidents.length, open: incidents.filter((item) => openStatuses.has(item.status)).length, bySeverity: countBy(incidents, (item) => item.severity), byCategory: countBy(incidents, (item) => item.category.name), byStatus: countBy(incidents, (item) => item.status), averageResolutionMinutes, slaPercentage, timeline: countBy(incidents, (item) => item.openedAt.toISOString().slice(0, 10)).sort((a, b) => a.name.localeCompare(b.name)) },
      inventory: { total: assets.length, byStatus: countBy(assets, (item) => item.status), byCondition: countBy(assets, (item) => item.condition), byType: countBy(assets, (item) => item.type.name), byLocation: countBy(assets, (item) => item.pollingPlaceId ?? item.electoralZoneId ?? "Depósito"), movements: movements.length },
      availability: { operationalPlacesPercentage: places.length ? Math.round(operationalPlaces / places.length * 1000) / 10 : 0, availableAssetsPercentage: assets.length ? Math.round(availableAssets / assets.length * 1000) / 10 : 0, onlineTransmissionPoints: transmissions.filter((item) => item.connectivity === "ONLINE").length },
      transmission: { total: transmissions.length, completed: transmissionCompleted, byStatus: countBy(transmissions, (item) => item.status), byConnectivity: countBy(transmissions, (item) => item.connectivity) },
      logistics: { totalRoutes: routes.length, activeRoutes: routes.filter((item) => item.status === RouteStatus.IN_PROGRESS || item.status === RouteStatus.DELAYED).length, delayedRoutes: delayedRoutes.length },
      byZone, byPlace, history,
    };
  }

  private async history(query: ReportQueryDto, currentIncidents: number, currentTransmissions: number) {
    if (!query.from || !query.to) return { available: false, current: { incidents: currentIncidents, transmissions: currentTransmissions }, previous: null };
    const from = new Date(query.from); const to = new Date(query.to); const duration = to.getTime() - from.getTime();
    if (duration <= 0) return { available: false, current: { incidents: currentIncidents, transmissions: currentTransmissions }, previous: null };
    const previousFrom = new Date(from.getTime() - duration); const previousTo = from;
    const [incidents, transmissions] = await Promise.all([
      this.prisma.incident.count({ where: { electionId: query.electionId, electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId, ...this.simulationFilter(query), openedAt: { gte: previousFrom, lt: previousTo } } }),
      this.prisma.transmissionPoint.count({ where: { electionId: query.electionId, electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId, status: TransmissionStatus.SUCCESS, lastActivity: { gte: previousFrom, lt: previousTo } } }),
    ]);
    return { available: true, current: { incidents: currentIncidents, transmissions: currentTransmissions }, previous: { from: previousFrom.toISOString(), to: previousTo.toISOString(), incidents, transmissions } };
  }

  async incidents(query: IncidentsReportQueryDto) {
    const { period, incidentStatus } = this.filters(query);
    const severity = Object.values(IncidentSeverity).includes(query.severity as IncidentSeverity) ? query.severity as IncidentSeverity : undefined;
    const { zones, places } = await this.geography(query);
    const where = { electionId: query.electionId, electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId, ...this.simulationFilter(query), categoryId: query.categoryId, status: incidentStatus, severity, openedAt: period };
    const incidents = await this.prisma.incident.findMany({ where, select: { id: true, electoralZoneId: true, pollingPlaceId: true, severity: true, status: true, openedAt: true, resolvedAt: true, slaDeadline: true, category: { select: { name: true } } } });
    const resolved = incidents.filter((item) => item.resolvedAt);
    const eligible = resolved.filter((item) => item.slaDeadline);
    const averageResolutionMinutes = averageMinutes(resolved.map((item) => (item.resolvedAt!.getTime() - item.openedAt.getTime()) / 60000));
    const slaPercentage = eligible.length ? rate(eligible.filter((item) => item.resolvedAt! <= item.slaDeadline!).length, eligible.length) : 0;
    const zoneMetrics = (items: typeof incidents) => { const done = items.filter((item) => item.resolvedAt); const due = done.filter((item) => item.slaDeadline); return { total: items.length, open: items.filter((item) => this.openIncidentStatuses.has(item.status)).length, critical: items.filter((item) => item.severity === IncidentSeverity.CRITICAL).length, resolved: done.length, averageResolutionMinutes: averageMinutes(done.map((item) => (item.resolvedAt!.getTime() - item.openedAt.getTime()) / 60000)), slaPercentage: due.length ? rate(due.filter((item) => item.resolvedAt! <= item.slaDeadline!).length, due.length) : 0 }; };
    const summary = { total: incidents.length, open: incidents.filter((item) => this.openIncidentStatuses.has(item.status)).length, critical: incidents.filter((item) => item.severity === IncidentSeverity.CRITICAL).length, resolved: resolved.length, averageResolutionMinutes, slaPercentage };
    const byZone = zones.map((zone) => ({ id: zone.id, label: `Zona ${zone.number} · ${zone.name}`, ...zoneMetrics(incidents.filter((item) => item.electoralZoneId === zone.id)) }));
    const byPlace = places.map((place) => ({ id: place.id, label: place.name, zoneId: place.electoralZoneId, ...zoneMetrics(incidents.filter((item) => item.pollingPlaceId === place.id)) }));
    const breakdown = { byZone, byPlace, bySeverity: countBy(incidents, (item) => item.severity), byCategory: countBy(incidents, (item) => item.category.name), byStatus: countBy(incidents, (item) => item.status), trend: countBy(incidents, (item) => item.openedAt.toISOString().slice(0, 10)).sort((a, b) => a.name.localeCompare(b.name)) };
    const comparison = await this.compare(query, { total: incidents.length, resolved: resolved.length }, async (window) => {
      const [total, previousResolved] = await Promise.all([
        this.prisma.incident.count({ where: { ...where, openedAt: window } }),
        this.prisma.incident.count({ where: { electionId: query.electionId, electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId, ...this.simulationFilter(query), categoryId: query.categoryId, status: incidentStatus, severity, resolvedAt: window } }),
      ]);
      return { total, resolved: previousResolved };
    });
    return this.envelope(query, summary, breakdown, comparison);
  }

  async transmission(query: ReportQueryDto) {
    const { period, transmissionStatus } = this.filters(query);
    const { zones, places } = await this.geography(query);
    const scope = { electionId: query.electionId, electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId };
    const [points, attempts] = await Promise.all([
      this.prisma.transmissionPoint.findMany({ where: { ...scope, status: transmissionStatus, lastActivity: period }, select: { id: true, electoralZoneId: true, pollingPlaceId: true, status: true, connectivity: true, latencyMs: true, attemptCount: true, operationalDeadline: true, lastActivity: true } }),
      this.prisma.transmissionAttempt.findMany({ where: { point: { ...scope }, startedAt: period }, select: { result: true, durationMs: true, startedAt: true } }),
    ]);
    const now = new Date();
    const success = points.filter((point) => point.status === TransmissionStatus.SUCCESS).length;
    const failed = points.filter((point) => point.status === TransmissionStatus.FAILED || point.status === TransmissionStatus.OFFLINE).length;
    const offlinePoints = points.filter((point) => point.connectivity === "OFFLINE").length;
    const queued = points.filter((point) => point.status === TransmissionStatus.WAITING || point.status === TransmissionStatus.QUEUED || point.status === TransmissionStatus.RETRYING).length;
    const retryPoints = points.filter((point) => point.attemptCount > 1).length;
    const latencies = points.map((point) => point.latencyMs).filter((value): value is number => typeof value === "number");
    const deadlineViolations = points.filter((point) => point.operationalDeadline && ((point.status === TransmissionStatus.SUCCESS && point.lastActivity && point.lastActivity > point.operationalDeadline) || (point.status !== TransmissionStatus.SUCCESS && now > point.operationalDeadline))).length;
    const attemptsToday = attempts.filter((attempt) => attempt.startedAt.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)).length;
    const summary = { total: points.length, success, failed, offlinePoints, queued, successRate: rate(success, points.length), failureRate: rate(failed, points.length), averageLatencyMs: Math.round(latencies.length ? average(latencies) : average(attempts.map((attempt) => attempt.durationMs))), retryRate: rate(retryPoints, points.length), deadlineViolations, attemptsToday };
    const byZone = zones.map((zone) => { const items = points.filter((point) => point.electoralZoneId === zone.id); const ok = items.filter((point) => point.status === TransmissionStatus.SUCCESS).length; const zoneLatencies = items.map((point) => point.latencyMs).filter((value): value is number => typeof value === "number"); return { id: zone.id, label: `Zona ${zone.number} · ${zone.name}`, total: items.length, success: ok, failed: items.filter((point) => point.status === TransmissionStatus.FAILED || point.status === TransmissionStatus.OFFLINE).length, offline: items.filter((point) => point.connectivity === "OFFLINE").length, successRate: rate(ok, items.length), averageLatencyMs: Math.round(average(zoneLatencies)), deadlineViolations: items.filter((point) => point.operationalDeadline && point.status !== TransmissionStatus.SUCCESS && now > point.operationalDeadline).length }; });
    const byPlace = places.map((place) => { const items = points.filter((point) => point.pollingPlaceId === place.id); return { id: place.id, label: place.name, zoneId: place.electoralZoneId, total: items.length, success: items.filter((point) => point.status === TransmissionStatus.SUCCESS).length, failed: items.filter((point) => point.status === TransmissionStatus.FAILED || point.status === TransmissionStatus.OFFLINE).length, offline: items.filter((point) => point.connectivity === "OFFLINE").length, deadlineViolations: items.filter((point) => point.operationalDeadline && point.status !== TransmissionStatus.SUCCESS && now > point.operationalDeadline).length }; });
    const breakdown = { byZone, byPlace, byStatus: countBy(points, (point) => point.status), byConnectivity: countBy(points, (point) => point.connectivity) };
    const comparison = await this.compare(query, { total: points.length, success }, async (window) => {
      const [total, previousSuccess] = await Promise.all([
        this.prisma.transmissionPoint.count({ where: { ...scope, status: transmissionStatus, lastActivity: window } }),
        this.prisma.transmissionPoint.count({ where: { ...scope, status: TransmissionStatus.SUCCESS, lastActivity: window } }),
      ]);
      return { total, success: previousSuccess };
    });
    return this.envelope(query, summary, breakdown, comparison);
  }

  async workforce(query: ReportQueryDto) {
    const { period } = this.filters(query);
    const { zones, places } = await this.geography(query);
    const dispatchWhere = { electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId, requestedAt: period, ...(query.electionId ? { team: { electionId: query.electionId } } : {}) };
    const [teams, allocations, dispatches] = await Promise.all([
      this.prisma.fieldTeam.findMany({ where: { electionId: query.electionId }, select: { id: true, name: true, status: true } }),
      this.prisma.fieldAllocation.findMany({ where: { electionId: query.electionId, electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId, startsAt: period }, select: { id: true, teamId: true, electoralZoneId: true, pollingPlaceId: true, status: true } }),
      this.prisma.fieldDispatch.findMany({ where: dispatchWhere, select: { id: true, teamId: true, electoralZoneId: true, pollingPlaceId: true, status: true, requestedAt: true, dispatchedAt: true, acceptedAt: true, arrivedAt: true } }),
    ]);
    const activeTeams = teams.filter((team) => team.status === "ACTIVE").length;
    const activeAllocations = allocations.filter((allocation) => allocation.status === "ACTIVE").length;
    const responseTimes = dispatches.filter((dispatch) => dispatch.acceptedAt).map((dispatch) => (dispatch.acceptedAt!.getTime() - dispatch.requestedAt.getTime()) / 60000);
    const allocatedTeams = new Set(allocations.map((allocation) => allocation.teamId).filter(Boolean)).size;
    const coveredPlaces = new Set(allocations.filter((allocation) => allocation.pollingPlaceId).map((allocation) => allocation.pollingPlaceId)).size;
    const summary = { teams: teams.length, activeTeams, allocations: allocations.length, activeAllocations, coveredPlaces, coverageRate: rate(coveredPlaces, places.length), dispatches: dispatches.length, completedDispatches: dispatches.filter((dispatch) => dispatch.status === "COMPLETED").length, averageResponseMinutes: averageMinutes(responseTimes), utilizationRate: rate(allocatedTeams, teams.length), availabilityRate: rate(activeTeams, teams.length) };
    const byZone = zones.map((zone) => { const zoneAllocations = allocations.filter((allocation) => allocation.electoralZoneId === zone.id); const zoneDispatches = dispatches.filter((dispatch) => dispatch.electoralZoneId === zone.id); const times = zoneDispatches.filter((dispatch) => dispatch.acceptedAt).map((dispatch) => (dispatch.acceptedAt!.getTime() - dispatch.requestedAt.getTime()) / 60000); return { id: zone.id, label: `Zona ${zone.number} · ${zone.name}`, allocations: zoneAllocations.length, activeAllocations: zoneAllocations.filter((allocation) => allocation.status === "ACTIVE").length, dispatches: zoneDispatches.length, averageResponseMinutes: averageMinutes(times), utilizationRate: rate(new Set(zoneAllocations.map((allocation) => allocation.teamId).filter(Boolean)).size, teams.length) }; });
    const byPlace = places.map((place) => ({ id: place.id, label: place.name, zoneId: place.electoralZoneId, allocations: allocations.filter((allocation) => allocation.pollingPlaceId === place.id).length, dispatches: dispatches.filter((dispatch) => dispatch.pollingPlaceId === place.id).length }));
    const breakdown = { byZone, byPlace, byStatus: countBy(dispatches, (dispatch) => dispatch.status) };
    const comparison = await this.compare(query, { dispatches: dispatches.length, allocations: allocations.length }, async (window) => {
      const [previousDispatches, previousAllocations] = await Promise.all([
        this.prisma.fieldDispatch.count({ where: { ...dispatchWhere, requestedAt: window } }),
        this.prisma.fieldAllocation.count({ where: { electionId: query.electionId, electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId, startsAt: window } }),
      ]);
      return { dispatches: previousDispatches, allocations: previousAllocations };
    });
    return this.envelope(query, summary, breakdown, comparison);
  }

  async logistics(query: ReportQueryDto) {
    const { period, routeStatus } = this.filters(query);
    const { zones, places } = await this.geography(query);
    const routes = await this.prisma.distributionRoute.findMany({ where: { electionId: query.electionId, electoralZoneId: query.zoneId, status: routeStatus, plannedDeparture: period }, select: { id: true, electoralZoneId: true, status: true, plannedArrival: true, actualArrival: true, deliveries: { select: { id: true, status: true, pollingPlaceId: true } } } });
    const now = new Date();
    const deliveries = routes.flatMap((route) => route.deliveries);
    const delivered = deliveries.filter((delivery) => delivery.status === "DELIVERED").length;
    const failed = deliveries.filter((delivery) => delivery.status === "FAILED" || delivery.status === "RETURNED").length;
    const pending = deliveries.filter((delivery) => delivery.status === "PENDING" || delivery.status === "IN_TRANSIT").length;
    const completedRoutes = routes.filter((route) => route.status === RouteStatus.COMPLETED);
    const onTime = completedRoutes.filter((route) => route.actualArrival && route.actualArrival <= route.plannedArrival).length;
    const delayedRoutes = routes.filter((route) => route.status === RouteStatus.DELAYED || (route.status !== RouteStatus.COMPLETED && route.status !== RouteStatus.CANCELLED && route.plannedArrival < now)).length;
    const summary = { totalRoutes: routes.length, completedRoutes: completedRoutes.length, activeRoutes: routes.filter((route) => route.status === RouteStatus.IN_PROGRESS || route.status === RouteStatus.DELAYED).length, delayedRoutes, onTimeRate: rate(onTime, completedRoutes.filter((route) => route.actualArrival).length), deliveries: deliveries.length, delivered, pending, failed, exceptionRate: rate(failed, deliveries.length) };
    const byZone = zones.map((zone) => { const zoneRoutes = routes.filter((route) => route.electoralZoneId === zone.id); const zoneDeliveries = zoneRoutes.flatMap((route) => route.deliveries); return { id: zone.id, label: `Zona ${zone.number} · ${zone.name}`, routes: zoneRoutes.length, completedRoutes: zoneRoutes.filter((route) => route.status === RouteStatus.COMPLETED).length, delayedRoutes: zoneRoutes.filter((route) => route.status === RouteStatus.DELAYED).length, deliveries: zoneDeliveries.length, delivered: zoneDeliveries.filter((delivery) => delivery.status === "DELIVERED").length, failed: zoneDeliveries.filter((delivery) => delivery.status === "FAILED" || delivery.status === "RETURNED").length }; });
    const byPlace = places.map((place) => { const placeDeliveries = deliveries.filter((delivery) => delivery.pollingPlaceId === place.id); return { id: place.id, label: place.name, zoneId: place.electoralZoneId, deliveries: placeDeliveries.length, delivered: placeDeliveries.filter((delivery) => delivery.status === "DELIVERED").length, failed: placeDeliveries.filter((delivery) => delivery.status === "FAILED" || delivery.status === "RETURNED").length }; });
    const breakdown = { byZone, byPlace, byStatus: countBy(routes, (route) => route.status) };
    const comparison = await this.compare(query, { routes: routes.length, deliveries: deliveries.length, failed }, async (window) => {
      const previous = await this.prisma.distributionRoute.findMany({ where: { electionId: query.electionId, electoralZoneId: query.zoneId, status: routeStatus, plannedDeparture: window }, select: { deliveries: { select: { status: true } } } });
      const previousDeliveries = previous.flatMap((route) => route.deliveries);
      return { routes: previous.length, deliveries: previousDeliveries.length, failed: previousDeliveries.filter((delivery) => delivery.status === "FAILED" || delivery.status === "RETURNED").length };
    });
    return this.envelope(query, summary, breakdown, comparison);
  }

  async assets(query: ReportQueryDto) {
    const { period, assetStatus } = this.filters(query);
    const { zones, places } = await this.geography(query);
    const assetWhere = { electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId, status: assetStatus, electoralZone: query.electionId ? { electionId: query.electionId } : undefined };
    const [assets, movements] = await Promise.all([
      this.prisma.asset.findMany({ where: assetWhere, select: { id: true, electoralZoneId: true, pollingPlaceId: true, status: true, condition: true, type: { select: { name: true } } } }),
      this.prisma.assetMovement.findMany({ where: { movedAt: period, asset: assetWhere }, select: { id: true, toZoneId: true, toPollingPlaceId: true } }),
    ]);
    const available = assets.filter((asset) => asset.status === AssetStatus.AVAILABLE).length;
    const summary = { total: assets.length, available, allocated: assets.filter((asset) => asset.status === AssetStatus.ALLOCATED).length, inUse: assets.filter((asset) => asset.status === AssetStatus.IN_USE).length, maintenance: assets.filter((asset) => asset.status === AssetStatus.MAINTENANCE).length, lost: assets.filter((asset) => asset.status === AssetStatus.LOST).length, goodCondition: assets.filter((asset) => asset.condition === AssetCondition.GOOD).length, movements: movements.length, availabilityRate: rate(available, assets.length) };
    const byZone = zones.map((zone) => { const items = assets.filter((asset) => asset.electoralZoneId === zone.id); return { id: zone.id, label: `Zona ${zone.number} · ${zone.name}`, total: items.length, available: items.filter((asset) => asset.status === AssetStatus.AVAILABLE).length, allocated: items.filter((asset) => asset.status === AssetStatus.ALLOCATED).length, maintenance: items.filter((asset) => asset.status === AssetStatus.MAINTENANCE).length, movements: movements.filter((movement) => movement.toZoneId === zone.id).length }; });
    const byPlace = places.map((place) => { const items = assets.filter((asset) => asset.pollingPlaceId === place.id); return { id: place.id, label: place.name, zoneId: place.electoralZoneId, total: items.length, available: items.filter((asset) => asset.status === AssetStatus.AVAILABLE).length, maintenance: items.filter((asset) => asset.status === AssetStatus.MAINTENANCE).length, movements: movements.filter((movement) => movement.toPollingPlaceId === place.id).length }; });
    const breakdown = { byZone, byPlace, byStatus: countBy(assets, (asset) => asset.status), byCondition: countBy(assets, (asset) => asset.condition), byType: countBy(assets, (asset) => asset.type.name) };
    const comparison = await this.compare(query, { movements: movements.length }, async (window) => ({ movements: await this.prisma.assetMovement.count({ where: { movedAt: window, asset: assetWhere } }) }));
    return this.envelope(query, summary, breakdown, comparison);
  }

  private parseMetric(value: string): ReportMetric {
    try {
      return assertReportMetric(value);
    } catch (error) {
      throw invalid(error);
    }
  }

  private parseGranularity(value: string): ReportGranularity {
    try {
      return assertReportGranularity(value);
    } catch (error) {
      throw invalid(error);
    }
  }

  private parseScope(
    query: { from?: string; to?: string; electionId?: string; electoralZoneId?: string; pollingPlaceId?: string; includeSimulated?: boolean },
    fallbackDays: number,
  ): ReportsScope {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - fallbackDays * DAY_MS);
    try {
      assertWindowWithinLimit(from, to);
    } catch (error) {
      throw invalid(error);
    }
    return {
      from,
      to,
      electionId: query.electionId,
      electoralZoneId: query.electoralZoneId,
      pollingPlaceId: query.pollingPlaceId,
      includeSimulated: query.includeSimulated === true,
    };
  }

  /** Série temporal contínua de uma métrica do vocabulário (SPEC 2.2/2.3). */
  async timeseries(query: TimeseriesQueryDto) {
    if (!query.from || !query.to)
      throw new BadRequestException("Informe 'from' e 'to' para a série temporal.");
    const metric = this.parseMetric(query.metric);
    const granularity = this.parseGranularity(query.granularity ?? "day");
    const scope = this.parseScope(query, 30);
    return seriesFor(this.prisma, metric, scope, granularity);
  }

  /** SLA Analytics com todas as fórmulas normativas (SPEC 2.4). */
  async sla(query: SlaQueryDto) {
    const scope = this.parseScope(query, 30);
    const incidents = (await loadMetricRows(this.prisma, "incidentsOpened", scope)) as unknown as IncidentTimingRow[];
    const transitions = (await loadMetricRows(this.prisma, "transmissionOffline", scope)) as unknown as TransmissionTransitionRow[];
    const requests = (await loadMetricRows(this.prisma, "resourceRequestsCreated", scope)) as unknown as Array<{ submittedAt: Date | null; fulfilledAt: Date | null }>;
    const dispatches = (await loadMetricRows(this.prisma, "dispatchesActive", scope)) as unknown as Array<{ requestedAt: Date; completedAt: Date | null }>;

    const openedInWindow = incidents.filter((row) => inWindow(row.openedAt, scope.from, scope.to));
    const respondedInWindow = incidents.filter((row) => inWindow(row.acknowledgedAt, scope.from, scope.to));
    const resolvedInWindow = incidents.filter((row) => inWindow(row.resolvedAt, scope.from, scope.to));
    const complianceRows = incidents.filter(
      (row) => row.slaDeadline !== null && inWindow(row.openedAt, scope.from, scope.to),
    );
    const fulfilledInWindow = requests.filter((row) => inWindow(row.fulfilledAt, scope.from, scope.to));
    const completedInWindow = dispatches.filter((row) => inWindow(row.completedAt, scope.from, scope.to));

    const now = new Date();
    const windowMinutes = (scope.to.getTime() - scope.from.getTime()) / 60000;
    const downtime = transmissionDowntimeMinutes(transitions, now);
    return {
      generatedAt: now.toISOString(),
      scope: {
        from: scope.from.toISOString(),
        to: scope.to.toISOString(),
        electionId: scope.electionId ?? null,
        electoralZoneId: scope.electoralZoneId ?? null,
        pollingPlaceId: scope.pollingPlaceId ?? null,
        includeSimulated: scope.includeSimulated,
      },
      windowMinutes,
      indicators: {
        meanResponseMinutes: meanResponseMinutes(respondedInWindow),
        meanResolutionMinutes: meanResolutionMinutes(resolvedInWindow),
        mttrMinutes: mttrMinutes(resolvedInWindow),
        slaCompliancePercent: slaCompliancePercent(complianceRows),
        deadlineMisses: deadlineMisses(incidents, now),
        escalationRatePercent: escalationRatePercent(openedInWindow),
        transmissionDowntimeMinutes: downtime,
        transmissionUptimePercent: transmissionUptimePercent(windowMinutes, downtime.value ?? 0),
        fulfillmentMeanMinutes: fulfillmentMeanMinutes(fulfilledInWindow),
        dispatchMeanMinutes: dispatchMeanMinutes(completedInWindow),
      },
    };
  }

  /** Comparação de zonas com denominador e ranking normalizado (SPEC 2.5). */
  async zoneComparison(query: ZonesQueryDto) {
    if (!query.electionId)
      throw new BadRequestException("Informe 'electionId' para comparar zonas.");
    const scope = this.parseScope({ ...query, electionId: query.electionId }, 30);
    const metrics: ReportMetric[] = query.metrics
      ? query.metrics.split(",").map((metric) => metric.trim()).filter(Boolean).map((metric) => this.parseMetric(metric))
      : [...REPORT_METRICS];

    const zones = await this.prisma.electoralZone.findMany({
      where: { electionId: scope.electionId },
      select: { id: true, number: true, name: true, municipality: true, state: true },
      orderBy: { number: "asc" },
    });
    const zoneIds = zones.map((zone) => zone.id);
    const [places, sections] = await Promise.all([
      this.prisma.pollingPlace.findMany({ where: { electoralZoneId: { in: zoneIds } }, select: { electoralZoneId: true } }),
      this.prisma.pollingSection.findMany({
        where: { pollingPlace: { electoralZoneId: { in: zoneIds } } },
        select: { registeredVoters: true, pollingPlace: { select: { electoralZoneId: true } } },
      }),
    ]);

    const rowsByMetric = new Map<ReportMetric, readonly unknown[]>();
    for (const metric of metrics) rowsByMetric.set(metric, await loadMetricRows(this.prisma, metric, scope));

    const perZone = zones.map((zone) => {
      const zonePlaces = places.filter((place) => place.electoralZoneId === zone.id).length;
      const zoneSections = sections.filter((section) => section.pollingPlace.electoralZoneId === zone.id);
      const registeredVoters = zoneSections.reduce((sum, section) => sum + section.registeredVoters, 0);
      return { zone, pollingPlaceCount: zonePlaces, pollingSectionCount: zoneSections.length, registeredVoters };
    });

    const valuesByMetric = new Map<ReportMetric, Map<string, SeriesPoint>>();
    const absoluteRanks = new Map<ReportMetric, Map<string, number | null>>();
    const normalizedRanks = new Map<ReportMetric, Map<string, number | null>>();
    for (const metric of metrics) {
      const rows = rowsByMetric.get(metric) ?? [];
      const values = new Map<string, SeriesPoint>();
      for (const entry of perZone)
        values.set(entry.zone.id, await aggregateFor(this.prisma, metric, scope, rows.filter((row) => metricZoneOf(metric, row) === entry.zone.id)));
      valuesByMetric.set(metric, values);
      const absolute = competitionRanks(perZone.map((entry) => values.get(entry.zone.id)?.value ?? 0));
      const normalized = competitionRanks(
        perZone.map((entry) => per1000Voters(values.get(entry.zone.id)?.value ?? 0, entry.registeredVoters)),
      );
      absoluteRanks.set(metric, new Map(perZone.map((entry, index) => [entry.zone.id, absolute[index]])));
      normalizedRanks.set(metric, new Map(perZone.map((entry, index) => [entry.zone.id, normalized[index]])));
    }

    return {
      generatedAt: new Date().toISOString(),
      scope: {
        from: scope.from.toISOString(),
        to: scope.to.toISOString(),
        electionId: scope.electionId ?? null,
        includeSimulated: scope.includeSimulated,
      },
      zones: perZone.map((entry) => {
        const metricsResult: Record<string, unknown> = {};
        const rankings: Record<string, unknown> = {};
        for (const metric of metrics) {
          const point = valuesByMetric.get(metric)?.get(entry.zone.id) ?? { value: 0, sampleSize: 0 };
          metricsResult[metric] = {
            value: point.value,
            sampleSize: point.sampleSize,
            per1000Voters: per1000Voters(point.value, entry.registeredVoters),
            perPlace: perPlace(point.value, entry.pollingPlaceCount),
          };
          rankings[metric] = {
            byAbsolute: absoluteRanks.get(metric)?.get(entry.zone.id) ?? null,
            byNormalized: normalizedRanks.get(metric)?.get(entry.zone.id) ?? null,
          };
        }
        return {
          zoneId: entry.zone.id,
          zoneNumber: entry.zone.number,
          zoneName: entry.zone.name,
          municipality: entry.zone.municipality,
          state: entry.zone.state,
          pollingPlaceCount: entry.pollingPlaceCount,
          pollingSectionCount: entry.pollingSectionCount,
          registeredVoters: entry.registeredVoters,
          metrics: metricsResult,
          rankings,
        };
      }),
    };
  }

  /** Entidades do bucket com deep link real e total não truncado (SPEC 2.6). */
  async drilldown(query: DrilldownQueryDto) {
    const metric = this.parseMetric(query.metric);
    const scope = this.parseScope(
      { from: query.from, to: query.to, electionId: query.electionId, electoralZoneId: query.zoneId, includeSimulated: query.includeSimulated },
      30,
    );
    const start = new Date(query.bucketStart);
    const end = new Date(query.bucketEnd);
    if (!(end.getTime() > start.getTime()))
      throw new BadRequestException("Bucket inválido: 'bucketEnd' deve ser posterior a 'bucketStart'.");
    return drilldownFor(this.prisma, metric, scope, { start, end }, query.limit);
  }

  /** Export JSON estruturado, respeitando escopo (SPEC 2.8). */
  async exportJson(query: ExportJsonQueryDto) {
    const [executive, operations, incidents, transmission, workforce, logistics, assets] = await Promise.all([
      this.executive(query),
      this.operations(query),
      this.incidents(query),
      this.transmission(query),
      this.workforce(query),
      this.logistics(query),
      this.assets(query),
    ]);
    const timeseries: Record<string, unknown> = {};
    if (query.metrics) {
      if (!query.from || !query.to)
        throw new BadRequestException("Informe 'from' e 'to' para exportar séries temporais.");
      for (const raw of query.metrics.split(",")) {
        const metric = raw.trim();
        if (!metric) continue;
        const series = await this.timeseries({
          metric,
          from: query.from,
          to: query.to,
          granularity: "day",
          electionId: query.electionId,
          electoralZoneId: query.zoneId,
          pollingPlaceId: query.pollingPlaceId,
          includeSimulated: query.includeSimulated,
        });
        timeseries[metric] = series.buckets;
      }
    }
    return {
      generatedAt: new Date().toISOString(),
      scope: {
        electionId: query.electionId ?? null,
        electoralZoneId: query.zoneId ?? null,
        pollingPlaceId: query.pollingPlaceId ?? null,
        from: query.from ?? null,
        to: query.to ?? null,
        includeSimulated: query.includeSimulated === true,
      },
      sections: { executive, operations, incidents, transmission, workforce, logistics, assets },
      timeseries,
    };
  }

  async csv(query: ReportQueryDto) {
    const report = await this.executive(query);
    const rows = [
      ["Indicador", "Valor"],
      ["Locais operacionais", report.executive.operationalPlaces], ["Locais críticos", report.executive.criticalPlaces], ["Incidentes abertos", report.executive.openIncidents],
      ["SLA (%)", report.executive.slaPercentage], ["Ativos disponíveis", report.executive.availableAssets], ["Ativos indisponíveis", report.executive.unavailableAssets],
      ["Transmissão (%)", report.executive.transmissionPercentage], ["Rotas em execução", report.executive.routesInProgress], ["Entregas atrasadas", report.executive.delayedDeliveries],
      [], ["Zona", "Locais", "Críticos", "Incidentes abertos", "Ativos", "Transmissão (%)"],
      ...report.byZone.map((zone) => [zone.label, zone.places, zone.criticalPlaces, zone.openIncidents, zone.assets, zone.transmissionPercentage]),
    ];
    return rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
  }

  async pdf(query: ReportQueryDto) {
    const report = await this.executive(query);
    return new Promise<Buffer>((resolve, reject) => {
      const document = new PDFDocument({ margin: 48, size: "A4", info: { Title: "Election Ops — Relatório Executivo" } });
      const chunks: Buffer[] = []; document.on("data", (chunk: Buffer) => chunks.push(chunk)); document.on("end", () => resolve(Buffer.concat(chunks))); document.on("error", reject);
      document.fontSize(20).fillColor("#17324d").text("Election Ops — Relatório Executivo");
      document.moveDown(0.4).fontSize(9).fillColor("#526b80").text(`Gerado em ${new Date(report.generatedAt).toLocaleString("pt-BR")}`);
      document.moveDown().fontSize(13).fillColor("#17324d").text("Indicadores consolidados");
      const metrics: Array<[string, number | string]> = [["Locais operacionais", report.executive.operationalPlaces], ["Locais críticos", report.executive.criticalPlaces], ["Incidentes abertos", report.executive.openIncidents], ["SLA", `${report.executive.slaPercentage}%`], ["Ativos disponíveis", report.executive.availableAssets], ["Transmissão", `${report.executive.transmissionPercentage}%`], ["Rotas em execução", report.executive.routesInProgress], ["Entregas atrasadas", report.executive.delayedDeliveries]];
      for (const [label, value] of metrics) document.fontSize(10).fillColor("#273b4d").text(`${label}: ${value}`);
      document.moveDown().fontSize(13).fillColor("#17324d").text("Indicadores por zona");
      for (const zone of report.byZone) document.fontSize(9).fillColor("#273b4d").text(`${zone.label} — ${zone.places} locais, ${zone.openIncidents} incidentes abertos, ${zone.assets} ativos, ${zone.transmissionPercentage}% transmitido`);
      document.moveDown().fontSize(8).fillColor("#6b7f90").text("Fonte: dados persistidos na Election Ops Platform. Nenhum valor demonstrativo foi injetado neste relatório.");
      document.end();
    });
  }
}
