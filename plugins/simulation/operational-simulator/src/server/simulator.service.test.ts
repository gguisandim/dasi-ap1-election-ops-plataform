import { AssetCondition, AssetStatus, FailureProbability, IncidentSeverity, SimulationScenarioEventType, SimulationScenarioStatus, SimulationStatus, SimulationTargetType } from "@prisma/client";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import {
  canEditScenario,
  canExecuteScenario,
  calculateCompositeScore,
  compareSimulationRuns,
  evaluateSimulationOutcome,
  SIMULATION_EVENT_METADATA,
  SIMULATION_TRANSITIONS,
  validateScoreWeights,
} from "@eops/shared/simulation";
import { SimulatorService } from "./simulator.service";
import { createTickRng, pendingScenarioEvents, validateScenarioEvents } from "./simulator.engine";

function simulation(overrides: Record<string, unknown> = {}) {
  return {
    id: "sim-12345", name: "Treinamento", electionId: "election-1", scenarioId: null,
    status: SimulationStatus.DRAFT, speed: 5, probability: FailureProbability.HIGH,
    connectivity: true, equipment: true, transmission: false, logistics: false, applyToOperations: true,
    elapsedSeconds: 0, seed: null, score: null, scoreBreakdown: null, metrics: null, failureReason: null,
    startedAt: null, simulatedStartedAt: null, pausedAt: null, endedAt: null, cancelledAt: null, createdById: null,
    createdAt: new Date(), updatedAt: new Date(),
    election: { id: "election-1", name: "Pleito" }, scenario: null, events: [], incidents: [], snapshots: [], decisions: [],
    ...overrides,
  };
}

function scenarioSimulation(events: unknown[], overrides: Record<string, unknown> = {}) {
  return simulation({
    status: SimulationStatus.RUNNING, seed: 7, applyToOperations: false,
    scenario: { id: "scenario-1", name: "Cenário", seed: 7, speed: 5, status: SimulationScenarioStatus.PUBLISHED, isTemplate: false, scoreWeights: null, objectives: null, successCriteria: null, failureCriteria: null, events },
    ...overrides,
  });
}

function scenarioEvent(overrides: Record<string, unknown> = {}) {
  return { id: "scenario-event-1", scenarioId: "scenario-1", offsetSeconds: 10, type: SimulationScenarioEventType.TRANSMISSION_FAILURE, severity: null, targetType: SimulationTargetType.TRANSMISSION, targetId: "point-1", probability: 100, enabled: true, impact: null, payload: {}, createdAt: new Date(), ...overrides };
}

function txClient(extra: Record<string, unknown> = {}) {
  return {
    simulation: { update: vi.fn().mockResolvedValue({}) }, simulationEvent: { create: vi.fn().mockResolvedValue({ id: "event-1" }) },
    simulationSnapshot: { upsert: vi.fn().mockResolvedValue({}) }, incident: { create: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    asset: { update: vi.fn().mockResolvedValue({}), findUnique: vi.fn() }, pollingPlace: { findUnique: vi.fn() }, incidentCategory: { findUnique: vi.fn(), findFirst: vi.fn() },
    ...extra,
  };
}

function prismaWith(tx: ReturnType<typeof txClient>, extra: Record<string, unknown> = {}) {
  return { $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)), simulationSnapshot: { upsert: vi.fn().mockResolvedValue({}) }, ...extra } as unknown as PrismaService;
}

