import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import {
  REPORT_MAX_WINDOW_DAYS,
  alignBucketStart,
  assertReportGranularity,
  assertReportMetric,
  assertWindowWithinLimit,
  buildSeries,
  continuousBucketRanges,
  dispatchMeanMinutes,
  escalationRatePercent,
  fulfillmentMeanMinutes,
  meanResolutionMinutes,
  meanResponseMinutes,
  mttrMinutes,
  per1000Voters,
  perPlace,
  slaCompliancePercent,
  deadlineMisses,
  transmissionDowntimeMinutes,
  transmissionUptimePercent,
  type IncidentTimingRow,
} from "@eops/shared/reports";
import { drilldownFor, type ReportsScope } from "./reports-metrics";

const at = (value: string) => new Date(value);
const day = (value: string) => at(`${value}T00:00:00.000Z`);

describe("eixo temporal", () => {
  it("gera buckets contínuos alinhados por hora", () => {
    const ranges = continuousBucketRanges(at("2026-10-06T10:30:00.000Z"), at("2026-10-06T13:10:00.000Z"), "hour");
    expect(ranges.map((range) => range.start.toISOString())).toEqual([
      "2026-10-06T10:00:00.000Z",
      "2026-10-06T11:00:00.000Z",
      "2026-10-06T12:00:00.000Z",
      "2026-10-06T13:00:00.000Z",
    ]);
  });

  it("alinhha a semana na segunda-feira 00:00 UTC", () => {
    const start = alignBucketStart(at("2026-10-08T05:00:00.000Z"), "week");
    expect(start.getUTCDay()).toBe(1);
    expect(start.getUTCHours()).toBe(0);
    expect(start.getTime()).toBeLessThanOrEqual(at("2026-10-08T05:00:00.000Z").getTime());
  });

  it("retorna buckets vazios com value 0 e sampleSize 0", () => {
    const from = day("2026-10-01");
    const to = day("2026-10-04");
    const ranges = continuousBucketRanges(from, to, "day");
    const series = buildSeries(
      "incidentsOpened", "day", from, to, ranges,
      (range) => (range.start.toISOString() === from.toISOString() ? { value: 7, sampleSize: 7 } : null),
      () => ({ value: 7, sampleSize: 7 }),
    );
    expect(series.bucketCount).toBe(3);
    expect(series.buckets[0]).toMatchObject({ value: 7, sampleSize: 7 });
    expect(series.buckets[1]).toMatchObject({ value: 0, sampleSize: 0 });
    expect(series.buckets[2]).toMatchObject({ value: 0, sampleSize: 0 });
    expect(series.totals).toEqual({ value: 7, sampleSize: 7 });
  });

  it("rejeita granularidade, métrica e janela fora do contrato", () => {
    expect(() => assertReportGranularity("month")).toThrow(/Granularidade/);
    expect(() => assertReportMetric("foo")).toThrow(/vocabulario/);
    expect(() => assertWindowWithinLimit(day("2026-01-01"), day("2026-01-01"))).not.toThrow();
    const tooLong = new Date(day("2026-01-01").getTime() + (REPORT_MAX_WINDOW_DAYS + 1) * 86_400_000);
    expect(() => assertWindowWithinLimit(day("2026-01-01"), tooLong)).toThrow(/limite/);
  });
});

