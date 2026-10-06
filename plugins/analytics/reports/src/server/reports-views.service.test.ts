import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import type { EventBus } from "@eops/event-bus";
import { PERMISSIONS } from "@eops/security";
import { ReportsViewsService, normalizeViewFilters, normalizeViewMetrics } from "./reports-views.service";

function createPrisma(overrides: Record<string, unknown> = {}) {
  const model = {
    reportSavedView: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: "view-1", ...data })),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: "view-1", ownerId: "user-1", ...data })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      delete: vi.fn().mockResolvedValue({ id: "view-1" }),
    },
    ...overrides,
  };
  const prisma = { ...model, $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(model)) };
  return prisma as unknown as PrismaService & typeof model;
}

function service(prisma: ReturnType<typeof createPrisma>) {
  const eventBus = { emit: vi.fn() } as unknown as EventBus;
  return { instance: new ReportsViewsService(prisma, eventBus), eventBus };
}

describe("validação de filtros de view", () => {
  it("aceita apenas chaves da whitelist", () => {
    expect(normalizeViewFilters({ from: " 2026-10-01 ", status: "NEW" })).toEqual({ from: "2026-10-01", status: "NEW" });
    expect(() => normalizeViewFilters({ ownerId: "hack" })).toThrow(/nao suportado/);
  });

  it("restringe métricas ao vocabulário", () => {
    expect(normalizeViewMetrics(["incidentsOpened", "incidentsOpened"])).toEqual(["incidentsOpened"]);
    expect(() => normalizeViewMetrics(["naoExiste"])).toThrow(/vocabulario/);
  });
});

describe("ownership e compartilhamento", () => {
  it("cria view privada e emite report_view.created", async () => {
    const prisma = createPrisma();
    const { instance, eventBus } = service(prisma);
    const view = await instance.create({ name: "Minha visão", metricsJson: ["incidentsOpened"] }, "user-1", []);
    expect(view.shared).toBe(false);
    expect(eventBus.emit).toHaveBeenCalledWith("report_view.created", expect.objectContaining({ entityId: "view-1", actorId: "user-1", name: "Minha visão" }));
    expect(eventBus.emit).not.toHaveBeenCalledWith("report_view.shared", expect.anything());
  });

  it("exige reports.manage para compartilhar e emite report_view.shared", async () => {
    const denied = service(createPrisma());
    await expect(denied.instance.create({ name: "Equipe", shared: true }, "u", [])).rejects.toThrow(/gerencia/);

    const prisma = createPrisma();
    const { instance, eventBus } = service(prisma);
    await instance.create({ name: "Equipe", shared: true }, "u", [PERMISSIONS.reports.manage]);
    expect(eventBus.emit).toHaveBeenCalledWith("report_view.shared", expect.objectContaining({ entityId: "view-1" }));
  });

  it("limita a 20 visões por owner", async () => {
    const prisma = createPrisma();
    prisma.reportSavedView.count.mockResolvedValue(20);
    const { instance } = service(prisma);
    await expect(instance.create({ name: "Excedente" }, "user-1", [])).rejects.toThrow(/Limite/);
  });

  it("isDefault é transacional por owner", async () => {
    const prisma = createPrisma();
    const { instance } = service(prisma);
    await instance.create({ name: "Padrão", isDefault: true }, "user-1", []);
    expect(prisma.reportSavedView.updateMany).toHaveBeenCalledWith({ where: { ownerId: "user-1", isDefault: true }, data: { isDefault: false } });
  });

  it("impede edição de view privada de outro owner", async () => {
    const prisma = createPrisma();
    prisma.reportSavedView.findUnique.mockResolvedValue({ id: "view-9", ownerId: "other", shared: false });
    const { instance } = service(prisma);
    await expect(instance.update("view-9", { name: "Nova" }, "user-1", [])).rejects.toThrow(/nao pode alterar/);
  });
});
