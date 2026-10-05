import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AssetCondition, AssetStatus, FailureProbability, IncidentEventType, IncidentSeverity, IncidentStatus, Prisma, SimulationScenarioEventType, SimulationTargetType, SimulationStatus } from "@prisma/client";
import { EventBus } from "@eops/event-bus";
import { PrismaService } from "@eops/database";
import { CreateSimulationDto, CreateSimulationScenarioDto, SimulationScenarioEventInputDto, UpdateSimulationScenarioDto } from "./dto/simulation.dto";
import { ACTIVE_INCIDENT_STATUSES, ScenarioEventInput, TICK_SECONDS, averageRecoverySeconds, buildScoreInput, calculateScore, createRng, pendingScenarioEvents, validateScenarioEvents } from "./simulator.engine";

type SideEffect =
  | { kind: "incident"; payload: { entityId: string; code: string; title: string; severity: IncidentSeverity; electionId: string; pollingPlaceId?: string } }
  | { kind: "asset"; payload: { entityId: string; assetTag: string; from: AssetStatus; to: AssetStatus } };

const TARGET_REQUIRED = new Set<SimulationScenarioEventType>([SimulationScenarioEventType.INCIDENT_CREATE, SimulationScenarioEventType.ASSET_FAILURE, SimulationScenarioEventType.ASSET_RECOVERY, SimulationScenarioEventType.TRANSMISSION_FAILURE, SimulationScenarioEventType.TRANSMISSION_RECOVERY]);

function eventPayload(event: SimulationScenarioEventInputDto): Prisma.InputJsonObject {
  const extra = event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? (event.payload as Prisma.InputJsonObject) : {};
  return { targetType: event.targetType ?? SimulationTargetType.NONE, targetId: event.targetId ?? null, ...extra };
}

