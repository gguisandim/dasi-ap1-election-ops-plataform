import { AssetCondition, AssetStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../../../../packages/database/src";
import { InventoryService } from "./inventory.service";

const asset = {
  id: "asset-1", assetTag: "RTR-0001", name: "Roteador de contingência", typeId: "type-1",
  serialNumber: null, manufacturer: null, model: null, status: AssetStatus.AVAILABLE,
  condition: AssetCondition.GOOD, electoralZoneId: null, pollingPlaceId: null,
  createdAt: new Date(), updatedAt: new Date(), type: { id: "type-1", active: true },
  electoralZone: null, pollingPlace: null, movements: [], assignments: [], incidents: [],
};

describe("InventoryService", () => {
  it("cria um ativo com patrimônio normalizado", async () => {
    const create = vi.fn().mockResolvedValue(asset);
    const prisma = {
      assetType: { findUnique: vi.fn().mockResolvedValue({ id: "type-1", active: true }) },
      electoralZone: { findUnique: vi.fn() }, pollingPlace: { findUnique: vi.fn() }, asset: { create },
    } as unknown as PrismaService;
    await new InventoryService(prisma).create({ assetTag: "rtr-0001", name: "Roteador de contingência", typeId: "type-1", status: AssetStatus.AVAILABLE, condition: AssetCondition.GOOD });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ assetTag: "RTR-0001" }) }));
  });

  it("movimenta o ativo e registra histórico imutável e nova alocação", async () => {
    const movement = { id: "movement-1" };
    const tx = {
      assetAssignment: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), create: vi.fn().mockResolvedValue({}) },
      assetMovement: { create: vi.fn().mockResolvedValue(movement) }, asset: { update: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      asset: { findUnique: vi.fn().mockResolvedValue(asset) },
      electoralZone: { findUnique: vi.fn().mockResolvedValue({ id: "zone-1", number: 76 }) },
      pollingPlace: { findUnique: vi.fn() },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    await new InventoryService(prisma).move("asset-1", { toZoneId: "zone-1", responsibleName: "Equipe logística", reason: "Distribuição inicial" });
    expect(tx.assetMovement.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ originLabel: "Depósito central", destinationLabel: "Zona 76", statusBefore: AssetStatus.AVAILABLE, statusAfter: AssetStatus.ALLOCATED }) }));
    expect(tx.asset.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: AssetStatus.ALLOCATED }) }));
    expect(tx.assetAssignment.create).toHaveBeenCalled();
  });

  it("altera condição e status preservando a localização", async () => {
    const update = vi.fn().mockResolvedValue({ ...asset, status: AssetStatus.MAINTENANCE, condition: AssetCondition.DAMAGED });
    const prisma = { asset: { findUnique: vi.fn().mockResolvedValue(asset), update } } as unknown as PrismaService;
    await new InventoryService(prisma).update("asset-1", { status: AssetStatus.MAINTENANCE, condition: AssetCondition.DAMAGED });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: AssetStatus.MAINTENANCE, condition: AssetCondition.DAMAGED } }));
  });
});
