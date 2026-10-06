import type { PrismaService } from "@eops/database";
import {
  buildSeries,
  continuousBucketRanges,
  type BucketRange,
  type ReportDeepLinkKind,
  type ReportGranularity,
  type ReportMetric,
  type ReportSeries,
  type SeriesPoint,
} from "@eops/shared/reports";

/**
 * Camada de agregacao analitica do plugin de reports. Le somente-leitura os
 * dominios vizinhos (I2) com `select` explicito, nunca escreve e sempre isola
 * por `electionId` ou pela entidade ancora (I4). As formulas de SLA e de
 * normalizacao vivem em `@eops/shared/reports` e sao cobertas por teste.
 */

export interface ReportsScope {
  from: Date;
  to: Date;
  electionId?: string;
  electoralZoneId?: string;
  pollingPlaceId?: string;
  includeSimulated: boolean;
}

export interface DrilldownItem {
  id: string;
  kind: ReportDeepLinkKind;
  title: string;
  subtitle: string | null;
  status: string;
  severity: string | null;
  occurredAt: string;
  deepLink: string;
  zoneId?: string;
  pollingPlaceId?: string;
}

export interface DrilldownResult {
  metric: ReportMetric;
  bucketStart: string;
  bucketEnd: string;
  total: number;
  truncated: boolean;
  items: DrilldownItem[];
}

interface MetricContext {
  now: Date;
  end: Date;
}

interface MetricSpec {
  kind: ReportDeepLinkKind;
  load(prisma: PrismaService, scope: ReportsScope): Promise<readonly unknown[]>;
  zoneOf(row: unknown): string | null;
  /** Pontuacao da metrica para a janela (bucket ou periodo inteiro). */
  point(rows: readonly unknown[], range: BucketRange, now: Date): SeriesPoint;
  /** Entidades que compoem o numerador, para o drill-down. */
  qualifying(rows: readonly unknown[], range: BucketRange, now: Date): readonly unknown[];
  toItem(row: unknown): DrilldownItem;
}

function rate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function deepLink(kind: ReportDeepLinkKind, id: string): string {
  if (kind === "INCIDENT") return `/incidents/${id}`;
  if (kind === "TRANSMISSION_POINT") return `/transmission/${id}`;
  if (kind === "RESOURCE_REQUEST") return `/resource-requests/${id}`;
  if (kind === "FIELD_SHIFT") return `/shifts/${id}`;
  if (kind === "FIELD_DISPATCH") return `/field-teams/dispatch/${id}`;
  if (kind === "ROUTE") return `/routes/${id}`;
  if (kind === "ASSET") return `/inventory/${id}`;
  return `/preparation-checklists/${id}`;
}

function inRange(at: Date | null, range: BucketRange): boolean {
  return (
    at !== null && at.getTime() >= range.start.getTime() && at.getTime() < range.end.getTime()
  );
}

function scopedZone(zone?: string) {
  return zone ? { electoralZoneId: zone } : {};
}

function scopedPlace(place?: string) {
  return place ? { pollingPlaceId: place } : {};
}

// ---------------------------------------------------------------------------
// Factories de spec por modo de metrica.
// ---------------------------------------------------------------------------

function countMetric<T>(config: {
  kind: ReportDeepLinkKind;
  load(prisma: PrismaService, scope: ReportsScope): Promise<T[]>;
  zoneOf(row: T): string | null;
  at(row: T): Date | null;
  match(row: T, context: MetricContext): boolean;
  toItem(row: T): DrilldownItem;
}): MetricSpec {
  const spec: MetricSpec = {
    kind: config.kind,
    load: (prisma, scope) => config.load(prisma, scope),
    zoneOf: (row) => config.zoneOf(row as T),
    point(rows, range, now) {
      const inWindow = (rows as T[]).filter((row) => inRange(config.at(row), range));
      const matched = inWindow.filter((row) => config.match(row, { now, end: range.end }));
      return { value: matched.length, sampleSize: inWindow.length };
    },
    qualifying(rows, range, now) {
      return (rows as T[]).filter(
        (row) => inRange(config.at(row), range) && config.match(row, { now, end: range.end }),
      );
    },
    toItem: (row) => config.toItem(row as T),
  };
  return spec;
}

