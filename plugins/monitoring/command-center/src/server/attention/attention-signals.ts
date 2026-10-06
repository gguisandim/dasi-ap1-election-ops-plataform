import {
  ATTENTION_WEIGHTS,
  OPERATIONAL_THRESHOLDS,
  buildAttentionItem,
  deriveOperationalHealth,
  partitionAttentionItems,
  rankAttentionItems,
  type OperationalAttentionItem,
  type OperationalDeadlineState,
  type OperationalHealth,
  type OperationalMetrics,
  type OperationalSeverity,
  type OperationalStatusState,
} from "@eops/shared/command-center";
import {
  RESOURCE_REQUEST_OPEN_STATUSES,
  deriveUrgency,
  type ResourceRequestStatus,
} from "@eops/shared/resource-requests";

/**
 * Sinais operacionais do Command Center.
 *
 * Este módulo é puro: recebe linhas já carregadas (formato estrutural mínimo) e
 * devolve attention items, métricas e contadores por zona. Toda leitura de banco
 * permanece no serviço, para que as regras abaixo sejam testáveis sem Prisma.
 */

const HOUR_MS = 3_600_000;

export const DEEP_LINKS = {
  incident: (id: string) => `/incidents/${id}`,
  transmission: (id: string) => `/transmission/${id}`,
  shift: (id: string) => `/shifts/${id}`,
  dispatch: (id: string) => `/field-teams/dispatch/${id}`,
  handover: (id: string) => `/shift-handovers/${id}`,
  preparation: (id: string) => `/preparation-checklists/${id}`,
  route: (id: string) => `/routes/${id}`,
  asset: (id: string) => `/inventory/${id}`,
  resourceRequest: (id: string) => `/resource-requests/${id}`,
} as const;

export interface IncidentSignalRow {
  id: string;
  code: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: string;
  electionId: string;
  electoralZoneId: string | null;
  pollingPlaceId: string | null;
  openedAt: Date;
  slaDeadline: Date | null;
  acknowledgedAt: Date | null;
  escalationLevel: number;
}

export interface TransmissionPointSignalRow {
  id: string;
  identification: string;
  status: string;
  connectivity: string;
  priority: number;
  operationalDeadline: Date | null;
  electoralZoneId: string;
  pollingPlaceId: string;
  electionId: string;
  queuedAt: Date | null;
  updatedAt: Date;
}

export interface TransmissionAlertSignalRow {
  id: string;
  pointId: string;
  type: string;
  status: string;
  message: string;
  createdAt: Date;
}

export interface ShiftCoverageSignalRow {
  id: string;
  name: string | null;
  status: string;
  startsAt: Date;
  requiredOperators: number;
  assignedOperators: number;
  electoralZoneId: string | null;
  pollingPlaceId: string | null;
  electionId: string;
}

export interface DispatchSignalRow {
  id: string;
  title: string;
  status: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  requestedAt: Date;
  electoralZoneId: string | null;
  pollingPlaceId: string | null;
  electionId: string;
}

export interface HandoverSignalRow {
  id: string;
  status: string;
  submittedAt: Date | null;
  confirmedAt: Date | null;
  createdAt: Date;
  shiftName: string | null;
  electoralZoneId: string | null;
  pollingPlaceId: string | null;
  electionId: string;
}

export interface PreparationSignalRow {
  id: string;
  status: string;
  dueAt: Date | null;
  pollingPlaceName: string | null;
  blockedRequiredItems: number;
  electoralZoneId: string;
  pollingPlaceId: string;
  electionId: string;
}

export interface RouteSignalRow {
  id: string;
  code: string;
  name: string;
  status: string;
  plannedArrival: Date;
  failedDeliveries: number;
  openExceptions: number;
  electoralZoneId: string;
  electionId: string;
}

export interface AssetSignalRow {
  id: string;
  assetTag: string;
  name: string;
  status: string;
  condition: string;
  openCorrectiveMaintenance: number;
  electoralZoneId: string | null;
  pollingPlaceId: string | null;
}

export interface ResourceRequestSignalRow {
  id: string;
  code: string;
  title: string;
  status: ResourceRequestStatus;
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  neededAt: Date | null;
  createdAt: Date;
  approvedAt: Date | null;
  electoralZoneId: string | null;
  pollingPlaceId: string | null;
  electionId: string;
}

