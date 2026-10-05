import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import { ReportsService } from "./reports.service";

function model(methods: string[], value: unknown = []) {
  return Object.fromEntries(methods.map((method) => [method, vi.fn().mockResolvedValue(value)]));
}

function countable(...methods: string[]) {
  return { ...model(methods), count: vi.fn().mockResolvedValue(0) };
}

function createPrisma(overrides: Record<string, Partial<Record<string, unknown>>> = {}) {
  const prisma = {
    election: model(["findMany"]),
    electoralZone: model(["findMany"]),
    pollingPlace: model(["findMany"]),
    incident: countable("findMany"),
    asset: model(["findMany"]),
    assetMovement: countable("findMany"),
    distributionRoute: countable("findMany"),
    transmissionPoint: countable("findMany"),
    transmissionAttempt: model(["findMany"]),
    fieldTeam: model(["findMany"]),
    fieldAllocation: countable("findMany"),
    fieldDispatch: countable("findMany"),
    task: countable("findMany"),
  };
  for (const [entity, methods] of Object.entries(overrides)) {
    for (const [method, value] of Object.entries(methods ?? {})) {
      (prisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>)[entity][method].mockResolvedValue(value);
    }
  }
  return prisma;
}

function service(prisma: ReturnType<typeof createPrisma>) {
  return new ReportsService(prisma as unknown as PrismaService);
}

const geography = {
  electoralZone: { findMany: [{ id: "z-1", number: 1, name: "Centro" }] },
  pollingPlace: { findMany: [{ id: "pl-1", name: "Local A", electoralZoneId: "z-1" }, { id: "pl-2", name: "Local B", electoralZoneId: "z-1" }] },
};

const report = {
  generatedAt: "2026-10-01T12:00:00.000Z", filters: {}, elections: [],
  executive: { operationalPlaces: 10, criticalPlaces: 2, openIncidents: 3, slaPercentage: 90, availableAssets: 8, unavailableAssets: 1, transmissionPercentage: 75, routesInProgress: 2, delayedDeliveries: 1, activeTeams: 0, teamsAvailable: false },
  incidents: { total: 3, open: 3, bySeverity: [], byCategory: [], byStatus: [], averageResolutionMinutes: 30, slaPercentage: 90, timeline: [] },
  inventory: { total: 9, byStatus: [], byCondition: [], byType: [], byLocation: [], movements: 2 },
  availability: { operationalPlacesPercentage: 83.3, availableAssetsPercentage: 88.9, onlineTransmissionPoints: 1 },
  transmission: { total: 4, completed: 3, byStatus: [], byConnectivity: [] }, logistics: { totalRoutes: 3, activeRoutes: 2, delayedRoutes: 1 },
  byZone: [{ id: "z-1", label: "Zona 1", places: 10, criticalPlaces: 2, openIncidents: 3, assets: 9, routesInProgress: 2, transmissionPercentage: 75, activeTeams: 0 }], byPlace: [],
  history: { available: false, current: { incidents: 3, transmissions: 3 }, previous: null },
};

