import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EvidenceType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import { EvidenceVersionsService } from "./evidence-versions.service";
import type { StorageService } from "./storage/storage.service";
import type { EvidenceTimelineService } from "./evidence-timeline.service";

const file = (overrides: Partial<{ originalname: string; mimetype: string; size: number }> = {}) => ({
  originalname: "foto.jpg",
  mimetype: "image/jpeg",
  size: 1024,
  buffer: Buffer.from("conteudo"),
  ...overrides,
});

function storageMock() {
  return {
    store: vi.fn().mockResolvedValue({
      key: "2026/10/abc.jpg",
      driver: "local",
      size: 1024,
      checksum: "b".repeat(64),
      mimeType: "image/jpeg",
      originalName: "foto.jpg",
      extension: "jpg",
    }),
    read: vi.fn().mockResolvedValue(Buffer.from("conteudo")),
    exists: vi.fn().mockResolvedValue(true),
    remove: vi.fn().mockResolvedValue(undefined),
    driver: "local",
  } as unknown as StorageService;
}

function timelineMock() {
  return {
    record: vi.fn().mockResolvedValue({}),
    dataFor: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
  } as unknown as EvidenceTimelineService;
}

describe("primeira versão", () => {
  it("grava o arquivo, cria a versão 1 e define como atual", async () => {
    const storage = storageMock();
    const tx = {
      evidenceVersion: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: "version-1", number: 1, isCurrent: true }),
      },
      evidence: { update: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new EvidenceVersionsService(
      prisma as unknown as PrismaService,
      storage,
      timelineMock(),
    );

    await service.createInitialVersion(
      "evidence-1",
      file(),
      EvidenceType.PHOTO,
      { id: "user-1", name: "Técnica" },
    );

    const data = tx.evidenceVersion.create.mock.calls[0][0].data;
    expect(data.number).toBe(1);
    expect(data.isCurrent).toBe(true);
    expect(data.checksum).toBe("b".repeat(64));
    expect(data.storageKey).toBe("2026/10/abc.jpg");
    expect(tx.evidence.update.mock.calls[0][0].data.currentVersion).toBe(1);
  });

  it("recusa arquivo ausente", async () => {
    const prisma = { $transaction: vi.fn() };
    const service = new EvidenceVersionsService(
      prisma as unknown as PrismaService,
      storageMock(),
      timelineMock(),
    );
    await expect(
      service.createInitialVersion("evidence-1", undefined, EvidenceType.PHOTO, undefined),
    ).rejects.toThrow("Envie um arquivo");
  });

  it("recusa arquivo incompatível com o tipo declarado", async () => {
    const prisma = { $transaction: vi.fn() };
    const service = new EvidenceVersionsService(
      prisma as unknown as PrismaService,
      storageMock(),
      timelineMock(),
    );
    await expect(
      service.createInitialVersion(
        "evidence-1",
        file({ mimetype: "application/pdf" }),
        EvidenceType.PHOTO,
        undefined,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("remove o objeto gravado quando a transação falha", async () => {
    const storage = storageMock();
    const prisma = {
      $transaction: vi.fn().mockRejectedValue(new Error("falha no banco")),
    };
    const service = new EvidenceVersionsService(
      prisma as unknown as PrismaService,
      storage,
      timelineMock(),
    );

    await expect(
      service.createInitialVersion("evidence-1", file(), EvidenceType.PHOTO, undefined),
    ).rejects.toThrow("falha no banco");
    expect(storage.remove).toHaveBeenCalledWith("2026/10/abc.jpg");
  });
});

describe("versionamento", () => {
  it("incrementa o número, desmarca a anterior e nunca sobrescreve", async () => {
    const storage = storageMock();
    const tx = {
      evidenceVersion: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({ id: "version-2", number: 2, fileName: "foto.jpg", checksum: "c".repeat(64), size: 2048 }),
      },
      evidence: { update: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      evidence: {
        findUnique: vi.fn().mockResolvedValue({
          id: "evidence-1",
          code: "EVD-00001",
          title: "Foto",
          type: EvidenceType.PHOTO,
          currentVersion: 1,
        }),
      },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new EvidenceVersionsService(
      prisma as unknown as PrismaService,
      storage,
      timelineMock(),
    );

    const { version } = await service.addVersion(
      "evidence-1",
      file(),
      { reason: "Imagem recortada para destacar a etiqueta" },
      { id: "user-1", name: "Técnica" },
    );

    expect(version.number).toBe(2);
    // A versão anterior é desmarcada, jamais apagada nem atualizada no conteúdo.
    expect(tx.evidenceVersion.updateMany).toHaveBeenCalledWith({
      where: { evidenceId: "evidence-1", isCurrent: true },
      data: { isCurrent: false },
    });
    expect(tx.evidenceVersion.create).toHaveBeenCalled();
    const updateData = tx.evidence.update.mock.calls[0][0].data;
    expect(updateData.currentVersion).toBe(2);
    expect(updateData.versionCount).toEqual({ increment: 1 });
  });

  it("rejeita versionar evidência inexistente", async () => {
    const prisma = { evidence: { findUnique: vi.fn().mockResolvedValue(null) } };
    const service = new EvidenceVersionsService(
      prisma as unknown as PrismaService,
      storageMock(),
      timelineMock(),
    );
    await expect(
      service.addVersion("inexistente", file(), { reason: "ajuste" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("download e integridade", () => {
  it("baixa a versão corrente quando nenhum id é informado", async () => {
    const storage = storageMock();
    const timeline = timelineMock();
    const prisma = {
      evidenceVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: "version-1",
          evidenceId: "evidence-1",
          number: 1,
          storageKey: "2026/10/abc.jpg",
          fileName: "foto.jpg",
          mimeType: "image/jpeg",
          checksum: "b".repeat(64),
        }),
      },
    };
    const service = new EvidenceVersionsService(
      prisma as unknown as PrismaService,
      storage,
      timeline,
    );

    const result = await service.download("evidence-1", undefined, { id: "user-1" });
    expect(result.buffer.toString()).toBe("conteudo");
    expect(result.version.number).toBe(1);
    // O acesso é auditável: quem baixou entra na timeline.
    expect(timeline.record).toHaveBeenCalledWith(
      "evidence-1",
      expect.objectContaining({ type: "DOWNLOADED" }),
    );
  });

  it("recusa versão que não pertence à evidência", async () => {
    const prisma = {
      evidenceVersion: {
        findUnique: vi.fn().mockResolvedValue({ id: "version-9", evidenceId: "outra" }),
      },
    };
    const service = new EvidenceVersionsService(
      prisma as unknown as PrismaService,
      storageMock(),
      timelineMock(),
    );
    await expect(service.download("evidence-1", "version-9")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("aponta versões cujo objeto sumiu do armazenamento", async () => {
    const storage = storageMock();
    (storage.exists as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const prisma = {
      evidenceVersion: {
        findMany: vi.fn().mockResolvedValue([
          { number: 2, checksum: "c".repeat(64), storageKey: "k2" },
          { number: 1, checksum: "b".repeat(64), storageKey: "k1" },
        ]),
      },
    };
    const service = new EvidenceVersionsService(
      prisma as unknown as PrismaService,
      storage,
      timelineMock(),
    );

    const report = await service.verifyIntegrity("evidence-1");
    expect(report.total).toBe(2);
    expect(report.available).toBe(1);
    expect(report.missing).toEqual([1]);
  });
});
