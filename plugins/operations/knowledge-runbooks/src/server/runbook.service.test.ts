import { RunbookUsageOutcome } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../../../../packages/database/src";
import type { EventBus } from "../../../../../packages/event-bus/src";
import type { KnowledgeService } from "./knowledge.service";
import { RunbookService } from "./runbook.service";

function runbook(overrides: Record<string, unknown> = {}) {
  return {
    id: "runbook-1",
    code: "KB-00001",
    kind: "RUNBOOK",
    title: "Reconectar enlace principal",
    summary: "Procedimento para restabelecer o enlace.",
    status: "PUBLISHED",
    category: null,
    tags: [],
    keywords: ["enlace", "reconexao"],
    incidentCategoryKey: "CONNECTIVITY",
    incidentSeverity: "HIGH",
    assetTypeKey: null,
    usageCount: 0,
    resolvedCount: 0,
    _count: { steps: 4 },
    ...overrides,
  };
}

function serviceFor(
  prisma: Record<string, unknown>,
  eventBus?: Partial<EventBus>,
  knowledgeOverride?: Partial<KnowledgeService>,
) {
  const knowledge = {
    requireExecutableRunbook: vi.fn().mockResolvedValue({
      id: "runbook-1",
      code: "KB-00001",
      title: "Reconectar enlace principal",
    }),
    findAll: vi.fn().mockResolvedValue({ items: [] }),
    ...knowledgeOverride,
  } as unknown as KnowledgeService;
  return new RunbookService(prisma as unknown as PrismaService, knowledge, eventBus as EventBus);
}

describe("recomendação", () => {
  const prismaWith = (candidates: unknown[]) => ({
    knowledgeArticle: { findMany: vi.fn().mockResolvedValue(candidates) },
  });

  it("recomenda por categoria, severidade e palavras-chave, com score explicado", async () => {
    const prisma = prismaWith([runbook()]);
    const results = await serviceFor(prisma).recommend({
      categoryKey: "CONNECTIVITY",
      severity: "HIGH",
      text: "enlace caiu e não reconecta",
      limit: 5,
    });

    expect(results).toHaveLength(1);
    // 40 categoria + 20 severidade + 5 por "enlace" presente no texto.
    // "reconecta" não casa com a palavra-chave "reconexao": a comparação é por
    // termo exato, não por radical.
    expect(results[0].score).toBe(65);
    expect(results[0].breakdown.incidentCategory).toBe(40);
    expect(results[0].reasons.length).toBeGreaterThan(0);
  });

  it("descarta runbooks sem nenhum critério em comum", async () => {
    const prisma = prismaWith([runbook({ incidentCategoryKey: "POWER", incidentSeverity: null })]);
    const results = await serviceFor(prisma).recommend({ categoryKey: "CONNECTIVITY", limit: 5 });
    expect(results).toHaveLength(0);
  });

  it("monta o contexto a partir do incidente informado", async () => {
    const prisma = {
      incident: {
        findUnique: vi.fn().mockResolvedValue({
          title: "Enlace offline",
          description: "Sem conectividade no local",
          severity: "HIGH",
          category: { key: "CONNECTIVITY" },
          asset: { type: { key: "ROUTER" } },
        }),
      },
      knowledgeArticle: { findMany: vi.fn().mockResolvedValue([runbook()]) },
    };
    const results = await serviceFor(prisma).recommend({ incidentId: "incident-1", limit: 5 });
    expect(results[0].breakdown.incidentCategory).toBe(40);
    expect(results[0].breakdown.severity).toBe(20);
  });

  it("rejeita incidente inexistente", async () => {
    const prisma = { incident: { findUnique: vi.fn().mockResolvedValue(null) } };
    await expect(
      serviceFor(prisma).recommend({ incidentId: "inexistente", limit: 5 }),
    ).rejects.toThrow("Incidente não encontrado.");
  });

  it("emite evento apenas quando há incidente e resultados", async () => {
    const prisma = {
      incident: {
        findUnique: vi.fn().mockResolvedValue({
          title: "Enlace offline",
          description: "",
          severity: "HIGH",
          category: { key: "CONNECTIVITY" },
          asset: null,
        }),
      },
      knowledgeArticle: { findMany: vi.fn().mockResolvedValue([runbook()]) },
      user: { findUnique: vi.fn().mockResolvedValue({ name: "Técnica" }) },
    };
    const emit = vi.fn().mockResolvedValue(undefined);
    await serviceFor(prisma, { emit } as unknown as Partial<EventBus>).recommend(
      { incidentId: "incident-1", limit: 5 },
      { id: "user-1" },
    );
    expect(emit).toHaveBeenCalledWith(
      "runbook.matched",
      expect.objectContaining({ incidentId: "incident-1", matchCount: 1 }),
    );
  });

  it("respeita o limite solicitado", async () => {
    const candidates = Array.from({ length: 8 }, (_, index) =>
      runbook({ id: `runbook-${index}`, title: `Runbook ${index}` }),
    );
    const prisma = prismaWith(candidates);
    const results = await serviceFor(prisma).recommend({ categoryKey: "CONNECTIVITY", limit: 3 });
    expect(results).toHaveLength(3);
  });

  it("consulta somente runbooks publicados", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await serviceFor({ knowledgeArticle: { findMany } }).recommend({ categoryKey: "X", limit: 5 });
    expect(findMany.mock.calls[0][0].where).toEqual({
      kind: "RUNBOOK",
      status: "PUBLISHED",
    });
  });
});

