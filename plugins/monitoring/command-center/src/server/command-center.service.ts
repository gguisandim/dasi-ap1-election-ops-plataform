import { Injectable } from "@nestjs/common";
import {
  AssetMaintenanceStatus,
  AssetMaintenanceType,
  AssetStatus,
  FieldDispatchStatus,
  FieldShiftStatus,
  IncidentStatus,
  ResourceRequestStatus,
  RouteStatus,
  ShiftHandoverStatus,
  TransmissionAlertStatus,
  TransmissionStatus,
} from "@prisma/client";
import { PrismaService } from "@eops/database";
import { PERMISSIONS } from "@eops/security";
import { isOperationalShiftAssignment } from "@eops/shared/workforce";
import {
  RESOURCE_REQUEST_OPEN_STATUSES,
  type ResourceRequestStatus as SharedResourceRequestStatus,
} from "@eops/shared/resource-requests";
import {
  OPERATIONAL_THRESHOLDS,
  type OperationalScope,
  type OperationalSectionKey,
  type OperationalSectionState,
  type OperationalSummary,
  type OperationalZoneSituation,
} from "@eops/shared/command-center";
import {
  computeAttention,
  emptyZoneCounters,
  type AttentionComputation,
  type LoadedSignals,
} from "./attention/attention-signals";

const HOUR_MS = 3_600_000;

/** Limite defensivo por domínio: o feed devolve no máximo 100 itens. */
const ROW_LIMIT = 500;

const ACTIVE_INCIDENT_STATUSES: IncidentStatus[] = [
  IncidentStatus.NEW,
  IncidentStatus.TRIAGED,
  IncidentStatus.ASSIGNED,
  IncidentStatus.IN_PROGRESS,
];

const ACTIVE_DISPATCH_STATUSES: FieldDispatchStatus[] = [
  FieldDispatchStatus.REQUESTED,
  FieldDispatchStatus.DISPATCHED,
  FieldDispatchStatus.ACCEPTED,
  FieldDispatchStatus.EN_ROUTE,
  FieldDispatchStatus.ARRIVED,
  FieldDispatchStatus.IN_PROGRESS,
];

const OPEN_PREPARATION_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "READY_FOR_APPROVAL",
  "BLOCKED",
] as const;

const OPEN_ROUTE_STATUSES: RouteStatus[] = [
  RouteStatus.PLANNED,
  RouteStatus.READY,
  RouteStatus.DISPATCHED,
  RouteStatus.IN_PROGRESS,
  RouteStatus.DELAYED,
];

const OPEN_TRANSMISSION_ALERT_TYPES = [
  "REPEATED_FAILURE",
  "POINT_OFFLINE",
  "TRANSMISSION_DELAYED",
  "TOO_MANY_ATTEMPTS",
] as const;

export function sectionState<T>(
  available: boolean,
  data: T,
): OperationalSectionState<T> {
  return available
    ? { available: true, data }
    : { available: false, reason: "FORBIDDEN" };
}

export interface DomainAvailability {
  incidents: boolean;
  transmission: boolean;
  shifts: boolean;
  dispatches: boolean;
  continuity: boolean;
  preparation: boolean;
  routes: boolean;
  assets: boolean;
  resourceRequests: boolean;
}

export function domainAvailability(
  permissions: readonly string[],
): DomainAvailability {
  const granted = new Set(permissions);
  return {
    incidents: granted.has(PERMISSIONS.incidents.read),
    transmission: granted.has(PERMISSIONS.transmission.read),
    shifts: granted.has(PERMISSIONS.shifts.read),
    dispatches: granted.has(PERMISSIONS.fieldTeams.read),
    continuity: granted.has(PERMISSIONS.shiftHandovers.read),
    preparation: granted.has(PERMISSIONS.preparationChecklists.read),
    routes: granted.has(PERMISSIONS.routes.read),
    assets: granted.has(PERMISSIONS.inventory.read),
    resourceRequests: granted.has(PERMISSIONS.resourceRequests.read),
  };
}

