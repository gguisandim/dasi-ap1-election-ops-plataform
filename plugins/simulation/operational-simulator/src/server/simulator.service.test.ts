import { AssetCondition, AssetStatus, FailureProbability, IncidentSeverity, SimulationStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import { SimulatorService } from "./simulator.service";

function simulation(overrides: Record<string, unknown> = {}) {
  return { id: "sim-12345", name: "Treinamento", electionId: "election-1", scenarioId: null, status: SimulationStatus.DRAFT, speed: 5, probability: FailureProbability.HIGH, connectivity: true, equipment: true, transmission: false, logistics: false, applyToOperations: true, elapsedSeconds: 0, startedAt: null, pausedAt: null, endedAt: null, createdById: null, createdAt: new Date(), updatedAt: new Date(), election: { id: "election-1", name: "Pleito" }, scenario: null, events: [], incidents: [], ...overrides };
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
});