export interface TransmissionSignals {
  points: TransmissionPointSignalRow[];
  alerts: TransmissionAlertSignalRow[];
}

export interface WorkforceSignals {
  shifts: ShiftCoverageSignalRow[];
  dispatches: DispatchSignalRow[];
}

export interface LogisticsSignals {
  routes: RouteSignalRow[];
  assets: AssetSignalRow[];
}

export interface LoadedSignals {
  incidents?: IncidentSignalRow[];
  transmission?: TransmissionSignals;
  workforce?: WorkforceSignals;
  continuity?: HandoverSignalRow[];
  preparation?: PreparationSignalRow[];
  logistics?: LogisticsSignals;
  resourceRequests?: ResourceRequestSignalRow[];
}

export interface ZoneCounters {
  itemCount: number;
  criticalItemCount: number;
  activeIncidents: number;
  transmissionProblems: number;
  coverageEmptyShifts: number;
  waitingDispatches: number;
  preparationBlockers: number;
  routesDelayed: number;
  resourceRequestsOpen: number;
}

export interface AttentionComputation {
  items: OperationalAttentionItem[];
  criticalItems: OperationalAttentionItem[];
  warnings: OperationalAttentionItem[];
  health: OperationalHealth;
  metrics: OperationalMetrics;
  zoneCounters: Map<string, ZoneCounters>;
}

const CLOSED_INCIDENT_STATUSES = new Set(["CLOSED", "CANCELLED"]);

export function emptyMetrics(): OperationalMetrics {
  return {
    totalItems: 0,
    criticalItems: 0,
    warnings: 0,
    activeIncidents: null,
    criticalIncidents: null,
    overdueIncidents: null,
    unacknowledgedIncidents: null,
    transmissionFailures: null,
    transmissionOffline: null,
    transmissionOverdue: null,
    shiftsTotal: null,
    shiftsCoverageEmpty: null,
    shiftsCoverageCritical: null,
    activeDispatches: null,
    waitingDispatches: null,
    pendingHandovers: null,
    oldestPendingHandoverAgeSeconds: null,
    confirmedHandoversToday: null,
    preparationBlocked: null,
    preparationOverdue: null,
    routesDelayed: null,
    routesFailedDeliveries: null,
    assetsLost: null,
    assetsInMaintenance: null,
    resourceRequestsCritical: null,
    resourceRequestsOverdue: null,
    resourceRequestsApprovedUnfulfilled: null,
  };
}

export function emptyZoneCounters(): ZoneCounters {
  return {
    itemCount: 0,
    criticalItemCount: 0,
    activeIncidents: 0,
    transmissionProblems: 0,
    coverageEmptyShifts: 0,
    waitingDispatches: 0,
    preparationBlockers: 0,
    routesDelayed: 0,
    resourceRequestsOpen: 0,
  };
}

/** Deadline derivado de um instante limite opcional. */
export function deadlineFrom(
  dueAt: Date | null | undefined,
  now: Date,
  dueSoonHours: number = OPERATIONAL_THRESHOLDS.dueSoonHours,
): OperationalDeadlineState {
  if (!dueAt) return "NONE";
  const remaining = dueAt.getTime() - now.getTime();
  if (remaining < 0) return "OVERDUE";
  if (remaining <= dueSoonHours * HOUR_MS) return "DUE_SOON";
  return "ON_TRACK";
}

function incidentDeadline(
  row: IncidentSignalRow,
  now: Date,
): OperationalDeadlineState {
  return deadlineFrom(row.slaDeadline, now);
}

export function incidentStatusState(
  row: Pick<
    IncidentSignalRow,
    "status" | "acknowledgedAt" | "escalationLevel" | "slaDeadline"
  >,
  now: Date,
): OperationalStatusState {
  if (row.escalationLevel > 0) return "ESCALATED";
  if (row.status === "NEW" && row.acknowledgedAt === null)
    return "UNACKNOWLEDGED";
  if (row.status === "ASSIGNED" && row.slaDeadline && row.slaDeadline < now)
    return "BLOCKED";
  if (row.status === "TRIAGED" || row.status === "ASSIGNED") return "IN_PROGRESS";
  if (row.status === "IN_PROGRESS") return "IN_PROGRESS";
  if (row.status === "RESOLVED") return "RESOLVED";
  return "WAITING";
}

