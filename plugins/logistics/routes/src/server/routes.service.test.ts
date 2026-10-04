import { DeliveryStatus, RouteStatus } from "@prisma/client";
import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import { RoutesService } from "./routes.service";

describe("RoutesService", () => {
  it("cria rota normalizando o código e persistindo o evento inicial", async () => {
    const created = { id: "route-1", code: "ROT-01", name: "Distribuição Norte", electionId: "e-1", electoralZoneId: "z-1" };
    const tx = { distributionRoute: { create: vi.fn().mockResolvedValue(created) }, routeHistoryEvent: { create: vi.fn() }, vehicle: { update: vi.fn() } };
    const prisma = {
      election: { findUnique: vi.fn().mockResolvedValue({ id: "e-1" }) },
      electoralZone: { findUnique: vi.fn().mockResolvedValue({ id: "z-1", electionId: "e-1" }) },
      vehicle: { findUnique: vi.fn() }, pollingPlace: { count: vi.fn() },
      distributionRoute: { findUnique: vi.fn().mockResolvedValue({ ...created, plannedArrival: new Date("2026-10-02T12:00:00Z"), actualArrival: null, status: RouteStatus.PLANNED, stops: [], batches: [], election: {}, electoralZone: {}, vehicle: null, deliveries: [], history: [] }) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new RoutesService(prisma);
    await service.create({ code: "rot-01", name: "Distribuição Norte", electionId: "e-1", electoralZoneId: "z-1", originName: "Depósito", destinationName: "Zona Norte", plannedDeparture: "2026-10-02T10:00:00Z", plannedArrival: "2026-10-02T12:00:00Z", responsibleName: "Coordenação" });
    expect(tx.distributionRoute.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ code: "ROT-01" }) }));
    expect(tx.routeHistoryEvent.create).toHaveBeenCalled();
  });

  it("exige justificativa ao registrar falha de entrega", async () => {
    const prisma = { delivery: { findUnique: vi.fn().mockResolvedValue({ id: "d-1", routeId: "r-1", pollingPlaceId: "p-1", route: {} }) } } as unknown as PrismaService;
    await expect(new RoutesService(prisma).updateDelivery("d-1", { status: DeliveryStatus.FAILED })).rejects.toBeInstanceOf(BadRequestException);
  });
});
