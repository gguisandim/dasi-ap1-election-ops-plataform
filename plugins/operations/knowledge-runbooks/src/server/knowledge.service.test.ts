import { BadRequestException } from "@nestjs/common";
import {
  KnowledgeArticleKind,
  KnowledgeArticleStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import type { EventBus } from "@eops/event-bus";
import type { KnowledgeCatalogService } from "./knowledge-catalog.service";
import { KnowledgeService } from "./knowledge.service";

function article(overrides: Record<string, unknown> = {}) {
  return {
    id: "article-1",
    code: "KB-00001",
    kind: KnowledgeArticleKind.RUNBOOK,
    title: "Reconectar enlace principal",
    summary: "Restabelece o enlace após queda.",
    content: null,
    status: KnowledgeArticleStatus.DRAFT,
    categoryId: null,
    authorId: "user-1",
    authorName: "Técnica Demo",
    currentVersion: 1,
    versionCount: 1,
    views: 0,
    usageCount: 0,
    resolvedCount: 0,
    incidentCategoryKey: "CONNECTIVITY",
    incidentSeverity: "HIGH",
    assetTypeKey: null,
    keywords: ["enlace"],
    problem: "Enlace caiu",
    symptoms: null,
    diagnosis: null,
    prerequisites: null,
    validation: null,
    rollback: null,
    escalation: null,
    references: null,
    publishedAt: null,
    reviewedAt: null,
    archivedAt: null,
    createdAt: new Date("2026-10-01T10:00:00.000Z"),
    updatedAt: new Date("2026-10-01T10:00:00.000Z"),
    category: null,
    tags: [],
    steps: [],
    _count: { steps: 0 },
    ...overrides,
  };
}

function serviceFor(prisma: Record<string, unknown>, eventBus?: Partial<EventBus>) {
  const catalog = {
    requireCategory: vi.fn().mockResolvedValue({ id: "category-1" }),
    linkDataFor: vi.fn().mockResolvedValue([]),
    listCategories: vi.fn().mockResolvedValue([]),
    listTags: vi.fn().mockResolvedValue([]),
  } as unknown as KnowledgeCatalogService;
  return new KnowledgeService(prisma as unknown as PrismaService, catalog, eventBus as EventBus);
}

describe("KnowledgeService.create", () => {
  it("gera código sequencial, autor e versão inicial", async () => {
    const tx = {
      knowledgeArticle: { create: vi.fn().mockResolvedValue(article()) },
      knowledgeArticleVersion: { create: vi.fn().mockResolvedValue({ id: "version-1" }) },
      runbookStep: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn(), createMany: vi.fn() },
      knowledgeTagLink: { deleteMany: vi.fn() },
    };
    const prisma = {
      knowledgeArticle: {
        findFirst: vi.fn().mockResolvedValue({ code: "KB-00041" }),
        findUnique: vi.fn().mockResolvedValue(article()),
      },
      user: { findUnique: vi.fn().mockResolvedValue({ name: "Técnica Demo" }) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const emit = vi.fn().mockResolvedValue(undefined);

    await serviceFor(prisma, { emit } as unknown as Partial<EventBus>).create(
      {
        kind: KnowledgeArticleKind.RUNBOOK,
        title: "Reconectar enlace principal",
        summary: "Restabelece o enlace após queda.",
        problem: "Enlace caiu",
        keywords: ["Enlace", "de"],
        tags: [],
      },
      { id: "user-1" },
    );

    const data = tx.knowledgeArticle.create.mock.calls[0][0].data;
    expect(data.code).toBe("KB-00042");
    expect(data.authorName).toBe("Técnica Demo");
    expect(data.keywords).toEqual(["enlace"]);
    expect(tx.knowledgeArticleVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ number: 1, note: "Versão inicial." }),
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      "runbook.created",
      expect.objectContaining({ title: "Reconectar enlace principal" }),
    );
  });

  it("exige problema ao criar runbook", async () => {
    const prisma = {};
    await expect(
      serviceFor(prisma).create({
        kind: KnowledgeArticleKind.RUNBOOK,
        title: "Runbook sem problema",
        summary: "Resumo",
        tags: [],
      }),
    ).rejects.toThrow("precisa descrever o problema");
  });

  it("não emite evento de runbook ao criar artigo", async () => {
    const tx = {
      knowledgeArticle: { create: vi.fn().mockResolvedValue(article({ kind: KnowledgeArticleKind.ARTICLE })) },
      knowledgeArticleVersion: { create: vi.fn().mockResolvedValue({}) },
      runbookStep: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const prisma = {
      knowledgeArticle: {
        findFirst: vi.fn().mockResolvedValue({ code: "KB-00001" }),
        findUnique: vi.fn().mockResolvedValue(article({ kind: KnowledgeArticleKind.ARTICLE })),
      },
      user: { findUnique: vi.fn().mockResolvedValue({ name: "Autora" }) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const emit = vi.fn().mockResolvedValue(undefined);
    await serviceFor(prisma, { emit } as unknown as Partial<EventBus>).create(
      { kind: KnowledgeArticleKind.ARTICLE, title: "Como funciona o pleito", summary: "Resumo", tags: [] },
      { id: "user-1" },
    );
    expect(emit).not.toHaveBeenCalled();
  });
});

describe("KnowledgeService.publish", () => {
  it("exige ao menos um passo em runbook", async () => {
    const prisma = {
      knowledgeArticle: { findUnique: vi.fn().mockResolvedValue(article()) },
      runbookStep: { count: vi.fn().mockResolvedValue(0) },
    };
    await expect(serviceFor(prisma).publish("article-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("publica runbook com passos, registra data e emite evento", async () => {
    const prisma = {
      knowledgeArticle: {
        findUnique: vi.fn().mockResolvedValue(article()),
        update: vi.fn().mockResolvedValue(article({ status: KnowledgeArticleStatus.PUBLISHED })),
      },
      runbookStep: { count: vi.fn().mockResolvedValue(4) },
      user: { findUnique: vi.fn().mockResolvedValue({ name: "Curadoria" }) },
    };
    const emit = vi.fn().mockResolvedValue(undefined);
    await serviceFor(prisma, { emit } as unknown as Partial<EventBus>).publish("article-1", {
      id: "user-1",
    });

    expect(prisma.knowledgeArticle.update.mock.calls[0][0].data).toEqual({
      status: KnowledgeArticleStatus.PUBLISHED,
      publishedAt: expect.any(Date),
    });
    expect(emit).toHaveBeenCalledWith(
      "runbook.published",
      expect.objectContaining({ stepCount: 4 }),
    );
  });

  it("é idempotente quando já está publicado", async () => {
    const prisma = {
      knowledgeArticle: {
        findUnique: vi
          .fn()
          .mockResolvedValue(article({ status: KnowledgeArticleStatus.PUBLISHED })),
        update: vi.fn(),
      },
    };
    await serviceFor(prisma).publish("article-1");
    expect(prisma.knowledgeArticle.update).not.toHaveBeenCalled();
  });

  it("recusa publicar verbete arquivado", async () => {
    const prisma = {
      knowledgeArticle: {
        findUnique: vi.fn().mockResolvedValue(article({ status: KnowledgeArticleStatus.ARCHIVED })),
      },
    };
    await expect(serviceFor(prisma).publish("article-1")).rejects.toThrow("não permitida");
  });
});

describe("KnowledgeService.update", () => {
  it("exige nota de alteração quando o verbete já saiu do rascunho", async () => {
    const prisma = {
      knowledgeArticle: {
        findUnique: vi
          .fn()
          .mockResolvedValue(article({ status: KnowledgeArticleStatus.PUBLISHED })),
      },
    };
    await expect(
      serviceFor(prisma).update("article-1", { title: "Novo título" }),
    ).rejects.toThrow("nota da alteração");
  });

  it("avança a versão e cria instantâneo com a nota informada", async () => {
    const tx = {
      knowledgeArticle: {
        update: vi.fn().mockResolvedValue(article({ currentVersion: 2 })),
      },
      knowledgeArticleVersion: { create: vi.fn().mockResolvedValue({}) },
      knowledgeTagLink: { deleteMany: vi.fn() },
      runbookStep: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const prisma = {
      knowledgeArticle: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(article({ status: KnowledgeArticleStatus.PUBLISHED }))
          .mockResolvedValue(article({ currentVersion: 2 })),
      },
      user: { findUnique: vi.fn().mockResolvedValue({ name: "Curadoria" }) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };

    await serviceFor(prisma).update("article-1", {
      title: "Título revisado",
      changeNote: "Ajuste após falha em campo",
    });

    const data = tx.knowledgeArticle.update.mock.calls[0][0].data;
    expect(data.currentVersion).toEqual({ increment: 1 });
    expect(tx.knowledgeArticleVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ note: "Ajuste após falha em campo" }),
      }),
    );
  });
});

describe("KnowledgeService.replaceSteps", () => {
  it("renumera os passos a partir de 1 antes de gravar", async () => {
    const tx = {
      runbookStep: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      knowledgeArticle: { update: vi.fn().mockResolvedValue(article()) },
      knowledgeArticleVersion: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      knowledgeArticle: {
        findUnique: vi.fn().mockResolvedValue(article()),
        findFirst: vi.fn(),
      },
      user: { findUnique: vi.fn().mockResolvedValue({ name: "Curadoria" }) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };

    await serviceFor(prisma).replaceSteps("article-1", {
      steps: [
        { order: 9, title: "Segundo na prática", instruction: "Faça depois" },
        { order: 3, title: "Primeiro na prática", instruction: "Faça antes" },
      ],
    });

    const created = tx.runbookStep.createMany.mock.calls[0][0].data;
    expect(created.map((step: { order: number }) => step.order)).toEqual([1, 2]);
    expect(created[0].title).toBe("Primeiro na prática");
    expect(created[0].required).toBe(true);
  });

  it("recusa substituir passos de um artigo", async () => {
    const prisma = {
      knowledgeArticle: {
        findUnique: vi.fn().mockResolvedValue(article({ kind: KnowledgeArticleKind.ARTICLE })),
      },
    };
    await expect(
      serviceFor(prisma).replaceSteps("article-1", { steps: [] }),
    ).rejects.toThrow("Somente runbooks");
  });
});

describe("KnowledgeService.remove", () => {
  it("exclui somente rascunho", async () => {
    const remove = vi.fn().mockResolvedValue({});
    const prisma = {
      knowledgeArticle: { findUnique: vi.fn().mockResolvedValue(article()), delete: remove },
    };
    await serviceFor(prisma).remove("article-1");
    expect(remove).toHaveBeenCalledWith({ where: { id: "article-1" } });
  });

  it("recusa excluir publicado, orientando a arquivar", async () => {
    const prisma = {
      knowledgeArticle: {
        findUnique: vi
          .fn()
          .mockResolvedValue(article({ status: KnowledgeArticleStatus.PUBLISHED })),
      },
    };
    await expect(serviceFor(prisma).remove("article-1")).rejects.toThrow("Archive o verbete");
  });
});

describe("KnowledgeService.findAll", () => {
  it("busca em título, resumo, problema, sintomas e conteúdo", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      knowledgeArticle: { findMany, count: vi.fn().mockResolvedValue(0) },
    };
    await serviceFor(prisma).findAll({ search: "enlace", page: 1, pageSize: 20 });
    expect(findMany.mock.calls[0][0].where.OR).toHaveLength(6);
  });

  it("restringe a desatualizados por status, tipo e data", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      knowledgeArticle: { findMany, count: vi.fn().mockResolvedValue(0) },
    };
    await serviceFor(prisma).findAll({ staleOnly: true, page: 1, pageSize: 20 });
    const filter = findMany.mock.calls[0][0].where.AND[0];
    expect(filter.status).toBe(KnowledgeArticleStatus.PUBLISHED);
    expect(filter.kind).toBe(KnowledgeArticleKind.RUNBOOK);
    expect(filter.updatedAt.lt).toBeInstanceOf(Date);
  });

  it("restringe a publicados sem uso", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      knowledgeArticle: { findMany, count: vi.fn().mockResolvedValue(0) },
    };
    await serviceFor(prisma).findAll({ unusedOnly: true, page: 1, pageSize: 20 });
    expect(findMany.mock.calls[0][0].where.AND[0]).toEqual({
      status: KnowledgeArticleStatus.PUBLISHED,
      usageCount: 0,
    });
  });
});