describe("formulas de SLA", () => {
  const base: IncidentTimingRow = {
    severity: "HIGH", status: "RESOLVED", openedAt: at("2026-10-01T10:00:00.000Z"),
    acknowledgedAt: null, resolvedAt: null, slaDeadline: null, escalationLevel: 0,
  };

  it("calcula média de resposta e devolve null sem amostra", () => {
    expect(meanResponseMinutes([])).toEqual({ value: null, sampleSize: 0 });
    expect(
      meanResponseMinutes([
        { ...base, status: "NEW", acknowledgedAt: at("2026-10-01T10:10:00.000Z") },
        { ...base, status: "NEW", acknowledgedAt: at("2026-10-01T10:30:00.000Z") },
      ]),
    ).toEqual({ value: 20, sampleSize: 2 });
  });

  it("calcula média de resolução e MTTR restrito a HIGH/CRITICAL", () => {
    expect(meanResolutionMinutes([])).toEqual({ value: null, sampleSize: 0 });
    const rows = [
      { ...base, severity: "LOW", resolvedAt: at("2026-10-01T12:00:00.000Z") },
      { ...base, severity: "CRITICAL", resolvedAt: at("2026-10-01T10:30:00.000Z") },
    ];
    expect(meanResolutionMinutes(rows)).toEqual({ value: 75, sampleSize: 2 });
    expect(mttrMinutes(rows)).toEqual({ value: 30, sampleSize: 1 });
    expect(mttrMinutes([{ ...base, severity: "LOW", resolvedAt: at("2026-10-01T12:00:00.000Z") }])).toEqual({ value: null, sampleSize: 0 });
  });

  it("calcula compliance e devolve null com denominador zero", () => {
    expect(slaCompliancePercent([base])).toEqual({ value: null, sampleSize: 0 });
    const withDeadline = [
      { ...base, resolvedAt: at("2026-10-01T11:00:00.000Z"), slaDeadline: at("2026-10-01T11:30:00.000Z") },
      { ...base, resolvedAt: at("2026-10-01T12:30:00.000Z"), slaDeadline: at("2026-10-01T12:00:00.000Z") },
      { ...base, status: "NEW", resolvedAt: null, slaDeadline: at("2026-10-01T09:00:00.000Z") },
    ];
    expect(slaCompliancePercent(withDeadline)).toEqual({ value: 33.3, sampleSize: 3 });
  });

  it("conta vencidos não terminais e terminais resolvidos após o prazo", () => {
    const now = at("2026-10-01T13:00:00.000Z");
    const rows: IncidentTimingRow[] = [
      { ...base, status: "IN_PROGRESS", slaDeadline: at("2026-10-01T12:00:00.000Z") },
      { ...base, status: "RESOLVED", resolvedAt: at("2026-10-01T11:00:00.000Z"), slaDeadline: at("2026-10-01T10:30:00.000Z") },
      { ...base, status: "RESOLVED", resolvedAt: at("2026-10-01T10:00:00.000Z"), slaDeadline: at("2026-10-01T11:00:00.000Z") },
    ];
    expect(deadlineMisses(rows, now)).toEqual({ value: 2, sampleSize: 3 });
  });

  it("calcula taxa de escalonamento e devolve null sem incidentes", () => {
    expect(escalationRatePercent([])).toEqual({ value: null, sampleSize: 0 });
    expect(escalationRatePercent([base, { ...base, escalationLevel: 2 }])).toEqual({ value: 50, sampleSize: 2 });
  });

  it("soma downtime OFFLINE e uptime, com null quando não há janela", () => {
    const now = at("2026-10-01T13:00:00.000Z");
    const transitions = [
      { from: "ONLINE", to: "OFFLINE", occurredAt: at("2026-10-01T10:00:00.000Z"), durationSeconds: 1800 },
      { from: "OFFLINE", to: "ONLINE", occurredAt: at("2026-10-01T10:30:00.000Z"), durationSeconds: 1200 },
    ];
    expect(transmissionDowntimeMinutes(transitions, now)).toEqual({ value: 30, sampleSize: 1 });
    expect(transmissionDowntimeMinutes([], now)).toEqual({ value: 0, sampleSize: 0 });
    expect(transmissionUptimePercent(100, 25)).toEqual({ value: 75, sampleSize: 100 });
    expect(transmissionUptimePercent(0, 0)).toEqual({ value: null, sampleSize: 0 });
  });

  it("calcula fulfillment e dispatch sem inventar média", () => {
    expect(fulfillmentMeanMinutes([])).toEqual({ value: null, sampleSize: 0 });
    expect(fulfillmentMeanMinutes([{ submittedAt: at("2026-10-01T10:00:00.000Z"), fulfilledAt: at("2026-10-01T11:00:00.000Z") }])).toEqual({ value: 60, sampleSize: 1 });
    expect(dispatchMeanMinutes([])).toEqual({ value: null, sampleSize: 0 });
    expect(dispatchMeanMinutes([{ requestedAt: at("2026-10-01T10:00:00.000Z"), completedAt: at("2026-10-01T10:15:00.000Z") }])).toEqual({ value: 15, sampleSize: 1 });
  });

  it("normaliza por zona apenas com denominador", () => {
    expect(per1000Voters(50, 10000)).toBe(5);
    expect(per1000Voters(50, 0)).toBeNull();
    expect(perPlace(9, 3)).toBe(3);
    expect(perPlace(9, 0)).toBeNull();
  });
});

describe("drill-down", () => {
  const scope: ReportsScope = { from: day("2026-10-01"), to: day("2026-10-02"), includeSimulated: false };
  const incident = (id: string, openedAt: string) => ({
    id, code: `INC-${id}`, title: `Incidente ${id}`, severity: "HIGH", status: "NEW",
    openedAt: at(openedAt), acknowledgedAt: null, resolvedAt: null, slaDeadline: null,
    escalatedAt: null, escalationLevel: 0, electoralZoneId: "z-1", pollingPlaceId: "p-1",
  });

  it("devolve total real e sinaliza truncamento", async () => {
    const prisma = { incident: { findMany: vi.fn().mockResolvedValue([incident("1", "2026-10-01T08:00:00.000Z"), incident("2", "2026-10-01T09:00:00.000Z"), incident("3", "2026-10-01T10:00:00.000Z")]) } } as unknown as PrismaService;
    const range = { start: day("2026-10-01"), end: day("2026-10-02") };
    const truncated = await drilldownFor(prisma, "incidentsOpened", scope, range, 2);
    expect(truncated.total).toBe(3);
    expect(truncated.truncated).toBe(true);
    expect(truncated.items).toHaveLength(2);
    expect(truncated.items[0]).toMatchObject({ kind: "INCIDENT", deepLink: "/incidents/1" });
    const full = await drilldownFor(prisma, "incidentsOpened", scope, range, 50);
    expect(full.truncated).toBe(false);
    expect(full.items).toHaveLength(3);
  });
});