function rateMetric<T>(config: {
  kind: ReportDeepLinkKind;
  load(prisma: PrismaService, scope: ReportsScope): Promise<T[]>;
  zoneOf(row: T): string | null;
  at(row: T): Date | null;
  numerator(row: T, context: MetricContext): boolean;
  denominator?(row: T): boolean;
  toItem(row: T): DrilldownItem;
}): MetricSpec {
  const spec: MetricSpec = {
    kind: config.kind,
    load: (prisma, scope) => config.load(prisma, scope),
    zoneOf: (row) => config.zoneOf(row as T),
    point(rows, range, now) {
      const inWindow = (rows as T[]).filter((row) => inRange(config.at(row), range));
      const denominator = config.denominator
        ? inWindow.filter((row) => config.denominator!(row)).length
        : inWindow.length;
      const numerator = inWindow.filter((row) =>
        config.numerator(row, { now, end: range.end }),
      ).length;
      return { value: rate(numerator, denominator), sampleSize: denominator };
    },
    qualifying(rows, range, now) {
      return (rows as T[]).filter(
        (row) =>
          inRange(config.at(row), range) &&
          config.numerator(row, { now, end: range.end }),
      );
    },
    toItem: (row) => config.toItem(row as T),
  };
  return spec;
}

function gaugeMetric<T>(config: {
  kind: ReportDeepLinkKind;
  load(prisma: PrismaService, scope: ReportsScope): Promise<T[]>;
  zoneOf(row: T): string | null;
  at(row: T): Date | null;
  active(row: T, at: Date): boolean;
  toItem(row: T): DrilldownItem;
}): MetricSpec {
  const spec: MetricSpec = {
    kind: config.kind,
    load: (prisma, scope) => config.load(prisma, scope),
    zoneOf: (row) => config.zoneOf(row as T),
    point(rows, range) {
      const upToEnd = (rows as T[]).filter((row) => {
        const at = config.at(row);
        return at !== null && at.getTime() <= range.end.getTime();
      });
      const active = upToEnd.filter((row) => config.active(row, range.end));
      return { value: active.length, sampleSize: upToEnd.length };
    },
    qualifying(rows, range) {
      return (rows as T[]).filter(
        (row) =>
          config.at(row) !== null &&
          config.at(row)!.getTime() <= range.end.getTime() &&
          config.active(row, range.end),
      );
    },
    toItem: (row) => config.toItem(row as T),
  };
  return spec;
}

// ---------------------------------------------------------------------------
// Linhas lidas dos dominios vizinhos.
// ---------------------------------------------------------------------------

interface IncidentRow {
  id: string;
  code: string;
  title: string;
  severity: string;
  status: string;
  openedAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  slaDeadline: Date | null;
  escalatedAt: Date | null;
  escalationLevel: number;
  electoralZoneId: string | null;
  pollingPlaceId: string | null;
}

interface TransmissionPointLite {
  id: string;
  identification: string;
  status: string;
  connectivity: string;
  electoralZoneId: string;
  pollingPlaceId: string;
  lastActivity: Date | null;
}

interface TransmissionAttemptRow {
  id: string;
  startedAt: Date;
  result: string;
  point: TransmissionPointLite;
}

interface TransmissionTransitionFullRow {
  id: string;
  from: string;
  to: string;
  occurredAt: Date;
  durationSeconds: number | null;
  point: TransmissionPointLite;
}

interface ResourceRequestRow {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  createdAt: Date;
  submittedAt: Date | null;
  fulfilledAt: Date | null;
  neededAt: Date | null;
  electoralZoneId: string | null;
  pollingPlaceId: string | null;
}

interface ShiftRow {
  id: string;
  name: string | null;
  status: string;
  startsAt: Date;
  endsAt: Date;
  requiredOperators: number;
  electoralZoneId: string | null;
  pollingPlaceId: string | null;
  team: { name: string };
  assignments: Array<{ status: string }>;
}