export function shouldReportIncident(
  row: IncidentSignalRow,
  now: Date,
): boolean {
  if (CLOSED_INCIDENT_STATUSES.has(row.status)) return false;
  if (row.severity === "CRITICAL" || row.severity === "HIGH") return true;
  if (row.slaDeadline && row.slaDeadline < now) return true;
  if (row.acknowledgedAt === null && row.status === "NEW") return true;
  if (row.escalationLevel > 0) return true;
  return false;
}

export function incidentAttentionItems(
  rows: readonly IncidentSignalRow[],
  now: Date,
): OperationalAttentionItem[] {
  return rows.filter((row) => shouldReportIncident(row, now)).map((row) => {
    const severity: OperationalSeverity =
      row.severity === "CRITICAL"
        ? "CRITICAL"
        : row.severity === "HIGH"
          ? "HIGH"
          : row.severity;
    return buildAttentionItem(
      {
        sourceType: "INCIDENT",
        sourceId: row.id,
        title: `${row.code}: ${row.title}`,
        summary:
          row.slaDeadline && row.slaDeadline < now
            ? "Prazo de atendimento vencido."
            : row.acknowledgedAt === null
              ? "Incidente ainda não reconhecido."
              : "Incidente ativo exige acompanhamento.",
        severity,
        status: row.status,
        statusState: incidentStatusState(row, now),
        deadlineState: incidentDeadline(row, now),
        impactWeight:
          row.severity === "CRITICAL"
            ? ATTENTION_WEIGHTS.impact.incidentCritical
            : ATTENTION_WEIGHTS.impact.default,
        occurredAt: row.openedAt,
        deepLink: DEEP_LINKS.incident(row.id),
        electionId: row.electionId,
        electoralZoneId: row.electoralZoneId,
        pollingPlaceId: row.pollingPlaceId,
        metadata: { severity: row.severity, escalationLevel: row.escalationLevel },
      },
      now,
    );
  });
}

export function transmissionAttentionItems(
  input: TransmissionSignals,
  now: Date,
): OperationalAttentionItem[] {
  const pointsById = new Map(input.points.map((point) => [point.id, point]));
  const items: OperationalAttentionItem[] = [];

  for (const point of input.points) {
    const offline = point.connectivity === "OFFLINE";
    const failed = point.status === "FAILED" || point.status === "OFFLINE";
    const overdue = Boolean(
      point.operationalDeadline &&
        point.operationalDeadline < now &&
        point.status !== "SUCCESS",
    );
    if (!offline && !failed && !overdue) continue;
    items.push(
      buildAttentionItem(
        {
          sourceType: "TRANSMISSION",
          sourceId: point.id,
          title: `Ponto ${point.identification}`,
          summary: overdue
            ? "Prazo operacional de transmissão vencido."
            : offline
              ? "Ponto sem conectividade."
              : point.status === "FAILED"
                ? "Última transmissão falhou."
                : "Transmissão fora do estado esperado.",
          severity: overdue ? "CRITICAL" : "HIGH",
          status: point.status,
          statusState: overdue ? "BLOCKED" : "WAITING",
          deadlineState: overdue
            ? "OVERDUE"
            : deadlineFrom(point.operationalDeadline, now),
          impactWeight:
            point.priority <= 2
              ? ATTENTION_WEIGHTS.impact.transmissionPriority
              : ATTENTION_WEIGHTS.impact.default,
          occurredAt: point.queuedAt ?? point.updatedAt,
          deepLink: DEEP_LINKS.transmission(point.id),
          electionId: point.electionId,
          electoralZoneId: point.electoralZoneId,
          pollingPlaceId: point.pollingPlaceId,
          metadata: { connectivity: point.connectivity, priority: point.priority },
        },
        now,
      ),
    );
  }

  const alertTypes = new Set([
    "REPEATED_FAILURE",
    "POINT_OFFLINE",
    "TOO_MANY_ATTEMPTS",
    "TRANSMISSION_DELAYED",
  ]);
  for (const alert of input.alerts) {
    if (alert.status !== "OPEN" || !alertTypes.has(alert.type)) continue;
    const point = pointsById.get(alert.pointId);
    if (!point) continue;
    items.push(
      buildAttentionItem(
        {
          sourceType: "TRANSMISSION",
          sourceId: alert.id,
          title: `Alerta: ${point.identification}`,
          summary: alert.message,
          severity: "HIGH",
          status: alert.status,
          statusState: "WAITING",
          deadlineState: deadlineFrom(point.operationalDeadline, now),
          impactWeight:
            point.priority <= 2
              ? ATTENTION_WEIGHTS.impact.transmissionPriority
              : ATTENTION_WEIGHTS.impact.default,
          occurredAt: alert.createdAt,
          deepLink: DEEP_LINKS.transmission(point.id),
          electionId: point.electionId,
          electoralZoneId: point.electoralZoneId,
          pollingPlaceId: point.pollingPlaceId,
          metadata: { alertType: alert.type, pointId: point.id },
        },
        now,
      ),
    );
  }

  return items;
}

