import { AssetAssignmentKind, AssetCondition, AssetMaintenanceStatus, AssetReservationStatus, AssetStatus } from "@prisma/client";
import { ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import type { EventBus } from "@eops/event-bus";
import { InventoryService } from "./inventory.service";

const asset = {
  id: "asset-1", assetTag: "RTR-0001", name: "Roteador de contingência", typeId: "type-1",
  serialNumber: null, manufacturer: null, model: null, status: AssetStatus.AVAILABLE,
  condition: AssetCondition.GOOD, electoralZoneId: null, pollingPlaceId: null,
  createdAt: new Date(), updatedAt: new Date(), type: { id: "type-1", active: true },
  electoralZone: null, pollingPlace: null, movements: [], assignments: [], reservations: [], maintenances: [], incidents: [],
};

describe("InventoryService", () => {
  it("cria ativo normalizado e atribui ator ao evento", async () => {
    const create = vi.fn().mockResolvedValue(asset); const emit = vi.fn();
    const prisma = { assetType: { findUnique: vi.fn().mockResolvedValue({ id: "type-1", active: true }) }, electoralZone: { findUnique: vi.fn() }, pollingPlace: { findUnique: vi.fn() }, asset: { create } } as unknown as PrismaService;
    await new InventoryService(prisma, { emit } as unknown as EventBus).create({ assetTag: "rtr-0001", name: asset.name, typeId: "type-1", status: AssetStatus.AVAILABLE, condition: AssetCondition.GOOD }, "actor-1");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ assetTag: "RTR-0001" }) }));
    expect(emit).toHaveBeenCalledWith("asset.created", expect.objectContaining({ actorId: "actor-1" }));
  });

  it("rejeita reserva sobreposta", async () => {
    const prisma = { asset: { findUnique: vi.fn().mockResolvedValue(asset) }, assetReservation: { findFirst: vi.fn().mockResolvedValue({ id: "existing" }) } } as unknown as PrismaService;
    await expect(new InventoryService(prisma).createReservation({ assetId: asset.id, requesterName: "Operação", purpose: "Distribuição", startsAt: "2026-10-05T10:00:00Z", endsAt: "2026-10-05T12:00:00Z" })).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejeita retirada quando o ativo já está em custódia", async () => {
    const prisma = { asset: { findUnique: vi.fn().mockResolvedValue({ ...asset, assignments: [{ id: "custody-1", kind: AssetAssignmentKind.CUSTODY, endedAt: null, expectedReturnAt: null }] }) } } as unknown as PrismaService;
    await expect(new InventoryService(prisma).checkOut(asset.id, { responsibleName: "Equipe A", purpose: "Operação", origin: "Depósito", destination: "Zona 1", conditionOut: AssetCondition.GOOD })).rejects.toBeInstanceOf(ConflictException);
  });

  it("devolução com problema abre manutenção corretiva", async () => {
    const custody = { id: "custody-1", kind: AssetAssignmentKind.CUSTODY, endedAt: null, expectedReturnAt: null, destinationLabel: "Zona 1" };
    const tx = { assetAssignment: { update: vi.fn() }, asset: { update: vi.fn() }, assetMovement: { create: vi.fn() }, assetMaintenance: { create: vi.fn().mockResolvedValue({ id: "maint-1", type: "CORRECTIVE" }) } };
    const prisma = { asset: { findUnique: vi.fn().mockResolvedValue({ ...asset, assignments: [custody] }) }, $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    await new InventoryService(prisma).checkIn(asset.id, { conditionIn: AssetCondition.DAMAGED, returnedTo: "Depósito", receivedByName: "Logística", problemDetected: true, notes: "Conector danificado" }, "actor-1");
    expect(tx.assetAssignment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ checkedInById: "actor-1", problemDetected: true }) }));
    expect(tx.assetMaintenance.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: "CORRECTIVE" }) }));
  });

  it("conclui manutenção e libera o ativo", async () => {
    const maintenance = { id: "maint-1", assetId: asset.id, status: AssetMaintenanceStatus.IN_PROGRESS, notes: null, asset };
    const tx = { assetMaintenance: { update: vi.fn().mockResolvedValue(maintenance) }, asset: { update: vi.fn() } };
    const prisma = { assetMaintenance: { findUnique: vi.fn().mockResolvedValue(maintenance) }, $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    await new InventoryService(prisma).completeMaintenance("maint-1", { returnToService: true, result: "Testado e liberado" }, "actor-1");
    expect(tx.asset.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: AssetStatus.AVAILABLE, condition: AssetCondition.GOOD } }));
  });

  it("não cancela reserva já cumprida", async () => {
    const prisma = { assetReservation: { findUnique: vi.fn().mockResolvedValue({ id: "r-1", status: AssetReservationStatus.FULFILLED, asset }) } } as unknown as PrismaService;
    await expect(new InventoryService(prisma).cancelReservation("r-1", {})).rejects.toBeInstanceOf(ConflictException);
  });
});