interface DispatchRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  requestedAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
  rejectedAt: Date | null;
  electoralZoneId: string | null;
  pollingPlaceId: string | null;
  team: { name: string };
}

interface RouteRow {
  id: string;
  code: string;
  name: string;
  status: string;
  plannedDeparture: Date;
  plannedArrival: Date;
  actualArrival: Date | null;
  electoralZoneId: string;
}

interface DeliveryRow {
  id: string;
  status: string;
  at: Date;
  electoralZoneId: string;
  route: { id: string; name: string; code: string; status: string };
}

interface PreparationRow {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  electoralZoneId: string;
  pollingPlaceId: string;
  template: { name: string };
}

interface AssetRow {
  id: string;
  assetTag: string;
  name: string;
  status: string;
  condition: string;
  updatedAt: Date;
  electoralZoneId: string | null;
  pollingPlaceId: string | null;
}

const TERMINAL_INCIDENT_STATUSES = ["RESOLVED", "CLOSED", "CANCELLED"];
const TERMINAL_REQUEST_STATUSES = ["FULFILLED", "REJECTED", "CANCELLED"];
const TERMINAL_DISPATCH_STATUSES = ["COMPLETED", "REJECTED", "CANCELLED"];
const TERMINAL_ROUTE_STATUSES = ["COMPLETED", "CANCELLED"];

function deadlineMiss(row: IncidentRow, now: Date): boolean {
  if (row.slaDeadline === null) return false;
  const deadline = row.slaDeadline.getTime();
  if (!TERMINAL_INCIDENT_STATUSES.includes(row.status)) return deadline < now.getTime();
  return row.resolvedAt !== null && row.resolvedAt.getTime() > deadline;
}

// ---------------------------------------------------------------------------
// Loaders (leitura cross-domain explicitamente selecionada).
// ---------------------------------------------------------------------------

function loadIncidents(prisma: PrismaService, scope: ReportsScope) {
  return prisma.incident.findMany({
    where: {
      ...(scope.electionId ? { electionId: scope.electionId } : {}),
      ...scopedZone(scope.electoralZoneId),
      ...scopedPlace(scope.pollingPlaceId),
      ...(scope.includeSimulated ? {} : { isSimulated: false }),
      openedAt: { lte: scope.to },
    },
    select: {
      id: true, code: true, title: true, severity: true, status: true,
      openedAt: true, acknowledgedAt: true, resolvedAt: true, slaDeadline: true,
      escalatedAt: true, escalationLevel: true, electoralZoneId: true, pollingPlaceId: true,
    },
  }) as unknown as Promise<IncidentRow[]>;
}

function pointWhere(scope: ReportsScope) {
  return {
    ...(scope.electionId ? { electionId: scope.electionId } : {}),
    ...scopedZone(scope.electoralZoneId),
    ...scopedPlace(scope.pollingPlaceId),
  };
}

const POINT_SELECT = {
  id: true, identification: true, status: true, connectivity: true,
  electoralZoneId: true, pollingPlaceId: true, lastActivity: true,
} as const;

function loadAttempts(prisma: PrismaService, scope: ReportsScope) {
  return prisma.transmissionAttempt.findMany({
    where: { point: pointWhere(scope), startedAt: { gte: scope.from, lte: scope.to } },
    select: { id: true, startedAt: true, result: true, point: { select: POINT_SELECT } },
  }) as unknown as Promise<TransmissionAttemptRow[]>;
}

function loadTransitions(prisma: PrismaService, scope: ReportsScope) {
  return prisma.transmissionStateTransition.findMany({
    where: { point: pointWhere(scope), occurredAt: { gte: scope.from, lte: scope.to } },
    select: {
      id: true, from: true, to: true, occurredAt: true, durationSeconds: true,
      point: { select: POINT_SELECT },
    },
  }) as unknown as Promise<TransmissionTransitionFullRow[]>;
}