interface AggregateResult {
  now: Date;
  loaded: LoadedSignals;
  allowed: DomainAvailability;
  sections: Record<OperationalSectionKey, OperationalSectionState<unknown>>;
  computation: AttentionComputation;
}

@Injectable()
export class CommandCenterService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Monta o resumo operacional em uma única passada de leitura. Cada seção só é
   * consultada quando o ator possui a permissão de leitura do domínio de
   * origem: sem permissão a seção nem é carregada, então nada vaza por contagem.
   */
  async summary(
    permissions: readonly string[],
    scope: OperationalScope = {},
  ): Promise<OperationalSummary> {
    const aggregate = await this.aggregate(permissions, scope);
    return {
      generatedAt: aggregate.now.toISOString(),
      scope,
      health: aggregate.computation.health,
      metrics: aggregate.computation.metrics,
      criticalItems: aggregate.computation.criticalItems,
      warnings: aggregate.computation.warnings,
      sections: aggregate.sections,
    };
  }

  async attention(
    permissions: readonly string[],
    scope: OperationalScope = {},
  ) {
    const aggregate = await this.aggregate(permissions, scope);
    return {
      generatedAt: aggregate.now.toISOString(),
      health: aggregate.computation.health,
      metrics: aggregate.computation.metrics,
      criticalItems: aggregate.computation.criticalItems,
      warnings: aggregate.computation.warnings,
      sections: aggregate.sections,
    };
  }

  async zones(
    permissions: readonly string[],
    scope: OperationalScope = {},
  ): Promise<{
    generatedAt: string;
    health: OperationalSummary["health"];
    zones: OperationalZoneSituation[];
  }> {
    const aggregate = await this.aggregate(permissions, scope);
    const zoneList = await this.prisma.electoralZone.findMany({
      where: {
        electionId: scope.electionId,
        id: scope.electoralZoneId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        number: true,
        name: true,
        municipality: true,
        state: true,
      },
      orderBy: { number: "asc" },
    });

    const { allowed, computation } = aggregate;
    const situations: OperationalZoneSituation[] = zoneList.map((zone) => {
      const counters = computation.zoneCounters.get(zone.id) ?? emptyZoneCounters();
      return {
        zoneId: zone.id,
        zoneNumber: zone.number,
        zoneName: zone.name,
        municipality: zone.municipality,
        state: zone.state,
        health:
          counters.itemCount === 0
            ? "NORMAL"
            : counters.criticalItemCount > 0
              ? "CRITICAL"
              : "ATTENTION",
        itemCount: counters.itemCount,
        criticalItemCount: counters.criticalItemCount,
        activeIncidents: allowed.incidents ? counters.activeIncidents : null,
        transmissionProblems: allowed.transmission
          ? counters.transmissionProblems
          : null,
        coverageEmptyShifts: allowed.shifts
          ? counters.coverageEmptyShifts
          : null,
        waitingDispatches: allowed.dispatches
          ? counters.waitingDispatches
          : null,
        preparationBlockers: allowed.preparation
          ? counters.preparationBlockers
          : null,
        routesDelayed: allowed.routes ? counters.routesDelayed : null,
        resourceRequestsOpen: allowed.resourceRequests
          ? counters.resourceRequestsOpen
          : null,
      };
    });

    const healthRank = { CRITICAL: 0, ATTENTION: 1, NORMAL: 2 } as const;
    situations.sort((left, right) => {
      if (healthRank[left.health] !== healthRank[right.health])
        return healthRank[left.health] - healthRank[right.health];
      if (left.criticalItemCount !== right.criticalItemCount)
        return right.criticalItemCount - left.criticalItemCount;
      if (left.itemCount !== right.itemCount)
        return right.itemCount - left.itemCount;
      return left.zoneNumber - right.zoneNumber;
    });

    return {
      generatedAt: aggregate.now.toISOString(),
      health: computation.health,
      zones: situations,
    };
  }

  async workforce(permissions: readonly string[], scope: OperationalScope = {}) {
    const allowed = domainAvailability(permissions);
    if (!allowed.shifts && !allowed.dispatches) {
      return {
        available: false as const,
        reason: "FORBIDDEN" as const,
        shifts: null,
        dispatches: null,
      };
    }
    const { shifts, dispatches } = await this.loadWorkforce(
      scope,
      new Date(),
      allowed,
    );
    return {
      available: true as const,
      shifts: allowed.shifts
        ? {
            total: shifts.length,
            coverageEmpty: shifts.filter((shift) => shift.assignedOperators === 0)
              .length,
            coverageCritical: shifts.filter(
              (shift) =>
                shift.assignedOperators > 0 &&
                shift.assignedOperators < shift.requiredOperators,
            ).length,
          }
        : null,
      dispatches: allowed.dispatches
        ? {
            active: dispatches.length,
            waiting: dispatches.filter(
              (dispatch) =>
                dispatch.status === FieldDispatchStatus.REQUESTED ||
                dispatch.status === FieldDispatchStatus.DISPATCHED,
            ).length,
          }
        : null,
    };
  }

  async logistics(permissions: readonly string[], scope: OperationalScope = {}) {
    const allowed = domainAvailability(permissions);
    if (!allowed.routes && !allowed.assets) {
      return {
        available: false as const,
        reason: "FORBIDDEN" as const,
        routes: null,
        assets: null,
      };
    }
    const { routes, assets } = await this.loadLogistics(scope, allowed);
    return {
      available: true as const,
      routes: allowed.routes
        ? {
            delayed: routes.filter((route) => route.status === "DELAYED").length,
            failedDeliveries: routes.reduce(
              (total, route) => total + route.failedDeliveries,
              0,
            ),
            openExceptions: routes.reduce(
              (total, route) => total + route.openExceptions,
              0,
            ),
          }
        : null,
      assets: allowed.assets
        ? {
            lost: assets.filter((asset) => asset.status === "LOST").length,
            inMaintenance: assets.filter(
              (asset) => asset.status === "MAINTENANCE",
            ).length,
            unavailable: assets.filter(
              (asset) => asset.condition === "UNAVAILABLE",
            ).length,
          }
        : null,
    };
  }

  async continuity(
    permissions: readonly string[],
    scope: OperationalScope = {},
  ) {
    if (!permissions.includes(PERMISSIONS.shiftHandovers.read)) {
      return { available: false as const, reason: "FORBIDDEN" as const };
    }
    const now = new Date();
    const rows = await this.loadContinuity(scope, now);
    const pending = rows.filter(
      (row) => row.status === ShiftHandoverStatus.PENDING_CONFIRMATION,
    );
    const oldest = pending.reduce((value, row) => {
      const age = Math.floor(
        (now.getTime() - (row.submittedAt ?? row.createdAt).getTime()) / 1000,
      );
      return Math.max(value, Math.max(0, age));
    }, 0);
    const oldThreshold = OPERATIONAL_THRESHOLDS.oldPendingHandoverHours * HOUR_MS;
    return {
      available: true as const,
      pending: pending.length,
      oldPending: pending.filter(
        (row) =>
          now.getTime() - (row.submittedAt ?? row.createdAt).getTime() >=
          oldThreshold,
      ).length,
      oldestPendingAgeSeconds: oldest,
      recentlyConfirmed: rows
        .filter((row) => row.status === ShiftHandoverStatus.CONFIRMED)
        .sort(
          (left, right) =>
            (right.confirmedAt?.getTime() ?? 0) -
            (left.confirmedAt?.getTime() ?? 0),
        )
        .slice(0, 5)
        .map((row) => ({
          id: row.id,
          shiftName: row.shiftName,
          confirmedAt: row.confirmedAt?.toISOString() ?? null,
        })),
    };
  }

  private async aggregate(
    permissions: readonly string[],
    scope: OperationalScope,
  ): Promise<AggregateResult> {
    const now = new Date();
    const allowed = domainAvailability(permissions);
    const loaded: LoadedSignals = {};
    const sections = {
      incidents: sectionState(allowed.incidents, { items: 0 }),
      transmission: sectionState(allowed.transmission, { points: 0, alerts: 0 }),
      workforce: sectionState(allowed.shifts || allowed.dispatches, {
        shifts: 0,
        dispatches: 0,
      }),
      continuity: sectionState(allowed.continuity, { pending: 0 }),
      preparation: sectionState(allowed.preparation, { checklists: 0 }),
      logistics: sectionState(allowed.routes || allowed.assets, {
        routes: 0,
        assets: 0,
      }),
      resourceRequests: sectionState(allowed.resourceRequests, { open: 0 }),
    } satisfies Record<OperationalSectionKey, OperationalSectionState<unknown>>;

    await Promise.all([
      allowed.incidents
        ? this.loadIncidents(scope).then((rows) => {
            loaded.incidents = rows;
            sections.incidents = sectionState(true, { items: rows.length });
          })
        : null,
      allowed.transmission
        ? this.loadTransmission(scope, now).then((value) => {
            loaded.transmission = value;
            sections.transmission = sectionState(true, {
              points: value.points.length,
              alerts: value.alerts.length,
            });
          })
        : null,
      allowed.shifts || allowed.dispatches
        ? this.loadWorkforce(scope, now, allowed).then((value) => {
            loaded.workforce = value;
            sections.workforce = sectionState(true, {
              shifts: value.shifts.length,
              dispatches: value.dispatches.length,
            });
          })
        : null,
      allowed.continuity
        ? this.loadContinuity(scope, now).then((rows) => {
            loaded.continuity = rows;
            sections.continuity = sectionState(true, { pending: rows.length });
          })
        : null,
      allowed.preparation
        ? this.loadPreparation(scope).then((rows) => {
            loaded.preparation = rows;
            sections.preparation = sectionState(true, {
              checklists: rows.length,
            });
          })
        : null,
      allowed.routes || allowed.assets
        ? this.loadLogistics(scope, allowed).then((value) => {
            loaded.logistics = value;
            sections.logistics = sectionState(true, {
              routes: value.routes.length,
              assets: value.assets.length,
            });
          })
        : null,
      allowed.resourceRequests
        ? this.loadResourceRequests(scope).then((rows) => {
            loaded.resourceRequests = rows;
            sections.resourceRequests = sectionState(true, { open: rows.length });
          })
        : null,
    ]);

    return {
      now,
      loaded,
      allowed,
      sections,
      computation: computeAttention({ loaded, now }),
    };
  }

  private async loadIncidents(scope: OperationalScope) {
    return this.prisma.incident.findMany({
      where: {
        electionId: scope.electionId,
        electoralZoneId: scope.electoralZoneId,
        status: { in: ACTIVE_INCIDENT_STATUSES },
        isSimulated: false,
      },
      select: {
        id: true,
        code: true,
        title: true,
        severity: true,
        status: true,
        electionId: true,
        electoralZoneId: true,
        pollingPlaceId: true,
        openedAt: true,
        slaDeadline: true,
        acknowledgedAt: true,
        escalationLevel: true,
      },
      orderBy: [{ severity: "desc" }, { openedAt: "asc" }],
      take: ROW_LIMIT,
    });
  }

  private async loadTransmission(scope: OperationalScope, now: Date) {
    const points = await this.prisma.transmissionPoint.findMany({
      where: {
        electionId: scope.electionId,
        electoralZoneId: scope.electoralZoneId,
        OR: [
          {
            status: {
              in: [TransmissionStatus.FAILED, TransmissionStatus.OFFLINE],
            },
          },
          { connectivity: "OFFLINE" },
          {
            operationalDeadline: { lt: now },
            status: { not: TransmissionStatus.SUCCESS },
          },
        ],
      },
      select: {
        id: true,
        identification: true,
        status: true,
        connectivity: true,
        priority: true,
        operationalDeadline: true,
        electoralZoneId: true,
        pollingPlaceId: true,
        electionId: true,
        queuedAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: ROW_LIMIT,
    });
    const alerts = points.length
      ? await this.prisma.transmissionAlert.findMany({
          where: {
            pointId: { in: points.map((point) => point.id) },
            status: TransmissionAlertStatus.OPEN,
            type: { in: [...OPEN_TRANSMISSION_ALERT_TYPES] },
          },
          select: {
            id: true,
            pointId: true,
            type: true,
            status: true,
            message: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: ROW_LIMIT,
        })
      : [];
    return { points, alerts };
  }

  /**
   * Cobertura usa `isOperationalShiftAssignment`, a definição compartilhada de
   * designação operacional, em vez de reimplementar o filtro do domínio.
   */
  private async loadWorkforce(
    scope: OperationalScope,
    now: Date,
    allowed: DomainAvailability,
  ) {
    const horizon = new Date(
      now.getTime() + OPERATIONAL_THRESHOLDS.dueSoonHours * HOUR_MS,
    );
    const shifts = allowed.shifts
      ? await this.prisma.fieldShift.findMany({
          where: {
            status: {
              in: [FieldShiftStatus.SCHEDULED, FieldShiftStatus.IN_PROGRESS],
            },
            startsAt: { lte: horizon },
            endsAt: { gte: now },
            electoralZoneId: scope.electoralZoneId,
            team: { electionId: scope.electionId },
          },
          select: {
            id: true,
            name: true,
            status: true,
            startsAt: true,
            requiredOperators: true,
            electoralZoneId: true,
            pollingPlaceId: true,
            team: { select: { electionId: true } },
            assignments: {
              select: { memberId: true, status: true, onCallActivatedAt: true },
            },
          },
          orderBy: { startsAt: "asc" },
          take: ROW_LIMIT,
        })
      : [];

    const dispatches = allowed.dispatches
      ? await this.prisma.fieldDispatch.findMany({
          where: {
            status: { in: ACTIVE_DISPATCH_STATUSES },
            electoralZoneId: scope.electoralZoneId,
            team: { electionId: scope.electionId },
          },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            requestedAt: true,
            electoralZoneId: true,
            pollingPlaceId: true,
            team: { select: { electionId: true } },
          },
          orderBy: { requestedAt: "asc" },
          take: ROW_LIMIT,
        })
      : [];

    return {
      shifts: shifts.map((shift) => ({
        id: shift.id,
        name: shift.name,
        status: shift.status,
        startsAt: shift.startsAt,
        requiredOperators: shift.requiredOperators,
        assignedOperators: new Set(
          shift.assignments
            .filter((assignment) => isOperationalShiftAssignment(assignment))
            .map((assignment) => assignment.memberId),
        ).size,
        electoralZoneId: shift.electoralZoneId,
        pollingPlaceId: shift.pollingPlaceId,
        electionId: shift.team.electionId,
      })),
      dispatches: dispatches.map((dispatch) => ({
        id: dispatch.id,
        title: dispatch.title,
        status: dispatch.status,
        priority: dispatch.priority,
        requestedAt: dispatch.requestedAt,
        electoralZoneId: dispatch.electoralZoneId,
        pollingPlaceId: dispatch.pollingPlaceId,
        electionId: dispatch.team.electionId,
      })),
    };
  }

  private async loadContinuity(scope: OperationalScope, now: Date) {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const rows = await this.prisma.shiftHandover.findMany({
      where: {
        shift: {
          team: { electionId: scope.electionId },
          electoralZoneId: scope.electoralZoneId,
        },
        OR: [
          { status: ShiftHandoverStatus.PENDING_CONFIRMATION },
          {
            status: ShiftHandoverStatus.CONFIRMED,
            confirmedAt: { gte: startOfDay },
          },
        ],
      },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        confirmedAt: true,
        createdAt: true,
        shift: {
          select: {
            name: true,
            electoralZoneId: true,
            pollingPlaceId: true,
            team: { select: { electionId: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: ROW_LIMIT,
    });
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      submittedAt: row.submittedAt,
      confirmedAt: row.confirmedAt,
      createdAt: row.createdAt,
      shiftName: row.shift.name,
      electoralZoneId: row.shift.electoralZoneId,
      pollingPlaceId: row.shift.pollingPlaceId,
      electionId: row.shift.team.electionId,
    }));
  }

  private async loadPreparation(scope: OperationalScope) {
    const rows = await this.prisma.preparationChecklist.findMany({
      where: {
        electionId: scope.electionId,
        electoralZoneId: scope.electoralZoneId,
        status: { in: [...OPEN_PREPARATION_STATUSES] },
      },
      select: {
        id: true,
        status: true,
        dueAt: true,
        electionId: true,
        electoralZoneId: true,
        pollingPlaceId: true,
        pollingPlace: { select: { name: true } },
        items: {
          where: { required: true, status: "BLOCKED" },
          select: { id: true },
        },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      take: ROW_LIMIT,
    });
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      dueAt: row.dueAt,
      pollingPlaceName: row.pollingPlace.name,
      blockedRequiredItems: row.items.length,
      electoralZoneId: row.electoralZoneId,
      pollingPlaceId: row.pollingPlaceId,
      electionId: row.electionId,
    }));
  }

  private async loadLogistics(
    scope: OperationalScope,
    allowed: DomainAvailability,
  ) {
    const routes = allowed.routes
      ? await this.prisma.distributionRoute.findMany({
          where: {
            electionId: scope.electionId,
            electoralZoneId: scope.electoralZoneId,
            status: { in: OPEN_ROUTE_STATUSES },
          },
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            plannedArrival: true,
            electionId: true,
            electoralZoneId: true,
            deliveries: { where: { status: "FAILED" }, select: { id: true } },
            exceptions: { where: { resolvedAt: null }, select: { id: true } },
          },
          orderBy: { plannedArrival: "asc" },
          take: ROW_LIMIT,
        })
      : [];

    const assets = allowed.assets
      ? await this.prisma.asset.findMany({
          where: {
            OR: [
              { status: AssetStatus.LOST },
              { status: AssetStatus.MAINTENANCE },
              { condition: "UNAVAILABLE" },
            ],
            ...(scope.electoralZoneId
              ? { electoralZoneId: scope.electoralZoneId }
              : {}),
          },
          select: {
            id: true,
            assetTag: true,
            name: true,
            status: true,
            condition: true,
            electoralZoneId: true,
            pollingPlaceId: true,
            maintenances: {
              where: {
                status: {
                  in: [
                    AssetMaintenanceStatus.OPEN,
                    AssetMaintenanceStatus.IN_PROGRESS,
                  ],
                },
                type: AssetMaintenanceType.CORRECTIVE,
              },
              select: { id: true },
            },
          },
          orderBy: { updatedAt: "desc" },
          take: ROW_LIMIT,
        })
      : [];

    return {
      routes: routes.map((route) => ({
        id: route.id,
        code: route.code,
        name: route.name,
        status: route.status,
        plannedArrival: route.plannedArrival,
        failedDeliveries: route.deliveries.length,
        openExceptions: route.exceptions.length,
        electoralZoneId: route.electoralZoneId,
        electionId: route.electionId,
      })),
      assets: assets.map((asset) => ({
        id: asset.id,
        assetTag: asset.assetTag,
        name: asset.name,
        status: asset.status,
        condition: asset.condition,
        openCorrectiveMaintenance: asset.maintenances.length,
        electoralZoneId: asset.electoralZoneId,
        pollingPlaceId: asset.pollingPlaceId,
      })),
    };
  }

  private async loadResourceRequests(scope: OperationalScope) {
    const rows = await this.prisma.resourceRequest.findMany({
      where: {
        electionId: scope.electionId,
        electoralZoneId: scope.electoralZoneId,
        status: {
          in: RESOURCE_REQUEST_OPEN_STATUSES as ResourceRequestStatus[],
        },
      },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        priority: true,
        neededAt: true,
        createdAt: true,
        approvedAt: true,
        electoralZoneId: true,
        pollingPlaceId: true,
        electionId: true,
      },
      orderBy: [{ priority: "desc" }, { neededAt: "asc" }],
      take: ROW_LIMIT,
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      status: row.status as SharedResourceRequestStatus,
      priority: row.priority,
      neededAt: row.neededAt,
      createdAt: row.createdAt,
      approvedAt: row.approvedAt,
      electoralZoneId: row.electoralZoneId,
      pollingPlaceId: row.pollingPlaceId,
      electionId: row.electionId,
    }));
  }
}