describe("ReportsService", () => {
  it("exporta CSV com indicadores persistidos", async () => {
    const instance = new ReportsService({} as PrismaService);
    vi.spyOn(instance, "executive").mockResolvedValue(report);
    const csv = await instance.csv({});
    expect(csv).toContain('"Locais operacionais","10"');
    expect(csv).toContain('"Zona 1"');
  });

  it("gera um PDF válido a partir do relatório", async () => {
    const instance = new ReportsService({} as PrismaService);
    vi.spyOn(instance, "executive").mockResolvedValue(report);
    const pdf = await instance.pdf({});
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(500);
  });

  it("mapeia o filtro compartilhado de status apenas para o domínio compatível", async () => {
    const prisma = createPrisma({ ...geography });
    await service(prisma).operations({ status: "SUCCESS", zoneId: "z-1", electionId: "e-1" });
    expect(prisma.transmissionPoint.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "SUCCESS", electoralZoneId: "z-1", electionId: "e-1" }) }));
    expect(prisma.incident.findMany.mock.calls[0][0].where.status).toBeUndefined();
  });

  it("agrega operações combinando incidentes, transmissão, tarefas, ativos e rotas", async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60 * 60 * 1000);
    const prisma = createPrisma({
      ...geography,
      incident: { findMany: [{ id: "i-1", electoralZoneId: "z-1", pollingPlaceId: "pl-1", severity: "CRITICAL", status: "NEW" }, { id: "i-2", electoralZoneId: "z-1", pollingPlaceId: "pl-2", severity: "LOW", status: "RESOLVED" }] },
      transmissionPoint: { findMany: [{ id: "t-1", electoralZoneId: "z-1", pollingPlaceId: "pl-1", status: "SUCCESS" }, { id: "t-2", electoralZoneId: "z-1", pollingPlaceId: "pl-2", status: "FAILED" }] },
      task: { findMany: [{ id: "k-1", electoralZoneId: "z-1", pollingPlaceId: "pl-1", status: "PENDING", dueAt: past }] },
      asset: { findMany: [{ id: "a-1", electoralZoneId: "z-1", pollingPlaceId: "pl-1", status: "AVAILABLE", condition: "GOOD" }] },
      distributionRoute: { findMany: [{ id: "r-1", electoralZoneId: "z-1", status: "DELAYED", plannedArrival: past }] },
    });
    const result = await service(prisma).operations({});
    expect(result.summary.incidents).toBe(2);
    expect(result.summary.openIncidents).toBe(1);
    expect(result.summary.transmissionSuccessRate).toBe(50);
    expect(result.summary.tasksOverdue).toBe(1);
    expect(result.summary.delayedRoutes).toBe(1);
    expect(result.breakdown.byZone[0].id).toBe("z-1");
    expect(result.breakdown.byPlace[0].id).toBe("pl-1");
  });

  it("calcula severidade, tempo de resolução e SLA dos incidentes", async () => {
    const base = new Date("2026-10-01T10:00:00.000Z");
    const prisma = createPrisma({
      ...geography,
      incident: { findMany: [
        { id: "i-1", electoralZoneId: "z-1", pollingPlaceId: "pl-1", severity: "CRITICAL", status: "RESOLVED", openedAt: base, resolvedAt: new Date("2026-10-01T10:30:00.000Z"), slaDeadline: new Date("2026-10-01T11:00:00.000Z"), category: { name: "Rede" } },
        { id: "i-2", electoralZoneId: "z-1", pollingPlaceId: "pl-2", severity: "LOW", status: "RESOLVED", openedAt: base, resolvedAt: new Date("2026-10-01T12:00:00.000Z"), slaDeadline: new Date("2026-10-01T11:00:00.000Z"), category: { name: "Energia" } },
        { id: "i-3", electoralZoneId: "z-1", pollingPlaceId: "pl-2", severity: "MEDIUM", status: "NEW", openedAt: base, resolvedAt: null, slaDeadline: null, category: { name: "Rede" } },
      ] },
    });
    const result = await service(prisma).incidents({});
    expect(result.summary.total).toBe(3);
    expect(result.summary.open).toBe(1);
    expect(result.summary.critical).toBe(1);
    expect(result.summary.averageResolutionMinutes).toBe(75);
    expect(result.summary.slaPercentage).toBe(50);
  });

  it("calcula taxas, latência e retentativas da transmissão", async () => {
    const when = new Date("2026-10-01T10:00:00.000Z");
    const prisma = createPrisma({
      ...geography,
      transmissionPoint: { findMany: [
        { id: "t-1", electoralZoneId: "z-1", pollingPlaceId: "pl-1", status: "SUCCESS", connectivity: "ONLINE", latencyMs: 100, attemptCount: 1, operationalDeadline: null, lastActivity: when },
        { id: "t-2", electoralZoneId: "z-1", pollingPlaceId: "pl-1", status: "FAILED", connectivity: "ONLINE", latencyMs: 300, attemptCount: 3, operationalDeadline: null, lastActivity: when },
        { id: "t-3", electoralZoneId: "z-1", pollingPlaceId: "pl-2", status: "OFFLINE", connectivity: "OFFLINE", latencyMs: null, attemptCount: 2, operationalDeadline: null, lastActivity: when },
      ] },
    });
    const result = await service(prisma).transmission({});
    expect(result.summary.successRate).toBe(33.3);
    expect(result.summary.failureRate).toBe(66.7);
    expect(result.summary.retryRate).toBe(66.7);
    expect(result.summary.averageLatencyMs).toBe(200);
    expect(result.summary.offlinePoints).toBe(1);
  });

  it("usa período anterior de mesma duração terminando no início do atual", async () => {
    const prisma = createPrisma({ ...geography });
    prisma.incident.findMany.mockResolvedValue([]);
    prisma.incident.count.mockResolvedValueOnce(5).mockResolvedValueOnce(4);
    const result = await service(prisma).incidents({ from: "2026-10-01T00:00:00.000Z", to: "2026-10-02T00:00:00.000Z" });
    expect(result.comparison.available).toBe(true);
    expect(result.comparison.previous).toEqual({ total: 5, resolved: 4 });
    const previousWindow = prisma.incident.count.mock.calls[0][0].where.openedAt;
    expect(previousWindow.gte).toEqual(new Date("2026-09-30T00:00:00.000Z"));
    expect(previousWindow.lt).toEqual(new Date("2026-10-01T00:00:00.000Z"));
  });

  it("trata período vazio sem dados e sem comparação", async () => {
    const prisma = createPrisma({ ...geography });
    const result = await service(prisma).operations({});
    expect(result.summary.transmissionSuccessRate).toBe(0);
    expect(result.summary.incidents).toBe(0);
    expect(result.comparison).toEqual({ available: false, current: { incidents: 0, tasks: 0, routes: 0 }, previous: null });
  });

  it("calcula tempo de resposta e cobertura de equipes a partir dos despachos", async () => {
    const start = new Date("2026-10-01T10:00:00.000Z");
    const prisma = createPrisma({
      ...geography,
      fieldTeam: { findMany: [{ id: "tm-1", name: "Equipe 1", status: "ACTIVE" }] },
      fieldAllocation: { findMany: [{ id: "al-1", teamId: "tm-1", electoralZoneId: "z-1", pollingPlaceId: "pl-1", status: "ACTIVE" }] },
      fieldDispatch: { findMany: [
        { id: "d-1", teamId: "tm-1", electoralZoneId: "z-1", pollingPlaceId: "pl-1", status: "COMPLETED", requestedAt: start, dispatchedAt: null, acceptedAt: new Date("2026-10-01T10:10:00.000Z"), arrivedAt: null },
        { id: "d-2", teamId: "tm-1", electoralZoneId: "z-1", pollingPlaceId: "pl-2", status: "COMPLETED", requestedAt: start, dispatchedAt: null, acceptedAt: new Date("2026-10-01T10:20:00.000Z"), arrivedAt: null },
      ] },
    });
    const result = await service(prisma).workforce({ electionId: "e-1" });
    expect(result.summary.averageResponseMinutes).toBe(15);
    expect(result.summary.availabilityRate).toBe(100);
    expect(result.summary.coverageRate).toBe(50);
  });

  it("mantém o relatório executivo inalterado", async () => {
    const prisma = createPrisma();
    const result = await service(prisma).executive({});
    expect(Object.keys(result).sort()).toEqual(["availability", "byPlace", "byZone", "elections", "executive", "filters", "generatedAt", "history", "incidents", "inventory", "logistics", "transmission"]);
    expect(result.executive.operationalPlaces).toBe(0);
    expect(result.byZone).toEqual([]);
    expect(result.history.available).toBe(false);
  });
});
