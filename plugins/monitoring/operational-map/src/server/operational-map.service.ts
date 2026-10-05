import { BadRequestException, Injectable } from "@nestjs/common";
import {
  AssetStatus,
  FieldAllocationStatus,
  FieldTeamStatus,
  IncidentSeverity,
  IncidentStatus,
  MonitoringStatus,
  RouteStatus,
  TransmissionStatus,
} from "@prisma/client";
import { PrismaService } from "@eops/database";
import { PERMISSIONS } from "@eops/security";
import {
  OPERATIONAL_MAP_TYPES,
  type OperationalMapFeature,
  type OperationalMapFeatureType,
} from "../shared/types/operational-map";
import type { OperationalMapQueryDto } from "./dto/operational-map.dto";

/** Permissão de leitura exigida por camada (SPEC §4.4). */
const LAYER_PERMISSIONS: Record<OperationalMapFeatureType, string> = {
  POLLING_PLACE: PERMISSIONS.elections.read,
  INCIDENT: PERMISSIONS.incidents.read,
  TRANSMISSION: PERMISSIONS.transmission.read,
  ASSET: PERMISSIONS.inventory.read,
  FIELD_TEAM: PERMISSIONS.fieldTeams.read,
  ROUTE: PERMISSIONS.routes.read,
};

/** Domínio de status de cada camada — o filtro `status` só se aplica onde o valor existe. */
const STATUS_DOMAINS: Record<OperationalMapFeatureType, readonly string[]> = {
  POLLING_PLACE: Object.values(MonitoringStatus),
  INCIDENT: Object.values(IncidentStatus),
  TRANSMISSION: Object.values(TransmissionStatus),
  ASSET: Object.values(AssetStatus),
  FIELD_TEAM: Object.values(FieldTeamStatus),
  ROUTE: Object.values(RouteStatus),
};

const placeSelect = { id: true, name: true, city: true, latitude: true, longitude: true } as const;

