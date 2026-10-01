import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EvidenceLinkType, EvidenceStatus, EvidenceType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../../../../packages/database/src";
import type { EventBus } from "../../../../../packages/event-bus/src";
import { EvidenceLinksService } from "./evidence-links.service";
import { EvidenceService } from "./evidence.service";
import type { EvidenceTagsService } from "./evidence-tags.service";
import type { EvidenceTimelineService } from "./evidence-timeline.service";
import type { EvidenceVersionsService } from "./evidence-versions.service";

function evidence(overrides: Record<string, unknown> = {}) {
  return {
    id: "evidence-1",
    code: "EVD-00001",
    title: "Foto da urna com etiqueta danificada",
    description: "Registro da vistoria preventiva.",
    type: EvidenceType.PHOTO,
    status: EvidenceStatus.ACTIVE,
    electionId: "election-1",
    authorId: "user-1",
    authorName: "Técnica Demo",
    origin: "Vistoria presencial",
    observations: null,
    capturedAt: new Date("2026-10-01T09:00:00.000Z"),
    currentVersion: 1,
    versionCount: 1,
    archivedAt: null,
    createdAt: new Date("2026-10-01T10:00:00.000Z"),
    updatedAt: new Date("2026-10-01T10:00:00.000Z"),
    election: { id: "election-1", name: "Eleições 2026", year: 2026 },
    tags: [],
    links: [],
    versions: [
      {
        id: "version-1",
        number: 1,
        fileName: "urna.jpg",
        extension: "jpg",
        mimeType: "image/jpeg",
        size: 2048,
        checksum: "a".repeat(64),
        isCurrent: true,
      },
    ],
    ...overrides,
  };
}

function serviceFor(prisma: Record<string, unknown>, eventBus?: Partial<EventBus>) {
  const versions = {
    createInitialVersion: vi.fn().mockResolvedValue({
      id: "version-1",
      number: 1,
      fileName: "urna.jpg",
      size: 2048,
      checksum: "a".repeat(64),
    }),
    addVersion: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    verifyIntegrity: vi.fn(),
    driver: "local",
  } as unknown as EvidenceVersionsService;
  const links = {
    resolveAll: vi.fn().mockResolvedValue([]),
    replace: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    hasLinks: vi.fn(),
  } as unknown as EvidenceLinksService;
  const tags = {
    linkDataFor: vi.fn().mockResolvedValue([]),
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
  } as unknown as EvidenceTagsService;
  const timeline = {
    record: vi.fn().mockResolvedValue({}),
    dataFor: vi.fn().mockImplementation((evidenceId: string, entry: unknown) => ({
      evidenceId,
      ...(entry as object),
    })),
    list: vi.fn().mockResolvedValue([]),
  } as unknown as EvidenceTimelineService;

  return new EvidenceService(
    prisma as unknown as PrismaService,
    versions,
    links,
    tags,
    timeline,
    eventBus as EventBus,
  );
}

