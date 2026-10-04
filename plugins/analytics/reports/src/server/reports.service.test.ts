import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import { ReportsService } from "./reports.service";

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
    const service = new ReportsService({} as PrismaService);
    vi.spyOn(service, "executive").mockResolvedValue(report);
    const csv = await service.csv({});
    expect(csv).toContain('"Locais operacionais","10"');
    expect(csv).toContain('"Zona 1"');
  });

  it("gera um PDF válido a partir do relatório", async () => {
    const service = new ReportsService({} as PrismaService);
    vi.spyOn(service, "executive").mockResolvedValue(report);
    const pdf = await service.pdf({});
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(500);
  });
});
