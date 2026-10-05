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
  calculateReadiness,
  criticalBlockerKeys,
  DEADLINE_AT_RISK_WINDOW_MS,
  deriveChecklistStatus,
  deriveDeadlineState,
  listCriticalBlockers,
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

  it("calcula readiness apenas sobre itens obrigatórios", () => {
    expect(calculateReadiness([
      { required: true, status: PreparationChecklistItemStatus.COMPLETED },
      { required: true, status: PreparationChecklistItemStatus.PENDING },
      { required: false, status: PreparationChecklistItemStatus.COMPLETED },
    ])).toBe(50);
    expect(calculateReadiness([
      { required: false, status: PreparationChecklistItemStatus.COMPLETED },
      { required: false, status: PreparationChecklistItemStatus.PENDING },
    ])).toBe(50);
    expect(calculateReadiness([])).toBe(0);
  });

  it("lista bloqueadores críticos separadamente por motivo", () => {
    const blockers = listCriticalBlockers([
      { id: "a", title: "Obrigatório pendente", required: true, status: PreparationChecklistItemStatus.PENDING, evidenceRequired: false, evidences: [] },
      { id: "b", title: "Sem evidência", required: false, status: PreparationChecklistItemStatus.PENDING, evidenceRequired: true, evidences: [] },
      { id: "c", title: "Bloqueado", required: true, status: PreparationChecklistItemStatus.BLOCKED, evidenceRequired: false, evidences: [] },
      { id: "d", title: "Regular", required: true, status: PreparationChecklistItemStatus.COMPLETED, evidenceRequired: true, evidences: [{}] },
    ]);
    expect(blockers).toEqual([
      { itemId: "a", title: "Obrigatório pendente", reasons: ["REQUIRED_PENDING"] },
      { itemId: "b", title: "Sem evidência", reasons: ["MISSING_EVIDENCE"] },
      { itemId: "c", title: "Bloqueado", reasons: ["REQUIRED_PENDING", "BLOCKED"] },
    ]);
    expect(criticalBlockerKeys(blockers)).toContain("c:BLOCKED");
  });

  it("deriva estado de prazo com janela de 24 horas", () => {
    const now = new Date("2026-10-05T12:00:00.000Z");
    expect(DEADLINE_AT_RISK_WINDOW_MS).toBe(86_400_000);
    expect(deriveDeadlineState(null, PreparationChecklistStatus.IN_PROGRESS, now)).toBe("ON_TRACK");
    expect(deriveDeadlineState(new Date("2026-10-05T11:00:00.000Z"), PreparationChecklistStatus.IN_PROGRESS, now)).toBe("OVERDUE");
    expect(deriveDeadlineState(new Date("2026-10-06T06:00:00.000Z"), PreparationChecklistStatus.IN_PROGRESS, now)).toBe("AT_RISK");
    expect(deriveDeadlineState(new Date("2026-10-07T12:00:00.000Z"), PreparationChecklistStatus.IN_PROGRESS, now)).toBe("ON_TRACK");
    expect(deriveDeadlineState(new Date("2026-10-05T11:00:00.000Z"), PreparationChecklistStatus.APPROVED, now)).toBe("ON_TRACK");
  });

  it("rejeita aprovação quando o checklist está bloqueado", async () => {
    const checklist = { id: "checklist-1", status: PreparationChecklistStatus.BLOCKED, assigneeId: "user-1", items: [] };
    const tx = { preparationChecklist: { findUnique: vi.fn().mockResolvedValue(checklist), update: vi.fn() }, preparationChecklistHistory: { create: vi.fn() } };
    const prisma = { preparationChecklist: { findUnique: vi.fn().mockResolvedValue(checklist) }, $transaction: transactionMock(tx) };
    const { service, eventBus } = createService(prisma);
    await expect(service.approve("checklist-1", "approver-1")).rejects.toBeInstanceOf(BadRequestException);
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it("rejeita aprovação quando existe item bloqueado mesmo sem ser obrigatório", async () => {
    const checklist = { id: "checklist-1", status: PreparationChecklistStatus.READY_FOR_APPROVAL, assigneeId: "user-1", items: [{ required: false, status: PreparationChecklistItemStatus.BLOCKED, evidenceRequired: false, evidences: [] }] };
    const tx = { preparationChecklist: { findUnique: vi.fn().mockResolvedValue(checklist), update: vi.fn() }, preparationChecklistHistory: { create: vi.fn() }, user: { findUnique: vi.fn().mockResolvedValue({ id: "user-1", status: "ACTIVE" }) } };
    const prisma = { preparationChecklist: { findUnique: vi.fn().mockResolvedValue(checklist) }, $transaction: transactionMock(tx) };
    const { service } = createService(prisma);
    await expect(service.approve("checklist-1", "approver-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("não incrementa a versão do template ao alterar apenas o nome", async () => {
    const prisma = {
      preparationChecklistTemplate: {
        findUnique: vi.fn().mockResolvedValue({ id: "template-1", name: "A", description: "D", locationType: "POLLING_PLACE", version: 1, items: [] }),
        update: vi.fn().mockResolvedValue({ id: "template-1" }),
      },
    };
    const { service } = createService(prisma);
    await service.updateTemplate("template-1", { name: "B" });
    expect(prisma.preparationChecklistTemplate.update.mock.calls[0][0].data).not.toHaveProperty("version");
  });

  it("incrementa a versão do template em alteração semântica", async () => {
    const prisma = {
      preparationChecklistTemplate: {
        findUnique: vi.fn().mockResolvedValue({ id: "template-1", name: "A", description: "D", locationType: "POLLING_PLACE", version: 1, items: [] }),
        update: vi.fn().mockResolvedValue({ id: "template-1" }),
      },
    };
    const { service } = createService(prisma);
    await service.updateTemplate("template-1", { description: "Nova descrição" });
    expect(prisma.preparationChecklistTemplate.update.mock.calls[0][0].data).toMatchObject({ version: { increment: 1 } });
  });

  it("incrementa a versão do template ao adicionar item", async () => {
    const tx = { preparationChecklistTemplateItem: { create: vi.fn().mockResolvedValue({ id: "new-item" }) }, preparationChecklistTemplate: { update: vi.fn() } };
    const prisma = { preparationChecklistTemplate: { findUnique: vi.fn().mockResolvedValue({ id: "template-1", version: 2, items: [] }) }, $transaction: transactionMock(tx) };
    const { service } = createService(prisma);
    await service.addTemplateItem("template-1", { title: "Novo item", order: 2 });
    expect(tx.preparationChecklistTemplate.update).toHaveBeenCalledWith({ where: { id: "template-1" }, data: { version: { increment: 1 } } });
  });

  it("grava a versão do template como snapshot na criação do checklist", async () => {
    const template = { id: "template-1", version: 3, active: true, locationType: "POLLING_PLACE", items: [{ title: "Item", description: "Desc", order: 1, required: true, evidenceRequired: false }] };
    const createdChecklist = { id: "checklist-1", items: [{ ...template.items[0], status: PreparationChecklistItemStatus.PENDING }], history: [] };
    const tx = { preparationChecklist: { create: vi.fn().mockResolvedValue({ id: "checklist-1" }), findUniqueOrThrow: vi.fn().mockResolvedValue(createdChecklist) }, preparationChecklistHistory: { create: vi.fn() } };
    const prisma = {
      election: { findUnique: vi.fn().mockResolvedValue({ id: "election-1" }) },
      electoralZone: { findUnique: vi.fn().mockResolvedValue({ id: "zone-1", electionId: "election-1" }) },
      pollingPlace: { findUnique: vi.fn().mockResolvedValue({ id: "place-1", electoralZoneId: "zone-1", electoralZone: { electionId: "election-1" } }) },
      preparationChecklistTemplate: { findUnique: vi.fn().mockResolvedValue(template) },
      $transaction: transactionMock(tx),
    };
    const { service } = createService(prisma);
    await service.createChecklist({ electionId: "election-1", electoralZoneId: "zone-1", pollingPlaceId: "place-1", templateId: "template-1" }, "creator-1");
    expect(tx.preparationChecklist.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ templateVersion: 3 }) }));
  });

  it("emite readiness_changed somente quando o readiness muda", async () => {
    const beforeItems = [{ id: "item-1", title: "Testar energia", required: true, evidenceRequired: false, status: PreparationChecklistItemStatus.PENDING, evidences: [] }];
    const item = { id: "item-1", title: "Testar energia", required: true, evidenceRequired: false, status: PreparationChecklistItemStatus.PENDING, completedAt: null, checklistId: "checklist-1", evidences: [], checklist: { id: "checklist-1", status: PreparationChecklistStatus.IN_PROGRESS, electionId: "election-1", pollingPlaceId: "place-1", items: beforeItems } };
    const afterPayload = { id: "checklist-1", electionId: "election-1", pollingPlaceId: "place-1", dueAt: null, status: PreparationChecklistStatus.IN_PROGRESS, template: { version: 1 }, history: [], items: [{ id: "item-1", title: "Testar energia", required: true, evidenceRequired: false, status: PreparationChecklistItemStatus.COMPLETED, evidences: [] }] };
    const tx = {
      preparationChecklistItem: { update: vi.fn() },
      preparationChecklistHistory: { create: vi.fn() },
      preparationChecklist: { findUnique: vi.fn().mockResolvedValue({ id: "checklist-1", status: PreparationChecklistStatus.IN_PROGRESS, assigneeId: "owner-1", items: [{ required: true, status: PreparationChecklistItemStatus.COMPLETED, evidenceRequired: false, evidences: [] }] }), update: vi.fn() },
    };
    const prisma = { preparationChecklistItem: { findUnique: vi.fn().mockResolvedValue(item) }, preparationChecklist: { findUnique: vi.fn().mockResolvedValue(afterPayload) }, $transaction: transactionMock(tx) };
    const { service, eventBus } = createService(prisma);
    await service.updateItem("item-1", { status: PreparationChecklistItemStatus.COMPLETED }, "actor-1");
    expect(eventBus.emit).toHaveBeenCalledWith("preparation_checklist.readiness_changed", expect.objectContaining({ checklistId: "checklist-1", from: 0, to: 100 }));
    expect(eventBus.emit.mock.calls.some(([name]) => name === "preparation_checklist.blocker_detected")).toBe(false);
  });

  it("emite blocker_detected quando um bloqueador crítico aparece", async () => {
    const beforeItems = [{ id: "item-1", title: "Item livre", required: false, evidenceRequired: false, status: PreparationChecklistItemStatus.PENDING, evidences: [] }];
    const item = { id: "item-1", title: "Item livre", required: false, evidenceRequired: false, status: PreparationChecklistItemStatus.PENDING, completedAt: null, checklistId: "checklist-1", evidences: [], checklist: { id: "checklist-1", status: PreparationChecklistStatus.IN_PROGRESS, electionId: "election-1", pollingPlaceId: "place-1", items: beforeItems } };
    const afterPayload = { id: "checklist-1", electionId: "election-1", pollingPlaceId: "place-1", dueAt: null, status: PreparationChecklistStatus.IN_PROGRESS, template: { version: 1 }, history: [], items: [{ id: "item-1", title: "Item livre", required: false, evidenceRequired: false, status: PreparationChecklistItemStatus.BLOCKED, evidences: [] }] };
    const tx = {
      preparationChecklistItem: { update: vi.fn() },
      preparationChecklistHistory: { create: vi.fn() },
      preparationChecklist: { findUnique: vi.fn().mockResolvedValue({ id: "checklist-1", status: PreparationChecklistStatus.IN_PROGRESS, assigneeId: "owner-1", items: [{ required: false, status: PreparationChecklistItemStatus.BLOCKED, evidenceRequired: false, evidences: [] }] }), update: vi.fn() },
    };
    const prisma = { preparationChecklistItem: { findUnique: vi.fn().mockResolvedValue(item) }, preparationChecklist: { findUnique: vi.fn().mockResolvedValue(afterPayload) }, $transaction: transactionMock(tx) };
    const { service, eventBus } = createService(prisma);
    await service.updateItem("item-1", { status: PreparationChecklistItemStatus.BLOCKED }, "actor-1");
    expect(eventBus.emit).toHaveBeenCalledWith("preparation_checklist.blocker_detected", expect.objectContaining({ checklistId: "checklist-1", blockers: ["item-1:BLOCKED"] }));
    expect(eventBus.emit.mock.calls.some(([name]) => name === "preparation_checklist.readiness_changed")).toBe(false);
  });

  it("expõe readiness, bloqueadores e prazo na visão consolidada", async () => {
    const rows = [{ id: "checklist-1", dueAt: null, status: PreparationChecklistStatus.IN_PROGRESS, election: { id: "election-1", name: "Eleições 2026", year: 2026 }, electoralZone: { id: "zone-1", electionId: "election-1", number: 1, name: "Zona" }, pollingPlace: { id: "place-1", electoralZoneId: "zone-1", name: "Local" }, assignee: { id: "user-1", name: "Ana", email: "ana@example.com" }, items: [{ id: "item-1", title: "Item", required: true, evidenceRequired: true, status: PreparationChecklistItemStatus.PENDING, evidences: [] }] }];
    const prisma = { preparationChecklist: { findMany: vi.fn().mockResolvedValue(rows) } };
    const { service } = createService(prisma);
    const result = await service.overview({});
    expect(result[0]).toMatchObject({ readiness: 0, criticalBlockers: 1, deadlineState: "ON_TRACK", progress: 0 });
  });
});