@Injectable()
export class SimulatorService {
  constructor(private readonly prisma: PrismaService, private readonly bus?: EventBus) {}
  list() { return this.prisma.simulation.findMany({ include: { election: { select: { id: true, name: true } }, scenario: true, _count: { select: { events: true, incidents: true } } }, orderBy: { createdAt: "desc" } }); }
  scenarios() { return this.prisma.simulationScenario.findMany({ where: { active: true }, include: { events: { orderBy: { offsetSeconds: "asc" } }, _count: { select: { simulations: true } } }, orderBy: { name: "asc" } }); }
  async get(id: string) { const simulation = await this.prisma.simulation.findUnique({ where: { id }, include: { election: { select: { id: true, name: true } }, scenario: { include: { events: { orderBy: { offsetSeconds: "asc" } } } }, events: { include: { incident: { select: { code: true, status: true } }, asset: { select: { assetTag: true, name: true } }, pollingPlace: { select: { name: true } } }, orderBy: { offsetSeconds: "asc" } }, incidents: { select: { id: true, code: true, title: true, status: true, severity: true, slaDeadline: true, resolvedAt: true, openedAt: true } } } }); if (!simulation) throw new NotFoundException("Simulação não encontrada."); return simulation; }
  async create(dto: CreateSimulationDto, actorId?: string) {
    const [election, scenario] = await Promise.all([this.prisma.election.findUnique({ where: { id: dto.electionId } }), dto.scenarioId ? this.prisma.simulationScenario.findUnique({ where: { id: dto.scenarioId } }) : null]);
    if (!election) throw new NotFoundException("Pleito não encontrado."); if (dto.scenarioId && !scenario?.active) throw new NotFoundException("Cenário não encontrado ou inativo.");
    if (!dto.connectivity && !dto.equipment && !dto.transmission && !dto.logistics) throw new BadRequestException("Selecione pelo menos um tipo de falha.");
    return this.prisma.simulation.create({ data: { ...dto, seed: scenario?.seed ?? null, createdById: actorId }, include: { election: true, scenario: true } });
  }
  async start(id: string, actorId?: string) {
    const simulation = await this.get(id); const startable: SimulationStatus[] = [SimulationStatus.DRAFT, SimulationStatus.PAUSED]; if (!startable.includes(simulation.status)) throw new BadRequestException("A simulação não pode ser iniciada neste estado.");
    const firstStart = simulation.status === SimulationStatus.DRAFT;
    const updated = await this.prisma.$transaction(async (tx) => { const row = await tx.simulation.update({ where: { id }, data: { status: SimulationStatus.RUNNING, startedAt: firstStart ? new Date() : undefined, pausedAt: null } }); if (firstStart) await tx.simulationEvent.create({ data: { simulationId: id, eventType: "VOTING_STARTED", title: "Votação simulada iniciada", description: "O relógio operacional foi iniciado.", offsetSeconds: 0 } }); return row; });
    if (firstStart) await this.bus?.emit("simulation.started", { entityId: id, actorId, name: simulation.name, electionId: simulation.electionId, scenarioId: simulation.scenarioId ?? undefined });
    else await this.bus?.emit("simulation.resumed", { entityId: id, actorId, name: simulation.name, electionId: simulation.electionId, elapsedSeconds: simulation.elapsedSeconds });
    return updated;
  }
  async pause(id: string, actorId?: string) { const simulation = await this.get(id); if (simulation.status !== SimulationStatus.RUNNING) throw new BadRequestException("Somente uma simulação em execução pode ser pausada."); const updated = await this.prisma.simulation.update({ where: { id }, data: { status: SimulationStatus.PAUSED, pausedAt: new Date() } }); await this.bus?.emit("simulation.paused", { entityId: id, actorId, name: simulation.name, electionId: simulation.electionId, elapsedSeconds: simulation.elapsedSeconds }); return updated; }
  async tick(id: string) {
    const simulation = await this.get(id); if (simulation.status !== SimulationStatus.RUNNING) throw new BadRequestException("Inicie a simulação antes de gerar eventos.");
    const scenarioEvents = simulation.scenario?.events ?? [];
    if (scenarioEvents.length) return this.tickScenario(simulation, scenarioEvents);
    return this.tickLegacy(simulation);
  }
  private async tickLegacy(simulation: Awaited<ReturnType<SimulatorService["get"]>>) {
    const id = simulation.id;
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
  private async tickScenario(simulation: Awaited<ReturnType<SimulatorService["get"]>>, scenarioEvents: { id: string; offsetSeconds: number; type: SimulationScenarioEventType; severity: IncidentSeverity | null; targetType: SimulationTargetType; targetId: string | null; probability: number; payload: Prisma.JsonValue }[]) {
    const id = simulation.id;
    const nextElapsed = simulation.elapsedSeconds + simulation.speed * TICK_SECONDS;
    const executed = new Set(simulation.events.map((event) => event.scenarioEventId).filter((value): value is string => Boolean(value)));
    const pending = pendingScenarioEvents(scenarioEvents, nextElapsed, executed);
    const seed = simulation.seed ?? simulation.scenario?.seed ?? null;
    const rng = createRng(seed === null ? null : seed + simulation.elapsedSeconds);
    const effects: SideEffect[] = [];
    const appliedAssets = new Map<string, { status: AssetStatus; condition: AssetCondition }>();
    for (const event of simulation.events) {
      const payload = event.payload as Prisma.JsonObject | null;
      if (event.assetId && event.eventType === SimulationScenarioEventType.ASSET_FAILURE && payload?.previousStatus) appliedAssets.set(event.assetId, { status: payload.previousStatus as AssetStatus, condition: (payload.previousCondition as AssetCondition) ?? AssetCondition.GOOD });
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const results: unknown[] = [];
      let sequence = simulation.events.length;
      for (const scenarioEvent of pending) {
        sequence += 1;
        results.push(await this.executeScenarioEvent(tx, simulation, scenarioEvent, rng, sequence, effects, appliedAssets));
      }
      await tx.simulation.update({ where: { id }, data: { elapsedSeconds: nextElapsed } });
      return results;
    });
    for (const effect of effects) {
      if (effect.kind === "incident") await this.bus?.emit("incident.created", effect.payload);
      else await this.bus?.emit("asset.status_changed", effect.payload);
    }
    return created;
  }
  private async executeScenarioEvent(tx: Prisma.TransactionClient, simulation: Awaited<ReturnType<SimulatorService["get"]>>, scenarioEvent: { id: string; offsetSeconds: number; type: SimulationScenarioEventType; severity: IncidentSeverity | null; targetType: SimulationTargetType; targetId: string | null; probability: number; payload: Prisma.JsonValue }, rng: () => number, sequence: number, effects: SideEffect[], appliedAssets: Map<string, { status: AssetStatus; condition: AssetCondition }>) {
    const base = { simulationId: simulation.id, scenarioEventId: scenarioEvent.id, offsetSeconds: scenarioEvent.offsetSeconds, eventType: scenarioEvent.type, severity: scenarioEvent.severity ?? null, payload: { targetType: scenarioEvent.targetType, targetId: scenarioEvent.targetId ?? null, ...(scenarioEvent.payload && typeof scenarioEvent.payload === "object" && !Array.isArray(scenarioEvent.payload) ? (scenarioEvent.payload as Prisma.InputJsonObject) : {}) } as Prisma.InputJsonObject };
    if (rng() * 100 >= scenarioEvent.probability) return tx.simulationEvent.create({ data: { ...base, title: `${scenarioEvent.type}: evento ignorado`, description: `A probabilidade de ${scenarioEvent.probability}% não foi atingida.`, result: "SKIPPED" } });
    try {
      const data = await this.applyScenarioEvent(tx, simulation, scenarioEvent, base, sequence, effects, appliedAssets);
      return tx.simulationEvent.create({ data });
    } catch (error) {
      return tx.simulationEvent.create({ data: { ...base, title: `${scenarioEvent.type}: falha na execução`, description: error instanceof Error ? error.message : "Não foi possível executar o evento.", result: "FAILED" } });
    }
  }
  private async applyScenarioEvent(tx: Prisma.TransactionClient, simulation: Awaited<ReturnType<SimulatorService["get"]>>, scenarioEvent: { type: SimulationScenarioEventType; severity: IncidentSeverity | null; targetType: SimulationTargetType; targetId: string | null; payload: Prisma.JsonValue }, base: { simulationId: string; scenarioEventId: string; offsetSeconds: number; eventType: SimulationScenarioEventType; severity: IncidentSeverity | null; payload: Prisma.InputJsonObject }, sequence: number, effects: SideEffect[], appliedAssets: Map<string, { status: AssetStatus; condition: AssetCondition }>): Promise<Prisma.SimulationEventUncheckedCreateInput> {
    const targetType = scenarioEvent.targetType;
    if (TARGET_REQUIRED.has(scenarioEvent.type) && targetType === SimulationTargetType.NONE) throw new BadRequestException("Evento sem tipo de alvo definido.");
    if (scenarioEvent.type === SimulationScenarioEventType.INCIDENT_CREATE) {
      const code = `SIM-${simulation.id.slice(-5).toUpperCase()}-${String(sequence).padStart(3, "0")}`;
      const payload = (scenarioEvent.payload ?? {}) as Prisma.JsonObject;
      const category = await this.resolveCategory(tx, payload.categoryKey);
      const place = targetType === SimulationTargetType.POLLING_PLACE && scenarioEvent.targetId ? await tx.pollingPlace.findUnique({ where: { id: scenarioEvent.targetId } }) : null;
      const asset = targetType === SimulationTargetType.ASSET && scenarioEvent.targetId ? await tx.asset.findUnique({ where: { id: scenarioEvent.targetId } }) : null;
      if (targetType === SimulationTargetType.POLLING_PLACE && !place) throw new BadRequestException("Local de votação informado não foi encontrado.");
      if (targetType === SimulationTargetType.ASSET && !asset) throw new BadRequestException("Ativo informado não foi encontrado.");
      const severity = scenarioEvent.severity ?? IncidentSeverity.MEDIUM;
      const slaMinutes = typeof payload.slaMinutes === "number" ? payload.slaMinutes : 60;
      const incident = await tx.incident.create({ data: { code, title: typeof payload.title === "string" ? payload.title : "Incidente simulado programado", description: typeof payload.description === "string" ? payload.description : `Evento programado do cenário ${simulation.scenario?.name ?? simulation.name}.`, severity, status: IncidentStatus.NEW, electionId: simulation.electionId, electoralZoneId: targetType === SimulationTargetType.ZONE && scenarioEvent.targetId ? scenarioEvent.targetId : place?.electoralZoneId ?? null, pollingPlaceId: place?.id ?? asset?.pollingPlaceId ?? null, categoryId: category.id, assetId: asset?.id ?? null, isSimulated: true, simulationId: simulation.id, slaDeadline: new Date(Date.now() + slaMinutes * 60 * 1000), events: { create: { type: IncidentEventType.INCIDENT_CREATED, message: "Incidente criado pelo simulador operacional." } } } });
      effects.push({ kind: "incident", payload: { entityId: incident.id, code: incident.code, title: incident.title, severity: incident.severity, electionId: incident.electionId, pollingPlaceId: incident.pollingPlaceId ?? undefined } });
      return { ...base, title: `Incidente simulado: ${incident.title}`, description: `Incidente ${incident.code} criado no replay.`, result: "APPLIED", incidentId: incident.id, pollingPlaceId: incident.pollingPlaceId, assetId: incident.assetId };
    }
    if (scenarioEvent.type === SimulationScenarioEventType.ASSET_FAILURE) {
      if (targetType !== SimulationTargetType.ASSET || !scenarioEvent.targetId) throw new BadRequestException("Falha de ativo exige targetType ASSET e targetId.");
      const asset = await tx.asset.findUnique({ where: { id: scenarioEvent.targetId }, include: { pollingPlace: true } });
      if (!asset) throw new BadRequestException("Ativo informado não foi encontrado.");
      if (simulation.applyToOperations) { appliedAssets.set(asset.id, { status: asset.status, condition: asset.condition }); await tx.asset.update({ where: { id: asset.id }, data: { status: AssetStatus.MAINTENANCE, condition: AssetCondition.ATTENTION } }); effects.push({ kind: "asset", payload: { entityId: asset.id, assetTag: asset.assetTag, from: asset.status, to: AssetStatus.MAINTENANCE } }); }
      return { ...base, title: `${asset.assetTag}: falha simulada`, description: `Falha registrada em ${asset.pollingPlace?.name ?? "local não alocado"}.`, result: "APPLIED", assetId: asset.id, pollingPlaceId: asset.pollingPlaceId, payload: { ...base.payload, previousStatus: asset.status, previousCondition: asset.condition, applied: simulation.applyToOperations } as Prisma.InputJsonObject };
    }
    if (scenarioEvent.type === SimulationScenarioEventType.ASSET_RECOVERY) {
      if (targetType !== SimulationTargetType.ASSET || !scenarioEvent.targetId) throw new BadRequestException("Recuperação de ativo exige targetType ASSET e targetId.");
      const asset = await tx.asset.findUnique({ where: { id: scenarioEvent.targetId } });
      if (!asset) throw new BadRequestException("Ativo informado não foi encontrado.");
      const restore = appliedAssets.get(asset.id) ?? { status: AssetStatus.AVAILABLE, condition: AssetCondition.GOOD };
      if (simulation.applyToOperations) { await tx.asset.update({ where: { id: asset.id }, data: { status: restore.status, condition: restore.condition } }); appliedAssets.delete(asset.id); effects.push({ kind: "asset", payload: { entityId: asset.id, assetTag: asset.assetTag, from: asset.status, to: restore.status } }); }
      return { ...base, title: `${asset.assetTag}: recuperação simulada`, description: "Ativo restaurado no replay.", result: "APPLIED", assetId: asset.id, pollingPlaceId: asset.pollingPlaceId, payload: { ...base.payload, applied: simulation.applyToOperations } as Prisma.InputJsonObject };
    }
    // TRANSMISSION_FAILURE / TRANSMISSION_RECOVERY: efeito somente simulado, nunca escreve em TransmissionPoint.
    const label = scenarioEvent.type === SimulationScenarioEventType.TRANSMISSION_FAILURE ? "Falha simulada de transmissão" : "Recuperação simulada de transmissão";
    return { ...base, title: label, description: "Estado simulado registrado apenas no replay; nenhum ponto real é alterado.", result: "APPLIED", payload: { ...base.payload, simulated: true } as Prisma.InputJsonObject };
  }
  private async resolveCategory(tx: Prisma.TransactionClient, key: unknown) {
    const category = typeof key === "string" ? await tx.incidentCategory.findUnique({ where: { key } }) : await tx.incidentCategory.findFirst({ where: { active: true }, orderBy: { name: "asc" } });
    if (!category) throw new BadRequestException("Categoria de incidente não configurada para a simulação.");
    return category;
  }
  async finish(id: string, actorId?: string) {
    const simulation = await this.get(id); const active: SimulationStatus[] = [SimulationStatus.RUNNING, SimulationStatus.PAUSED]; if (!active.includes(simulation.status)) throw new BadRequestException("A simulação não está ativa.");
    const scoreInput = buildScoreInput({ scenarioEvents: simulation.scenario?.events ?? null, events: simulation.events, incidents: simulation.incidents, elapsedSeconds: simulation.elapsedSeconds });
    const { score } = calculateScore(scoreInput);
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.incident.updateMany({ where: { simulationId: id, status: { in: ACTIVE_INCIDENT_STATUSES } }, data: { status: IncidentStatus.RESOLVED, resolvedAt: new Date() } });
      for (const event of simulation.events) { const payload = event.payload as Prisma.JsonObject | null; if (simulation.applyToOperations && event.assetId && payload?.applied && (payload.previousStatus || payload.previousCondition)) await tx.asset.update({ where: { id: event.assetId }, data: { status: payload.previousStatus as AssetStatus, condition: payload.previousCondition as AssetCondition } }); }
      await tx.simulationEvent.create({ data: { simulationId: id, eventType: "SIMULATION_FINISHED", title: "Simulação encerrada", description: "Incidentes simulados foram resolvidos e estados aplicados foram restaurados.", offsetSeconds: simulation.elapsedSeconds } });
      return tx.simulation.update({ where: { id }, data: { status: SimulationStatus.FINISHED, endedAt: new Date(), score } });
    });
    await this.bus?.emit("simulation.finished", { entityId: id, actorId, name: simulation.name, electionId: simulation.electionId, elapsedSeconds: simulation.elapsedSeconds, incidentCount: simulation.incidents.length });
    await this.bus?.emit("simulation.scored", { entityId: id, actorId, name: simulation.name, electionId: simulation.electionId, score, executedEvents: scoreInput.executedEvents, plannedEvents: scoreInput.plannedEvents });
    return { ...updated, score };
  }
  async report(id: string) {
    const simulation = await this.get(id);
    const scoreInput = buildScoreInput({ scenarioEvents: simulation.scenario?.events ?? null, events: simulation.events, incidents: simulation.incidents, elapsedSeconds: simulation.elapsedSeconds });
    const { score, coverage, skillScore, penalties } = calculateScore(scoreInput);
    const events = simulation.events;
    return {
      score: simulation.score ?? score,
      breakdown: { ...scoreInput, coverage, skillScore, penalties },
      plannedEvents: scoreInput.plannedEvents,
      executedEvents: scoreInput.executedEvents,
      failedEvents: scoreInput.failedEvents,
      incidentsCreated: simulation.incidents.length,
      resolvedIncidents: simulation.incidents.filter((incident) => Boolean(incident.resolvedAt) || incident.status === IncidentStatus.RESOLVED || incident.status === IncidentStatus.CLOSED).length,
      transmissionFailures: events.filter((event) => event.eventType === SimulationScenarioEventType.TRANSMISSION_FAILURE).length,
      transmissionRecoveries: events.filter((event) => event.eventType === SimulationScenarioEventType.TRANSMISSION_RECOVERY).length,
      averageRecoverySeconds: averageRecoverySeconds(events),
      slaViolations: scoreInput.slaViolations,
      unresolved: simulation.incidents.filter((incident) => ACTIVE_INCIDENT_STATUSES.includes(incident.status)).length,
      timeline: events.map((event) => { const payload = (event.payload ?? {}) as Prisma.JsonObject; return { id: event.id, offsetSeconds: event.offsetSeconds, eventType: event.eventType, title: event.title, description: event.description, result: event.result, severity: event.severity, targetType: payload.targetType ?? null, targetId: payload.targetId ?? null, incidentId: event.incidentId, assetId: event.assetId, pollingPlaceId: event.pollingPlaceId, incident: event.incident ?? null, asset: event.asset ?? null, pollingPlace: event.pollingPlace ?? null }; }),
    };
  }
  async getScenario(id: string) { const scenario = await this.prisma.simulationScenario.findUnique({ where: { id }, include: { events: { orderBy: { offsetSeconds: "asc" } }, _count: { select: { simulations: true } } } }); if (!scenario) throw new NotFoundException("Cenário não encontrado."); return scenario; }
  async createScenario(dto: CreateSimulationScenarioDto) {
    const events = dto.events ?? [];
    const errors = validateScenarioEvents(events);
    if (errors.length) throw new BadRequestException(errors.join(" "));
    return this.prisma.simulationScenario.create({ data: { name: dto.name, description: dto.description ?? null, seed: dto.seed ?? null, durationSeconds: dto.durationSeconds ?? null, configuration: (dto.configuration ?? {}) as Prisma.InputJsonValue, events: { create: events.map((event) => this.scenarioEventData(event)) } }, include: { events: { orderBy: { offsetSeconds: "asc" } }, _count: { select: { simulations: true } } } });
  }
  private scenarioEventData(event: SimulationScenarioEventInputDto) { return { offsetSeconds: event.offsetSeconds, type: event.type, severity: event.severity ?? null, targetType: event.targetType ?? SimulationTargetType.NONE, targetId: event.targetId ?? null, probability: event.probability, payload: event.payload === undefined ? undefined : eventPayload(event) }; }
  async updateScenario(id: string, dto: UpdateSimulationScenarioDto) { await this.getScenario(id); return this.prisma.simulationScenario.update({ where: { id }, data: { name: dto.name, description: dto.description, seed: dto.seed, durationSeconds: dto.durationSeconds, active: dto.active }, include: { events: { orderBy: { offsetSeconds: "asc" } }, _count: { select: { simulations: true } } } }); }
  async deleteScenario(id: string) { const scenario = await this.getScenario(id); if ((scenario._count?.simulations ?? 0) > 0) throw new BadRequestException("Cenário possui simulações vinculadas e não pode ser excluído."); await this.prisma.simulationScenario.delete({ where: { id } }); return { id, deleted: true }; }
  async addScenarioEvent(scenarioId: string, dto: SimulationScenarioEventInputDto) {
    const scenario = await this.getScenario(scenarioId);
    const existing: ScenarioEventInput[] = scenario.events.map((event) => ({ offsetSeconds: event.offsetSeconds, type: event.type, severity: event.severity, targetType: event.targetType, targetId: event.targetId, probability: event.probability }));
    const errors = validateScenarioEvents([...existing, dto]);
    if (errors.length) throw new BadRequestException(errors.join(" "));
    return this.prisma.simulationScenarioEvent.create({ data: { scenarioId, ...this.scenarioEventData(dto) } });
  }
  async duplicateScenarioEvent(scenarioId: string, eventId: string) {
    const scenario = await this.getScenario(scenarioId);
    const original = scenario.events.find((event) => event.id === eventId); if (!original) throw new NotFoundException("Evento do cenário não encontrado.");
    let offset = original.offsetSeconds + 1;
    while (scenario.events.some((event) => event.type === original.type && event.offsetSeconds === offset)) offset += 1;
    return this.prisma.simulationScenarioEvent.create({ data: { scenarioId, offsetSeconds: offset, type: original.type, severity: original.severity, targetType: original.targetType, targetId: original.targetId, probability: original.probability, payload: original.payload === null ? undefined : (original.payload as Prisma.InputJsonValue) } });
  }
  async deleteScenarioEvent(scenarioId: string, eventId: string) {
    const scenario = await this.getScenario(scenarioId);
    if (!scenario.events.some((event) => event.id === eventId)) throw new NotFoundException("Evento do cenário não encontrado.");
    await this.prisma.simulationScenarioEvent.delete({ where: { id: eventId } });
    return { id: eventId, deleted: true };
  }
}
