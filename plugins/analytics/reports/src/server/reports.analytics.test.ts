import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import { ReportsService } from "./reports.service";

const at = (value: string) => new Date(value);

function incidentRow(id: string, openedAt: string, extra: Record<string, unknown> = {}) {
  return {
    id, code: `INC-${id}`, title: `Incidente ${id}`, severity: "HIGH", status: "NEW",
    openedAt: at(openedAt), acknowledgedAt: null, resolvedAt: null, slaDeadline: null,
    escalatedAt: null, escalationLevel: 0, electoralZoneId: "z-1", pollingPlaceId: "p-1", ...extra,
  };
}

function createPrisma(overrides: Record<string, Record<string, unknown>> = {}) {
  const prisma: Record<string, Record<string, unknown>> = {
    incident: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    transmissionStateTransition: { findMany: vi.fn().mockResolvedValue([]) },
    resourceRequest: { findMany: vi.fn().mockResolvedValue([]) },
    fieldDispatch: { findMany: vi.fn().mockResolvedValue([]) },
    electoralZone: { findMany: vi.fn().mockResolvedValue([]) },
    pollingPlace: { findMany: vi.fn().mockResolvedValue([]) },
    pollingSection: { findMany: vi.fn().mockResolvedValue([]) },
  };
  for (const [model, methods] of Object.entries(overrides))
    for (const [method, value] of Object.entries(methods)) prisma[model][method] = vi.fn().mockResolvedValue(value);
  return prisma as unknown as PrismaService & Record<string, Record<string, ReturnType<typeof vi.fn>>>;
}

function service(prisma: ReturnType<typeof createPrisma>) {
  return new ReportsService(prisma as unknown as PrismaService);
}

describe("série temporal", () => {
  it("gera eixo contínuo com buckets vazios zerados e totais do período", async () => {
    const prisma = createPrisma({
      incident: { findMany: [incidentRow("1", "2026-10-01T08:00:00.000Z"), incidentRow("2", "2026-10-02T09:00:00.000Z"), incidentRow("3", "2026-10-02T10:00:00.000Z")] },
    });
    const series = await service(prisma).timeseries({ metric: "incidentsOpened", from: "2026-10-01T00:00:00.000Z", to: "2026-10-03T00:00:00.000Z", granularity: "day" });
    expect(series.bucketCount).toBe(2);
    expect(series.buckets.map((bucket) => bucket.value)).toEqual([1, 2]);
    expect(series.totals).toEqual({ value: 3, sampleSize: 3 });
  });

  it("rejeita granularidade, métrica, janela e período ausentes", async () => {
    const instance = service(createPrisma());
    await expect(instance.timeseries({ metric: "incidentsOpened", from: "2026-10-01T00:00:00.000Z", to: "2026-10-02T00:00:00.000Z", granularity: "month" })).rejects.toThrow(/Granularidade/);
    await expect(instance.timeseries({ metric: "foo", from: "2026-10-01T00:00:00.000Z", to: "2026-10-02T00:00:00.000Z" })).rejects.toThrow(/vocabulario/);
    await expect(instance.timeseries({ metric: "incidentsOpened", from: "2026-01-01T00:00:00.000Z", to: "2027-06-01T00:00:00.000Z" })).rejects.toThrow(/limite/);
    await expect(instance.timeseries({ metric: "incidentsOpened" } as never)).rejects.toThrow(/'from' e 'to'/);
  });
});

describe("SLA", () => {
  it("calcula indicadores e usa null sem amostra", async () => {
    const prisma = createPrisma({
      incident: { findMany: [incidentRow("1", "2026-10-01T10:00:00.000Z", { status: "RESOLVED", resolvedAt: at("2026-10-01T10:30:00.000Z") })] },
    });
    const result = await service(prisma).sla({ from: "2026-10-01T00:00:00.000Z", to: "2026-10-02T00:00:00.000Z" });
    expect(result.indicators.meanResolutionMinutes).toEqual({ value: 30, sampleSize: 1 });
    expect(result.indicators.meanResponseMinutes).toEqual({ value: null, sampleSize: 0 });
    expect(result.indicators.slaCompliancePercent).toEqual({ value: null, sampleSize: 0 });
    expect(result.indicators.transmissionUptimePercent).toEqual({ value: 100, sampleSize: 1440 });
  });

  it("não inventa média quando não há dado", async () => {
    const result = await service(createPrisma()).sla({ from: "2026-10-01T00:00:00.000Z", to: "2026-10-02T00:00:00.000Z" });
    expect(result.indicators.escalationRatePercent).toEqual({ value: null, sampleSize: 0 });
    expect(result.indicators.fulfillmentMeanMinutes).toEqual({ value: null, sampleSize: 0 });
    expect(result.indicators.dispatchMeanMinutes).toEqual({ value: null, sampleSize: 0 });
    expect(result.indicators.transmissionDowntimeMinutes).toEqual({ value: 0, sampleSize: 0 });
  });
});

describe("comparação de zonas", () => {
  it("expõe denominador e não produz ranking normalizado sem denominador", async () => {
    const prisma = createPrisma({
      electoralZone: { findMany: [{ id: "z-1", number: 1, name: "Centro", municipality: "São Paulo", state: "SP" }] },
      pollingPlace: { findMany: [{ electoralZoneId: "z-1" }] },
      pollingSection: { findMany: [{ registeredVoters: 0, pollingPlace: { electoralZoneId: "z-1" } }] },
      incident: { findMany: [incidentRow("1", "2026-10-01T08:00:00.000Z")] },
    });
    const result = await service(prisma).zoneComparison({ electionId: "e-1", from: "2026-10-01T00:00:00.000Z", to: "2026-10-02T00:00:00.000Z", metrics: "incidentsOpened" });
    const zone = result.zones[0];
    expect(zone.registeredVoters).toBe(0);
    expect(zone.pollingPlaceCount).toBe(1);
    expect(zone.metrics.incidentsOpened).toMatchObject({ value: 1, sampleSize: 1, per1000Voters: null, perPlace: 1 });
    expect(zone.rankings.incidentsOpened).toEqual({ byAbsolute: 1, byNormalized: null });
  });

  it("exige electionId", async () => {
    await expect(service(createPrisma()).zoneComparison({})).rejects.toThrow(/electionId/);
  });
});

describe("export JSON", () => {
  it("devolve seções e séries respeitando escopo", async () => {
    const prisma = createPrisma({ incident: { findMany: [incidentRow("1", "2026-10-01T08:00:00.000Z")] } });
    const instance = service(prisma);
    for (const method of ["executive", "operations", "incidents", "transmission", "workforce", "logistics", "assets"] as const)
      vi.spyOn(instance, method).mockResolvedValue({} as never);
    const result = await instance.exportJson({ from: "2026-10-01T00:00:00.000Z", to: "2026-10-02T00:00:00.000Z", metrics: "incidentsOpened" });
    expect(Object.keys(result.sections).sort()).toEqual(["assets", "executive", "incidents", "logistics", "operations", "transmission", "workforce"]);
    expect(result.scope).toMatchObject({ from: "2026-10-01T00:00:00.000Z", includeSimulated: false });
    expect(result.timeseries.incidentsOpened).toHaveLength(1);
  });
});
