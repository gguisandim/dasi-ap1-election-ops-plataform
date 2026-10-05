import { AssetCondition, AssetStatus, FailureProbability, IncidentSeverity, SimulationScenarioEventType, SimulationStatus, SimulationTargetType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import { SimulatorService } from "./simulator.service";
import { calculateScore, createRng, pendingScenarioEvents, validateScenarioEvents } from "./simulator.engine";

function simulation(overrides: Record<string, unknown> = {}) {
  return { id: "sim-12345", name: "Treinamento", electionId: "election-1", scenarioId: null, status: SimulationStatus.DRAFT, speed: 5, probability: FailureProbability.HIGH, connectivity: true, equipment: true, transmission: false, logistics: false, applyToOperations: true, elapsedSeconds: 0, seed: null, startedAt: null, pausedAt: null, endedAt: null, createdById: null, createdAt: new Date(), updatedAt: new Date(), election: { id: "election-1", name: "Pleito" }, scenario: null, events: [], incidents: [], ...overrides };
}

function scenarioSimulation(events: unknown[], overrides: Record<string, unknown> = {}) {
  return simulation({ status: SimulationStatus.RUNNING, seed: 7, applyToOperations: false, scenario: { id: "scenario-1", name: "Cenário", seed: 7, events }, ...overrides });
}

function scenarioEvent(overrides: Record<string, unknown> = {}) {
  return { id: "scenario-event-1", scenarioId: "scenario-1", offsetSeconds: 10, type: SimulationScenarioEventType.TRANSMISSION_FAILURE, severity: null, targetType: SimulationTargetType.TRANSMISSION, targetId: "point-1", probability: 100, payload: {}, createdAt: new Date(), ...overrides };
}

describe("SimulatorService", () => {
  it("inicia a simulação e registra o primeiro evento", async () => {
    const tx = { simulation: { update: vi.fn().mockResolvedValue({ status: SimulationStatus.RUNNING }) }, simulationEvent: { create: vi.fn().mockResolvedValue({}) } };
    const prisma = { $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    const service = new SimulatorService(prisma); vi.spyOn(service, "get").mockResolvedValue(simulation() as never);
    await service.start("sim-12345");
    expect(tx.simulationEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: "VOTING_STARTED", offsetSeconds: 0 }) }));
  });
  it("gera falha, incidente simulado e mudança temporária do ativo", async () => {
    const asset = { id: "asset-1", assetTag: "RTR-1", name: "Roteador", status: AssetStatus.IN_USE, condition: AssetCondition.GOOD, pollingPlaceId: "place-1", pollingPlace: { id: "place-1", name: "Escola", electoralZoneId: "zone-1", electoralZone: { electionId: "election-1" } } };
    const incident = { id: "incident-1", code: "SIM-12345-001", title: "Falha", severity: IncidentSeverity.CRITICAL, electionId: "election-1", pollingPlaceId: "place-1" };
    const tx = { incident: { create: vi.fn().mockResolvedValue(incident) }, asset: { update: vi.fn().mockResolvedValue({}) }, simulationEvent: { create: vi.fn().mockResolvedValue({ id: "event-1" }) }, simulation: { update: vi.fn().mockResolvedValue({}) } };
    const prisma = { asset: { findMany: vi.fn().mockResolvedValue([asset]) }, incidentCategory: { findUnique: vi.fn().mockResolvedValue({ id: "category-1", name: "Equipamento" }) }, $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    const service = new SimulatorService(prisma); vi.spyOn(service, "get").mockResolvedValue(simulation({ status: SimulationStatus.RUNNING }) as never);
    await service.tick("sim-12345");
    expect(tx.incident.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isSimulated: true, simulationId: "sim-12345", severity: IncidentSeverity.CRITICAL }) }));
    expect(tx.asset.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: AssetStatus.MAINTENANCE, condition: AssetCondition.ATTENTION } }));
  });
  it("encerra, resolve incidentes e registra o final do replay", async () => {
    const tx = { incident: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) }, asset: { update: vi.fn() }, simulationEvent: { create: vi.fn().mockResolvedValue({}) }, simulation: { update: vi.fn().mockResolvedValue({ status: SimulationStatus.FINISHED }) } };
    const prisma = { $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    const service = new SimulatorService(prisma); vi.spyOn(service, "get").mockResolvedValue(simulation({ status: SimulationStatus.PAUSED }) as never);
    await service.finish("sim-12345");
    expect(tx.incident.updateMany).toHaveBeenCalled();
    expect(tx.simulationEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: "SIMULATION_FINISHED" }) }));
    expect(tx.simulation.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: SimulationStatus.FINISHED }) }));
  });
  it("recusa eventos de cenário com offset e tipo duplicados", () => {
    const errors = validateScenarioEvents([{ offsetSeconds: 60, type: SimulationScenarioEventType.INCIDENT_CREATE, targetType: SimulationTargetType.POLLING_PLACE, probability: 100 }, { offsetSeconds: 60, type: SimulationScenarioEventType.INCIDENT_CREATE, targetType: SimulationTargetType.POLLING_PLACE, probability: 50 }]);
    expect(errors.join(" ")).toContain("já existe um evento");
  });
  it("exige alvo para tipos que dependem de alvo", () => {
    const errors = validateScenarioEvents([{ offsetSeconds: 30, type: SimulationScenarioEventType.ASSET_FAILURE, targetType: SimulationTargetType.NONE, probability: 100 }]);
    expect(errors.join(" ")).toContain("informe o tipo de alvo");
  });
  it("executa somente eventos dentro da janela lógica ainda não executados", () => {
    const events = [{ id: "a", offsetSeconds: 0 }, { id: "b", offsetSeconds: 180 }, { id: "c", offsetSeconds: 900 }];
    const pending = pendingScenarioEvents(events, 360, new Set(["b"]));
    expect(pending.map((event) => event.id)).toEqual(["a"]);
  });
  it("produz a mesma sequência com a mesma seed e sequências distintas sem seed", () => {
    const a = createRng(42); const b = createRng(42);
    const left = [a(), a(), a()]; const right = [b(), b(), b()];
    expect(left).toEqual(right);
    expect(left.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(createRng(1)()).not.toEqual(createRng(2)());
  });
  it("calcula o score com a fórmula explícita", () => {
    const result = calculateScore({ plannedEvents: 4, executedEvents: 2, failedEvents: 1, slaViolations: 1, unresolvedCritical: 1, unrecoveredFailures: 1 });
    expect(result.coverage).toBe(50);
    expect(result.penalties).toBe(38);
    expect(result.skillScore).toBe(62);
    expect(result.score).toBe(58);
  });
  it("marca SKIPPED quando a rolagem de probabilidade falha", async () => {
    const tx = { simulationEvent: { create: vi.fn().mockResolvedValue({ id: "event-1" }) }, simulation: { update: vi.fn().mockResolvedValue({}) } };
    const prisma = { $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    const service = new SimulatorService(prisma);
    vi.spyOn(service, "get").mockResolvedValue(scenarioSimulation([scenarioEvent({ type: SimulationScenarioEventType.TRANSMISSION_FAILURE, probability: 0 })]) as never);
    await service.tick("sim-12345");
    expect(tx.simulationEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ result: "SKIPPED" }) }));
    expect(tx.simulation.update).toHaveBeenCalledWith(expect.objectContaining({ data: { elapsedSeconds: 900 } }));
  });
  it("registra FAILED sem abortar os eventos seguintes", async () => {
    const events = [scenarioEvent({ id: "fail", type: SimulationScenarioEventType.INCIDENT_CREATE, targetType: SimulationTargetType.POLLING_PLACE, targetId: "missing", probability: 100 }), scenarioEvent({ id: "ok", type: SimulationScenarioEventType.TRANSMISSION_RECOVERY, targetType: SimulationTargetType.TRANSMISSION, targetId: "point-1", probability: 100 })];
    const tx = { simulationEvent: { create: vi.fn().mockResolvedValue({}) }, simulation: { update: vi.fn().mockResolvedValue({}) }, incidentCategory: { findFirst: vi.fn().mockResolvedValue({ id: "category-1", name: "Geral", key: "GENERAL" }), findUnique: vi.fn() }, pollingPlace: { findUnique: vi.fn().mockResolvedValue(null) }, incident: { create: vi.fn() } };
    const prisma = { $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    const service = new SimulatorService(prisma);
    vi.spyOn(service, "get").mockResolvedValue(scenarioSimulation(events) as never);
    await service.tick("sim-12345");
    const results = tx.simulationEvent.create.mock.calls.map((call) => (call[0] as { data: { result: string } }).data.result);
    expect(results).toEqual(["FAILED", "APPLIED"]);
    expect(tx.incident.create).not.toHaveBeenCalled();
  });
  it("registra falha de transmissão sem escrever em TransmissionPoint", async () => {
    const tx = { simulationEvent: { create: vi.fn().mockResolvedValue({}) }, simulation: { update: vi.fn().mockResolvedValue({}) }, transmissionPoint: { update: vi.fn(), updateMany: vi.fn(), create: vi.fn() } };
    const prisma = { $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    const service = new SimulatorService(prisma);
    vi.spyOn(service, "get").mockResolvedValue(scenarioSimulation([scenarioEvent({ probability: 100 })]) as never);
    await service.tick("sim-12345");
    expect(tx.simulationEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ result: "APPLIED", eventType: SimulationScenarioEventType.TRANSMISSION_FAILURE }) }));
    expect(tx.transmissionPoint.update).not.toHaveBeenCalled();
    expect(tx.transmissionPoint.updateMany).not.toHaveBeenCalled();
    expect(tx.transmissionPoint.create).not.toHaveBeenCalled();
  });
});
