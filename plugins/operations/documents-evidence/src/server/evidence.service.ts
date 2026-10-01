import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  EvidenceEventType,
  EvidenceLinkType,
  EvidenceStatus,
  EvidenceType,
  Prisma,
} from "@prisma/client";
import { EventBus } from "../../../../../packages/event-bus/src";
import { PrismaService } from "../../../../../packages/database/src";
import type { EvidenceDashboard, EvidenceSummary } from "@eops/shared/evidence";
import {
  CreateEvidenceDto,
  EvidenceQueryDto,
  ReplaceEvidenceLinksDto,
  UpdateEvidenceDto,
} from "./dto/evidence.dto";
import { formatEvidenceCode, nextEvidenceSequence } from "./helpers/evidence-code";
import { EVIDENCE_TYPE_RULES, guessTypeFromMime } from "./helpers/evidence-type";
import { EvidenceLinksService } from "./evidence-links.service";
import { EvidenceTagsService } from "./evidence-tags.service";
import { EvidenceTimelineService } from "./evidence-timeline.service";
import { EvidenceVersionsService } from "./evidence-versions.service";
import type { EvidenceActor, UploadedFile } from "./types";

const listInclude = {
  election: { select: { id: true, name: true, year: true } },
  tags: { include: { tag: true } },
  links: { orderBy: { createdAt: "asc" as const } },
  versions: { where: { isCurrent: true }, take: 1 },
} satisfies Prisma.EvidenceInclude;

const detailInclude = {
  ...listInclude,
  versions: { orderBy: { number: "desc" as const } },
  timeline: { orderBy: { createdAt: "desc" as const }, take: 100 },
} satisfies Prisma.EvidenceInclude;

/** Teto absoluto aceito pelo interceptor de upload. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

type EvidenceRecord = Prisma.EvidenceGetPayload<{ include: typeof listInclude }>;
type EvidenceDetailRecord = Prisma.EvidenceGetPayload<{ include: typeof detailInclude }>;

/**
 * Núcleo do repositório de evidências: registro, busca, metadados, arquivamento
 * e integridade. Versionamento e vínculos ficam em serviços próprios.
 */
