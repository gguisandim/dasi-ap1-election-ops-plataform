import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../../../../packages/database/src";
import { CommunicationTemplatesService } from "./communication-templates.service";

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("duplicado", {
    code: "P2002",
    clientVersion: "6.19.3",
  });
}

describe("categorias", () => {
  it("normaliza a chave para maiúsculas", async () => {
    const create = vi.fn().mockResolvedValue({ id: "category-1" });
    const prisma = { communicationCategory: { create } };
    await new CommunicationTemplatesService(
      prisma as unknown as PrismaService,
    ).createCategory({ key: " energia ", name: "Energia" });

    expect(create.mock.calls[0][0].data.key).toBe("ENERGIA");
  });

  it("converte chave duplicada em conflito legível", async () => {
    const prisma = {
      communicationCategory: { create: vi.fn().mockRejectedValue(uniqueViolation()) },
    };
    await expect(
      new CommunicationTemplatesService(prisma as unknown as PrismaService).createCategory({
        key: "ENERGIA",
        name: "Energia",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("lista apenas categorias ativas por padrão", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { communicationCategory: { findMany } };
    await new CommunicationTemplatesService(prisma as unknown as PrismaService).listCategories();
    expect(findMany.mock.calls[0][0].where).toEqual({ active: true });
  });

  it("recusa atualizar categoria inexistente", async () => {
    const prisma = {
      communicationCategory: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    await expect(
      new CommunicationTemplatesService(prisma as unknown as PrismaService).updateCategory(
        "categoria-fantasma",
        { name: "Nova" },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("etiquetas", () => {
  it("reaproveita etiqueta existente em vez de duplicar", async () => {
    const create = vi.fn();
    const prisma = {
      communicationTag: {
        findFirst: vi.fn().mockResolvedValue({ id: "tag-1", label: "Energia", slug: "energia" }),
        create,
      },
    };
    const tag = await new CommunicationTemplatesService(
      prisma as unknown as PrismaService,
    ).createTag({ label: "energia" });

    expect(tag.id).toBe("tag-1");
    expect(create).not.toHaveBeenCalled();
  });

  it("persiste etiqueta nova com slug derivado do rótulo", async () => {
    const create = vi.fn().mockImplementation(({ data }) => ({ id: "tag-2", ...data }));
    const prisma = {
      communicationTag: { findFirst: vi.fn().mockResolvedValue(null), create },
    };
    const tag = await new CommunicationTemplatesService(
      prisma as unknown as PrismaService,
    ).createTag({ label: "Falha de Energia" });

    expect(tag.slug).toBe("falha-de-energia");
  });

  it("recusa etiqueta sem conteúdo utilizável", async () => {
    const prisma = { communicationTag: { findFirst: vi.fn().mockResolvedValue(null) } };
    await expect(
      new CommunicationTemplatesService(prisma as unknown as PrismaService).createTag({
        label: "!!!",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("inclui a contagem de uso ao listar etiquetas", async () => {
    const prisma = {
      communicationTag: {
        findMany: vi.fn().mockResolvedValue([
          { id: "tag-1", label: "Energia", slug: "energia", _count: { links: 4 } },
        ]),
      },
    };
    const tags = await new CommunicationTemplatesService(
      prisma as unknown as PrismaService,
    ).listTags();
    expect(tags).toEqual([
      { id: "tag-1", label: "Energia", slug: "energia", usageCount: 4 },
    ]);
  });
});

describe("templates", () => {
  const template = {
    id: "template-1",
    name: "Abertura de turno",
    defaultTitle: "Abertura de turno",
    body: "Confirme o checklist inicial.",
    priority: "NORMAL",
    categoryId: null,
  };

  it("cria template registrando o autor", async () => {
    const create = vi.fn().mockResolvedValue(template);
    const prisma = { communicationTemplate: { create } };
    await new CommunicationTemplatesService(
      prisma as unknown as PrismaService,
    ).createTemplate(
      { name: "Abertura de turno", defaultTitle: "Título", body: "Corpo" },
      { id: "user-1", name: "Coordenação" },
    );

    expect(create.mock.calls[0][0].data.createdById).toBe("user-1");
    expect(create.mock.calls[0][0].data.priority).toBe("NORMAL");
  });

  it("valida a categoria informada antes de criar", async () => {
    const prisma = {
      communicationCategory: { findUnique: vi.fn().mockResolvedValue(null) },
      communicationTemplate: { create: vi.fn() },
    };
    await expect(
      new CommunicationTemplatesService(prisma as unknown as PrismaService).createTemplate({
        name: "Template",
        defaultTitle: "Título",
        body: "Corpo",
        categoryId: "categoria-fantasma",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("converte nome duplicado em conflito legível", async () => {
    const prisma = {
      communicationTemplate: { create: vi.fn().mockRejectedValue(uniqueViolation()) },
    };
    await expect(
      new CommunicationTemplatesService(prisma as unknown as PrismaService).createTemplate({
        name: "Abertura de turno",
        defaultTitle: "Título",
        body: "Corpo",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("aplica o template devolvendo conteúdo pronto para o formulário", async () => {
    const prisma = {
      communicationTemplate: { findUnique: vi.fn().mockResolvedValue(template) },
    };
    const applied = await new CommunicationTemplatesService(
      prisma as unknown as PrismaService,
    ).applyTemplate("template-1");

    expect(applied).toEqual({
      templateId: "template-1",
      title: "Abertura de turno",
      content: "Confirme o checklist inicial.",
      priority: "NORMAL",
      categoryId: null,
    });
  });

  it("não lista templates inativos por padrão", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { communicationTemplate: { findMany } };
    await new CommunicationTemplatesService(prisma as unknown as PrismaService).listTemplates();
    expect(findMany.mock.calls[0][0].where).toEqual({ active: true });
  });
});