function loadResourceRequests(prisma: PrismaService, scope: ReportsScope) {
  return prisma.resourceRequest.findMany({
    where: {
      ...(scope.electionId ? { electionId: scope.electionId } : {}),
      ...scopedZone(scope.electoralZoneId),
      ...scopedPlace(scope.pollingPlaceId),
      OR: [
        { createdAt: { gte: scope.from, lte: scope.to } },
        { fulfilledAt: { gte: scope.from, lte: scope.to } },
        { neededAt: { gte: scope.from, lte: scope.to } },
      ],
    },
    select: {
      id: true, code: true, title: true, status: true, priority: true, createdAt: true,
      submittedAt: true, fulfilledAt: true, neededAt: true, electoralZoneId: true, pollingPlaceId: true,
    },
  }) as unknown as Promise<ResourceRequestRow[]>;
}

function loadShifts(prisma: PrismaService, scope: ReportsScope) {
  return prisma.fieldShift.findMany({
    where: {
      ...(scope.electionId ? { team: { electionId: scope.electionId } } : {}),
      ...scopedZone(scope.electoralZoneId),
      ...scopedPlace(scope.pollingPlaceId),
      startsAt: { gte: scope.from, lte: scope.to },
    },
    select: {
      id: true, name: true, status: true, startsAt: true, endsAt: true,
      requiredOperators: true, electoralZoneId: true, pollingPlaceId: true,
      team: { select: { name: true } }, assignments: { select: { status: true } },
    },
  }) as unknown as Promise<ShiftRow[]>;
}

function loadDispatches(prisma: PrismaService, scope: ReportsScope) {
  return prisma.fieldDispatch.findMany({
    where: {
      ...(scope.electionId ? { team: { electionId: scope.electionId } } : {}),
      ...scopedZone(scope.electoralZoneId),
      ...scopedPlace(scope.pollingPlaceId),
      requestedAt: { lte: scope.to },
    },
    select: {
      id: true, title: true, status: true, priority: true, requestedAt: true,
      completedAt: true, cancelledAt: true, rejectedAt: true,
      electoralZoneId: true, pollingPlaceId: true, team: { select: { name: true } },
    },
  }) as unknown as Promise<DispatchRow[]>;
}

function loadRoutes(prisma: PrismaService, scope: ReportsScope) {
  return prisma.distributionRoute.findMany({
    where: {
      ...(scope.electionId ? { electionId: scope.electionId } : {}),
      ...scopedZone(scope.electoralZoneId),
      plannedDeparture: { gte: scope.from, lte: scope.to },
    },
    select: {
      id: true, code: true, name: true, status: true, electoralZoneId: true,
      plannedDeparture: true, plannedArrival: true, actualArrival: true,
    },
  }) as unknown as Promise<RouteRow[]>;
}

function loadDeliveries(prisma: PrismaService, scope: ReportsScope) {
  return prisma.distributionRoute
    .findMany({
      where: {
        ...(scope.electionId ? { electionId: scope.electionId } : {}),
        ...scopedZone(scope.electoralZoneId),
        plannedDeparture: { gte: scope.from, lte: scope.to },
      },
      select: {
        id: true, code: true, name: true, status: true, electoralZoneId: true,
        plannedDeparture: true, deliveries: { select: { id: true, status: true } },
      },
    })
    .then((routes) =>
      routes.flatMap((route) =>
        route.deliveries.map<DeliveryRow>((delivery) => ({
          id: delivery.id,
          status: delivery.status,
          at: route.plannedDeparture,
          electoralZoneId: route.electoralZoneId,
          route: { id: route.id, name: route.name, code: route.code, status: route.status },
        })),
      ),
    );
}

function loadPreparation(prisma: PrismaService, scope: ReportsScope) {
  return prisma.preparationChecklist.findMany({
    where: {
      ...(scope.electionId ? { electionId: scope.electionId } : {}),
      ...scopedZone(scope.electoralZoneId),
      ...scopedPlace(scope.pollingPlaceId),
      updatedAt: { gte: scope.from, lte: scope.to },
    },
    select: {
      id: true, status: true, createdAt: true, updatedAt: true, approvedAt: true,
      electoralZoneId: true, pollingPlaceId: true, template: { select: { name: true } },
    },
  }) as unknown as Promise<PreparationRow[]>;
}