export function shiftCoverageAttentionItems(
  shifts: readonly ShiftCoverageSignalRow[],
  now: Date,
): OperationalAttentionItem[] {
  return shifts
    .filter(
      (shift) =>
        shift.status === "SCHEDULED" &&
        shift.assignedOperators < shift.requiredOperators &&
        shift.startsAt.getTime() - now.getTime() <=
          OPERATIONAL_THRESHOLDS.dueSoonHours * HOUR_MS,
    )
    .map((shift) => {
      const empty = shift.assignedOperators === 0;
      return buildAttentionItem(
        {
          sourceType: "SHIFT_COVERAGE",
          sourceId: shift.id,
          title: `Cobertura: ${shift.name ?? "turno"}`,
          summary: `${shift.assignedOperators}/${shift.requiredOperators} operadores designados.`,
          severity: "HIGH",
          status: shift.status,
          statusState: empty ? "BLOCKED" : "WAITING",
          deadlineState: deadlineFrom(
            shift.startsAt,
            now,
            OPERATIONAL_THRESHOLDS.coverageDueSoonHours,
          ),
          impactWeight: empty
            ? ATTENTION_WEIGHTS.impact.coverageEmpty
            : ATTENTION_WEIGHTS.impact.coveragePartial,
          occurredAt: shift.startsAt,
          deepLink: DEEP_LINKS.shift(shift.id),
          electionId: shift.electionId,
          electoralZoneId: shift.electoralZoneId,
          pollingPlaceId: shift.pollingPlaceId,
          metadata: {
            assignedOperators: shift.assignedOperators,
            requiredOperators: shift.requiredOperators,
          },
        },
        now,
      );
    });
}

const DISPATCH_ACTIVE = new Set([
  "REQUESTED",
  "DISPATCHED",
  "ACCEPTED",
  "EN_ROUTE",
  "ARRIVED",
  "IN_PROGRESS",
]);

export function dispatchAttentionItems(
  dispatches: readonly DispatchSignalRow[],
  now: Date,
): OperationalAttentionItem[] {
  return dispatches
    .filter(
      (dispatch) =>
        DISPATCH_ACTIVE.has(dispatch.status) &&
        (dispatch.priority === "HIGH" || dispatch.priority === "CRITICAL"),
    )
    .map((dispatch) =>
      buildAttentionItem(
        {
          sourceType: "FIELD_DISPATCH",
          sourceId: dispatch.id,
          title: `Dispatch: ${dispatch.title}`,
          summary:
            dispatch.status === "REQUESTED" || dispatch.status === "DISPATCHED"
              ? "Demanda aguardando aceite da equipe."
              : "Demanda em execução no campo.",
          severity: "HIGH",
          status: dispatch.status,
          statusState:
            dispatch.status === "REQUESTED" || dispatch.status === "DISPATCHED"
              ? "WAITING"
              : "IN_PROGRESS",
          deadlineState: "NONE",
          occurredAt: dispatch.requestedAt,
          deepLink: DEEP_LINKS.dispatch(dispatch.id),
          electionId: dispatch.electionId,
          electoralZoneId: dispatch.electoralZoneId,
          pollingPlaceId: dispatch.pollingPlaceId,
          metadata: { priority: dispatch.priority },
        },
        now,
      ),
    );
}

