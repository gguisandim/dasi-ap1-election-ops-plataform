import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import { PERMISSIONS } from "@eops/security";
import { OperationalMapService } from "./operational-map.service";

const ALL_PERMISSIONS = [
  PERMISSIONS.elections.read,
  PERMISSIONS.incidents.read,
  PERMISSIONS.transmission.read,
  PERMISSIONS.inventory.read,
  PERMISSIONS.fieldTeams.read,
  PERMISSIONS.routes.read,
];

type ModelKey = "pollingPlace" | "incident" | "transmissionPoint" | "asset" | "fieldAllocation" | "routeStop";

function buildPrisma(data: Partial<Record<ModelKey, unknown[]>> = {}) {
  const findMany = (key: ModelKey) => vi.fn().mockResolvedValue(data[key] ?? []);
  const models = {
    pollingPlace: { findMany: findMany("pollingPlace") },
    incident: { findMany: findMany("incident") },
    transmissionPoint: { findMany: findMany("transmissionPoint") },
    asset: { findMany: findMany("asset") },
    fieldAllocation: { findMany: findMany("fieldAllocation") },
    routeStop: { findMany: findMany("routeStop") },
  };
  return { prisma: models as unknown as PrismaService, models };
}

describe("OperationalMapService", () => {
  it("agrega features num contrato único e omite registros sem coordenada resolvível", async () => {
    const { prisma } = buildPrisma({
      pollingPlace: [
        { id: "l-1", name: "Escola A", city: "Belém", state: "PA", district: "Centro", latitude: 1.45, longitude: -48.49, monitoringStatus: "NORMAL", updatedAt: new Date("2026-10-05T10:00:00Z") },
        { id: "l-2", name: "Sem coordenada", city: "Belém", state: "PA", district: "Centro", latitude: null, longitude: null, monitoringStatus: "NORMAL", updatedAt: new Date("2026-10-05T10:00:00Z") },
      ],
      incident: [
        { id: "i-1", code: "INC-1", title: "Falha de urna", status: "IN_PROGRESS", severity: "HIGH", updatedAt: new Date("2026-10-05T11:00:00Z"), category: { name: "Equipamento" }, pollingPlace: { id: "l-1", name: "Escola A", city: "Belém", latitude: 1.45, longitude: -48.49 } },
      ],
    });
    const features = await new OperationalMapService(prisma).features({}, ALL_PERMISSIONS);

    expect(features).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "POLLING_PLACE:l-1", type: "POLLING_PLACE", latitude: 1.45, longitude: -48.49, entityId: "l-1", deepLink: "/polling-places/l-1" }),
      expect.objectContaining({ id: "INCIDENT:i-1", type: "INCIDENT", latitude: 1.45, entityId: "i-1", severity: "HIGH", deepLink: "/incidents/i-1" }),
    ]));
    expect(features.some((feature) => feature.entityId === "l-2")).toBe(false);
  });

  it("rejeita camada desconhecida com 400", async () => {
    const { prisma } = buildPrisma();
    await expect(
      new OperationalMapService(prisma).features({ types: "POLLING_PLACE,DESCONHECIDA" }, ALL_PERMISSIONS),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("filtra camadas pela permissão do solicitante", async () => {
    const { prisma, models } = buildPrisma({
      pollingPlace: [{ id: "l-1", name: "Escola", city: "Belém", state: "PA", district: "Centro", latitude: 1.45, longitude: -48.49, monitoringStatus: "NORMAL", updatedAt: new Date() }],
      incident: [{ id: "i-1", code: "INC-1", title: "x", status: "NEW", severity: "HIGH", updatedAt: new Date(), category: { name: "c" }, pollingPlace: { id: "l-1", latitude: 1.45, longitude: -48.49 } }],
    });
    const features = await new OperationalMapService(prisma).features({}, [PERMISSIONS.elections.read]);

    expect(models.pollingPlace.findMany).toHaveBeenCalledTimes(1);
    expect(models.incident.findMany).not.toHaveBeenCalled();
    expect(features.every((feature) => feature.type === "POLLING_PLACE")).toBe(true);
  });

  it("aplica filtros de zona, status por camada e severidade de incidente", async () => {
    const { prisma, models } = buildPrisma();
    await new OperationalMapService(prisma).features(
      { zoneId: "z-1", status: "CRITICAL", severity: "CRITICAL" },
      [PERMISSIONS.elections.read, PERMISSIONS.incidents.read],
    );

    expect(models.pollingPlace.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ electoralZoneId: "z-1", monitoringStatus: "CRITICAL" }) }),
    );
    expect(models.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ electoralZoneId: "z-1", isSimulated: false, severity: "CRITICAL" }) }),
    );
  });
});
