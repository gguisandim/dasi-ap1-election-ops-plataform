import { BadRequestException } from "@nestjs/common";
import {
  PreparationChecklistItemStatus,
  PreparationChecklistStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import { PERMISSIONS, PLATFORM_PERMISSION_KEYS } from "@eops/security";
import {
  calculateChecklistProgress,
  deriveChecklistStatus,
  PreparationChecklistsService,
} from "./preparation-checklists.service";

function createService(prisma: Record<string, unknown>, eventBus = { emit: vi.fn() }) {
  return { service: new PreparationChecklistsService(prisma as unknown as PrismaService, eventBus as never), eventBus };
}

function transactionMock(tx: Record<string, unknown>) {
  return vi.fn((callback: (client: never) => unknown) => callback(tx as never));
}

describe("PreparationChecklistsService", () => {
  it("calcula o progresso sobre todos os itens", () => {
    expect(calculateChecklistProgress([
      { status: PreparationChecklistItemStatus.COMPLETED },
      { status: PreparationChecklistItemStatus.COMPLETED },
      { status: PreparationChecklistItemStatus.PENDING },
      { status: PreparationChecklistItemStatus.BLOCKED },
    ])).toBe(50);
    expect(calculateChecklistProgress([])).toBe(0);
  });

  it("deriva estado pronto apenas com obrigatórios concluídos, evidências e responsável", () => {
    const item = { required: true, evidenceRequired: true, status: PreparationChecklistItemStatus.COMPLETED, evidences: [{}] };
    expect(deriveChecklistStatus([item], "user-1")).toBe(PreparationChecklistStatus.READY_FOR_APPROVAL);
    expect(deriveChecklistStatus([item], null)).toBe(PreparationChecklistStatus.IN_PROGRESS);
    expect(deriveChecklistStatus([{ ...item, evidences: [] }], "user-1")).toBe(PreparationChecklistStatus.IN_PROGRESS);
    expect(deriveChecklistStatus([{ ...item, required: false, status: PreparationChecklistItemStatus.BLOCKED }], "user-1")).toBe(PreparationChecklistStatus.READY_FOR_APPROVAL);
    expect(deriveChecklistStatus([{ ...item, status: PreparationChecklistItemStatus.BLOCKED }], "user-1")).toBe(PreparationChecklistStatus.BLOCKED);
  });

  it("cria checklist copiando os itens do modelo", async () => {
    const template = { id: "template-1", active: true, locationType: "POLLING_PLACE", items: [{ title: "Testar energia", description: "Teste de contingência", order: 1, required: true, evidenceRequired: false }] };
    const createdChecklist = { id: "checklist-1", items: [{ ...template.items[0], status: PreparationChecklistItemStatus.PENDING }], history: [] };
    const tx = {
      preparationChecklist: { create: vi.fn().mockResolvedValue({ id: "checklist-1" }), findUniqueOrThrow: vi.fn().mockResolvedValue(createdChecklist) },
      preparationChecklistHistory: { create: vi.fn() },
    };
    const prisma = {
      election: { findUnique: vi.fn().mockResolvedValue({ id: "election-1" }) },
      electoralZone: { findUnique: vi.fn().mockResolvedValue({ id: "zone-1", electionId: "election-1" }) },
      pollingPlace: { findUnique: vi.fn().mockResolvedValue({ id: "place-1", electoralZoneId: "zone-1", electoralZone: { electionId: "election-1" } }) },
      preparationChecklistTemplate: { findUnique: vi.fn().mockResolvedValue(template) },
      user: { findUnique: vi.fn().mockResolvedValue({ id: "user-1", status: "ACTIVE" }) },
      $transaction: transactionMock(tx),
    };
    const { service } = createService(prisma);
    await service.createChecklist({ electionId: "election-1", electoralZoneId: "zone-1", pollingPlaceId: "place-1", templateId: "template-1", assigneeId: "user-1" }, "creator-1");
    expect(tx.preparationChecklist.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ items: { create: template.items } }) }));
    expect(tx.preparationChecklistHistory.create).toHaveBeenCalled();
  });

  it("rejeita local e zona que não pertencem ao pleito informado", async () => {
    const prisma = {
      election: { findUnique: vi.fn().mockResolvedValue({ id: "election-1" }) },
      electoralZone: { findUnique: vi.fn().mockResolvedValue({ id: "zone-1", electionId: "other-election" }) },
      pollingPlace: { findUnique: vi.fn().mockResolvedValue({ id: "place-1", electoralZoneId: "zone-1", electoralZone: { electionId: "other-election" } }) },
      preparationChecklistTemplate: { findUnique: vi.fn() },
    };
    const { service } = createService(prisma);
    await expect(service.createChecklist({ electionId: "election-1", electoralZoneId: "zone-1", pollingPlaceId: "place-1", templateId: "template-1" }, "creator-1")).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.preparationChecklistTemplate.findUnique).not.toHaveBeenCalled();
  });

  it("impede concluir item que exige evidência sem evidência registrada", async () => {
    const prisma = { preparationChecklistItem: { findUnique: vi.fn().mockResolvedValue({ id: "item-1", title: "Teste", status: PreparationChecklistItemStatus.PENDING, evidenceRequired: true, evidences: [], checklist: { id: "checklist-1", status: PreparationChecklistStatus.IN_PROGRESS } }) } };
    const { service } = createService(prisma);
    await expect(service.updateItem("item-1", { status: PreparationChecklistItemStatus.COMPLETED }, "user-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejeita aprovação quando há item obrigatório pendente", async () => {
    const checklist = { id: "checklist-1", assigneeId: "user-1", items: [{ required: true, status: PreparationChecklistItemStatus.PENDING, evidenceRequired: false, evidences: [] }] };
    const tx = { preparationChecklist: { findUnique: vi.fn().mockResolvedValue(checklist), update: vi.fn() }, preparationChecklistHistory: { create: vi.fn() }, user: { findUnique: vi.fn().mockResolvedValue({ id: "user-1", status: "ACTIVE" }) } };
    const prisma = { preparationChecklist: { findUnique: vi.fn().mockResolvedValue(checklist) }, $transaction: transactionMock(tx) };
    const { service, eventBus } = createService(prisma);
    await expect(service.approve("checklist-1", "approver-1")).rejects.toBeInstanceOf(BadRequestException);
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it("aprova checklist válido, registra ator/data e publica evento", async () => {
    const checklist = { id: "checklist-1", electionId: "election-1", electoralZoneId: "zone-1", pollingPlaceId: "place-1", status: PreparationChecklistStatus.READY_FOR_APPROVAL, assigneeId: "owner-1", items: [{ required: true, status: PreparationChecklistItemStatus.COMPLETED, evidenceRequired: true, evidences: [{}] }], history: [] };
    const tx = {
      preparationChecklist: { findUnique: vi.fn().mockResolvedValue(checklist), update: vi.fn() },
      preparationChecklistHistory: { create: vi.fn() },
      user: { findUnique: vi.fn().mockResolvedValue({ id: "owner-1", status: "ACTIVE" }) },
    };
    const prisma = { preparationChecklist: { findUnique: vi.fn().mockResolvedValue(checklist) }, $transaction: transactionMock(tx) };
    const { service, eventBus } = createService(prisma);
    await service.approve("checklist-1", "approver-1");
    expect(tx.preparationChecklist.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: PreparationChecklistStatus.APPROVED, approvedById: "approver-1", approvedAt: expect.any(Date) }) }));
    expect(eventBus.emit).toHaveBeenCalledWith("preparation_checklist.approved", expect.objectContaining({ checklistId: "checklist-1", approvedBy: "approver-1" }));
  });

  it("não altera itens de checklist aprovado", async () => {
    const prisma = { preparationChecklistItem: { findUnique: vi.fn().mockResolvedValue({ id: "item-1", checklistId: "checklist-1", status: PreparationChecklistItemStatus.COMPLETED, checklist: { status: PreparationChecklistStatus.APPROVED }, evidences: [] }) } };
    const { service } = createService(prisma);
    await expect(service.updateItem("item-1", { status: PreparationChecklistItemStatus.PENDING }, "user-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("registra as permissões principais no catálogo RBAC da plataforma", () => {
    expect(PLATFORM_PERMISSION_KEYS).toContain(PERMISSIONS.preparationChecklists.read);
    expect(PLATFORM_PERMISSION_KEYS).toContain(PERMISSIONS.preparationChecklists.manage);
    expect(PLATFORM_PERMISSION_KEYS).toContain(PERMISSIONS.preparationChecklists.approve);
  });
});