function loadAssets(prisma: PrismaService, scope: ReportsScope) {
  return prisma.asset.findMany({
    where: {
      ...(scope.electionId ? { electoralZone: { electionId: scope.electionId } } : {}),
      ...scopedZone(scope.electoralZoneId),
      ...scopedPlace(scope.pollingPlaceId),
      updatedAt: { gte: scope.from, lte: scope.to },
    },
    select: {
      id: true, assetTag: true, name: true, status: true, condition: true,
      updatedAt: true, electoralZoneId: true, pollingPlaceId: true,
    },
  }) as unknown as Promise<AssetRow[]>;
}

function presentCount(row: ShiftRow): number {
  return row.assignments.filter((assignment) => assignment.status === "PRESENT").length;
}

// ---------------------------------------------------------------------------
// Mapeamento metrica -> spec.
// ---------------------------------------------------------------------------

function incidentItem(row: IncidentRow): DrilldownItem {
  return {
    id: row.id, kind: "INCIDENT", title: row.code, subtitle: row.title,
    status: row.status, severity: row.severity, occurredAt: row.openedAt.toISOString(),
    deepLink: deepLink("INCIDENT", row.id),
    ...(row.electoralZoneId ? { zoneId: row.electoralZoneId } : {}),
    ...(row.pollingPlaceId ? { pollingPlaceId: row.pollingPlaceId } : {}),
  };
}

function pointItem(timestamp: Date) {
  return (row: TransmissionPointLite): DrilldownItem => ({
    id: row.id, kind: "TRANSMISSION_POINT", title: row.identification,
    subtitle: row.connectivity, status: row.status, severity: row.connectivity,
    occurredAt: timestamp.toISOString(), deepLink: deepLink("TRANSMISSION_POINT", row.id),
    zoneId: row.electoralZoneId, pollingPlaceId: row.pollingPlaceId,
  });
}

function requestItem(row: ResourceRequestRow): DrilldownItem {
  return {
    id: row.id, kind: "RESOURCE_REQUEST", title: row.title, subtitle: row.code,
    status: row.status, severity: row.priority, occurredAt: (row.submittedAt ?? row.createdAt).toISOString(),
    deepLink: deepLink("RESOURCE_REQUEST", row.id),
    ...(row.electoralZoneId ? { zoneId: row.electoralZoneId } : {}),
    ...(row.pollingPlaceId ? { pollingPlaceId: row.pollingPlaceId } : {}),
  };
}

function routeItem(row: DeliveryRow): DrilldownItem {
  return {
    id: row.route.id, kind: "ROUTE", title: row.route.name, subtitle: row.route.code,
    status: row.route.status, severity: null, occurredAt: row.at.toISOString(),
    deepLink: deepLink("ROUTE", row.route.id), zoneId: row.electoralZoneId,
  };
}

function routeRowItem(row: RouteRow): DrilldownItem {
  return {
    id: row.id, kind: "ROUTE", title: row.name, subtitle: row.code,
    status: row.status, severity: null, occurredAt: row.plannedDeparture.toISOString(),
    deepLink: deepLink("ROUTE", row.id), zoneId: row.electoralZoneId,
  };
}

function preparationItem(row: PreparationRow): DrilldownItem {
  return {
    id: row.id, kind: "PREPARATION_CHECKLIST", title: row.template.name, subtitle: row.status,
    status: row.status, severity: null, occurredAt: row.updatedAt.toISOString(),
    deepLink: deepLink("PREPARATION_CHECKLIST", row.id),
    zoneId: row.electoralZoneId, pollingPlaceId: row.pollingPlaceId,
  };
}

function assetItem(row: AssetRow): DrilldownItem {
  return {
    id: row.id, kind: "ASSET", title: row.name, subtitle: row.assetTag,
    status: row.status, severity: row.condition, occurredAt: row.updatedAt.toISOString(),
    deepLink: deepLink("ASSET", row.id),
    ...(row.electoralZoneId ? { zoneId: row.electoralZoneId } : {}),
    ...(row.pollingPlaceId ? { pollingPlaceId: row.pollingPlaceId } : {}),
  };
}

const DELIVERY_FAILED = ["FAILED", "RETURNED"];