export function handoverAttentionItems(
  handovers: readonly HandoverSignalRow[],
  now: Date,
): OperationalAttentionItem[] {
  return handovers
    .filter((handover) => handover.status === "PENDING_CONFIRMATION")
    .map((handover) => {
      const occurredAt = handover.submittedAt ?? handover.createdAt;
      const ageHours = (now.getTime() - occurredAt.getTime()) / HOUR_MS;
      const old = ageHours >= OPERATIONAL_THRESHOLDS.oldPendingHandoverHours;
      return buildAttentionItem(
        {
          sourceType: "SHIFT_HANDOVER",
          sourceId: handover.id,
          title: `Passagem pendente: ${handover.shiftName ?? "turno"}`,
          summary: old
            ? "Passagem aguardando confirmação há mais de 24 horas."
            : "Passagem aguardando confirmação do destinatário.",
          severity: old ? "HIGH" : "MEDIUM",
          status: handover.status,
          statusState: "WAITING",
          deadlineState: old ? "OVERDUE" : "ON_TRACK",
          occurredAt,
          deepLink: DEEP_LINKS.handover(handover.id),
          electionId: handover.electionId,
          electoralZoneId: handover.electoralZoneId,
          pollingPlaceId: handover.pollingPlaceId,
          metadata: { pendingHours: Math.floor(ageHours) },
        },
        now,
      );
    });
}

const PREPARATION_OPEN = new Set(["PENDING", "IN_PROGRESS", "READY_FOR_APPROVAL"]);

export function preparationAttentionItems(
  rows: readonly PreparationSignalRow[],
  now: Date,
): OperationalAttentionItem[] {
  return rows
    .filter((row) => {
      if (row.status === "BLOCKED") return true;
      if (row.blockedRequiredItems > 0) return true;
      if (!row.dueAt) return false;
      if (!PREPARATION_OPEN.has(row.status)) return false;
      return deadlineFrom(row.dueAt, now) !== "ON_TRACK";
    })
    .map((row) => {
      const blocked = row.status === "BLOCKED" || row.blockedRequiredItems > 0;
      const overdue = Boolean(row.dueAt && row.dueAt < now);
      return buildAttentionItem(
        {
          sourceType: "PREPARATION",
          sourceId: row.id,
          title: `Preparação: ${row.pollingPlaceName ?? "local"}`,
          summary: blocked
            ? `${row.blockedRequiredItems} item(ns) obrigatório(s) bloqueado(s).`
            : overdue
              ? "Checklist de preparação vencido."
              : "Checklist próximo do prazo.",
          severity: blocked ? "CRITICAL" : overdue ? "HIGH" : "MEDIUM",
          status: row.status,
          statusState: blocked ? "BLOCKED" : "WAITING",
          deadlineState: deadlineFrom(row.dueAt, now),
          impactWeight: blocked
            ? ATTENTION_WEIGHTS.impact.preparationBlocked
            : ATTENTION_WEIGHTS.impact.default,
          occurredAt: row.dueAt ?? now,
          deepLink: DEEP_LINKS.preparation(row.id),
          electionId: row.electionId,
          electoralZoneId: row.electoralZoneId,
          pollingPlaceId: row.pollingPlaceId,
          metadata: {
            blockedRequiredItems: row.blockedRequiredItems,
            dueAt: row.dueAt ? row.dueAt.toISOString() : null,
          },
        },
        now,
      );
    });
}

export function routeAttentionItems(
  rows: readonly RouteSignalRow[],
  now: Date,
): OperationalAttentionItem[] {
  return rows
    .filter(
      (row) =>
        row.status === "DELAYED" ||
        row.failedDeliveries > 0 ||
        row.openExceptions > 0,
    )
    .map((row) => {
      const delayed = row.status === "DELAYED";
      const failed = row.failedDeliveries > 0;
      return buildAttentionItem(
        {
          sourceType: "ROUTE",
          sourceId: row.id,
          title: `Rota ${row.code}`,
          summary: failed
            ? `${row.failedDeliveries} entrega(s) com falha registrada(s).`
            : delayed
              ? "Rota atrasada em relação ao plano."
              : `${row.openExceptions} exceção(ões) logística(s) aberta(s).`,
          severity: failed && delayed ? "CRITICAL" : "HIGH",
          status: row.status,
          statusState: delayed ? "BLOCKED" : "WAITING",
          deadlineState: delayed
            ? "OVERDUE"
            : deadlineFrom(row.plannedArrival, now),
          impactWeight: failed
            ? ATTENTION_WEIGHTS.impact.routeFailed
            : ATTENTION_WEIGHTS.impact.default,
          occurredAt: row.plannedArrival,
          deepLink: DEEP_LINKS.route(row.id),
          electionId: row.electionId,
          electoralZoneId: row.electoralZoneId,
          pollingPlaceId: null,
          metadata: {
            failedDeliveries: row.failedDeliveries,
            openExceptions: row.openExceptions,
          },
        },
        now,
      );
    });
}

