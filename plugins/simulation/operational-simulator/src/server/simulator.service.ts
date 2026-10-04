import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AssetCondition, AssetStatus, FailureProbability, IncidentEventType, IncidentSeverity, IncidentStatus, Prisma, SimulationStatus } from "@prisma/client";
import { EventBus } from "@eops/event-bus";
import { PrismaService } from "@eops/database";
import { CreateSimulationDto } from "./dto/simulation.dto";

const activeIncidentStatuses = [IncidentStatus.NEW, IncidentStatus.TRIAGED, IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS];
@Injectable()
export class SimulatorService {
  constructor(private readonly prisma: PrismaService, private readonly bus?: EventBus) {}
  list() { return this.prisma.simulation.findMany({ include: { election: { select: { id: true, name: true } }, scenario: true, _count: { select: { events: true, incidents: true } } }, orderBy: { createdAt: "desc" } }); }
  scenarios() { return this.prisma.simulationScenario.findMany({ where: { active: true }, orderBy: { name: "asc" } }); }
  async get(id: string) { const simulation = await this.prisma.simulation.findUnique({ where: { id }, include: { election: { select: { id: true, name: true } }, scenario: true, events: { include: { incident: { select: { code: true, status: true } }, asset: { select: { assetTag: true, name: true } }, pollingPlace: { select: { name: true } } }, orderBy: { offsetSeconds: "asc" } }, incidents: { select: { id: true, code: true, title: true, status: true } } } }); if (!simulation) throw new NotFoundException("Simulação não encontrada."); return simulation; }
  async create(dto: CreateSimulationDto, actorId?: string) {
    const [election, scenario] = await Promise.all([this.prisma.election.findUnique({ where: { id: dto.electionId } }), dto.scenarioId ? this.prisma.simulationScenario.findUnique({ where: { id: dto.scenarioId } }) : null]);
    if (!election) throw new NotFoundException("Pleito não encontrado."); if (dto.scenarioId && !scenario?.active) throw new NotFoundException("Cenário não encontrado ou inativo.");
    if (!dto.connectivity && !dto.equipment && !dto.transmission && !dto.logistics) throw new BadRequestException("Selecione pelo menos um tipo de falha.");
    return this.prisma.simulation.create({ data: { ...dto, createdById: actorId }, include: { election: true, scenario: true } });
  }
  async start(id: string) {
    const simulation = await this.get(id); const startable: SimulationStatus[] = [SimulationStatus.DRAFT, SimulationStatus.PAUSED]; if (!startable.includes(simulation.status)) throw new BadRequestException("A simulação não pode ser iniciada neste estado.");
    const firstStart = simulation.status === SimulationStatus.DRAFT;
    return this.prisma.$transaction(async (tx) => { const updated = await tx.simulation.update({ where: { id }, data: { status: SimulationStatus.RUNNING, startedAt: firstStart ? new Date() : undefined, pausedAt: null } }); if (firstStart) await tx.simulationEvent.create({ data: { simulationId: id, eventType: "VOTING_STARTED", title: "Votação simulada iniciada", description: "O relógio operacional foi iniciado.", offsetSeconds: 0 } }); return updated; });
  }
  async pause(id: string) { const simulation = await this.get(id); if (simulation.status !== SimulationStatus.RUNNING) throw new BadRequestException("Somente uma simulação em execução pode ser pausada."); return this.prisma.simulation.update({ where: { id }, data: { status: SimulationStatus.PAUSED, pausedAt: new Date() } }); }
  async tick(id: string) {
    const simulation = await this.get(id); if (simulation.status !== SimulationStatus.RUNNING) throw new BadRequestException("Inicie a simulação antes de gerar eventos.");
    const assets = await this.prisma.asset.findMany({ where: { pollingPlace: { electoralZone: { electionId: simulation.electionId } } }, include: { pollingPlace: { include: { electoralZone: true } } }, orderBy: { assetTag: "asc" } });
    if (!assets.length) throw new BadRequestException("O pleito não possui ativos alocados para simulação.");
    const enabled = ([simulation.connectivity && "CONNECTIVITY", simulation.equipment && "EQUIPMENT", simulation.transmission && "TRANSMISSION", simulation.logistics && "TRANSPORT"] as Array<string | false>).filter((value): value is string => Boolean(value));
    const offsetSeconds = simulation.elapsedSeconds + simulation.speed * 180;
    const asset = assets[Math.floor(offsetSeconds / 180) % assets.length]; const categoryKey = enabled[Math.floor(offsetSeconds / 180) % enabled.length];
    const category = await this.prisma.incidentCategory.findUnique({ where: { key: categoryKey } }); if (!category) throw new BadRequestException(`Categoria ${categoryKey} não configurada.`);
    const severity = simulation.probability === FailureProbability.HIGH ? IncidentSeverity.CRITICAL : simulation.probability === FailureProbability.MEDIUM ? IncidentSeverity.HIGH : IncidentSeverity.MEDIUM;
    const code = `SIM-${simulation.id.slice(-5).toUpperCase()}-${String(simulation.events.length + 1).padStart(3, "0")}`;
    const result = await this.prisma.$transaction(async (tx) => {
      const incident = await tx.incident.create({ data: { code, title: `Falha simulada de ${category.name.toLowerCase()}`, description: `Evento gerado pelo cenário ${simulation.name}.`, severity, status: IncidentStatus.NEW, electionId: simulation.electionId, electoralZoneId: asset.pollingPlace?.electoralZoneId, pollingPlaceId: asset.pollingPlaceId, categoryId: category.id, assetId: asset.id, isSimulated: true, simulationId: id, slaDeadline: new Date(Date.now() + 60 * 60 * 1000), events: { create: { type: IncidentEventType.INCIDENT_CREATED, message: "Incidente criado pelo simulador operacional." } } } });
      if (simulation.applyToOperations) await tx.asset.update({ where: { id: asset.id }, data: { status: AssetStatus.MAINTENANCE, condition: AssetCondition.ATTENTION } });
      const event = await tx.simulationEvent.create({ data: { simulationId: id, eventType: "ASSET_FAILURE", title: `${asset.assetTag}: falha simulada`, description: `Falha de ${category.name.toLowerCase()} em ${asset.pollingPlace?.name ?? "local não alocado"}.`, offsetSeconds, incidentId: incident.id, assetId: asset.id, pollingPlaceId: asset.pollingPlaceId, payload: { previousStatus: asset.status, previousCondition: asset.condition, categoryKey, applied: simulation.applyToOperations } } });
      await tx.simulation.update({ where: { id }, data: { elapsedSeconds: offsetSeconds } }); return { incident, event };
    });
    await this.bus?.emit("incident.created", { entityId: result.incident.id, code: result.incident.code, title: result.incident.title, severity: result.incident.severity, electionId: result.incident.electionId, pollingPlaceId: result.incident.pollingPlaceId ?? undefined });
    if (simulation.applyToOperations) await this.bus?.emit("asset.status_changed", { entityId: asset.id, assetTag: asset.assetTag, from: asset.status, to: AssetStatus.MAINTENANCE });
    return result.event;
  }
  async finish(id: string) {
    const simulation = await this.get(id); const active: SimulationStatus[] = [SimulationStatus.RUNNING, SimulationStatus.PAUSED]; if (!active.includes(simulation.status)) throw new BadRequestException("A simulação não está ativa.");
    return this.prisma.$transaction(async (tx) => {
      await tx.incident.updateMany({ where: { simulationId: id, status: { in: activeIncidentStatuses } }, data: { status: IncidentStatus.RESOLVED, resolvedAt: new Date() } });
      for (const event of simulation.events) { const payload = event.payload as Prisma.JsonObject | null; if (simulation.applyToOperations && event.assetId && payload?.applied) await tx.asset.update({ where: { id: event.assetId }, data: { status: payload.previousStatus as AssetStatus, condition: payload.previousCondition as AssetCondition } }); }
      await tx.simulationEvent.create({ data: { simulationId: id, eventType: "SIMULATION_FINISHED", title: "Simulação encerrada", description: "Incidentes simulados foram resolvidos e estados aplicados foram restaurados.", offsetSeconds: simulation.elapsedSeconds } });
      return tx.simulation.update({ where: { id }, data: { status: SimulationStatus.FINISHED, endedAt: new Date() } });
    });
  }
}