export const METRIC_SPECS: Record<ReportMetric, MetricSpec> = {
  incidentsOpened: countMetric<IncidentRow>({
    kind: "INCIDENT", load: loadIncidents, zoneOf: (row) => row.electoralZoneId,
    at: (row) => row.openedAt, match: () => true, toItem: incidentItem,
  }),
  incidentsOpenedCritical: countMetric<IncidentRow>({
    kind: "INCIDENT", load: loadIncidents, zoneOf: (row) => row.electoralZoneId,
    at: (row) => row.openedAt, match: (row) => row.severity === "CRITICAL", toItem: incidentItem,
  }),
  incidentsResolved: countMetric<IncidentRow>({
    kind: "INCIDENT", load: loadIncidents, zoneOf: (row) => row.electoralZoneId,
    at: (row) => row.resolvedAt, match: () => true, toItem: incidentItem,
  }),
  incidentsEscalated: countMetric<IncidentRow>({
    kind: "INCIDENT", load: loadIncidents, zoneOf: (row) => row.electoralZoneId,
    at: (row) => row.escalatedAt, match: () => true, toItem: incidentItem,
  }),
  incidentsOverdueSla: countMetric<IncidentRow>({
    kind: "INCIDENT", load: loadIncidents, zoneOf: (row) => row.electoralZoneId,
    at: (row) => row.slaDeadline, match: (row, context) => deadlineMiss(row, context.now),
    toItem: incidentItem,
  }),
  incidentsActive: gaugeMetric<IncidentRow>({
    kind: "INCIDENT", load: loadIncidents, zoneOf: (row) => row.electoralZoneId,
    at: (row) => row.openedAt,
    active: (row, at) =>
      row.openedAt.getTime() <= at.getTime() &&
      (row.resolvedAt === null || row.resolvedAt.getTime() > at.getTime()) &&
      row.status !== "CANCELLED",
    toItem: incidentItem,
  }),
  transmissionFailures: countMetric<TransmissionAttemptRow>({
    kind: "TRANSMISSION_POINT", load: loadAttempts, zoneOf: (row) => row.point.electoralZoneId,
    at: (row) => row.startedAt, match: (row) => row.result !== "SUCCESS",
    toItem: (row) => pointItem(row.startedAt)(row.point),
  }),
  transmissionOffline: countMetric<TransmissionTransitionFullRow>({
    kind: "TRANSMISSION_POINT", load: loadTransitions, zoneOf: (row) => row.point.electoralZoneId,
    at: (row) => row.occurredAt, match: (row) => row.to === "OFFLINE",
    toItem: (row) => pointItem(row.occurredAt)(row.point),
  }),
  transmissionSuccessRate: rateMetric<TransmissionAttemptRow>({
    kind: "TRANSMISSION_POINT", load: loadAttempts, zoneOf: (row) => row.point.electoralZoneId,
    at: (row) => row.startedAt, numerator: (row) => row.result === "SUCCESS",
    toItem: (row) => pointItem(row.startedAt)(row.point),
  }),
  resourceRequestsCreated: countMetric<ResourceRequestRow>({
    kind: "RESOURCE_REQUEST", load: loadResourceRequests, zoneOf: (row) => row.electoralZoneId,
    at: (row) => row.createdAt, match: () => true, toItem: requestItem,
  }),
  resourceRequestsFulfilled: countMetric<ResourceRequestRow>({
    kind: "RESOURCE_REQUEST", load: loadResourceRequests, zoneOf: (row) => row.electoralZoneId,
    at: (row) => row.fulfilledAt, match: () => true, toItem: requestItem,
  }),
  resourceRequestsOverdue: countMetric<ResourceRequestRow>({
    kind: "RESOURCE_REQUEST", load: loadResourceRequests, zoneOf: (row) => row.electoralZoneId,
    at: (row) => row.neededAt,
    match: (row, context) =>
      row.neededAt !== null && row.neededAt.getTime() < context.now.getTime() &&
      !TERMINAL_REQUEST_STATUSES.includes(row.status),
    toItem: requestItem,
  }),
  shiftCoveragePercent: {
    kind: "FIELD_SHIFT",
    load: loadShifts,
    zoneOf: (row) => (row as ShiftRow).electoralZoneId,
    point(rows, range) {
      const inWindow = (rows as ShiftRow[]).filter((row) => inRange(row.startsAt, range));
      const required = inWindow.reduce((sum, row) => sum + row.requiredOperators, 0);
      const present = inWindow.reduce((sum, row) => sum + Math.min(presentCount(row), row.requiredOperators), 0);
      return { value: rate(present, required), sampleSize: required };
    },
    qualifying(rows, range) {
      return (rows as ShiftRow[]).filter((row) => inRange(row.startsAt, range));
    },
    toItem: (row) => {
      const shift = row as ShiftRow;
      return {
        id: shift.id, kind: "FIELD_SHIFT", title: shift.name ?? "Turno", subtitle: shift.team.name,
        status: shift.status, severity: null, occurredAt: shift.startsAt.toISOString(),
        deepLink: deepLink("FIELD_SHIFT", shift.id),
        ...(shift.electoralZoneId ? { zoneId: shift.electoralZoneId } : {}),
        ...(shift.pollingPlaceId ? { pollingPlaceId: shift.pollingPlaceId } : {}),
      };
    },
  },
  shiftCoverageEmpty: countMetric<ShiftRow>({
    kind: "FIELD_SHIFT", load: loadShifts, zoneOf: (row) => row.electoralZoneId,
    at: (row) => row.startsAt, match: (row) => presentCount(row) === 0,
    toItem: (row) => ({
      id: row.id, kind: "FIELD_SHIFT", title: row.name ?? "Turno", subtitle: row.team.name,
      status: row.status, severity: null, occurredAt: row.startsAt.toISOString(),
      deepLink: deepLink("FIELD_SHIFT", row.id),
      ...(row.electoralZoneId ? { zoneId: row.electoralZoneId } : {}),
      ...(row.pollingPlaceId ? { pollingPlaceId: row.pollingPlaceId } : {}),
    }),
  }),
  dispatchesActive: gaugeMetric<DispatchRow>({
    kind: "FIELD_DISPATCH", load: loadDispatches, zoneOf: (row) => row.electoralZoneId,
    at: (row) => row.requestedAt,
    active: (row, at) => {
      const finishedAt = row.completedAt ?? row.cancelledAt ?? row.rejectedAt;
      if (TERMINAL_DISPATCH_STATUSES.includes(row.status) && finishedAt !== null)
        return finishedAt.getTime() > at.getTime();
      return !TERMINAL_DISPATCH_STATUSES.includes(row.status);
    },
    toItem: (row) => ({
      id: row.id, kind: "FIELD_DISPATCH", title: row.title, subtitle: row.team.name,
      status: row.status, severity: row.priority, occurredAt: row.requestedAt.toISOString(),
      deepLink: deepLink("FIELD_DISPATCH", row.id),
      ...(row.electoralZoneId ? { zoneId: row.electoralZoneId } : {}),
      ...(row.pollingPlaceId ? { pollingPlaceId: row.pollingPlaceId } : {}),
    }),
  }),
  routesDelayed: countMetric<RouteRow>({
    kind: "ROUTE", load: loadRoutes, zoneOf: (row) => row.electoralZoneId,
    at: (row) => row.plannedDeparture,
    match: (row, context) =>
      row.status === "DELAYED" ||
      (!TERMINAL_ROUTE_STATUSES.includes(row.status) &&
        row.actualArrival === null &&
        row.plannedArrival.getTime() < context.end.getTime()),
    toItem: routeRowItem,
  }),
  deliveriesFailed: countMetric<DeliveryRow>({
    kind: "ROUTE", load: loadDeliveries, zoneOf: (row) => row.electoralZoneId,
    at: (row) => row.at, match: (row) => DELIVERY_FAILED.includes(row.status), toItem: routeItem,
  }),
  deliveriesCompleted: countMetric<DeliveryRow>({
    kind: "ROUTE", load: loadDeliveries, zoneOf: (row) => row.electoralZoneId,
    at: (row) => row.at, match: (row) => row.status === "DELIVERED", toItem: routeItem,
  }),
  preparationReady: countMetric<PreparationRow>({
    kind: "PREPARATION_CHECKLIST", load: loadPreparation, zoneOf: (row) => row.electoralZoneId,
    at: (row) => row.updatedAt,
    match: (row) => row.status === "READY_FOR_APPROVAL" || row.status === "APPROVED",
    toItem: preparationItem,
  }),
  preparationBlocked: countMetric<PreparationRow>({
    kind: "PREPARATION_CHECKLIST", load: loadPreparation, zoneOf: (row) => row.electoralZoneId,
    at: (row) => row.updatedAt, match: (row) => row.status === "BLOCKED", toItem: preparationItem,
  }),
  assetsLost: countMetric<AssetRow>({
    kind: "ASSET", load: loadAssets, zoneOf: (row) => row.electoralZoneId,
    at: (row) => row.updatedAt, match: (row) => row.status === "LOST", toItem: assetItem,
  }),
  assetsInMaintenance: countMetric<AssetRow>({
    kind: "ASSET", load: loadAssets, zoneOf: (row) => row.electoralZoneId,
    at: (row) => row.updatedAt, match: (row) => row.status === "MAINTENANCE", toItem: assetItem,
  }),
  assetsUnavailable: countMetric<AssetRow>({
    kind: "ASSET", load: loadAssets, zoneOf: (row) => row.electoralZoneId,
    at: (row) => row.updatedAt,
    match: (row) =>
      ["MAINTENANCE", "LOST", "RETIRED"].includes(row.status) || row.condition === "UNAVAILABLE",
    toItem: assetItem,
  }),
};