describe("registro de uso", () => {
  it("persiste a execução e incrementa os contadores do runbook", async () => {
    const tx = {
      runbookUsage: { create: vi.fn().mockResolvedValue({ id: "usage-1" }) },
      knowledgeArticle: { update: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ name: "Técnica Demo" }) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const emit = vi.fn().mockResolvedValue(undefined);

    await serviceFor(prisma, { emit } as unknown as Partial<EventBus>).registerUsage(
      "runbook-1",
      { outcome: RunbookUsageOutcome.RESOLVED, stepsCompleted: 4 },
      { id: "user-1" },
    );

    const data = tx.runbookUsage.create.mock.calls[0][0].data;
    expect(data.resolved).toBe(true);
    expect(data.userName).toBe("Técnica Demo");
    expect(tx.knowledgeArticle.update.mock.calls[0][0].data.usageCount).toEqual({ increment: 1 });
    expect(tx.knowledgeArticle.update.mock.calls[0][0].data.resolvedCount).toEqual({
      increment: 1,
    });
    expect(emit).toHaveBeenCalledWith(
      "runbook.executed",
      expect.objectContaining({ outcome: "RESOLVED", resolved: true }),
    );
  });

  it("não incrementa resoluções quando o desfecho é negativo", async () => {
    const tx = {
      runbookUsage: { create: vi.fn().mockResolvedValue({ id: "usage-2" }) },
      knowledgeArticle: { update: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ name: "Técnica" }) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };

    await serviceFor(prisma).registerUsage("runbook-1", {
      outcome: RunbookUsageOutcome.NOT_RESOLVED,
    });

    const updateData = tx.knowledgeArticle.update.mock.calls[0][0].data;
    expect(updateData.usageCount).toEqual({ increment: 1 });
    expect(updateData.resolvedCount).toBeUndefined();
    expect(tx.runbookUsage.create.mock.calls[0][0].data.resolved).toBe(false);
  });

  it("registra fim mesmo sem data informada", async () => {
    const tx = {
      runbookUsage: { create: vi.fn().mockResolvedValue({}) },
      knowledgeArticle: { update: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    await serviceFor(prisma).registerUsage("runbook-1", {
      outcome: RunbookUsageOutcome.PARTIALLY_RESOLVED,
    });
    expect(tx.runbookUsage.create.mock.calls[0][0].data.finishedAt).toBeInstanceOf(Date);
  });
});

describe("métricas", () => {
  it("consolida desfechos e calcula a taxa de sucesso", async () => {
    const prisma = {
      knowledgeArticle: {
        groupBy: vi.fn().mockResolvedValue([]),
        findMany: vi.fn().mockResolvedValue([
          { id: "r1", code: "KB-00001", title: "A", usageCount: 4, resolvedCount: 3, categoryId: "c1", updatedAt: new Date() },
        ]),
      },
      runbookUsage: {
        groupBy: vi.fn().mockResolvedValue([
          { outcome: RunbookUsageOutcome.RESOLVED, _count: { _all: 3 } },
          { outcome: RunbookUsageOutcome.NOT_RESOLVED, _count: { _all: 1 } },
        ]),
      },
      knowledgeCategory: {
        findMany: vi.fn().mockResolvedValue([{ id: "c1", name: "Conectividade" }]),
      },
    };
    const metrics = await serviceFor(prisma).metrics();
    expect(metrics.outcomes.total).toBe(4);
    expect(metrics.outcomes.successRate).toBe(75);
    expect(metrics.mostUsed[0].successRate).toBe(75);
    expect(metrics.coverage.find((entry) => entry.name === "Conectividade")?.runbooks).toBe(0);
  });
});
