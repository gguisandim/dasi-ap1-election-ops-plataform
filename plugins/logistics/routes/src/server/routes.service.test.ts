import { BadRequestException, ConflictException } from "@nestjs/common";
import { DeliveryStatus, RouteStatus, RouteStopStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import { RoutesService } from "./routes.service";

const route = {
  id: "route-1", code: "ROT-01", name: "Distribuição Norte", electionId: "e-1", electoralZoneId: "z-1",
  plannedDeparture: new Date("2026-10-05T10:00:00Z"), plannedArrival: new Date("2026-10-05T12:00:00Z"),
  actualArrival: null, status: RouteStatus.PLANNED, vehicleId: null, driverName: null, vehicle: null,
  stops: [], deliveries: [], batches: [], history: [], exceptions: [], election: {}, electoralZone: {},
};

describe("RoutesService", () => {
  it("cria rota sempre em planejamento e persiste evento inicial", async () => {
    const created = { id: route.id, code: route.code, name: route.name, electionId: "e-1", electoralZoneId: "z-1" };
    const tx = { distributionRoute: { create: vi.fn().mockResolvedValue(created) }, routeHistoryEvent: { create: vi.fn() }, vehicle: { update: vi.fn() } };
    const prisma = { election: { findUnique: vi.fn().mockResolvedValue({ id: "e-1" }) }, electoralZone: { findUnique: vi.fn().mockResolvedValue({ id: "z-1", electionId: "e-1" }) }, vehicle: { findUnique: vi.fn() }, pollingPlace: { count: vi.fn() }, distributionRoute: { findUnique: vi.fn().mockResolvedValue(route) }, $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    await new RoutesService(prisma).create({ code: "rot-01", name: route.name, electionId: "e-1", electoralZoneId: "z-1", originName: "Depósito", destinationName: "Zona Norte", plannedDeparture: "2026-10-05T10:00:00Z", plannedArrival: "2026-10-05T12:00:00Z", responsibleName: "Coordenação" });
    expect(tx.distributionRoute.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ code: "ROT-01", status: RouteStatus.PLANNED }) }));
    expect(tx.routeHistoryEvent.create).toHaveBeenCalled();
  });

  it("bloqueia liberação sem recursos operacionais", async () => {
    const prisma = { distributionRoute: { findUnique: vi.fn().mockResolvedValue(route) } } as unknown as PrismaService;
    await expect(new RoutesService(prisma).transition(route.id, { status: RouteStatus.READY })).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejeita transição fora do lifecycle", async () => {
    const prisma = { distributionRoute: { findUnique: vi.fn().mockResolvedValue(route) } } as unknown as PrismaService;
    await expect(new RoutesService(prisma).transition(route.id, { status: RouteStatus.COMPLETED })).rejects.toBeInstanceOf(ConflictException);
  });

  it("exige justificativa para falha de entrega", async () => {
    const prisma = { delivery: { findUnique: vi.fn().mockResolvedValue({ id: "d-1", routeId: route.id, pollingPlaceId: "p-1", route: { status: RouteStatus.IN_PROGRESS } }) } } as unknown as PrismaService;
    await expect(new RoutesService(prisma).updateDelivery("d-1", { status: DeliveryStatus.FAILED })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("atribui ator e timestamp do servidor ao comprovante", async () => {
    const current = { id: "d-1", routeId: route.id, pollingPlaceId: "p-1", route: { status: RouteStatus.IN_PROGRESS } };
    const tx = { delivery: { update: vi.fn().mockResolvedValue({ ...current, status: DeliveryStatus.DELIVERED }) }, routeHistoryEvent: { create: vi.fn() }, routeException: { create: vi.fn() } };
    const prisma = { delivery: { findUnique: vi.fn().mockResolvedValue(current) }, $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    await new RoutesService(prisma).updateDelivery("d-1", { status: DeliveryStatus.DELIVERED, receiverName: "Maria", proofUrl: "https://example.test/proof" }, "actor-1");
    expect(tx.delivery.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ handledById: "actor-1", deliveredAt: expect.any(Date) }) }));
  });

  it("exige motivo para pular parada", async () => {
    const active = { ...route, status: RouteStatus.IN_PROGRESS, stops: [{ id: "stop-1", order: 1, pollingPlaceId: "p-1", description: "Local", eta: new Date(), actualAt: null, status: RouteStopStatus.PENDING, notes: null }] };
    const prisma = { distributionRoute: { findUnique: vi.fn().mockResolvedValue(active) } } as unknown as PrismaService;
    await expect(new RoutesService(prisma).stopAction(route.id, "stop-1", { status: RouteStopStatus.SKIPPED })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("valida que a reordenação contenha todas as paradas", async () => {
    const planned = { ...route, stops: [{ id: "stop-1", order: 1, eta: new Date(), actualAt: null, status: RouteStopStatus.PENDING }, { id: "stop-2", order: 2, eta: new Date(), actualAt: null, status: RouteStopStatus.PENDING }] };
    const prisma = { distributionRoute: { findUnique: vi.fn().mockResolvedValue(planned) } } as unknown as PrismaService;
    await expect(new RoutesService(prisma).reorderStops(route.id, { stopIds: ["stop-1"] })).rejects.toBeInstanceOf(BadRequestException);
  });
});
