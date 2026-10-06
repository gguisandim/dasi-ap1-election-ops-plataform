import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AssetCondition, AssetStatus, IncidentEventType, IncidentSeverity, IncidentStatus, Prisma, SimulationScenarioEvent, SimulationScenarioEventType, SimulationScenarioStatus, SimulationStatus, SimulationTargetType } from "@prisma/client";
import { EventBus } from "@eops/event-bus";
import { PrismaService } from "@eops/database";
import {
  SIMULATION_EVENT_METADATA,
  SIMULATION_API_STATUSES,
  buildSimulationBreakdown,
  calculateCompositeScore,
  canEditScenario,
  canExecuteScenario,
  canTransitionSimulation,
  compareSimulationRuns,
  deriveSimulationHealth,
  evaluateSimulationOutcome,
  toApiSimulationStatus,
  toDbSimulationStatus,
  validateCriteria,
  validateEventTarget,
  validateInitialConditions,
  validateObjectives,
  validateScoreWeights,
  type SimulationDbStatus,
  type SimulationEventType,
  type SimulationObjective,
  type SimulationCriterion,
  type SimulationScoreBreakdown,
  type SimulationScoreInput,
} from "@eops/shared/simulation";
import { ACTIVE_INCIDENT_STATUSES, ScenarioEventInput, TICK_SECONDS, buildSimulationScoreInput, createTickRng, pendingScenarioEvents, validateScenarioEvents } from "./simulator.engine";
import { CloneSimulationScenarioDto, CreateSimulationDto, CreateSimulationScenarioDto, FailSimulationDto, RecordDecisionDto, SimulationScenarioEventInputDto, UpdateScenarioEventDto, UpdateSimulationScenarioDto } from "./dto/simulation.dto";

type SideEffect =
  | { kind: "incident"; payload: { entityId: string; code: string; title: string; severity: IncidentSeverity; electionId: string; simulationId: string; pollingPlaceId?: string } }
  | { kind: "asset"; payload: { entityId: string; assetTag: string; from: AssetStatus; to: AssetStatus } };

const runInclude = {
  election: { select: { id: true, name: true, year: true } },
  scenario: { select: { id: true, name: true, seed: true, speed: true, status: true, isTemplate: true, scoreWeights: true, objectives: true, successCriteria: true, failureCriteria: true, events: { orderBy: { offsetSeconds: "asc" as const } } } },
  events: { orderBy: { offsetSeconds: "asc" as const }, include: { incident: { select: { code: true, status: true } }, asset: { select: { assetTag: true, name: true } }, pollingPlace: { select: { name: true } } } },
  incidents: { select: { id: true, code: true, title: true, severity: true, status: true, slaDeadline: true, openedAt: true, acknowledgedAt: true, resolvedAt: true } },
  snapshots: { orderBy: { offsetSeconds: "asc" as const } },
  decisions: { orderBy: { offsetSeconds: "asc" as const }, include: { actor: { select: { id: true, name: true } } } },
  _count: { select: { events: true, incidents: true } },
} satisfies Prisma.SimulationInclude;

type RunRecord = Prisma.SimulationGetPayload<{ include: typeof runInclude }>;
type ScenarioEventRecord = SimulationScenarioEvent;

function eventPayload(event: SimulationScenarioEventInputDto): Prisma.InputJsonObject {
  const extra = event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? (event.payload as Prisma.InputJsonObject) : {};
  return { targetType: event.targetType ?? SimulationTargetType.NONE, targetId: event.targetId ?? null, ...extra };
}

/**
 * Converte um valor opcional em entrada JSON do Prisma. Ausencia vira o
 * sentinela `JsonNull`, que e o unico jeito de gravar JSON nulo em coluna
 * anulavel sem confundir com "campo nao informado".
 */