function toCoordinate(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

@Injectable()
export class OperationalMapService {
  constructor(private readonly prisma: PrismaService) {}

  async features(query: OperationalMapQueryDto, permissions: string[]): Promise<OperationalMapFeature[]> {
    const requested = this.requestedTypes(query.types);
    const allowed = requested.filter((type) => permissions.includes(LAYER_PERMISSIONS[type]));
    const groups = await Promise.all(allowed.map((type) => this.layer(type, query)));
    return groups
      .flat()
      .sort((left, right) =>
        left.type === right.type ? left.id.localeCompare(right.id) : left.type.localeCompare(right.type),
      );
  }

  private requestedTypes(types?: string): OperationalMapFeatureType[] {
    if (!types) return [...OPERATIONAL_MAP_TYPES];
    const requested = types.split(",").map((value) => value.trim()).filter(Boolean);
    const invalid = requested.filter((value) => !OPERATIONAL_MAP_TYPES.includes(value as OperationalMapFeatureType));
    if (invalid.length > 0) throw new BadRequestException(`Camada desconhecida: ${invalid.join(", ")}.`);
    return [...new Set(requested as OperationalMapFeatureType[])];
  }

  private statusFilter(type: OperationalMapFeatureType, value?: string): string | undefined {
    return value && STATUS_DOMAINS[type].includes(value) ? value : undefined;
  }

  private layer(type: OperationalMapFeatureType, query: OperationalMapQueryDto): Promise<OperationalMapFeature[]> {
    switch (type) {
      case "POLLING_PLACE":
        return this.pollingPlaces(query);
      case "INCIDENT":
        return this.incidents(query);
      case "TRANSMISSION":
        return this.transmission(query);
      case "ASSET":
        return this.assets(query);
      case "FIELD_TEAM":
        return this.fieldTeams(query);
      case "ROUTE":
        return this.routes(query);
    }
  }

  private async pollingPlaces(query: OperationalMapQueryDto): Promise<OperationalMapFeature[]> {
    const places = await this.prisma.pollingPlace.findMany({
      where: {
        id: query.pollingPlaceId || undefined,
        electoralZoneId: query.zoneId || undefined,
        monitoringStatus: this.statusFilter("POLLING_PLACE", query.status) as MonitoringStatus | undefined,
        electoralZone: query.electionId ? { electionId: query.electionId } : undefined,
      },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        district: true,
        latitude: true,
        longitude: true,
        monitoringStatus: true,
        updatedAt: true,
      },
    });
    return places.flatMap((place) => {
      const latitude = toCoordinate(place.latitude);
      const longitude = toCoordinate(place.longitude);
      if (latitude === null || longitude === null) return [];
      return [{
        id: `POLLING_PLACE:${place.id}`,
        type: "POLLING_PLACE" as const,
        latitude,
        longitude,
        title: place.name,
        subtitle: place.city,
        status: place.monitoringStatus,
        entityId: place.id,
        updatedAt: place.updatedAt.toISOString(),
        metadata: { municipality: place.city, district: place.district, state: place.state },
        deepLink: `/polling-places/${place.id}`,
      }];
    });
  }

  private async incidents(query: OperationalMapQueryDto): Promise<OperationalMapFeature[]> {
    const incidents = await this.prisma.incident.findMany({
      where: {
        isSimulated: false,
        electionId: query.electionId || undefined,
        electoralZoneId: query.zoneId || undefined,
        pollingPlaceId: query.pollingPlaceId || undefined,
        status: this.statusFilter("INCIDENT", query.status) as IncidentStatus | undefined,
        severity: this.severity(query.severity),
      },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        severity: true,
        updatedAt: true,
        category: { select: { name: true } },
        pollingPlace: { select: placeSelect },
      },
    });
    return incidents.flatMap((incident) => {
      const latitude = toCoordinate(incident.pollingPlace?.latitude);
      const longitude = toCoordinate(incident.pollingPlace?.longitude);
      if (latitude === null || longitude === null) return [];
      return [{
        id: `INCIDENT:${incident.id}`,
        type: "INCIDENT" as const,
        latitude,
        longitude,
        title: incident.title,
        subtitle: `${incident.code} · ${incident.category.name}`,
        status: incident.status,
        severity: incident.severity,
        entityId: incident.id,
        updatedAt: incident.updatedAt.toISOString(),
        metadata: { code: incident.code, category: incident.category.name, pollingPlace: incident.pollingPlace?.name ?? null },
        deepLink: `/incidents/${incident.id}`,
      }];
    });
  }

  private async transmission(query: OperationalMapQueryDto): Promise<OperationalMapFeature[]> {
    const points = await this.prisma.transmissionPoint.findMany({
      where: {
        electionId: query.electionId || undefined,
        electoralZoneId: query.zoneId || undefined,
        pollingPlaceId: query.pollingPlaceId || undefined,
        status: this.statusFilter("TRANSMISSION", query.status) as TransmissionStatus | undefined,
      },
      select: {
        id: true,
        identification: true,
        status: true,
        connectivity: true,
        priority: true,
        attemptCount: true,
        updatedAt: true,
        pollingPlace: { select: placeSelect },
      },
    });
    return points.flatMap((point) => {
      const latitude = toCoordinate(point.pollingPlace?.latitude);
      const longitude = toCoordinate(point.pollingPlace?.longitude);
      if (latitude === null || longitude === null) return [];
      return [{
        id: `TRANSMISSION:${point.id}`,
        type: "TRANSMISSION" as const,
        latitude,
        longitude,
        title: point.identification,
        subtitle: point.pollingPlace?.name,
        status: point.status,
        entityId: point.id,
        updatedAt: point.updatedAt.toISOString(),
        metadata: { connectivity: point.connectivity, priority: point.priority, attemptCount: point.attemptCount },
        deepLink: `/transmission/${point.id}`,
      }];
    });
  }

  private async assets(query: OperationalMapQueryDto): Promise<OperationalMapFeature[]> {
    const assets = await this.prisma.asset.findMany({
      where: {
        electoralZoneId: query.zoneId || undefined,
        pollingPlaceId: query.pollingPlaceId || undefined,
        status: this.statusFilter("ASSET", query.status) as AssetStatus | undefined,
        electoralZone: query.electionId ? { electionId: query.electionId } : undefined,
      },
      select: {
        id: true,
        assetTag: true,
        name: true,
        status: true,
        condition: true,
        updatedAt: true,
        type: { select: { name: true } },
        pollingPlace: { select: placeSelect },
      },
    });
    return assets.flatMap((asset) => {
      const latitude = toCoordinate(asset.pollingPlace?.latitude);
      const longitude = toCoordinate(asset.pollingPlace?.longitude);
      if (latitude === null || longitude === null) return [];
      return [{
        id: `ASSET:${asset.id}`,
        type: "ASSET" as const,
        latitude,
        longitude,
        title: asset.name,
        subtitle: asset.assetTag,
        status: asset.status,
        entityId: asset.id,
        updatedAt: asset.updatedAt.toISOString(),
        metadata: { assetTag: asset.assetTag, type: asset.type.name, condition: asset.condition },
        deepLink: `/inventory/${asset.id}`,
      }];
    });
  }

  private async fieldTeams(query: OperationalMapQueryDto): Promise<OperationalMapFeature[]> {
    const allocations = await this.prisma.fieldAllocation.findMany({
      where: {
        status: FieldAllocationStatus.ACTIVE,
        teamId: { not: null },
        electionId: query.electionId || undefined,
        electoralZoneId: query.zoneId || undefined,
        pollingPlaceId: query.pollingPlaceId || undefined,
        team: this.statusFilter("FIELD_TEAM", query.status)
          ? { status: this.statusFilter("FIELD_TEAM", query.status) as FieldTeamStatus }
          : undefined,
      },
      orderBy: { startsAt: "desc" },
      select: {
        teamId: true,
        updatedAt: true,
        team: { select: { id: true, name: true, code: true, status: true } },
        pollingPlace: { select: placeSelect },
      },
    });
    const seen = new Set<string>();
    const features: OperationalMapFeature[] = [];
    for (const allocation of allocations) {
      const team = allocation.team;
      if (!team || seen.has(team.id)) continue;
      const latitude = toCoordinate(allocation.pollingPlace?.latitude);
      const longitude = toCoordinate(allocation.pollingPlace?.longitude);
      if (latitude === null || longitude === null) continue;
      seen.add(team.id);
      features.push({
        id: `FIELD_TEAM:${team.id}`,
        type: "FIELD_TEAM",
        latitude,
        longitude,
        title: team.name,
        subtitle: team.code,
        status: team.status,
        entityId: team.id,
        updatedAt: allocation.updatedAt.toISOString(),
        metadata: { code: team.code, pollingPlace: allocation.pollingPlace?.name ?? null },
        deepLink: `/field-teams/teams/${team.id}`,
      });
    }
    return features;
  }

  private async routes(query: OperationalMapQueryDto): Promise<OperationalMapFeature[]> {
    const stops = await this.prisma.routeStop.findMany({
      where: {
        pollingPlaceId: query.pollingPlaceId || undefined,
        route: {
          electionId: query.electionId || undefined,
          electoralZoneId: query.zoneId || undefined,
          status: this.statusFilter("ROUTE", query.status) as RouteStatus | undefined,
        },
      },
      select: {
        id: true,
        order: true,
        description: true,
        status: true,
        latitude: true,
        longitude: true,
        updatedAt: true,
        route: { select: { id: true, code: true, name: true, status: true } },
      },
    });
    return stops.flatMap((stop) => {
      const latitude = toCoordinate(stop.latitude);
      const longitude = toCoordinate(stop.longitude);
      if (latitude === null || longitude === null) return [];
      return [{
        id: `ROUTE:${stop.id}`,
        type: "ROUTE" as const,
        latitude,
        longitude,
        title: stop.route.code,
        subtitle: stop.description,
        status: stop.route.status,
        entityId: stop.id,
        updatedAt: stop.updatedAt.toISOString(),
        metadata: { routeId: stop.route.id, routeName: stop.route.name, order: stop.order, stopStatus: stop.status },
        deepLink: `/routes/${stop.route.id}`,
      }];
    });
  }

  private severity(value?: string): IncidentSeverity | undefined {
    if (!value) return undefined;
    return (Object.values(IncidentSeverity) as string[]).includes(value) ? (value as IncidentSeverity) : undefined;
  }
}