describe("EvidenceService.create", () => {
  it("gera código sequencial, autor e registra a timeline", async () => {
    const tx = {
      evidence: {
        create: vi.fn().mockResolvedValue(evidence()),
        update: vi.fn(),
        findUnique: vi.fn(),
      },
      evidenceEvent: { create: vi.fn().mockResolvedValue({}) },
      evidenceLink: { findMany: vi.fn().mockResolvedValue([]) },
      evidenceVersion: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn() },
      evidenceTagLink: { deleteMany: vi.fn() },
    };
    const prisma = {
      election: { findUnique: vi.fn().mockResolvedValue({ id: "election-1" }) },
      evidence: {
        findFirst: vi.fn().mockResolvedValue({ code: "EVD-00041" }),
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(evidence())
          .mockResolvedValue(evidence()),
      },
      user: { findUnique: vi.fn().mockResolvedValue({ name: "Técnica Demo" }) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const emit = vi.fn().mockResolvedValue(undefined);

    await serviceFor(prisma, { emit } as unknown as Partial<EventBus>).create(
      {
        title: "Foto da urna",
        type: EvidenceType.PHOTO,
        tags: [],
      },
      {
        originalname: "urna.jpg",
        mimetype: "image/jpeg",
        size: 2048,
        buffer: Buffer.from("jpg"),
      },
      { id: "user-1" },
    );

    const data = tx.evidence.create.mock.calls[0][0].data;
    expect(data.code).toBe("EVD-00042");
    expect(data.authorName).toBe("Técnica Demo");
    expect(tx.evidenceEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "CREATED" }),
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      "evidence.created",
      expect.objectContaining({ code: "EVD-00042", type: EvidenceType.PHOTO }),
    );
  });

  it("rejeita pleito inexistente antes de gravar", async () => {
    const prisma = { election: { findUnique: vi.fn().mockResolvedValue(null) } };
    await expect(
      serviceFor(prisma).create(
        { title: "Evidência", type: EvidenceType.PHOTO, electionId: "inexistente", tags: [] },
        undefined,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejeita vínculo em formato inválido", async () => {
    const prisma = {
      election: { findUnique: vi.fn().mockResolvedValue({ id: "election-1" }) },
    };
    await expect(
      serviceFor(prisma).create(
        {
          title: "Evidência",
          type: EvidenceType.PHOTO,
          tags: [],
          links: ["semSeparador"],
        },
        undefined,
      ),
    ).rejects.toThrow("Vínculo inválido");
  });

  it("rejeita tipo de vínculo desconhecido", async () => {
    const prisma = {
      election: { findUnique: vi.fn().mockResolvedValue({ id: "election-1" }) },
    };
    await expect(
      serviceFor(prisma).create(
        { title: "Evidência", type: EvidenceType.PHOTO, tags: [], links: ["FOO:abc"] },
        undefined,
      ),
    ).rejects.toThrow("Tipo de vínculo desconhecido");
  });
});

describe("EvidenceService.remove", () => {
  it("exclui evidência ativa e sem vínculo", async () => {
    const remove = vi.fn().mockResolvedValue({});
    const prisma = {
      evidence: { findUnique: vi.fn().mockResolvedValue(evidence()), delete: remove },
    };
    await serviceFor(prisma).remove("evidence-1");
    expect(remove).toHaveBeenCalledWith({ where: { id: "evidence-1" } });
  });

  it("recusa excluir evidência vinculada a registro operacional", async () => {
    const prisma = {
      evidence: {
        findUnique: vi.fn().mockResolvedValue(
          evidence({
            links: [
              {
                id: "link-1",
                type: EvidenceLinkType.INCIDENT,
                targetId: "incident-1",
                targetLabel: "INC-00001",
              },
            ],
          }),
        ),
      },
    };
    await expect(serviceFor(prisma).remove("evidence-1")).rejects.toThrow(
      "não podem ser excluídas",
    );
  });

  it("recusa excluir evidência arquivada", async () => {
    const prisma = {
      evidence: {
        findUnique: vi
          .fn()
          .mockResolvedValue(evidence({ status: EvidenceStatus.ARCHIVED, archivedAt: new Date() })),
      },
    };
    await expect(serviceFor(prisma).remove("evidence-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe("EvidenceService.archive", () => {
  it("marca como arquivada, registra timeline e emite evento", async () => {
    const tx = {
      evidence: { update: vi.fn().mockResolvedValue({}) },
      evidenceEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      evidence: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(evidence())
          .mockResolvedValue(
            evidence({ status: EvidenceStatus.ARCHIVED, archivedAt: new Date() }),
          ),
        findMany: vi.fn().mockResolvedValue([]),
      },
      user: { findUnique: vi.fn().mockResolvedValue({ name: "Técnica Demo" }) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const emit = vi.fn().mockResolvedValue(undefined);

    await serviceFor(prisma, { emit } as unknown as Partial<EventBus>).archive("evidence-1");

    expect(tx.evidence.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: EvidenceStatus.ARCHIVED }),
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      "evidence.archived",
      expect.objectContaining({ code: "EVD-00001" }),
    );
  });

  it("é idempotente quando já está arquivada", async () => {
    const prisma = {
      evidence: {
        findUnique: vi.fn().mockResolvedValue(
          evidence({ status: EvidenceStatus.ARCHIVED, archivedAt: new Date() }),
        ),
      },
      $transaction: vi.fn(),
    };
    await serviceFor(prisma).archive("evidence-1");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("EvidenceService.findAll", () => {
  it("aplica filtros de tipo, período, vínculo e busca", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      evidence: { findMany, count: vi.fn().mockResolvedValue(0) },
    };
    await serviceFor(prisma).findAll({
      type: EvidenceType.PHOTO,
      from: "2026-10-01T00:00:00.000Z",
      linkType: EvidenceLinkType.INCIDENT,
      linkTargetId: "incident-1",
      search: "urna",
      page: 2,
      pageSize: 10,
    });

    const args = findMany.mock.calls[0][0];
    expect(args.where.type).toBe(EvidenceType.PHOTO);
    expect(args.where.capturedAt.gte).toBeInstanceOf(Date);
    expect(args.where.links).toEqual({
      some: { type: EvidenceLinkType.INCIDENT, targetId: "incident-1" },
    });
    expect(args.where.OR).toHaveLength(5);
    expect(args.skip).toBe(10);
  });

  it("filtra evidências sem vínculo quando solicitado", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { evidence: { findMany, count: vi.fn().mockResolvedValue(0) } };
    await serviceFor(prisma).findAll({ withoutLinks: true, page: 1, pageSize: 20 });
    expect(findMany.mock.calls[0][0].where.links).toEqual({ none: {} });
  });

  it("expõe o checksum da versão corrente em cada item", async () => {
    const prisma = {
      evidence: {
        findMany: vi.fn().mockResolvedValue([evidence()]),
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const result = await serviceFor(prisma).findAll({ page: 1, pageSize: 20 });
    expect(result.items[0].version?.checksum).toBe("a".repeat(64));
    expect(result.items[0].version?.number).toBe(1);
    expect(result.totalPages).toBe(1);
  });
});

describe("EvidenceService.referenceData", () => {
  it("informa driver de armazenamento e limites por tipo", async () => {
    const prisma = {
      election: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const data = await serviceFor(prisma).referenceData();
    expect(data.storageDriver).toBe("local");
    expect(data.maxUploadBytes).toBeGreaterThan(0);
    expect(data.typeRules.PHOTO.imageOnly).toBe(true);
  });
});