describe("KnowledgeService.dashboard", () => {
  it("ordena a cobertura da menor para a maior", async () => {
    const prisma = {
      knowledgeArticle: {
        count: vi.fn().mockResolvedValue(0),
        groupBy: vi
          .fn()
          .mockResolvedValue([{ categoryId: "c2", _count: { _all: 5 } }]),
      },
      runbookUsage: { count: vi.fn().mockResolvedValue(0) },
      knowledgeCategory: {
        findMany: vi.fn().mockResolvedValue([
          { id: "c1", name: "Conectividade" },
          { id: "c2", name: "Energia" },
        ]),
      },
    };
    const dashboard = await serviceFor(prisma).dashboard();
    // Ordenado da menor para a maior cobertura: categorias sem runbook primeiro.
    expect(dashboard.coverage[0].name).toBe("Conectividade");
    expect(dashboard.coverage[0].runbooks).toBe(0);
    expect(dashboard.coverage[dashboard.coverage.length - 1]).toMatchObject({
      name: "Energia",
      runbooks: 5,
    });
  });
});

describe("KnowledgeService.requireExecutableRunbook", () => {
  it("recusa executar artigo", async () => {
    const prisma = {
      knowledgeArticle: {
        findUnique: vi.fn().mockResolvedValue(article({ kind: KnowledgeArticleKind.ARTICLE })),
      },
    };
    await expect(serviceFor(prisma).requireExecutableRunbook("article-1")).rejects.toThrow(
      "Somente runbooks podem ser executados",
    );
  });

  it("recusa executar runbook não publicado", async () => {
    const prisma = {
      knowledgeArticle: { findUnique: vi.fn().mockResolvedValue(article()) },
    };
    await expect(serviceFor(prisma).requireExecutableRunbook("article-1")).rejects.toThrow(
      "publicados",
    );
  });

  it("aceita runbook publicado", async () => {
    const prisma = {
      knowledgeArticle: {
        findUnique: vi
          .fn()
          .mockResolvedValue(article({ status: KnowledgeArticleStatus.PUBLISHED })),
      },
    };
    await expect(
      serviceFor(prisma).requireExecutableRunbook("article-1"),
    ).resolves.toMatchObject({ id: "article-1" });
  });
});