export function assetAttentionItems(
  rows: readonly AssetSignalRow[],
  now: Date,
): OperationalAttentionItem[] {
  return rows
    .filter(
      (row) =>
        row.status === "LOST" ||
        row.condition === "UNAVAILABLE" ||
        row.openCorrectiveMaintenance > 0,
    )
    .map((row) => {
      const lost = row.status === "LOST";
      return buildAttentionItem(
        {
          sourceType: "ASSET",
          sourceId: row.id,
          title: `Ativo ${row.assetTag}`,
          summary: lost
            ? "Ativo marcado como perdido."
            : row.condition === "UNAVAILABLE"
              ? "Ativo indisponível para a operação."
              : `${row.openCorrectiveMaintenance} manutenção(ões) corretiva(s) aberta(s).`,
          severity: lost ? "CRITICAL" : "MEDIUM",
          status: row.status,
          statusState: lost ? "BLOCKED" : "WAITING",
          deadlineState: "NONE",
          impactWeight: lost
            ? ATTENTION_WEIGHTS.impact.assetLost
            : ATTENTION_WEIGHTS.impact.default,
          occurredAt: now,
          deepLink: DEEP_LINKS.asset(row.id),
          electionId: null,
          electoralZoneId: row.electoralZoneId,
          pollingPlaceId: row.pollingPlaceId,
          metadata: {
            condition: row.condition,
            openCorrectiveMaintenance: row.openCorrectiveMaintenance,
          },
        },
        now,
      );
    });
}

export function resourceRequestAttentionItems(
  rows: readonly ResourceRequestSignalRow[],
  now: Date,
): OperationalAttentionItem[] {
  return rows
    .filter((row) => RESOURCE_REQUEST_OPEN_STATUSES.includes(row.status))
    .map((row) => {
      const urgency = deriveUrgency({
        status: row.status,
        neededAt: row.neededAt,
        now,
      });
      const critical = row.priority === "CRITICAL";
      const overdue = urgency === "OVERDUE";
      const approvedUnfulfilled =
        row.status === "APPROVED" &&
        Boolean(row.neededAt && row.neededAt.getTime() - now.getTime() <= 4 * HOUR_MS);
      if (!critical && !overdue && !approvedUnfulfilled) return null;
      return buildAttentionItem(
        {
          sourceType: "RESOURCE_REQUEST",
          sourceId: row.id,
          title: `${row.code}: ${row.title}`,
          summary: overdue
            ? "Necessidade operacional vencida sem atendimento completo."
            : critical
              ? "Solicitação crítica em andamento."
              : "Aprovada e ainda sem atendimento próximo do prazo.",
          severity: overdue || critical ? "CRITICAL" : "HIGH",
          status: row.status,
          statusState: overdue ? "BLOCKED" : "IN_PROGRESS",
          deadlineState: overdue
            ? "OVERDUE"
            : deadlineFrom(row.neededAt, now),
          impactWeight: critical
            ? ATTENTION_WEIGHTS.impact.requestCritical
            : ATTENTION_WEIGHTS.impact.default,
          occurredAt: row.approvedAt ?? row.createdAt,
          deepLink: DEEP_LINKS.resourceRequest(row.id),
          electionId: row.electionId,
          electoralZoneId: row.electoralZoneId,
          pollingPlaceId: row.pollingPlaceId,
          metadata: { priority: row.priority, urgency },
        },
        now,
      );
    })
    .filter((item): item is OperationalAttentionItem => item !== null);
}

