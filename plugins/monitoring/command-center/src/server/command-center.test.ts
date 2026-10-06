import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import {
  OPERATIONAL_THRESHOLDS,
  type OperationalSummary,
} from "@eops/shared/command-center";
import {
  comparableMetrics,
  buildSnapshotPayload,
} from "./command-center-snapshots.service";
import {
  normalizeRefreshSeconds,
  normalizeViewFilters,
} from "./command-center-views.service";
import { domainAvailability } from "./command-center.service";

describe("filtros de visão salva", () => {
  it("aceita apenas as chaves do contrato", () => {
    expect(
      normalizeViewFilters({ severity: ["CRITICAL"], electionId: " election-1 " }),
    ).toEqual({ severity: ["CRITICAL"], electionId: "election-1" });
  });

  it("rejeita chave fora do contrato", () => {
    expect(() => normalizeViewFilters({ sql: "drop" })).toThrow(
      BadRequestException,
    );
  });

  it("rejeita valor de tipo inválido", () => {
    expect(() => normalizeViewFilters({ severity: 10 })).toThrow(
      BadRequestException,
    );
  });

  it("remove duplicatas e entradas vazias", () => {
    expect(
      normalizeViewFilters({ sourceType: ["ROUTE", "ROUTE", " ", "ASSET"] }),
    ).toEqual({ sourceType: ["ROUTE", "ASSET"] });
  });
});

describe("intervalo de atualização", () => {
  it("usa o padrão quando ausente", () => {
    expect(normalizeRefreshSeconds(undefined)).toBe(
      OPERATIONAL_THRESHOLDS.viewRefreshSeconds.default,
    );
  });

  it("rejeita valores fora da janela permitida", () => {
    expect(() => normalizeRefreshSeconds(5)).toThrow(BadRequestException);
    expect(() => normalizeRefreshSeconds(600)).toThrow(BadRequestException);
  });

  it("aceita valores dentro da janela", () => {
    expect(normalizeRefreshSeconds(30)).toBe(30);
  });
});

describe("payload de snapshot", () => {
  const summary = {
    generatedAt: "2026-10-06T12:00:00.000Z",
    scope: { electionId: "election-1" },
    health: "CRITICAL",
    metrics: {
      totalItems: 3,
      criticalItems: 2,
      warnings: 1,
      activeIncidents: 2,
    },
    criticalItems: Array.from({ length: 30 }, (_, index) => ({
      id: `INCIDENT:${index}`,
      sourceType: "INCIDENT",
      sourceId: String(index),
      title: `Incidente ${index}`,
      summary: "resumo",
      severity: "CRITICAL",
      status: "NEW",
      statusState: "UNACKNOWLEDGED",
      deadlineState: "OVERDUE",
      occurredAt: "2026-10-06T10:00:00.000Z",
      ageSeconds: 7200,
      score: 200,
      deepLink: `/incidents/${index}`,
      metadata: {},
    })),
    warnings: [],
    sections: {},
  } as unknown as OperationalSummary;

  it("persiste apenas os agregados e limita os itens mais relevantes", () => {
    const payload = buildSnapshotPayload(summary, [
      {
        zoneId: "zone-1",
        zoneName: "Zona 1",
        health: "CRITICAL",
        itemCount: 3,
      },
    ]);
    expect(payload.topItems).toHaveLength(
      OPERATIONAL_THRESHOLDS.snapshotTopItems,
    );
    expect(payload.zones).toHaveLength(1);
    expect(payload.health).toBe("CRITICAL");
    expect(Object.keys(payload).sort()).toEqual([
      "health",
      "metrics",
      "scope",
      "topItems",
      "zones",
    ]);
  });

  it("extrai apenas métricas numéricas comparáveis", () => {
    expect(comparableMetrics({ metrics: { a: 1, b: null, c: "x" } })).toEqual({
      a: 1,
    });
    expect(comparableMetrics(null)).toEqual({});
  });
});

describe("permissões subjacentes", () => {
  it("habilita somente os domínios autorizados", () => {
    expect(domainAvailability(["command-center.read"])).toEqual({
      incidents: false,
      transmission: false,
      shifts: false,
      dispatches: false,
      continuity: false,
      preparation: false,
      routes: false,
      assets: false,
      resourceRequests: false,
    });
    expect(
      domainAvailability([
        "command-center.read",
        "incidents.read",
        "resource-requests.read",
      ]),
    ).toMatchObject({
      incidents: true,
      resourceRequests: true,
      transmission: false,
      routes: false,
    });
  });
});