export function metricKind(metric: ReportMetric): ReportDeepLinkKind {
  return METRIC_SPECS[metric].kind;
}

/** Serie temporal de uma metrica com eixo continuo e totais do periodo. */
export async function seriesFor(
  prisma: PrismaService,
  metric: ReportMetric,
  scope: ReportsScope,
  granularity: ReportGranularity,
): Promise<ReportSeries> {
  const spec = METRIC_SPECS[metric];
  const rows = await spec.load(prisma, scope);
  const ranges = continuousBucketRanges(scope.from, scope.to, granularity);
  const now = new Date();
  return buildSeries(
    metric,
    granularity,
    scope.from,
    scope.to,
    ranges,
    (range) => spec.point(rows, range, now),
    () => spec.point(rows, { start: scope.from, end: scope.to }, now),
  );
}

/** Agregado do periodo inteiro, usado na comparacao de zonas. */
export async function aggregateFor(
  prisma: PrismaService,
  metric: ReportMetric,
  scope: ReportsScope,
  rows?: readonly unknown[],
): Promise<SeriesPoint> {
  const spec = METRIC_SPECS[metric];
  const loaded = rows ?? (await spec.load(prisma, scope));
  return spec.point(loaded, { start: scope.from, end: scope.to }, new Date());
}

/** Drill-down: entidades do bucket; `total` nunca e truncado (SPEC 2.6). */
export async function drilldownFor(
  prisma: PrismaService,
  metric: ReportMetric,
  scope: ReportsScope,
  range: BucketRange,
  limit: number,
): Promise<DrilldownResult> {
  const spec = METRIC_SPECS[metric];
  const rows = await spec.load(prisma, scope);
  const qualifying = spec.qualifying(rows, range, new Date());
  return {
    metric,
    bucketStart: range.start.toISOString(),
    bucketEnd: range.end.toISOString(),
    total: qualifying.length,
    truncated: qualifying.length > limit,
    items: qualifying.slice(0, limit).map((row) => spec.toItem(row)),
  };
}

/** Carrega as linhas de um dominio uma unica vez para a comparacao de zonas. */
export async function loadMetricRows(
  prisma: PrismaService,
  metric: ReportMetric,
  scope: ReportsScope,
): Promise<readonly unknown[]> {
  return METRIC_SPECS[metric].load(prisma, scope);
}

export function metricZoneOf(metric: ReportMetric, row: unknown): string | null {
  return METRIC_SPECS[metric].zoneOf(row);
}