function bumpZone(
  counters: Map<string, ZoneCounters>,
  zoneId: string | null,
  mutate: (value: ZoneCounters) => void,
): void {
  if (!zoneId) return;
  const current = counters.get(zoneId) ?? emptyZoneCounters();
  mutate(current);
  counters.set(zoneId, current);
}

function registerItem(
  counters: Map<string, ZoneCounters>,
  item: OperationalAttentionItem,
): void {
  bumpZone(counters, item.electoralZoneId ?? null, (value) => {
    value.itemCount += 1;
    if (item.severity === "CRITICAL" || item.deadlineState === "OVERDUE")
      value.criticalItemCount += 1;
  });
}

/**
 * Calcula o estado agregado a partir das seções efetivamente carregadas.
 * Seções ausentes permanecem `null` nas métricas — nunca são estimadas.
 */
export function computeAttention(input: {
  loaded: LoadedSignals;
  now: Date;
}): AttentionComputation {
  const { loaded, now } = input;
  const metrics = emptyMetrics();
  const zoneCounters = new Map<string, ZoneCounters>();
  const items: OperationalAttentionItem[] = [];
  const push = (next: OperationalAttentionItem[]) => {
    for (const item of next) {
      items.push(item);
      registerItem(zoneCounters, item);
    }
  };

  if (loaded.incidents) {
    const active = loaded.incidents.filter(
      (row) => !CLOSED_INCIDENT_STATUSES.has(row.status),
    );
    metrics.activeIncidents = active.length;
    metrics.criticalIncidents = active.filter(
      (row) => row.severity === "CRITICAL",
    ).length;
    metrics.overdueIncidents = active.filter(
      (row) => row.slaDeadline !== null && row.slaDeadline < now,
    ).length;
    metrics.unacknowledgedIncidents = active.filter(
      (row) => row.acknowledgedAt === null,
    ).length;
    for (const row of active) {
      bumpZone(zoneCounters, row.electoralZoneId, (value) => {
        value.activeIncidents += 1;
      });
    }
    push(incidentAttentionItems(loaded.incidents, now));
  }

  if (loaded.transmission) {
    const { points } = loaded.transmission;
    metrics.transmissionFailures = points.filter(
      (point) => point.status === "FAILED",
    ).length;
    metrics.transmissionOffline = points.filter(
      (point) => point.connectivity === "OFFLINE",
    ).length;
    metrics.transmissionOverdue = points.filter(
      (point) =>
        point.operationalDeadline !== null &&
        point.operationalDeadline < now &&
        point.status !== "SUCCESS",
    ).length;
    const problemPoints = points.filter(
      (point) =>
        point.status === "FAILED" ||
        point.status === "OFFLINE" ||
        point.connectivity === "OFFLINE" ||
        (point.operationalDeadline !== null &&
          point.operationalDeadline < now &&
          point.status !== "SUCCESS"),
    );
    for (const point of problemPoints) {
      bumpZone(zoneCounters, point.electoralZoneId, (value) => {
        value.transmissionProblems += 1;
      });
    }
    push(transmissionAttentionItems(loaded.transmission, now));
  }

  if (loaded.workforce) {
    const { shifts, dispatches } = loaded.workforce;
    metrics.shiftsTotal = shifts.length;
    metrics.shiftsCoverageEmpty = shifts.filter(
      (shift) =>
        shift.status === "SCHEDULED" && shift.assignedOperators === 0,
    ).length;
    metrics.shiftsCoverageCritical = shifts.filter(
      (shift) =>
        shift.status === "SCHEDULED" &&
        shift.assignedOperators > 0 &&
        shift.assignedOperators < shift.requiredOperators,
    ).length;
    for (const shift of shifts) {
      if (
        shift.status === "SCHEDULED" &&
        shift.assignedOperators === 0
      ) {
        bumpZone(zoneCounters, shift.electoralZoneId, (value) => {
          value.coverageEmptyShifts += 1;
        });
      }
    }
    const activeDispatches = dispatches.filter((dispatch) =>
      DISPATCH_ACTIVE.has(dispatch.status),
    );
    metrics.activeDispatches = activeDispatches.length;
    metrics.waitingDispatches = activeDispatches.filter(
      (dispatch) =>
        dispatch.status === "REQUESTED" || dispatch.status === "DISPATCHED",
    ).length;
    for (const dispatch of activeDispatches) {
      if (
        dispatch.status === "REQUESTED" ||
        dispatch.status === "DISPATCHED"
      ) {
        bumpZone(zoneCounters, dispatch.electoralZoneId, (value) => {
          value.waitingDispatches += 1;
        });
      }
    }
    push(shiftCoverageAttentionItems(shifts, now));
    push(dispatchAttentionItems(dispatches, now));
  }

  if (loaded.continuity) {
    const pending = loaded.continuity.filter(
      (handover) => handover.status === "PENDING_CONFIRMATION",
    );
    metrics.pendingHandovers = pending.length;
    metrics.oldestPendingHandoverAgeSeconds = pending.reduce((oldest, row) => {
      const age = Math.floor(
        (now.getTime() - (row.submittedAt ?? row.createdAt).getTime()) / 1000,
      );
      return Math.max(oldest, Math.max(0, age));
    }, 0);
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    metrics.confirmedHandoversToday = loaded.continuity.filter(
      (handover) =>
        handover.status === "CONFIRMED" &&
        handover.confirmedAt !== null &&
        handover.confirmedAt >= startOfDay,
    ).length;
    push(handoverAttentionItems(loaded.continuity, now));
  }

  if (loaded.preparation) {
    metrics.preparationBlocked = loaded.preparation.filter(
      (row) => row.status === "BLOCKED" || row.blockedRequiredItems > 0,
    ).length;
    metrics.preparationOverdue = loaded.preparation.filter(
      (row) =>
        row.dueAt !== null &&
        row.dueAt < now &&
        PREPARATION_OPEN.has(row.status),
    ).length;
    for (const row of loaded.preparation) {
      if (row.status === "BLOCKED" || row.blockedRequiredItems > 0) {
        bumpZone(zoneCounters, row.electoralZoneId, (value) => {
          value.preparationBlockers += 1;
        });
      }
    }
    push(preparationAttentionItems(loaded.preparation, now));
  }

  if (loaded.logistics) {
    const { routes, assets } = loaded.logistics;
    metrics.routesDelayed = routes.filter((row) => row.status === "DELAYED").length;
    metrics.routesFailedDeliveries = routes.reduce(
      (total, row) => total + row.failedDeliveries,
      0,
    );
    metrics.assetsLost = assets.filter((row) => row.status === "LOST").length;
    metrics.assetsInMaintenance = assets.filter(
      (row) => row.status === "MAINTENANCE",
    ).length;
    for (const route of routes) {
      if (route.status === "DELAYED") {
        bumpZone(zoneCounters, route.electoralZoneId, (value) => {
          value.routesDelayed += 1;
        });
      }
    }
    push(routeAttentionItems(routes, now));
    push(assetAttentionItems(assets, now));
  }

  if (loaded.resourceRequests) {
    const open = loaded.resourceRequests.filter((row) =>
      RESOURCE_REQUEST_OPEN_STATUSES.includes(row.status),
    );
    metrics.resourceRequestsCritical = open.filter(
      (row) => row.priority === "CRITICAL",
    ).length;
    metrics.resourceRequestsOverdue = open.filter(
      (row) => deriveUrgency({ status: row.status, neededAt: row.neededAt, now }) === "OVERDUE",
    ).length;
    metrics.resourceRequestsApprovedUnfulfilled = open.filter(
      (row) => row.status === "APPROVED",
    ).length;
    for (const row of open) {
      bumpZone(zoneCounters, row.electoralZoneId, (value) => {
        value.resourceRequestsOpen += 1;
      });
    }
    push(resourceRequestAttentionItems(loaded.resourceRequests, now));
  }

  const ranked = rankAttentionItems(items);
  const { criticalItems, warnings } = partitionAttentionItems(ranked);
  metrics.totalItems = ranked.length;
  metrics.criticalItems = criticalItems.length;
  metrics.warnings = warnings.length;

  return {
    items: ranked,
    criticalItems,
    warnings,
    health: deriveOperationalHealth(ranked),
    metrics,
    zoneCounters,
  };
}

export function zoneHealthFromCounters(
  counters: ZoneCounters,
  criticalItemCount: number,
): OperationalHealth {
  if (counters.itemCount === 0) return "NORMAL";
  return criticalItemCount > 0 ? "CRITICAL" : "ATTENTION";
}