@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly versions: EvidenceVersionsService,
    private readonly links: EvidenceLinksService,
    private readonly tags: EvidenceTagsService,
    private readonly timeline: EvidenceTimelineService,
    private readonly eventBus?: EventBus,
  ) {}

  // ------------------------------------------------------------------ leitura

  private where(query: EvidenceQueryDto): Prisma.EvidenceWhereInput {
    return {
      type: query.type,
      status: query.status,
      electionId: query.electionId,
      authorId: query.authorId,
      tags: query.tag ? { some: { tag: { slug: query.tag } } } : undefined,
      links: query.linkType
        ? { some: { type: query.linkType, targetId: query.linkTargetId } }
        : query.withoutLinks
          ? { none: {} }
          : undefined,
      capturedAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
      OR: query.search
        ? [
            { code: { contains: query.search, mode: "insensitive" } },
            { title: { contains: query.search, mode: "insensitive" } },
            { description: { contains: query.search, mode: "insensitive" } },
            { origin: { contains: query.search, mode: "insensitive" } },
            { authorName: { contains: query.search, mode: "insensitive" } },
          ]
        : undefined,
    };
  }

  async findAll(query: EvidenceQueryDto) {
    const where = this.where(query);
    const [items, total] = await Promise.all([
      this.prisma.evidence.findMany({
        where,
        include: listInclude,
        orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.evidence.count({ where }),
    ]);
    return {
      items: items.map((item) => this.present(item)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  /** Somente evidências fotográficas ativas — alimenta a galeria. */
  async gallery(query: EvidenceQueryDto) {
    const where: Prisma.EvidenceWhereInput = {
      ...this.where({ ...query, status: query.status ?? EvidenceStatus.ACTIVE }),
      type: query.type ?? { in: [EvidenceType.PHOTO, EvidenceType.SCREENSHOT] },
    };
    const items = await this.prisma.evidence.findMany({
      where,
      include: listInclude,
      orderBy: { capturedAt: "desc" },
      take: Math.min(query.pageSize * 4, 120),
    });
    return items.map((item) => this.present(item));
  }

  async dashboard(electionId?: string): Promise<EvidenceDashboard> {
    const scoped: Prisma.EvidenceWhereInput = electionId ? { electionId } : {};
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

    const [total, archived, grouped, withLinks, sizeAggregate, addedLastSevenDays, tagGroups] =
      await Promise.all([
        this.prisma.evidence.count({ where: scoped }),
        this.prisma.evidence.count({ where: { ...scoped, status: EvidenceStatus.ARCHIVED } }),
        this.prisma.evidence.groupBy({
          by: ["type"],
          where: scoped,
          _count: { _all: true },
        }),
        this.prisma.evidence.count({ where: { ...scoped, links: { some: {} } } }),
        this.prisma.evidenceVersion.aggregate({
          where: { isCurrent: true, evidence: scoped },
          _sum: { size: true },
        }),
        this.prisma.evidence.count({ where: { ...scoped, createdAt: { gte: sevenDaysAgo } } }),
        this.prisma.evidenceTagLink.groupBy({
          by: ["tagId"],
          where: { evidence: scoped },
          _count: { _all: true },
          orderBy: { _count: { tagId: "desc" } },
          take: 5,
        }),
      ]);

    const tagIds = tagGroups.map((group) => group.tagId);
    const tags = tagIds.length
      ? await this.prisma.evidenceTag.findMany({
          where: { id: { in: tagIds } },
          select: { id: true, label: true },
        })
      : [];
    const labelById = new Map(tags.map((tag) => [tag.id, tag.label]));

    return {
      total,
      active: total - archived,
      archived,
      byType: grouped.map((group) => ({ type: group.type, total: group._count._all })),
      withLinks,
      withoutLinks: total - withLinks,
      totalBytes: sizeAggregate._sum.size ?? 0,
      addedLastSevenDays,
      topTags: tagGroups.map((group) => ({
        tagId: group.tagId,
        label: labelById.get(group.tagId) ?? "Etiqueta removida",
        total: group._count._all,
      })),
    };
  }

  async findOne(id: string) {
    const evidence = await this.prisma.evidence.findUnique({
      where: { id },
      include: detailInclude,
    });
    if (!evidence) throw new NotFoundException("Evidência não encontrada.");
    return {
      ...this.present(evidence),
      versions: evidence.versions,
      timeline: evidence.timeline,
    };
  }

  async requireEvidence(id: string) {
    const evidence = await this.prisma.evidence.findUnique({
      where: { id },
      include: listInclude,
    });
    if (!evidence) throw new NotFoundException("Evidência não encontrada.");
    return evidence;
  }

  private present(evidence: EvidenceRecord | EvidenceDetailRecord): EvidenceSummary {
    const current = evidence.versions.find((version) => version.isCurrent) ?? evidence.versions[0];
    return {
      ...evidence,
      versions: undefined,
      tags: evidence.tags.map((link) => ({
        id: link.tag.id,
        label: link.tag.label,
        slug: link.tag.slug,
      })),
      version: current ?? null,
    } as unknown as EvidenceSummary;
  }

  async timelineFor(id: string) {
    await this.requireEvidence(id);
    return this.timeline.list(id);
  }

  integrityFor(id: string) {
    return this.requireEvidence(id).then(() => this.versions.verifyIntegrity(id));
  }

  // ------------------------------------------------------------------ escrita

  private async resolveActor(input?: { id?: string; email?: string }): Promise<EvidenceActor> {
    if (!input?.id) return { name: input?.email ?? "Sistema" };
    const user = await this.prisma.user.findUnique({
      where: { id: input.id },
      select: { name: true, email: true },
    });
    return { id: input.id, name: user?.name ?? user?.email ?? input.email };
  }

  private async validateElection(electionId?: string) {
    if (!electionId) return;
    const election = await this.prisma.election.findUnique({
      where: { id: electionId },
      select: { id: true },
    });
    if (!election) throw new NotFoundException("Pleito não encontrado.");
  }

  /** Converte `"TYPE:targetId"` em vínculo; o formato vem do formulário multipart. */
  private parseLinkTokens(tokens: string[] | undefined) {
    if (!tokens?.length) return [];
    return tokens.map((token) => {
      const [type, ...rest] = token.split(":");
      const targetId = rest.join(":").trim();
      if (!type || !targetId) {
        throw new BadRequestException(
          `Vínculo inválido: "${token}". Use o formato TIPO:idDoRegistro.`,
        );
      }
      if (!Object.values(EvidenceLinkType).includes(type as EvidenceLinkType)) {
        throw new BadRequestException(`Tipo de vínculo desconhecido: ${type}.`);
      }
      return { type: type as EvidenceLinkType, targetId };
    });
  }

  async create(
    dto: CreateEvidenceDto,
    file: UploadedFile | undefined,
    actorInput?: { id?: string; email?: string },
  ) {
    const actor = await this.resolveActor(actorInput);
    await this.validateElection(dto.electionId);

    const type = dto.type ?? (file ? guessTypeFromMime(file.mimetype) : EvidenceType.OTHER);
    const resolvedLinks = this.parseLinkTokens(dto.links);
    const validatedLinks = resolvedLinks.length ? await this.links.resolveAll(resolvedLinks) : [];
    const tagLinks = await this.tags.linkDataFor(dto.tags ?? []);

    const last = await this.prisma.evidence.findFirst({
      orderBy: { code: "desc" },
      select: { code: true },
    });
    const code = formatEvidenceCode(nextEvidenceSequence(last?.code));

    let evidenceId: string;
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const evidence = await tx.evidence.create({
          data: {
            code,
            title: dto.title,
            description: dto.description,
            type,
            electionId: dto.electionId,
            authorId: actor.id,
            authorName: actor.name ?? "Sistema",
            origin: dto.origin,
            observations: dto.observations,
            capturedAt: dto.capturedAt ? new Date(dto.capturedAt) : undefined,
            tags: { create: tagLinks },
            links: {
              create: validatedLinks.map((link) => ({
                type: link.type,
                targetId: link.targetId,
                targetLabel: link.targetLabel,
                notes: link.notes,
              })),
            },
          },
        });
        await tx.evidenceEvent.create({
          data: this.timeline.dataFor(evidence.id, {
            type: EvidenceEventType.CREATED,
            message: "Evidência registrada.",
            actorId: actor.id,
            actorName: actor.name,
            metadata: { code: evidence.code, type: evidence.type },
          }),
        });
        for (const link of validatedLinks) {
          await tx.evidenceEvent.create({
            data: this.timeline.dataFor(evidence.id, {
              type: EvidenceEventType.LINK_ADDED,
              message: `Vínculo inicial com ${link.targetLabel}.`,
              actorId: actor.id,
              actorName: actor.name,
              metadata: { type: link.type, targetId: link.targetId },
            }),
          });
        }
        return evidence;
      });
      evidenceId = created.id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException(
          "Não foi possível gerar um código único para a evidência. Tente novamente.",
        );
      }
      throw error;
    }

    const version = await this.versions.createInitialVersion(evidenceId, file, type, actor);
    await this.timeline.record(evidenceId, {
      type: EvidenceEventType.UPLOADED,
      message: `Arquivo enviado: ${version.fileName} (${version.size} bytes, SHA-256 ${version.checksum.slice(0, 12)}…).`,
      actorId: actor.id,
      actorName: actor.name,
      metadata: { version: version.number, checksum: version.checksum, size: version.size },
    });

    await this.eventBus?.emit("evidence.created", {
      entityId: evidenceId,
      actorId: actor.id,
      code,
      title: dto.title,
      type,
      size: version.size,
      checksum: version.checksum,
    });

    return this.findOne(evidenceId);
  }

  async update(
    id: string,
    dto: UpdateEvidenceDto,
    actorInput?: { id?: string; email?: string },
  ) {
    const current = await this.requireEvidence(id);
    await this.validateElection(dto.electionId);
    const actor = await this.resolveActor(actorInput);

    const tagLinks = dto.tags ? await this.tags.linkDataFor(dto.tags) : undefined;
    const typeChanged = dto.type !== undefined && dto.type !== current.type;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (tagLinks) {
        await tx.evidenceTagLink.deleteMany({ where: { evidenceId: id } });
      }
      const result = await tx.evidence.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          type: dto.type,
          electionId: dto.electionId,
          origin: dto.origin,
          observations: dto.observations,
          capturedAt: dto.capturedAt ? new Date(dto.capturedAt) : undefined,
          tags: tagLinks ? { create: tagLinks } : undefined,
        },
        include: listInclude,
      });
      await tx.evidenceEvent.create({
        data: this.timeline.dataFor(id, {
          type: EvidenceEventType.METADATA_UPDATED,
          message: typeChanged
            ? `Metadados atualizados. Tipo alterado de ${current.type} para ${dto.type}.`
            : "Metadados atualizados.",
          actorId: actor.id,
          actorName: actor.name,
          metadata: typeChanged ? { from: current.type, to: dto.type } : { fields: Object.keys(dto) },
        }),
      });
      return result;
    });

    return this.findOne(updated.id);
  }

  replaceLinks(id: string, dto: ReplaceEvidenceLinksDto, actorInput?: { id?: string; email?: string }) {
    return this.requireEvidence(id)
      .then(() => this.resolveActor(actorInput))
      .then((actor) => this.links.replace(id, dto.links, actor))
      .then(() => this.findOne(id));
  }

  async addVersion(
    id: string,
    file: UploadedFile | undefined,
    dto: { reason: string; description?: string },
    actorInput?: { id?: string; email?: string },
  ) {
    const actor = await this.resolveActor(actorInput);
    const { version, evidence } = await this.versions.addVersion(id, file, dto, actor);
    await this.eventBus?.emit("evidence.versioned", {
      entityId: id,
      actorId: actor.id,
      code: evidence.code,
      title: evidence.title,
      version: version.number,
      size: version.size,
      checksum: version.checksum,
    });
    return this.findOne(id);
  }

  /**
   * Arquiva a evidência: sai das listagens padrão, não recebe novas versões,
   * mas continua consultável e restaurável. É o caminho de descarte do domínio.
   */
  async archive(id: string, actorInput?: { id?: string; email?: string }) {
    const current = await this.requireEvidence(id);
    if (current.status === EvidenceStatus.ARCHIVED) return this.findOne(id);
    const actor = await this.resolveActor(actorInput);

    await this.prisma.$transaction(async (tx) => {
      await tx.evidence.update({
        where: { id },
        data: { status: EvidenceStatus.ARCHIVED, archivedAt: new Date() },
      });
      await tx.evidenceEvent.create({
        data: this.timeline.dataFor(id, {
          type: EvidenceEventType.ARCHIVED,
          message: "Evidência arquivada.",
          actorId: actor.id,
          actorName: actor.name,
        }),
      });
    });

    await this.eventBus?.emit("evidence.archived", {
      entityId: id,
      actorId: actor.id,
      code: current.code,
      title: current.title,
    });
    return this.findOne(id);
  }

  async restore(id: string, actorInput?: { id?: string; email?: string }) {
    const current = await this.requireEvidence(id);
    if (current.status === EvidenceStatus.ACTIVE) return this.findOne(id);
    const actor = await this.resolveActor(actorInput);

    await this.prisma.$transaction(async (tx) => {
      await tx.evidence.update({
        where: { id },
        data: { status: EvidenceStatus.ACTIVE, archivedAt: null },
      });
      await tx.evidenceEvent.create({
        data: this.timeline.dataFor(id, {
          type: EvidenceEventType.RESTORED,
          message: "Evidência restaurada.",
          actorId: actor.id,
          actorName: actor.name,
        }),
      });
    });
    return this.findOne(id);
  }

  /**
   * Exclusão física restrita: só enquanto a evidência nunca foi vinculada nem
   * arquivada. Evidência auditável é preservada por arquivamento.
   */
  async remove(id: string) {
    const current = await this.requireEvidence(id);
    if (current.status === EvidenceStatus.ARCHIVED) {
      throw new BadRequestException(
        "Evidências arquivadas são preservadas para auditoria. Restaure antes de excluir.",
      );
    }
    if (current.links.length > 0) {
      throw new BadRequestException(
        "Evidências vinculadas a registros operacionais não podem ser excluídas. Archive-a.",
      );
    }
    await this.prisma.evidence.delete({ where: { id } });
  }

  /** Dados de apoio do formulário: pleitos, etiquetas e limites de upload. */
  async referenceData() {
    const [elections, tags] = await Promise.all([
      this.prisma.election.findMany({
        select: { id: true, name: true, year: true, status: true },
        orderBy: { year: "desc" },
      }),
      this.tags.list(),
    ]);
    return {
      elections,
      tags,
      storageDriver: this.storageDriver,
      maxUploadBytes: MAX_UPLOAD_BYTES,
      typeRules: EVIDENCE_TYPE_RULES,
    };
  }

  /** Driver ativo, informado na interface para deixar claro onde o arquivo vive. */
  get storageDriver(): string {
    return this.versions.driver;
  }
}