describe("SimulatorService", () => {
  it("inicia a simulação e registra o primeiro evento", async () => {
    const tx = txClient();
    const service = new SimulatorService(prismaWith(tx));
    vi.spyOn(service, "get").mockResolvedValue(simulation() as never);
    await service.start("sim-12345");
    expect(tx.simulationEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: "VOTING_STARTED", offsetSeconds: 0 }) }));
  });

  it("expõe o status traduzido para o vocabulário da API no detalhe", async () => {
    const service = new SimulatorService({} as PrismaService);
    vi.spyOn(service, "get").mockResolvedValue(simulation({ status: SimulationStatus.DRAFT }) as never);
    const detail = await service.detail("sim-12345");
    expect(detail.status).toBe("CREATED");
    expect(detail.statusCode).toBe("DRAFT");
  });

  it("rejeita transições fora da tabela normativa", async () => {
    const service = new SimulatorService(prismaWith(txClient()));
    vi.spyOn(service, "get").mockResolvedValue(simulation({ status: SimulationStatus.DRAFT }) as never);
    await expect(service.pause("sim-12345")).rejects.toBeInstanceOf(ConflictException);
    vi.spyOn(service, "get").mockResolvedValue(simulation({ status: SimulationStatus.FINISHED }) as never);
    await expect(service.start("sim-12345")).rejects.toBeInstanceOf(ConflictException);
  });

  it("step avança TICK_SECONDS e tick avança speed × TICK_SECONDS", async () => {
    const stepTx = txClient();
    const stepService = new SimulatorService(prismaWith(stepTx));
    vi.spyOn(stepService, "get").mockResolvedValue(scenarioSimulation([scenarioEvent({ probability: 0 })]) as never);
    await stepService.step("sim-12345");
    expect(stepTx.simulation.update).toHaveBeenCalledWith(expect.objectContaining({ data: { elapsedSeconds: 180 } }));

    const tickTx = txClient();
    const tickService = new SimulatorService(prismaWith(tickTx));
    vi.spyOn(tickService, "get").mockResolvedValue(scenarioSimulation([scenarioEvent({ probability: 0 })]) as never);
    await tickService.tick("sim-12345");
    expect(tickTx.simulation.update).toHaveBeenCalledWith(expect.objectContaining({ data: { elapsedSeconds: 900 } }));
  });

  it("gera falha, incidente simulado e mudança temporária do ativo no modo legado", async () => {
    const asset = { id: "asset-1", assetTag: "RTR-1", name: "Roteador", status: AssetStatus.IN_USE, condition: AssetCondition.GOOD, pollingPlaceId: "place-1", pollingPlace: { id: "place-1", name: "Escola", electoralZoneId: "zone-1", electoralZone: { electionId: "election-1" } } };
    const incident = { id: "incident-1", code: "SIM-12345-001", title: "Falha", severity: IncidentSeverity.CRITICAL, electionId: "election-1", pollingPlaceId: "place-1" };
    const tx = txClient(); tx.incident.create = vi.fn().mockResolvedValue(incident);
    const prisma = { $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)), simulationSnapshot: { upsert: vi.fn().mockResolvedValue({}) }, asset: { findMany: vi.fn().mockResolvedValue([asset]) }, incidentCategory: { findUnique: vi.fn().mockResolvedValue({ id: "category-1", name: "Equipamento" }) } } as unknown as PrismaService;
    const service = new SimulatorService(prisma);
    vi.spyOn(service, "get").mockResolvedValue(simulation({ status: SimulationStatus.RUNNING }) as never);
    await service.tick("sim-12345");
    expect(tx.incident.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isSimulated: true, simulationId: "sim-12345", severity: IncidentSeverity.CRITICAL }) }));
    expect(tx.asset.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: AssetStatus.MAINTENANCE, condition: AssetCondition.ATTENTION } }));
  });

  it("encerra, resolve incidentes, grava snapshot final e registra o estado terminal", async () => {
    const tx = txClient();
    const service = new SimulatorService(prismaWith(tx));
    vi.spyOn(service, "get").mockResolvedValue(simulation({ status: SimulationStatus.PAUSED }) as never);
    await service.finish("sim-12345", "actor-1");
    expect(tx.incident.updateMany).toHaveBeenCalled();
    expect(tx.simulationEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: "SIMULATION_FINISHED" }) }));
    expect(tx.simulationSnapshot.upsert).toHaveBeenCalled();
    expect(tx.simulation.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: SimulationStatus.FINISHED }) }));
  });

  it("cancel registra cancelledAt e não calcula score", async () => {
    const tx = txClient();
    const service = new SimulatorService(prismaWith(tx));
    vi.spyOn(service, "get").mockResolvedValue(simulation({ status: SimulationStatus.RUNNING }) as never);
    const result = await service.cancel("sim-12345", "actor-1");
    expect(tx.simulation.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: SimulationStatus.CANCELLED }) }));
    expect(result.score).toBeNull();
  });

  it("fail exige motivo e classifica como FAILED", async () => {
    const tx = txClient();
    const service = new SimulatorService(prismaWith(tx));
    vi.spyOn(service, "get").mockResolvedValue(simulation({ status: SimulationStatus.RUNNING }) as never);
    await expect(service.fail("sim-12345", { reason: "  " } as never, "actor-1")).rejects.toBeInstanceOf(BadRequestException);
    await service.fail("sim-12345", { reason: "Queda total do datacenter" } as never, "actor-1");
    expect(tx.simulation.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: SimulationStatus.FAILED, failureReason: expect.stringContaining("Queda total") }) }));
  });

  it("grava snapshot por offset a cada avanço", async () => {
    const tx = txClient();
    const upsert = vi.fn().mockResolvedValue({});
    const prisma = prismaWith(tx, { simulationSnapshot: { upsert } });
    const service = new SimulatorService(prisma);
    vi.spyOn(service, "get").mockResolvedValue(scenarioSimulation([scenarioEvent({ probability: 0 })]) as never);
    await service.step("sim-12345");
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { simulationId_offsetSeconds: { simulationId: "sim-12345", offsetSeconds: 180 } } }));
  });

  it("recusa eventos de cenário com offset e tipo duplicados", () => {
    const errors = validateScenarioEvents([{ offsetSeconds: 60, type: SimulationScenarioEventType.INCIDENT_CREATE, targetType: SimulationTargetType.POLLING_PLACE, targetId: "p1", probability: 100 }, { offsetSeconds: 60, type: SimulationScenarioEventType.INCIDENT_CREATE, targetType: SimulationTargetType.POLLING_PLACE, targetId: "p2", probability: 50 }]);
    expect(errors.join(" ")).toContain("já existe um evento");
  });

  it("exige alvo para tipos que dependem de alvo", () => {
    const errors = validateScenarioEvents([{ offsetSeconds: 30, type: SimulationScenarioEventType.ASSET_FAILURE, targetType: SimulationTargetType.NONE, probability: 100 }]);
    expect(errors.join(" ")).toContain("informe o tipo de alvo");
  });

  it("aceita apenas tipos de evento conhecidos com seus alvos válidos", () => {
    expect(validateScenarioEvents([{ offsetSeconds: 10, type: "UNKNOWN_TYPE" as never, probability: 100 }]).join(" ")).toContain("tipo de evento desconhecido");
    expect(validateScenarioEvents([{ offsetSeconds: 10, type: SimulationScenarioEventType.ROUTE_FAILURE, targetType: SimulationTargetType.POLLING_PLACE, probability: 100 }]).join(" ")).toContain("não é aceito");
  });

  it("executa somente eventos dentro da janela lógica ainda não executados e ignora desabilitados", () => {
    const events = [{ id: "a", offsetSeconds: 0 }, { id: "b", offsetSeconds: 180 }, { id: "c", offsetSeconds: 900 }, { id: "d", offsetSeconds: 90, enabled: false }];
    const pending = pendingScenarioEvents(events, 360, new Set(["b"]));
    expect(pending.map((event) => event.id)).toEqual(["a"]);
  });

  it("produz a mesma sequência com a mesma seed por offset e difere entre offsets", () => {
    const left = [createTickRng(42, 360)(), createTickRng(42, 360)()];
    const right = [createTickRng(42, 360)(), createTickRng(42, 360)()];
    expect(left).toEqual(right);
    expect(createTickRng(42, 0)()).not.toEqual(createTickRng(42, 180)());
    expect(left.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it("marca SKIPPED quando a rolagem de probabilidade falha", async () => {
    const tx = txClient();
    const service = new SimulatorService(prismaWith(tx));
    vi.spyOn(service, "get").mockResolvedValue(scenarioSimulation([scenarioEvent({ probability: 0 })]) as never);
    await service.tick("sim-12345");
    expect(tx.simulationEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ result: "SKIPPED" }) }));
  });

  it("registra FAILED por evento sem abortar os eventos seguintes", async () => {
    const events = [scenarioEvent({ id: "fail", type: SimulationScenarioEventType.INCIDENT_CREATE, targetType: SimulationTargetType.POLLING_PLACE, targetId: "missing", probability: 100 }), scenarioEvent({ id: "ok", type: SimulationScenarioEventType.TRANSMISSION_RECOVERY, targetType: SimulationTargetType.TRANSMISSION, targetId: "point-1", probability: 100 })];
    const tx = txClient(); tx.incidentCategory.findFirst = vi.fn().mockResolvedValue({ id: "category-1", name: "Geral", key: "GENERAL" }); tx.pollingPlace.findUnique = vi.fn().mockResolvedValue(null);
    const service = new SimulatorService(prismaWith(tx));
    vi.spyOn(service, "get").mockResolvedValue(scenarioSimulation(events) as never);
    await service.tick("sim-12345");
    const results = tx.simulationEvent.create.mock.calls.map((call) => (call[0] as { data: { result: string } }).data.result);
    expect(results).toEqual(["FAILED", "APPLIED"]);
    expect(tx.incident.create).not.toHaveBeenCalled();
  });

  it("registra eventos de transmissão sem tocar em TransmissionPoint", async () => {
    const tx = txClient({ transmissionPoint: { update: vi.fn(), updateMany: vi.fn(), create: vi.fn() } });
    const service = new SimulatorService(prismaWith(tx));
    vi.spyOn(service, "get").mockResolvedValue(scenarioSimulation([scenarioEvent({ probability: 100 })]) as never);
    await service.tick("sim-12345");
    expect(tx.simulationEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ result: "APPLIED", eventType: SimulationScenarioEventType.TRANSMISSION_FAILURE }) }));
    expect(tx.transmissionPoint.update).not.toHaveBeenCalled();
    expect(tx.transmissionPoint.updateMany).not.toHaveBeenCalled();
    expect(tx.transmissionPoint.create).not.toHaveBeenCalled();
  });

  it("aplica ASSET_FAILURE em domínio real somente com applyToOperations", async () => {
    const asset = { id: "asset-1", assetTag: "RTR-1", status: AssetStatus.IN_USE, condition: AssetCondition.GOOD, pollingPlaceId: "place-1", pollingPlace: { name: "Escola" } };
    const tx = txClient(); tx.asset.findUnique = vi.fn().mockResolvedValue(asset);
    const service = new SimulatorService(prismaWith(tx));
    vi.spyOn(service, "get").mockResolvedValue(scenarioSimulation([scenarioEvent({ type: SimulationScenarioEventType.ASSET_FAILURE, targetType: SimulationTargetType.ASSET, targetId: "asset-1", probability: 100 })], { applyToOperations: true }) as never);
    await service.tick("sim-12345");
    expect(tx.asset.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: AssetStatus.MAINTENANCE, condition: AssetCondition.ATTENTION } }));
  });

  it("mantém limites de escrita por tipo de evento", () => {
    for (const [type, metadata] of Object.entries(SIMULATION_EVENT_METADATA)) {
      if (!metadata.writesExternalWhenApplied) continue;
      expect(["ASSET_FAILURE", "ASSET_RECOVERY"]).toContain(type);
      expect(metadata.externalDomain).toBe("ASSET");
    }
    expect(SIMULATION_EVENT_METADATA.TRANSMISSION_FAILURE.externalDomain).toBe("TRANSMISSION");
    expect(SIMULATION_EVENT_METADATA.VEHICLE_UNAVAILABLE.writesExternalWhenApplied).toBe(false);
  });

  it("valida pesos de score incluindo soma zero", () => {
    expect(validateScoreWeights({ responseTime: 10, unknown: 5 }).join(" ")).toContain("desconhecida");
    expect(validateScoreWeights({ responseTime: 0, unresolvedIncidents: 0 }).join(" ")).toContain("soma dos pesos");
    expect(validateScoreWeights({ responseTime: 10, unresolvedIncidents: 5 })).toEqual([]);
  });

  it("calcula score ponderado e trata peso total zero como score zero", () => {
    const dimensions = { responseTime: 90, unresolvedIncidents: 40, deadlineMisses: 0, availability: 0, recoveryTime: 0, workforceCoverage: 0, resourceFulfillment: 0, transmission: 0, readiness: 0, accumulatedCriticality: 0, decisionQuality: 0 };
    const onlyResponse = { responseTime: 2, unresolvedIncidents: 0, deadlineMisses: 0, availability: 0, recoveryTime: 0, workforceCoverage: 0, resourceFulfillment: 0, transmission: 0, readiness: 0, accumulatedCriticality: 0, decisionQuality: 0 };
    expect(calculateCompositeScore(dimensions, { ...onlyResponse })).toBe(90);
    const even = { responseTime: 1, unresolvedIncidents: 1, deadlineMisses: 0, availability: 0, recoveryTime: 0, workforceCoverage: 0, resourceFulfillment: 0, transmission: 0, readiness: 0, accumulatedCriticality: 0, decisionQuality: 0 };
    expect(calculateCompositeScore(dimensions, { ...even })).toBe(65);
    expect(calculateCompositeScore(dimensions, { responseTime: 0, unresolvedIncidents: 0, deadlineMisses: 0, availability: 0, recoveryTime: 0, workforceCoverage: 0, resourceFulfillment: 0, transmission: 0, readiness: 0, accumulatedCriticality: 0, decisionQuality: 0 })).toBe(0);
  });

  it("avalia objetivos, sucesso e critérios de falha", () => {
    const dimensions = { responseTime: 90, unresolvedIncidents: 70, deadlineMisses: 100, availability: 100, recoveryTime: 100, workforceCoverage: 100, resourceFulfillment: 100, transmission: 100, readiness: 100, accumulatedCriticality: 100, decisionQuality: 100 } as never;
    const outcome = evaluateSimulationOutcome({
      objectives: [{ key: "responseTime", label: "Responder rápido", target: 80, direction: "AT_LEAST", weight: 1 }],
      successCriteria: [{ metric: "unresolvedIncidents", operator: "GTE", value: 50, label: "Sem pendências" }],
      failureCriteria: [{ metric: "deadlineMisses", operator: "LTE", value: 50, label: "Prazos" }],
      dimensions,
    });
    expect(outcome.objectiveResults[0].met).toBe(true);
    expect(outcome.successEvaluated).toBe(true);
    expect(outcome.failureTriggered).toBe(false);

    const failed = evaluateSimulationOutcome({ failureCriteria: [{ metric: "unresolvedIncidents", operator: "LTE", value: 80, label: "Pendências" }], dimensions });
    expect(failed.failureTriggered).toBe(true);
    expect(failed.failureReasons.length).toBeGreaterThan(0);
  });

  it("clona cenário incrementando a versão e preservando a linhagem", async () => {
    const original = { id: "scenario-1", name: "Base", status: SimulationScenarioStatus.PUBLISHED, version: 3, description: null, configuration: {}, electionId: "election-1", isTemplate: false, seed: 7, durationSeconds: null, speed: 1, clonedFromId: null, objectives: null, successCriteria: null, failureCriteria: null, scoreWeights: null, initialConditions: null, events: [], createdAt: new Date(), _count: { simulations: 0, clones: 0 } };
    const create = vi.fn().mockResolvedValue({ id: "scenario-2", version: 4 });
    const prisma = { simulationScenario: { findUnique: vi.fn().mockResolvedValue(original), create } } as unknown as PrismaService;
    const service = new SimulatorService(prisma);
    await service.cloneScenario("scenario-1", {});
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ version: 4, status: SimulationScenarioStatus.DRAFT, clonedFromId: "scenario-1" }) }));
  });

  it("bloqueia edição de cenário publicado e execução de template/arquivado", async () => {
    const prisma = { simulationScenario: { findUnique: vi.fn().mockResolvedValue({ id: "scenario-1", status: SimulationScenarioStatus.PUBLISHED, events: [], _count: { simulations: 0, clones: 0 } }) } } as unknown as PrismaService;
    const service = new SimulatorService(prisma);
    await expect(service.updateScenario("scenario-1", { name: "Novo" })).rejects.toBeInstanceOf(ConflictException);
    expect(canEditScenario("PUBLISHED")).toBe(false);
    expect(canEditScenario("DRAFT")).toBe(true);
    expect(canExecuteScenario("PUBLISHED", false)).toBe(true);
    expect(canExecuteScenario("PUBLISHED", true)).toBe(false);
    expect(canExecuteScenario("ARCHIVED", false)).toBe(false);
  });

  it("rejeita criação de cenário com configuração estrutural inválida", async () => {
    const service = new SimulatorService({} as PrismaService);
    await expect(service.createScenario({ name: "Cenário inválido", scoreWeights: { unknownDimension: 1 } } as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("compara runs do mesmo pleito e rejeita pleitos distintos", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "a", name: "A", status: SimulationStatus.FINISHED, score: 80, seed: 1, electionId: "election-1", scoreBreakdown: null }, { id: "b", name: "B", status: SimulationStatus.FINISHED, score: 70, seed: 1, electionId: "election-2", scoreBreakdown: null }]);
    const service = new SimulatorService({ simulation: { findMany } } as unknown as PrismaService);
    await expect(service.compare(["a", "b"])).rejects.toBeInstanceOf(BadRequestException);

    findMany.mockResolvedValue([{ id: "a", name: "A", status: SimulationStatus.FINISHED, score: 80, seed: 1, electionId: "election-1", scoreBreakdown: null }, { id: "b", name: "B", status: SimulationStatus.FINISHED, score: 70, seed: 2, electionId: "election-1", scoreBreakdown: null }]);
    const comparison = await service.compare(["a", "b"]);
    expect(comparison.seedMismatch).toBe(true);
  });

  it("trata dimensão ausente como null, nunca zero", () => {
    const comparison = compareSimulationRuns([{ id: "a", name: "A", status: "COMPLETED", score: 80, seed: 1, electionId: "election-1", breakdown: null }]);
    expect(comparison.runs[0].dimensions.responseTime).toBeNull();
    expect(comparison.missingDimensions).toBe(true);
  });

  it("reproduz o replay por offset com snapshot anterior e eventos posteriores", async () => {
    const snapshots = [{ id: "snap-1", offsetSeconds: 180, health: "NORMAL", metrics: {}, payload: null, simulationId: "sim-12345", createdAt: new Date() }];
    const events = [{ id: "e1", simulationId: "sim-12345", eventType: "TRANSMISSION_FAILURE", title: "T", description: null, offsetSeconds: 360, payload: { targetType: "TRANSMISSION", targetId: "point-1" }, result: "APPLIED", severity: null, incidentId: null, assetId: null, pollingPlaceId: null, scenarioEventId: "se-1", createdAt: new Date(), incident: null, asset: null, pollingPlace: null }];
    const service = new SimulatorService({} as PrismaService);
    vi.spyOn(service, "get").mockResolvedValue(simulation({ status: SimulationStatus.FINISHED, snapshots, events }) as never);
    const frame = await service.replayFrame("sim-12345", 400);
    expect(frame.snapshotOffset).toBe(180);
    expect(frame.health).toBe("NORMAL");
    expect(frame.events.map((event) => event.id)).toEqual(["e1"]);
    expect((await service.replayFrame("sim-12345", 100)).snapshotOffset).toBeNull();
  });

  it("a tabela de transições permite apenas os destinos normativos a partir de cada estado", () => {
    expect(SIMULATION_TRANSITIONS.DRAFT).toEqual(["RUNNING", "CANCELLED"]);
    expect(SIMULATION_TRANSITIONS.RUNNING).toEqual(expect.arrayContaining(["PAUSED", "FINISHED", "FAILED", "CANCELLED"]));
    expect(SIMULATION_TRANSITIONS.FINISHED).toEqual([]);
    expect(SIMULATION_TRANSITIONS.FAILED).toEqual([]);
    expect(SIMULATION_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it("registra decisão com justificativa obrigatória", async () => {
    const create = vi.fn().mockResolvedValue({ id: "decision-1", kind: "ESCALATE", offsetSeconds: 0 });
    const prisma = { simulation: { findUnique: vi.fn().mockResolvedValue({ id: "sim-12345", elapsedSeconds: 0 }) }, simulationDecision: { create } } as unknown as PrismaService;
    const service = new SimulatorService(prisma);
    await expect(service.recordDecision("sim-12345", { kind: "ESCALATE", rationale: "  " } as never, "actor-1")).rejects.toBeInstanceOf(BadRequestException);
    await service.recordDecision("sim-12345", { kind: "ESCALATE", rationale: "Risco de queda" } as never, "actor-1");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: "ESCALATE", rationale: "Risco de queda", actorId: "actor-1" }) }));
  });
});
