import { Injectable } from "@nestjs/common";
import { AssetCondition, AssetStatus, IncidentStatus, MonitoringStatus, RouteStatus, TransmissionStatus } from "@prisma/client";
import PDFDocument from "pdfkit";
import { PrismaService } from "../../../../../packages/database/src";
import { ReportQueryDto } from "./dto/report-query.dto";

function countBy<T>(items: T[], key: (item: T) => string) {
  return Object.entries(items.reduce<Record<string, number>>((result, item) => { const value = key(item); result[value] = (result[value] ?? 0) + 1; return result; }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private filters(query: ReportQueryDto) {
    const period = query.from || query.to ? { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined } : undefined;
    const incidentStatus = Object.values(IncidentStatus).includes(query.status as IncidentStatus) ? query.status as IncidentStatus : undefined;
    const assetStatus = Object.values(AssetStatus).includes(query.status as AssetStatus) ? query.status as AssetStatus : undefined;
    const routeStatus = Object.values(RouteStatus).includes(query.status as RouteStatus) ? query.status as RouteStatus : undefined;
    const transmissionStatus = Object.values(TransmissionStatus).includes(query.status as TransmissionStatus) ? query.status as TransmissionStatus : undefined;
    return { period, incidentStatus, assetStatus, routeStatus, transmissionStatus };
  }

  async executive(query: ReportQueryDto) {
    const { period, incidentStatus, assetStatus, routeStatus, transmissionStatus } = this.filters(query);
    const placeWhere = { id: query.pollingPlaceId, electoralZoneId: query.zoneId, electoralZone: { electionId: query.electionId } };
    const incidentWhere = { electionId: query.electionId, electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId, categoryId: query.categoryId, status: incidentStatus, openedAt: period };
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
      this.prisma.incident.count({ where: { electionId: query.electionId, electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId, openedAt: { gte: previousFrom, lt: previousTo } } }),
      this.prisma.transmissionPoint.count({ where: { electionId: query.electionId, electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId, status: TransmissionStatus.SUCCESS, lastActivity: { gte: previousFrom, lt: previousTo } } }),
    ]);
    return { available: true, current: { incidents: currentIncidents, transmissions: currentTransmissions }, previous: { from: previousFrom.toISOString(), to: previousTo.toISOString(), incidents, transmissions } };
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
