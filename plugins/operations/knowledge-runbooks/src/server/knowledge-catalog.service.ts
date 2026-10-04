import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@eops/database";
import {
  CreateKnowledgeCategoryDto,
  UpdateKnowledgeCategoryDto,
} from "./dto/knowledge.dto";
import { normalizeTagLabels, slugifyTag } from "./helpers/tag-slug";

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Categorias e etiquetas da base de conhecimento. */
@Injectable()
export class KnowledgeCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- categorias

  listCategories(includeInactive = false) {
    return this.prisma.knowledgeCategory.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { articles: true } } },
    });
  }

  async createCategory(dto: CreateKnowledgeCategoryDto) {
    try {
      return await this.prisma.knowledgeCategory.create({
        data: { ...dto, key: dto.key.trim().toUpperCase() },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("Já existe uma categoria com essa chave.");
      }
      throw error;
    }
  }

  async updateCategory(id: string, dto: UpdateKnowledgeCategoryDto) {
    await this.requireCategory(id);
    return this.prisma.knowledgeCategory.update({ where: { id }, data: dto });
  }

  async requireCategory(id: string) {
    const category = await this.prisma.knowledgeCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException("Categoria não encontrada.");
    return category;
  }

  // ---------------------------------------------------------------- etiquetas

  async listTags() {
    const tags = await this.prisma.knowledgeTag.findMany({
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

  async createTag(label: string) {
    const normalized = label.trim().replace(/\s+/g, " ");
    const slug = slugifyTag(normalized);
    if (!slug) throw new ConflictException("Etiqueta inválida.");
    const existing = await this.prisma.knowledgeTag.findFirst({
      where: { OR: [{ slug }, { label: { equals: normalized, mode: "insensitive" } }] },
    });
    if (existing) return existing;
    return this.prisma.knowledgeTag.create({ data: { label: normalized, slug } });
  }

  /** Conexões N:N prontas para o `create`/`update` aninhado do Prisma. */
  async linkDataFor(labels: string[]) {
    const tagIds: string[] = [];
    for (const label of normalizeTagLabels(labels)) {
      const tag = await this.createTag(label);
      tagIds.push(tag.id);
    }
    return tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } }));
  }
}