function toInput(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null || value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function apiStatus(status: SimulationStatus) {
  return toApiSimulationStatus(status as SimulationDbStatus);
}

/** Converte um filtro de status da API para o enum persistido. */
function statusFilter(status?: string): SimulationStatus | undefined {
  return status && (SIMULATION_API_STATUSES as readonly string[]).includes(status) ? (toDbSimulationStatus(status as never) as SimulationStatus) : undefined;
}

function presentRun(run: Pick<RunRecord, "id" | "name" | "status" | "speed" | "probability" | "elapsedSeconds" | "score" | "failureReason" | "seed" | "createdAt" | "startedAt" | "endedAt"> & { election?: { id: string; name: string } | null; scenario?: { id: string; name: string } | null; _count?: { events: number; incidents: number } }) {
  return {
    id: run.id,
    name: run.name,
    status: apiStatus(run.status),
    statusCode: run.status,
    speed: run.speed,
    probability: run.probability,
    elapsedSeconds: run.elapsedSeconds,
    score: run.score,
    failureReason: run.failureReason,
    seed: run.seed,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    election: run.election ?? null,
    scenario: run.scenario ?? null,
    _count: run._count ?? null,
  };
}

@Injectable()
export class SimulatorService {
  constructor(private readonly prisma: PrismaService, private readonly bus?: EventBus) {}

  /* ---------------------------------------------------------------- *
   * Execuções
   * ---------------------------------------------------------------- */

  async list(query: { electionId?: string; status?: string; scenarioId?: string } = {}) {
    const runs = await this.prisma.simulation.findMany({
      where: { electionId: query.electionId, scenarioId: query.scenarioId, status: statusFilter(query.status) },
      include: { election: { select: { id: true, name: true } }, scenario: { select: { id: true, name: true } }, _count: { select: { events: true, incidents: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return runs.map((run) => presentRun(run));
  }

  async runs(query: { electionId?: string; status?: string; scenarioId?: string; page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.SimulationWhereInput = { electionId: query.electionId, scenarioId: query.scenarioId, status: statusFilter(query.status) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.simulation.findMany({ where, include: { election: { select: { id: true, name: true } }, scenario: { select: { id: true, name: true } }, _count: { select: { events: true, incidents: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.simulation.count({ where }),
    ]);
    return { items: items.map((run) => presentRun(run)), page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async get(id: string): Promise<RunRecord> {
    const simulation = await this.prisma.simulation.findUnique({ where: { id }, include: runInclude });
    if (!simulation) throw new NotFoundException("Simulação não encontrada.");
    return simulation;
  }

  /** Detalhe exposto na API: status traduzido para o vocabulário público. */
  async detail(id: string) {
    const simulation = await this.get(id);
    return { ...simulation, status: apiStatus(simulation.status), statusCode: simulation.status };
  }

  async create(dto: CreateSimulationDto, actorId?: string) {
    const [election, scenario] = await Promise.all([
      this.prisma.election.findUnique({ where: { id: dto.electionId } }),
      dto.scenarioId ? this.prisma.simulationScenario.findUnique({ where: { id: dto.scenarioId } }) : null,
    ]);
    if (!election) throw new NotFoundException("Pleito não encontrado.");
    if (dto.scenarioId && !scenario) throw new NotFoundException("Cenário não encontrado.");
    if (scenario && !canExecuteScenario(scenario.status, scenario.isTemplate)) throw new ConflictException("Cenário arquivado ou template não pode ser executado.");
    if (!dto.connectivity && !dto.equipment && !dto.transmission && !dto.logistics && !dto.scenarioId) throw new BadRequestException("Selecione pelo menos um tipo de falha.");
    return this.prisma.simulation.create({ data: { ...dto, seed: scenario?.seed ?? null, createdById: actorId }, include: { election: true, scenario: true } });
  }

  /** Aplica uma transição da tabela normativa ou rejeita com 409. */
  private ensureTransition(from: SimulationStatus, to: SimulationDbStatus) {
    if (!canTransitionSimulation(from as SimulationDbStatus, to)) throw new ConflictException(`Transição ${apiStatus(from)} → ${to} não permitida.`);
  }

  async start(id: string, actorId?: string) {
    const simulation = await this.get(id);
    this.ensureTransition(simulation.status, "RUNNING");
    const firstStart = simulation.status === SimulationStatus.DRAFT;
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.simulation.update({ where: { id }, data: { status: SimulationStatus.RUNNING, startedAt: firstStart ? new Date() : undefined, simulatedStartedAt: firstStart ? new Date() : undefined, pausedAt: null } });
      if (firstStart) await tx.simulationEvent.create({ data: { simulationId: id, eventType: "VOTING_STARTED", title: "Votação simulada iniciada", description: "O relógio operacional foi iniciado.", offsetSeconds: 0 } });
      return row;
    });
    if (firstStart) await this.bus?.emit("simulation.started", { entityId: id, actorId, name: simulation.name, electionId: simulation.electionId, scenarioId: simulation.scenarioId ?? undefined });
    else await this.bus?.emit("simulation.resumed", { entityId: id, actorId, name: simulation.name, electionId: simulation.electionId, elapsedSeconds: simulation.elapsedSeconds });
    return updated;
  }

  async pause(id: string, actorId?: string) {
    const simulation = await this.get(id);
    this.ensureTransition(simulation.status, "PAUSED");
    const updated = await this.prisma.simulation.update({ where: { id }, data: { status: SimulationStatus.PAUSED, pausedAt: new Date() } });
    await this.bus?.emit("simulation.paused", { entityId: id, actorId, name: simulation.name, electionId: simulation.electionId, elapsedSeconds: simulation.elapsedSeconds });
    return updated;
  }

  /** `tick` avança `speed × TICK_SECONDS`. */
  async tick(id: string) {
    const simulation = await this.get(id);
    return this.advance(simulation, simulation.speed * TICK_SECONDS);
  }

  /** `step` avança exatamente `TICK_SECONDS`, independente da velocidade. */
  async step(id: string) {
    const simulation = await this.get(id);
    return this.advance(simulation, TICK_SECONDS);
  }

  private async advance(simulation: RunRecord, advanceSeconds: number) {
    if (simulation.status !== SimulationStatus.RUNNING) throw new ConflictException("Inicie a simulação antes de avançar o relógio.");
    const nextElapsed = simulation.elapsedSeconds + advanceSeconds;
    const scenarioEvents = simulation.scenario?.events ?? [];
    const created = scenarioEvents.length ? await this.advanceScenario(simulation, scenarioEvents, nextElapsed) : await this.advanceLegacy(simulation, nextElapsed);
    if (created.length > 0) await this.snapshot(simulation.id, nextElapsed);
    return { elapsedSeconds: nextElapsed, events: created };
  }

  private async advanceScenario(simulation: RunRecord, scenarioEvents: ScenarioEventRecord[], nextElapsed: number) {
    const seed = simulation.seed ?? simulation.scenario?.seed ?? null;
    const rng = createTickRng(seed, simulation.elapsedSeconds);
    const executed = new Set(simulation.events.map((event) => event.scenarioEventId).filter((value): value is string => Boolean(value)));
    const pending = pendingScenarioEvents(scenarioEvents, nextElapsed, executed);
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
      await tx.simulation.update({ where: { id: simulation.id }, data: { elapsedSeconds: nextElapsed } });
      return results;
    });
    await this.publishEffects(simulation.electionId, effects);
    return created;
  }

  private async advanceLegacy(simulation: RunRecord, nextElapsed: number) {
    const id = simulation.id;
    const assets = await this.prisma.asset.findMany({ where: { pollingPlace: { electoralZone: { electionId: simulation.electionId } } }, include: { pollingPlace: { include: { electoralZone: true } } }, orderBy: { assetTag: "asc" } });
    if (!assets.length) throw new BadRequestException("O pleito não possui ativos alocados para simulação.");
    const enabled = ([simulation.connectivity && "CONNECTIVITY", simulation.equipment && "EQUIPMENT", simulation.transmission && "TRANSMISSION", simulation.logistics && "TRANSPORT"] as Array<string | false>).filter((value): value is string => Boolean(value));
    const asset = assets[Math.floor(nextElapsed / TICK_SECONDS) % assets.length];
    const categoryKey = enabled[Math.floor(nextElapsed / TICK_SECONDS) % enabled.length];
    const category = await this.prisma.incidentCategory.findUnique({ where: { key: categoryKey } });
    if (!category) throw new BadRequestException(`Categoria ${categoryKey} não configurada.`);
    const severity = simulation.probability === "HIGH" ? IncidentSeverity.CRITICAL : simulation.probability === "MEDIUM" ? IncidentSeverity.HIGH : IncidentSeverity.MEDIUM;
    const code = `SIM-${simulation.id.slice(-5).toUpperCase()}-${String(simulation.events.length + 1).padStart(3, "0")}`;
    const effects: SideEffect[] = [];
    const created = await this.prisma.$transaction(async (tx) => {
      const incident = await tx.incident.create({ data: { code, title: `Falha simulada de ${category.name.toLowerCase()}`, description: `Evento gerado pelo cenário ${simulation.name}.`, severity, status: IncidentStatus.NEW, electionId: simulation.electionId, electoralZoneId: asset.pollingPlace?.electoralZoneId, pollingPlaceId: asset.pollingPlaceId, categoryId: category.id, assetId: asset.id, isSimulated: true, simulationId: id, slaDeadline: new Date(Date.now() + 60 * 60 * 1000), events: { create: { type: IncidentEventType.INCIDENT_CREATED, message: "Incidente criado pelo simulador operacional." } } } });
      effects.push({ kind: "incident", payload: { entityId: incident.id, code: incident.code, title: incident.title, severity: incident.severity, electionId: incident.electionId, simulationId: id, pollingPlaceId: incident.pollingPlaceId ?? undefined } });
      if (simulation.applyToOperations) {
        await tx.asset.update({ where: { id: asset.id }, data: { status: AssetStatus.MAINTENANCE, condition: AssetCondition.ATTENTION } });
        effects.push({ kind: "asset", payload: { entityId: asset.id, assetTag: asset.assetTag, from: asset.status, to: AssetStatus.MAINTENANCE } });
      }
      const event = await tx.simulationEvent.create({ data: { simulationId: id, eventType: "INCIDENT_CREATE", title: `${asset.assetTag}: falha simulada`, description: `Falha de ${category.name.toLowerCase()} em ${asset.pollingPlace?.name ?? "local não alocado"}.`, offsetSeconds: nextElapsed, incidentId: incident.id, assetId: asset.id, pollingPlaceId: asset.pollingPlaceId, payload: { previousStatus: asset.status, previousCondition: asset.condition, categoryKey, applied: simulation.applyToOperations } } });
      await tx.simulation.update({ where: { id }, data: { elapsedSeconds: nextElapsed } });
      return [event];
    });
    await this.publishEffects(simulation.electionId, effects);
    return created;
  }

  private async publishEffects(electionId: string, effects: SideEffect[]) {
    for (const effect of effects) {
      if (effect.kind === "incident") await this.bus?.emit("simulated_incident.created", effect.payload);
      else await this.bus?.emit("asset.status_changed", effect.payload);
    }
  }

  private async executeScenarioEvent(tx: Prisma.TransactionClient, simulation: RunRecord, scenarioEvent: ScenarioEventRecord, rng: () => number, sequence: number, effects: SideEffect[], appliedAssets: Map<string, { status: AssetStatus; condition: AssetCondition }>) {
    const base = { simulationId: simulation.id, scenarioEventId: scenarioEvent.id, offsetSeconds: scenarioEvent.offsetSeconds, eventType: scenarioEvent.type, severity: scenarioEvent.severity ?? null, payload: { targetType: scenarioEvent.targetType, targetId: scenarioEvent.targetId ?? null, ...(scenarioEvent.payload && typeof scenarioEvent.payload === "object" && !Array.isArray(scenarioEvent.payload) ? (scenarioEvent.payload as Prisma.InputJsonObject) : {}) } as Prisma.InputJsonObject };
    if (rng() * 100 >= scenarioEvent.probability) return tx.simulationEvent.create({ data: { ...base, title: `${scenarioEvent.type}: evento ignorado`, description: `A probabilidade de ${scenarioEvent.probability}% não foi atingida.`, result: "SKIPPED" } });
    try {
      return tx.simulationEvent.create({ data: await this.applyScenarioEvent(tx, simulation, scenarioEvent, base, sequence, effects, appliedAssets) });
    } catch (error) {
      return tx.simulationEvent.create({ data: { ...base, title: `${scenarioEvent.type}: falha na execução`, description: error instanceof Error ? error.message : "Não foi possível executar o evento.", result: "FAILED" } });
    }
  }

  private async applyScenarioEvent(tx: Prisma.TransactionClient, simulation: RunRecord, scenarioEvent: ScenarioEventRecord, base: { simulationId: string; scenarioEventId: string; offsetSeconds: number; eventType: SimulationScenarioEventType; severity: IncidentSeverity | null; payload: Prisma.InputJsonObject }, sequence: number, effects: SideEffect[], appliedAssets: Map<string, { status: AssetStatus; condition: AssetCondition }>): Promise<Prisma.SimulationEventUncheckedCreateInput> {
    const type = scenarioEvent.type as SimulationEventType;
    const metadata = SIMULATION_EVENT_METADATA[type];
    const targetErrors = validateEventTarget(type, scenarioEvent.targetType, scenarioEvent.targetId);
    if (targetErrors.length) throw new BadRequestException(targetErrors.join(" "));

    if (type === "INCIDENT_CREATE" || type === "INCIDENT_CRITICAL") {
      const code = `SIM-${simulation.id.slice(-5).toUpperCase()}-${String(sequence).padStart(3, "0")}`;
      const payload = (scenarioEvent.payload ?? {}) as Prisma.JsonObject;
      const category = await this.resolveCategory(tx, payload.categoryKey);
      const place = scenarioEvent.targetType === SimulationTargetType.POLLING_PLACE && scenarioEvent.targetId ? await tx.pollingPlace.findUnique({ where: { id: scenarioEvent.targetId } }) : null;
      const asset = scenarioEvent.targetType === SimulationTargetType.ASSET && scenarioEvent.targetId ? await tx.asset.findUnique({ where: { id: scenarioEvent.targetId } }) : null;
      if (scenarioEvent.targetType === SimulationTargetType.POLLING_PLACE && !place) throw new BadRequestException("Local de votação informado não foi encontrado.");
      if (scenarioEvent.targetType === SimulationTargetType.ASSET && !asset) throw new BadRequestException("Ativo informado não foi encontrado.");
      const severity = scenarioEvent.severity ?? (type === "INCIDENT_CRITICAL" ? IncidentSeverity.CRITICAL : IncidentSeverity.MEDIUM);
      const slaMinutes = typeof payload.slaMinutes === "number" ? payload.slaMinutes : 60;
      const incident = await tx.incident.create({ data: { code, title: typeof payload.title === "string" ? payload.title : "Incidente simulado programado", description: typeof payload.description === "string" ? payload.description : `Evento programado do cenário ${simulation.scenario?.name ?? simulation.name}.`, severity, status: IncidentStatus.NEW, electionId: simulation.electionId, electoralZoneId: scenarioEvent.targetType === SimulationTargetType.ZONE && scenarioEvent.targetId ? scenarioEvent.targetId : place?.electoralZoneId ?? null, pollingPlaceId: place?.id ?? asset?.pollingPlaceId ?? null, categoryId: category.id, assetId: asset?.id ?? null, isSimulated: true, simulationId: simulation.id, slaDeadline: new Date(Date.now() + slaMinutes * 60 * 1000), events: { create: { type: IncidentEventType.INCIDENT_CREATED, message: "Incidente criado pelo simulador operacional." } } } });
      effects.push({ kind: "incident", payload: { entityId: incident.id, code: incident.code, title: incident.title, severity: incident.severity, electionId: incident.electionId, simulationId: simulation.id, pollingPlaceId: incident.pollingPlaceId ?? undefined } });
      return { ...base, title: `Incidente simulado: ${incident.title}`, description: `Incidente ${incident.code} criado no replay.`, result: "APPLIED", severity, incidentId: incident.id, pollingPlaceId: incident.pollingPlaceId, assetId: incident.assetId };
    }

    if (type === "ASSET_FAILURE") {
      const asset = await tx.asset.findUnique({ where: { id: scenarioEvent.targetId! }, include: { pollingPlace: true } });
      if (!asset) throw new BadRequestException("Ativo informado não foi encontrado.");
      if (simulation.applyToOperations) {
        appliedAssets.set(asset.id, { status: asset.status, condition: asset.condition });
        await tx.asset.update({ where: { id: asset.id }, data: { status: AssetStatus.MAINTENANCE, condition: AssetCondition.ATTENTION } });
        effects.push({ kind: "asset", payload: { entityId: asset.id, assetTag: asset.assetTag, from: asset.status, to: AssetStatus.MAINTENANCE } });
      }
      return { ...base, title: `${asset.assetTag}: falha simulada`, description: `Falha registrada em ${asset.pollingPlace?.name ?? "local não alocado"}.`, result: "APPLIED", assetId: asset.id, pollingPlaceId: asset.pollingPlaceId, payload: { ...base.payload, previousStatus: asset.status, previousCondition: asset.condition, applied: simulation.applyToOperations } as Prisma.InputJsonObject };
    }

    if (type === "ASSET_RECOVERY") {
      const asset = await tx.asset.findUnique({ where: { id: scenarioEvent.targetId! } });
      if (!asset) throw new BadRequestException("Ativo informado não foi encontrado.");
      const restore = appliedAssets.get(asset.id) ?? { status: AssetStatus.AVAILABLE, condition: AssetCondition.GOOD };
      if (simulation.applyToOperations) {
        await tx.asset.update({ where: { id: asset.id }, data: { status: restore.status, condition: restore.condition } });
        appliedAssets.delete(asset.id);
        effects.push({ kind: "asset", payload: { entityId: asset.id, assetTag: asset.assetTag, from: asset.status, to: restore.status } });
      }
      return { ...base, title: `${asset.assetTag}: recuperação simulada`, description: "Ativo restaurado no replay.", result: "APPLIED", assetId: asset.id, pollingPlaceId: asset.pollingPlaceId, payload: { ...base.payload, applied: simulation.applyToOperations } as Prisma.InputJsonObject };
    }

    // Todos os demais tipos são estados simulados persistidos apenas no run.
    return { ...base, title: metadata.label, description: "Estado simulado registrado apenas no replay; nenhum domínio real é alterado.", result: "APPLIED", payload: { ...base.payload, simulated: true, externalDomain: metadata.externalDomain } as Prisma.InputJsonObject };
  }

  private async resolveCategory(tx: Prisma.TransactionClient, key: unknown) {
    const category = typeof key === "string" ? await tx.incidentCategory.findUnique({ where: { key } }) : await tx.incidentCategory.findFirst({ where: { active: true }, orderBy: { name: "asc" } });
    if (!category) throw new BadRequestException("Categoria de incidente não configurada para a simulação.");
    return category;
  }

  /** Grava (upsert) o snapshot do offset com o estado simulado acumulado (§1.7). */
  private async snapshot(id: string, offsetSeconds: number) {
    const simulation = await this.get(id);
    const input = this.scoreInputOf(simulation, offsetSeconds);
    const breakdown = buildSimulationBreakdown(input, this.weightsOf(simulation));
    const health = deriveSimulationHealth(input);
    const metrics = { health, dimensions: breakdown.dimensions, counters: breakdown.counters } as unknown as Prisma.InputJsonValue;
    await this.prisma.simulationSnapshot.upsert({
      where: { simulationId_offsetSeconds: { simulationId: id, offsetSeconds } },
      create: { simulationId: id, offsetSeconds, health, metrics, payload: { appliedEvents: input.appliedEvents, plannedEvents: input.plannedEvents } },
      update: { health, metrics, payload: { appliedEvents: input.appliedEvents, plannedEvents: input.plannedEvents } },
    });
  }

  private async writeClosingSnapshot(tx: Prisma.TransactionClient, simulation: RunRecord, offsetSeconds: number, breakdown: SimulationScoreBreakdown, health: string) {
    const metrics = { health, dimensions: breakdown.dimensions, counters: breakdown.counters } as unknown as Prisma.InputJsonValue;
    await tx.simulationSnapshot.upsert({
      where: { simulationId_offsetSeconds: { simulationId: simulation.id, offsetSeconds } },
      create: { simulationId: simulation.id, offsetSeconds, health, metrics, payload: { closing: true } },
      update: { health, metrics, payload: { closing: true } },
    });
  }

  private weightsOf(simulation: RunRecord): Record<string, number> | null {
    return (simulation.scenario?.scoreWeights as Record<string, number> | null) ?? null;
  }

  private scenarioEventsOf(simulation: RunRecord) {
    return simulation.scenario?.events ?? [];
  }

  private scoreInputOf(simulation: RunRecord, elapsedSeconds: number): SimulationScoreInput {
    return buildSimulationScoreInput({ scenarioEvents: this.scenarioEventsOf(simulation), events: simulation.events, incidents: simulation.incidents, decisions: simulation.decisions, elapsedSeconds });
  }

  private async restoreAssets(tx: Prisma.TransactionClient, simulation: RunRecord, appliedAssets: Map<string, { status: AssetStatus; condition: AssetCondition }>) {
    const restored = new Map(appliedAssets);
    for (const event of simulation.events) {
      const payload = event.payload as Prisma.JsonObject | null;
      if (event.assetId && event.eventType === SimulationScenarioEventType.ASSET_FAILURE && payload?.previousStatus) restored.set(event.assetId, { status: payload.previousStatus as AssetStatus, condition: (payload.previousCondition as AssetCondition) ?? AssetCondition.GOOD });
    }
    for (const [assetId, state] of restored) await tx.asset.update({ where: { id: assetId }, data: { status: state.status, condition: state.condition } });
  }

  private resolveSimulatedIncidents(tx: Prisma.TransactionClient, id: string) {
    return tx.incident.updateMany({ where: { simulationId: id, status: { in: ACTIVE_INCIDENT_STATUSES } }, data: { status: IncidentStatus.RESOLVED, resolvedAt: new Date() } });
  }

  private async closeRun(simulation: RunRecord, to: SimulationDbStatus, actorId: string, options: { reason?: string; score: boolean }) {
    this.ensureTransition(simulation.status, to);
    const input = this.scoreInputOf(simulation, simulation.elapsedSeconds);
    const breakdown = buildSimulationBreakdown(input, this.weightsOf(simulation));
    const score = options.score ? calculateCompositeScore(breakdown.dimensions, breakdown.weights) : null;
    const health = deriveSimulationHealth(input);
    const outcome = evaluateSimulationOutcome({
      objectives: simulation.scenario?.objectives as SimulationObjective[] | null,
      successCriteria: simulation.scenario?.successCriteria as SimulationCriterion[] | null,
      failureCriteria: simulation.scenario?.failureCriteria as SimulationCriterion[] | null,
      dimensions: breakdown.dimensions,
    });
    const data: Prisma.SimulationUpdateInput = {
      status: to as SimulationStatus,
      endedAt: to === SimulationStatus.CANCELLED ? undefined : new Date(),
      cancelledAt: to === SimulationStatus.CANCELLED ? new Date() : undefined,
      failureReason: to === SimulationStatus.FAILED ? [options.reason, ...outcome.failureReasons].filter(Boolean).join(" ") || "Falha registrada." : undefined,
      score,
      scoreBreakdown: to === SimulationStatus.CANCELLED ? undefined : (breakdown as unknown as Prisma.InputJsonValue),
      metrics: { health, ...breakdown.counters, successEvaluated: outcome.successEvaluated, failureTriggered: outcome.failureTriggered, failureReasons: outcome.failureReasons } as unknown as Prisma.InputJsonValue,
    };
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.restoreAssets(tx, simulation, new Map());
      await this.resolveSimulatedIncidents(tx, simulation.id);
      await tx.simulationEvent.create({ data: { simulationId: simulation.id, eventType: to === SimulationStatus.CANCELLED ? "SIMULATION_CANCELLED" : to === SimulationStatus.FAILED ? "SIMULATION_FAILED" : "SIMULATION_FINISHED", title: to === SimulationStatus.CANCELLED ? "Simulação cancelada" : to === SimulationStatus.FAILED ? "Simulação falhou" : "Simulação encerrada", description: `Estado final registrado como ${to}.`, offsetSeconds: simulation.elapsedSeconds } });
      await this.writeClosingSnapshot(tx, simulation, simulation.elapsedSeconds, breakdown, health);
      return tx.simulation.update({ where: { id: simulation.id }, data });
    });
    await this.emitClosing(simulation, updated, to, actorId, score, input, options.reason);
    return { ...updated, score, breakdown, outcome };
  }

  private async emitClosing(simulation: RunRecord, updated: { score: number | null }, to: SimulationDbStatus, actorId: string, score: number | null, input: SimulationScoreInput, reason?: string) {
    if (to === SimulationStatus.CANCELLED) {
      await this.bus?.emit("simulation.cancelled", { entityId: simulation.id, actorId, name: simulation.name, electionId: simulation.electionId, elapsedSeconds: simulation.elapsedSeconds });
      return;
    }
    if (to === SimulationStatus.FAILED) {
      await this.bus?.emit("simulation.failed", { entityId: simulation.id, actorId, name: simulation.name, electionId: simulation.electionId, reason: reason ?? "Falha registrada.", elapsedSeconds: simulation.elapsedSeconds });
    } else {
      await this.bus?.emit("simulation.finished", { entityId: simulation.id, actorId, name: simulation.name, electionId: simulation.electionId, elapsedSeconds: simulation.elapsedSeconds, incidentCount: simulation.incidents.length });
    }
    if (score !== null) await this.bus?.emit("simulation.scored", { entityId: simulation.id, actorId, name: simulation.name, electionId: simulation.electionId, score, executedEvents: input.appliedEvents, plannedEvents: input.plannedEvents });
  }

  async finish(id: string, actorId: string) {
    const simulation = await this.get(id);
    if (simulation.status !== SimulationStatus.RUNNING && simulation.status !== SimulationStatus.PAUSED) throw new ConflictException("A simulação não está ativa.");
    const input = this.scoreInputOf(simulation, simulation.elapsedSeconds);
    const breakdown = buildSimulationBreakdown(input, this.weightsOf(simulation));
    const dimensions = breakdown.dimensions;
    const outcome = evaluateSimulationOutcome({
      objectives: simulation.scenario?.objectives as SimulationObjective[] | null,
      successCriteria: simulation.scenario?.successCriteria as SimulationCriterion[] | null,
      failureCriteria: simulation.scenario?.failureCriteria as SimulationCriterion[] | null,
      dimensions,
    });
    // O critério de falha classifica o resultado, mas não interrompe a execução (§1.8).
    if (outcome.failureTriggered) return this.closeRun(simulation, "FAILED", actorId, { reason: undefined, score: true });
    return this.closeRun(simulation, "FINISHED", actorId, { score: true });
  }

  async cancel(id: string, actorId: string) {
    const simulation = await this.get(id);
    return this.closeRun(simulation, "CANCELLED", actorId, { score: false });
  }

  async fail(id: string, dto: FailSimulationDto, actorId: string) {
    const simulation = await this.get(id);
    if (!dto.reason?.trim()) throw new BadRequestException("Informe o motivo da falha.");
    return this.closeRun(simulation, "FAILED", actorId, { reason: dto.reason.trim(), score: true });
  }

  async report(id: string) {
    const simulation = await this.get(id);
    const input = this.scoreInputOf(simulation, simulation.elapsedSeconds);
    const persisted = simulation.scoreBreakdown as SimulationScoreBreakdown | null;
    const breakdown = persisted?.dimensions ? persisted : buildSimulationBreakdown(input, this.weightsOf(simulation));
    const score = simulation.score ?? calculateCompositeScore(breakdown.dimensions, breakdown.weights);
    const events = simulation.events;
    return {
      score,
      breakdown,
      plannedEvents: input.plannedEvents,
      executedEvents: input.appliedEvents,
      failedEvents: events.filter((event) => event.result === "FAILED").length,
      incidentsCreated: input.incidentsCreated,
      resolvedIncidents: input.incidentsResolved,
      transmissionFailures: input.transmissionFailures,
      transmissionRecoveries: input.transmissionRecoveries,
      averageRecoverySeconds: input.meanRecoverySeconds ?? 0,
      slaViolations: input.deadlineMisses,
      unresolved: input.incidentsUnresolved,
      timeline: this.timeline(events),
    };
  }

  private timeline(events: RunRecord["events"]) {
    return events.map((event) => {
      const payload = (event.payload ?? {}) as Prisma.JsonObject;
      return { id: event.id, offsetSeconds: event.offsetSeconds, eventType: event.eventType, title: event.title, description: event.description, result: event.result, severity: event.severity, targetType: payload.targetType ?? null, targetId: payload.targetId ?? null, incidentId: event.incidentId, assetId: event.assetId, pollingPlaceId: event.pollingPlaceId, incident: event.incident ?? null, asset: event.asset ?? null, pollingPlace: event.pollingPlace ?? null };
    });
  }

  /* ---------------------------------------------------------------- *
   * Replay e decisões (§1.9)
   * ---------------------------------------------------------------- */

  async replay(id: string) {
    const simulation = await this.get(id);
    const events = simulation.events;
    const frames = simulation.snapshots.map((snapshot) => ({
      offsetSeconds: snapshot.offsetSeconds,
      health: snapshot.health,
      metrics: snapshot.metrics,
      events: this.timeline(events.filter((event) => event.offsetSeconds === snapshot.offsetSeconds)),
    }));
    const executed = new Set(events.map((event) => event.scenarioEventId).filter((value): value is string => Boolean(value)));
    const plannedEvents = this.scenarioEventsOf(simulation).map((event) => ({
      id: event.id,
      offsetSeconds: event.offsetSeconds,
      type: event.type,
      enabled: event.enabled,
      status: !event.enabled ? "DISABLED" : executed.has(event.id) ? "EXECUTED" : "PENDING",
      impact: event.impact,
    }));
    return { simulationId: id, elapsedSeconds: simulation.elapsedSeconds, frames, plannedEvents };
  }

  async replayFrame(id: string, offsetSeconds: number) {
    const simulation = await this.get(id);
    const eligible = simulation.snapshots.filter(
      (entry) => entry.offsetSeconds <= offsetSeconds,
    );
    const snapshot = eligible.length > 0 ? eligible[eligible.length - 1] : null;
    const events = simulation.events.filter((event) => event.offsetSeconds <= offsetSeconds && (!snapshot || event.offsetSeconds > snapshot.offsetSeconds));
    return {
      simulationId: id,
      offsetSeconds,
      available: Boolean(snapshot),
      snapshotOffset: snapshot?.offsetSeconds ?? null,
      health: snapshot?.health ?? null,
      metrics: snapshot?.metrics ?? null,
      events: this.timeline(events),
    };
  }

  async decisions(id: string) {
    await this.requireRun(id);
    return this.prisma.simulationDecision.findMany({ where: { simulationId: id }, include: { actor: { select: { id: true, name: true } } }, orderBy: [{ offsetSeconds: "asc" }, { createdAt: "asc" }] });
  }

  async recordDecision(id: string, dto: RecordDecisionDto, actorId: string) {
    const simulation = await this.requireRun(id);
    const rationale = dto.rationale?.trim();
    if (!rationale) throw new BadRequestException("A justificativa da decisão é obrigatória.");
    const offsetSeconds = dto.offsetSeconds ?? simulation.elapsedSeconds;
    const decision = await this.prisma.simulationDecision.create({ data: { simulationId: id, offsetSeconds, kind: dto.kind, rationale, actorId, payload: toInput(dto.payload) }, include: { actor: { select: { id: true, name: true } } } });
    await this.bus?.emit("simulation.decision_recorded", { entityId: decision.id, actorId, simulationId: id, kind: decision.kind, offsetSeconds, rationale });
    return decision;
  }

  private async requireRun(id: string) {
    const simulation = await this.prisma.simulation.findUnique({ where: { id }, select: { id: true, elapsedSeconds: true } });
    if (!simulation) throw new NotFoundException("Simulação não encontrada.");
    return simulation;
  }

  /* ---------------------------------------------------------------- *
   * Comparação (§1.10)
   * ---------------------------------------------------------------- */

  async compare(simulationIds: string[]) {
    const runs = await this.prisma.simulation.findMany({ where: { id: { in: simulationIds } }, select: { id: true, name: true, status: true, score: true, seed: true, electionId: true, scoreBreakdown: true } });
    if (runs.length !== new Set(simulationIds).size) throw new NotFoundException("Uma ou mais execuções não foram encontradas.");
    const elections = new Set(runs.map((run) => run.electionId));
    if (elections.size > 1) throw new BadRequestException("As execuções comparadas precisam pertencer ao mesmo pleito.");
    const ordered = simulationIds.map((id) => runs.find((run) => run.id === id)!).filter(Boolean);
    return compareSimulationRuns(ordered.map((run) => ({ id: run.id, name: run.name, status: apiStatus(run.status), score: run.score, seed: run.seed, electionId: run.electionId, breakdown: (run.scoreBreakdown as SimulationScoreBreakdown | null) ?? null })));
  }

  /* ---------------------------------------------------------------- *
   * Cenários (§1.5)
   * ---------------------------------------------------------------- */

  async scenarios(query: { status?: string; isTemplate?: boolean } = {}) {
    const scenarios = await this.prisma.simulationScenario.findMany({
      where: { active: true, status: query.status ? (query.status as SimulationScenarioStatus) : undefined, isTemplate: query.isTemplate },
      include: { events: { orderBy: { offsetSeconds: "asc" } }, _count: { select: { simulations: true, clones: true } } },
      orderBy: { name: "asc" },
    });
    return scenarios.map((scenario) => this.presentScenario(scenario));
  }

  private presentScenario<T extends { events: { enabled: boolean }[] }>(scenario: T) {
    return { ...scenario, eventCount: scenario.events.length, enabledEventCount: scenario.events.filter((event) => event.enabled).length };
  }

  async getScenario(id: string) {
    const scenario = await this.prisma.simulationScenario.findUnique({ where: { id }, include: { events: { orderBy: { offsetSeconds: "asc" } }, election: { select: { id: true, name: true } }, clonedFrom: { select: { id: true, name: true, version: true } }, _count: { select: { simulations: true, clones: true } } } });
    if (!scenario) throw new NotFoundException("Cenário não encontrado.");
    return scenario;
  }

  private validateScenarioConfig(dto: { objectives?: unknown; successCriteria?: unknown; failureCriteria?: unknown; scoreWeights?: unknown; initialConditions?: unknown }) {
    const errors = [
      ...validateObjectives(dto.objectives),
      ...validateCriteria(dto.successCriteria, "successCriteria"),
      ...validateCriteria(dto.failureCriteria, "failureCriteria"),
      ...validateScoreWeights(dto.scoreWeights),
      ...validateInitialConditions(dto.initialConditions),
    ];
    if (errors.length) throw new BadRequestException(errors.join(" "));
  }

  private async ensureElection(electionId?: string | null) {
    if (!electionId) return;
    const election = await this.prisma.election.findUnique({ where: { id: electionId }, select: { id: true } });
    if (!election) throw new BadRequestException("Pleito informado não foi encontrado.");
  }

  private async ensureScenarioTargets(electionId: string | null, events: { type: SimulationScenarioEventType; targetType: SimulationTargetType; targetId: string | null }[]) {
    for (const event of events) {
      if (event.targetType === SimulationTargetType.NONE || !event.targetId) continue;
      if (event.targetType === SimulationTargetType.POLLING_PLACE) {
        const place = await this.prisma.pollingPlace.findUnique({ where: { id: event.targetId }, select: { electoralZone: { select: { electionId: true } } } });
        if (!place) throw new BadRequestException("Local de votação do evento não foi encontrado.");
        if (electionId && place.electoralZone.electionId !== electionId) throw new BadRequestException("O alvo do evento pertence a outro pleito.");
      }
    }
  }

  async createScenario(dto: CreateSimulationScenarioDto) {
    const events = dto.events ?? [];
    const errors = validateScenarioEvents(events, dto.durationSeconds ?? null);
    if (errors.length) throw new BadRequestException(errors.join(" "));
    this.validateScenarioConfig(dto);
    await this.ensureElection(dto.electionId ?? null);
    await this.ensureScenarioTargets(dto.electionId ?? null, events.map((event) => ({ type: event.type, targetType: event.targetType ?? SimulationTargetType.NONE, targetId: event.targetId ?? null })));
    return this.prisma.simulationScenario.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        electionId: dto.electionId ?? null,
        isTemplate: dto.isTemplate ?? false,
        seed: dto.seed ?? null,
        durationSeconds: dto.durationSeconds ?? null,
        speed: dto.speed ?? 1,
        status: SimulationScenarioStatus.DRAFT,
        version: 1,
        configuration: (dto.configuration ?? {}) as Prisma.InputJsonValue,
        objectives: toInput(dto.objectives),
        successCriteria: toInput(dto.successCriteria),
        failureCriteria: toInput(dto.failureCriteria),
        scoreWeights: toInput(dto.scoreWeights),
        initialConditions: toInput(dto.initialConditions),
        events: { create: events.map((event) => this.scenarioEventData(event)) },
      },
      include: { events: { orderBy: { offsetSeconds: "asc" } }, _count: { select: { simulations: true, clones: true } } },
    });
  }

  private scenarioEventData(event: SimulationScenarioEventInputDto) {
    return { offsetSeconds: event.offsetSeconds, type: event.type, severity: event.severity ?? null, targetType: event.targetType ?? SimulationTargetType.NONE, targetId: event.targetId ?? null, probability: event.probability, enabled: event.enabled ?? true, impact: event.impact ?? null, payload: event.payload === undefined ? undefined : eventPayload(event) };
  }

  private async requireEditableScenario(id: string) {
    const scenario = await this.getScenario(id);
    if (!canEditScenario(scenario.status)) throw new ConflictException("Cenário publicado ou arquivado não aceita edição.");
    return scenario;
  }

  async updateScenario(id: string, dto: UpdateSimulationScenarioDto) {
    const scenario = await this.requireEditableScenario(id);
    this.validateScenarioConfig(dto);
    await this.ensureElection(dto.electionId ?? scenario.electionId);
    const durationSeconds = dto.durationSeconds ?? scenario.durationSeconds;
    const errors = validateScenarioEvents(scenario.events.map((event) => ({ offsetSeconds: event.offsetSeconds, type: event.type as SimulationEventType, targetType: event.targetType, targetId: event.targetId, probability: event.probability, enabled: event.enabled })), durationSeconds);
    if (errors.length) throw new BadRequestException(errors.join(" "));
    return this.prisma.simulationScenario.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        electionId: dto.electionId,
        isTemplate: dto.isTemplate,
        seed: dto.seed,
        durationSeconds: dto.durationSeconds,
        speed: dto.speed,
        active: dto.active,
        objectives: dto.objectives === undefined ? undefined : toInput(dto.objectives),
        successCriteria: dto.successCriteria === undefined ? undefined : toInput(dto.successCriteria),
        failureCriteria: dto.failureCriteria === undefined ? undefined : toInput(dto.failureCriteria),
        scoreWeights: dto.scoreWeights === undefined ? undefined : toInput(dto.scoreWeights),
        initialConditions: dto.initialConditions === undefined ? undefined : toInput(dto.initialConditions),
      },
      include: { events: { orderBy: { offsetSeconds: "asc" } }, _count: { select: { simulations: true, clones: true } } },
    });
  }

  async publishScenario(id: string) {
    const scenario = await this.getScenario(id);
    if (scenario.status === SimulationScenarioStatus.PUBLISHED) throw new ConflictException("O cenário já está publicado.");
    if (scenario.status === SimulationScenarioStatus.ARCHIVED) throw new ConflictException("Cenário arquivado não pode ser publicado.");
    return this.prisma.simulationScenario.update({ where: { id }, data: { status: SimulationScenarioStatus.PUBLISHED } });
  }

  async archiveScenario(id: string) {
    const scenario = await this.getScenario(id);
    if (scenario.status === SimulationScenarioStatus.ARCHIVED) throw new ConflictException("O cenário já está arquivado.");
    return this.prisma.simulationScenario.update({ where: { id }, data: { status: SimulationScenarioStatus.ARCHIVED } });
  }

  /** Clonagem preserva linhagem e incrementa a versão (§1.5). */
  async cloneScenario(id: string, dto: CloneSimulationScenarioDto) {
    const original = await this.getScenario(id);
    if (original.status === SimulationScenarioStatus.ARCHIVED) throw new ConflictException("Cenário arquivado não pode ser clonado.");
    const clone = await this.prisma.simulationScenario.create({
      data: {
        name: dto.name ?? `${original.name} (cópia)`,
        description: original.description,
        configuration: original.configuration as Prisma.InputJsonValue,
        electionId: dto.electionId ?? original.electionId,
        isTemplate: dto.isTemplate ?? false,
        seed: original.seed,
        durationSeconds: original.durationSeconds,
        speed: original.speed,
        status: SimulationScenarioStatus.DRAFT,
        version: original.version + 1,
        clonedFromId: original.id,
        objectives: original.objectives === null ? undefined : (original.objectives as Prisma.InputJsonValue),
        successCriteria: original.successCriteria === null ? undefined : (original.successCriteria as Prisma.InputJsonValue),
        failureCriteria: original.failureCriteria === null ? undefined : (original.failureCriteria as Prisma.InputJsonValue),
        scoreWeights: original.scoreWeights === null ? undefined : (original.scoreWeights as Prisma.InputJsonValue),
        initialConditions: original.initialConditions === null ? undefined : (original.initialConditions as Prisma.InputJsonValue),
        events: { create: original.events.map((event) => ({ offsetSeconds: event.offsetSeconds, type: event.type, severity: event.severity, targetType: event.targetType, targetId: event.targetId, probability: event.probability, enabled: event.enabled, impact: event.impact, payload: event.payload === null ? undefined : (event.payload as Prisma.InputJsonValue) })) },
      },
      include: { events: { orderBy: { offsetSeconds: "asc" } }, _count: { select: { simulations: true, clones: true } } },
    });
    return clone;
  }

  async deleteScenario(id: string) {
    const scenario = await this.requireEditableScenario(id);
    if ((scenario._count?.simulations ?? 0) > 0) throw new BadRequestException("Cenário possui simulações vinculadas e não pode ser excluído.");
    await this.prisma.simulationScenario.delete({ where: { id } });
    return { id, deleted: true };
  }

  async addScenarioEvent(scenarioId: string, dto: SimulationScenarioEventInputDto) {
    const scenario = await this.requireEditableScenario(scenarioId);
    const existing: ScenarioEventInput[] = scenario.events.map((event) => ({ offsetSeconds: event.offsetSeconds, type: event.type as SimulationEventType, severity: event.severity, targetType: event.targetType, targetId: event.targetId, probability: event.probability, enabled: event.enabled }));
    const errors = validateScenarioEvents([...existing, { ...dto, type: dto.type as SimulationEventType }], scenario.durationSeconds);
    if (errors.length) throw new BadRequestException(errors.join(" "));
    await this.ensureScenarioTargets(scenario.electionId, [{ type: dto.type, targetType: dto.targetType ?? SimulationTargetType.NONE, targetId: dto.targetId ?? null }]);
    return this.prisma.simulationScenarioEvent.create({ data: { scenarioId, ...this.scenarioEventData(dto) } });
  }

  async updateScenarioEvent(scenarioId: string, eventId: string, dto: UpdateScenarioEventDto) {
    const scenario = await this.requireEditableScenario(scenarioId);
    const event = scenario.events.find((entry) => entry.id === eventId);
    if (!event) throw new NotFoundException("Evento do cenário não encontrado.");
    return this.prisma.simulationScenarioEvent.update({ where: { id: eventId }, data: { enabled: dto.enabled, impact: dto.impact } });
  }

  async duplicateScenarioEvent(scenarioId: string, eventId: string) {
    const scenario = await this.requireEditableScenario(scenarioId);
    const original = scenario.events.find((event) => event.id === eventId);
    if (!original) throw new NotFoundException("Evento do cenário não encontrado.");
    let offset = original.offsetSeconds + 1;
    while (scenario.events.some((event) => event.type === original.type && event.offsetSeconds === offset)) offset += 1;
    return this.prisma.simulationScenarioEvent.create({ data: { scenarioId, offsetSeconds: offset, type: original.type, severity: original.severity, targetType: original.targetType, targetId: original.targetId, probability: original.probability, enabled: original.enabled, impact: original.impact, payload: original.payload === null ? undefined : (original.payload as Prisma.InputJsonValue) } });
  }

  async deleteScenarioEvent(scenarioId: string, eventId: string) {
    const scenario = await this.requireEditableScenario(scenarioId);
    if (!scenario.events.some((event) => event.id === eventId)) throw new NotFoundException("Evento do cenário não encontrado.");
    await this.prisma.simulationScenarioEvent.delete({ where: { id: eventId } });
    return { id: eventId, deleted: true };
  }
}
