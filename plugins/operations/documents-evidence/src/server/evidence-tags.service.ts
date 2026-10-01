import { ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../../packages/database/src";
import { normalizeTagLabels, slugifyTag } from "./helpers/tag-slug";

/**
 * Etiquetas de evidência.
 *
 * Reaproveita a normalização de slug do domínio de comunicações por ser uma
 * regra puramente textual; a implementação é local para não criar dependência
 * entre plugins.
 */
@Injectable()
export class EvidenceTagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const tags = await this.prisma.evidenceTag.findMany({
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

  async create(label: string) {
    const normalized = label.trim().replace(/\s+/g, " ");
    const slug = slugifyTag(normalized);
    if (!slug) throw new ConflictException("Etiqueta inválida.");
    const existing = await this.prisma.evidenceTag.findFirst({
      where: { OR: [{ slug }, { label: { equals: normalized, mode: "insensitive" } }] },
    });
    if (existing) return existing;
    return this.prisma.evidenceTag.create({ data: { label: normalized, slug } });
  }

  /** Conexões N:N prontas para o `create`/`update` aninhado do Prisma. */
  async linkDataFor(labels: string[]) {
    const tagIds: string[] = [];
    for (const label of normalizeTagLabels(labels)) {
      const tag = await this.create(label);
      tagIds.push(tag.id);
    }
    return tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } }));
  }
}
