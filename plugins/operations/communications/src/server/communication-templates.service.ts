import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { CommunicationPriority, Prisma } from "@prisma/client";
import { PrismaService } from "@eops/database";
import {
  CreateCommunicationCategoryDto,
  CreateCommunicationTagDto,
  CreateCommunicationTemplateDto,
  UpdateCommunicationCategoryDto,
  UpdateCommunicationTemplateDto,
} from "./dto/communication-template.dto";
import { normalizeTagLabels, slugifyTag } from "./helpers/tag-slug";
import type { CommunicationActor } from "./types";

const templateInclude = { category: true } satisfies Prisma.CommunicationTemplateInclude;

/** Nomes de categoria/etiqueta que não podem se repetir. */
function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

@Injectable()
export class CommunicationTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- categorias

  listCategories(includeInactive = false) {
    return this.prisma.communicationCategory.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { name: "asc" },
    });
  }

  async createCategory(dto: CreateCommunicationCategoryDto) {
    try {
      return await this.prisma.communicationCategory.create({
        data: { ...dto, key: dto.key.trim().toUpperCase() },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("Já existe uma categoria com essa chave.");
      }
      throw error;
    }
  }

  async updateCategory(id: string, dto: UpdateCommunicationCategoryDto) {
    await this.requireCategory(id);
    return this.prisma.communicationCategory.update({ where: { id }, data: dto });
  }

  private async requireCategory(id: string) {
    const category = await this.prisma.communicationCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException("Categoria não encontrada.");
    return category;
  }

  // ---------------------------------------------------------------- etiquetas

  async listTags() {
    const tags = await this.prisma.communicationTag.findMany({
      orderBy: { label: "asc" },
      include: { _count: { select: { links: true } } },
    });
    return tags.map((tag) => ({
      id: tag.id,
      label: tag.label,
      slug: tag.slug,
      usageCount: tag._count.links,
    }));
  }

  async createTag(dto: CreateCommunicationTagDto) {
    const label = dto.label.trim().replace(/\s+/g, " ");
    const slug = slugifyTag(label);
    if (!slug) throw new ConflictException("Etiqueta inválida.");
    const existing = await this.prisma.communicationTag.findFirst({
      where: { OR: [{ slug }, { label: { equals: label, mode: "insensitive" } }] },
    });
    if (existing) return existing;
    return this.prisma.communicationTag.create({ data: { label, slug } });
  }

  private async ensureTagIds(labels: string[]) {
    const ids: string[] = [];
    for (const label of normalizeTagLabels(labels)) {
      const tag = await this.createTag({ label });
      ids.push(tag.id);
    }
    return ids;
  }

  // ---------------------------------------------------------------- templates

  listTemplates(includeInactive = false) {
    return this.prisma.communicationTemplate.findMany({
      where: includeInactive ? {} : { active: true },
      include: templateInclude,
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
  }

  async findTemplate(id: string) {
    const template = await this.prisma.communicationTemplate.findUnique({
      where: { id },
      include: templateInclude,
    });
    if (!template) throw new NotFoundException("Template não encontrado.");
    return template;
  }

  async createTemplate(dto: CreateCommunicationTemplateDto, actor?: CommunicationActor) {
    if (dto.categoryId) await this.requireCategory(dto.categoryId);
    try {
      return await this.prisma.communicationTemplate.create({
        data: {
          name: dto.name.trim(),
          description: dto.description,
          defaultTitle: dto.defaultTitle,
          body: dto.body,
          priority: dto.priority ?? CommunicationPriority.NORMAL,
          categoryId: dto.categoryId,
          createdById: actor?.id,
        },
        include: templateInclude,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("Já existe um template com esse nome.");
      }
      throw error;
    }
  }

  async updateTemplate(id: string, dto: UpdateCommunicationTemplateDto) {
    await this.findTemplate(id);
    if (dto.categoryId) await this.requireCategory(dto.categoryId);
    try {
      return await this.prisma.communicationTemplate.update({
        where: { id },
        data: { ...dto, name: dto.name?.trim() },
        include: templateInclude,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("Já existe um template com esse nome.");
      }
      throw error;
    }
  }

  async removeTemplate(id: string) {
    await this.findTemplate(id);
    await this.prisma.communicationTemplate.delete({ where: { id } });
  }

  // ------------------------------------------------------------- uso interno

  /** Cria/recupera etiquetas e devolve as conexões N:N para um comunicado. */
  async tagLinksFor(labels: string[]) {
    const tagIds = await this.ensureTagIds(labels);
    return tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } }));
  }

  /**
   * Aplica um template sobre o formulário de novo comunicado.
   * Retorna o conteúdo pronto para preencher a interface; nada é persistido.
   */
  async applyTemplate(id: string) {
    const template = await this.findTemplate(id);
    return {
      templateId: template.id,
      title: template.defaultTitle,
      content: template.body,
      priority: template.priority,
      categoryId: template.categoryId,
    };
  }
}
