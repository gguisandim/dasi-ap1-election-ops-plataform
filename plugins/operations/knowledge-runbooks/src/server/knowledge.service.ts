import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  KnowledgeArticleKind,
  KnowledgeArticleStatus,
  Prisma,
} from "@prisma/client";
import { EventBus } from "@eops/event-bus";
import { PrismaService } from "@eops/database";
import {
  KnowledgeArticleSummary,
  RUNBOOK_STALE_DAYS,
} from "@eops/shared/knowledge";
import {
  CreateKnowledgeArticleDto,
  KnowledgeQueryDto,
  ReplaceRunbookStepsDto,
  RunbookStepDto,
  UpdateKnowledgeArticleDto,
} from "./dto/knowledge.dto";
import { formatKnowledgeCode, nextKnowledgeSequence } from "./helpers/knowledge-code";
import {
  canTransition,
  isPublished,
  isStale,
  requiresChangeNote,
  transitionError,
} from "./helpers/knowledge-status";
import { normalizeKeywords } from "./helpers/tag-slug";
import { successRate } from "./helpers/runbook-matching";
import { KnowledgeCatalogService } from "./knowledge-catalog.service";
import type { KnowledgeActor } from "./types";

const listInclude = {
  category: true,
  tags: { include: { tag: true } },
  _count: { select: { steps: true } },
} satisfies Prisma.KnowledgeArticleInclude;

const detailInclude = {
  category: true,
  tags: { include: { tag: true } },
  steps: { orderBy: { order: "asc" as const } },
  _count: { select: { steps: true } },
} satisfies Prisma.KnowledgeArticleInclude;

type ArticleRecord = Prisma.KnowledgeArticleGetPayload<{ include: typeof listInclude }>;
type ArticleDetailRecord = Prisma.KnowledgeArticleGetPayload<{
  include: typeof detailInclude;
}>;

/**
 * Artigos e runbooks: CRUD, busca, publicação, versionamento e passos.
 *
 * Artigos e runbooks compartilham uma tabela com discriminador `kind` — isso
 * mantém busca, categorização, versionamento e métricas em um só lugar, sem
 * duplicar regras. Os campos exclusivos de runbook ficam nulos em artigos.
 */
@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: KnowledgeCatalogService,
    private readonly eventBus?: EventBus,
  ) {}

  // ------------------------------------------------------------------ leitura

  private where(query: KnowledgeQueryDto): Prisma.KnowledgeArticleWhereInput {
    const staleLimit = new Date(Date.now() - RUNBOOK_STALE_DAYS * 86_400_000);
    const filters: Prisma.KnowledgeArticleWhereInput[] = [];

    if (query.staleOnly) {
      filters.push({
        status: KnowledgeArticleStatus.PUBLISHED,
        kind: KnowledgeArticleKind.RUNBOOK,
        updatedAt: { lt: staleLimit },
      });
    }
    if (query.unusedOnly) {
      filters.push({ status: KnowledgeArticleStatus.PUBLISHED, usageCount: 0 });
    }

    return {
      kind: query.kind,
      status: query.status,
      categoryId: query.categoryId,
      incidentCategoryKey: query.incidentCategoryKey,
      incidentSeverity: query.incidentSeverity,
      tags: query.tag ? { some: { tag: { slug: query.tag } } } : undefined,
      AND: filters.length ? filters : undefined,
      // A busca cobre título, resumo, problema, sintomas e conteúdo, conforme a
      // regra publicada na especificação.
      OR: query.search
        ? [
            { code: { contains: query.search, mode: "insensitive" } },
            { title: { contains: query.search, mode: "insensitive" } },
            { summary: { contains: query.search, mode: "insensitive" } },
            { problem: { contains: query.search, mode: "insensitive" } },
            { symptoms: { contains: query.search, mode: "insensitive" } },
            { content: { contains: query.search, mode: "insensitive" } },
          ]
        : undefined,
    };
  }

  async findAll(query: KnowledgeQueryDto) {
    const where = this.where(query);
    const [items, total] = await Promise.all([
      this.prisma.knowledgeArticle.findMany({
        where,
        include: listInclude,
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.knowledgeArticle.count({ where }),
    ]);
    return {
      items: items.map((item) => this.present(item)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async dashboard(): Promise<import("@eops/shared/knowledge").KnowledgeDashboard> {
    const staleLimit = new Date(Date.now() - RUNBOOK_STALE_DAYS * 86_400_000);
    const [
      total,
      articles,
      runbooks,
      published,
      drafts,
      review,
      archived,
      staleRunbooks,
      unusedPublished,
      usageAggregate,
      resolvedAggregate,
      categories,
      coverageGroups,
    ] = await Promise.all([
      this.prisma.knowledgeArticle.count(),
      this.prisma.knowledgeArticle.count({ where: { kind: KnowledgeArticleKind.ARTICLE } }),
      this.prisma.knowledgeArticle.count({ where: { kind: KnowledgeArticleKind.RUNBOOK } }),
      this.prisma.knowledgeArticle.count({ where: { status: KnowledgeArticleStatus.PUBLISHED } }),
      this.prisma.knowledgeArticle.count({ where: { status: KnowledgeArticleStatus.DRAFT } }),
      this.prisma.knowledgeArticle.count({ where: { status: KnowledgeArticleStatus.REVIEW } }),
      this.prisma.knowledgeArticle.count({ where: { status: KnowledgeArticleStatus.ARCHIVED } }),
      this.prisma.knowledgeArticle.count({
        where: {
          kind: KnowledgeArticleKind.RUNBOOK,
          status: KnowledgeArticleStatus.PUBLISHED,
          updatedAt: { lt: staleLimit },
        },
      }),
      this.prisma.knowledgeArticle.count({
        where: { status: KnowledgeArticleStatus.PUBLISHED, usageCount: 0 },
      }),
      this.prisma.runbookUsage.count(),
      this.prisma.runbookUsage.count({ where: { resolved: true } }),
      this.prisma.knowledgeCategory.findMany({ orderBy: { name: "asc" } }),
      this.prisma.knowledgeArticle.groupBy({
        by: ["categoryId"],
        where: { kind: KnowledgeArticleKind.RUNBOOK, status: KnowledgeArticleStatus.PUBLISHED },
        _count: { _all: true },
      }),
    ]);

    const countByCategory = new Map(
      coverageGroups.map((group) => [group.categoryId, group._count._all]),
    );
    // Cobertura: categorias cadastradas primeiro (menos cobertura à frente) e,
    // ao final, runbooks publicados sem categoria.
    const coverage = [
      ...categories.map((category) => ({
        categoryId: category.id,
        name: category.name,
        runbooks: countByCategory.get(category.id) ?? 0,
      })),
      {
        categoryId: null,
        name: "Sem categoria",
        runbooks: countByCategory.get(null) ?? 0,
      },
    ].sort((left, right) => left.runbooks - right.runbooks || left.name.localeCompare(right.name, "pt-BR"));

    return {
      total,
      articles,
      runbooks,
      published,
      drafts,
      review,
      archived,
      staleRunbooks,
      unusedPublished,
      totalUsages: usageAggregate,
      successRate: successRate(resolvedAggregate, usageAggregate),
      coverage,
    };
  }

  async findOne(id: string) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id },
      include: detailInclude,
    });
    if (!article) throw new NotFoundException("Artigo não encontrado.");
    return { ...this.present(article), steps: article.steps };
  }

  async requireArticle(id: string) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id },
      include: listInclude,
    });
    if (!article) throw new NotFoundException("Artigo não encontrado.");
    return article;
  }

  /** Marca a leitura do verbete; usado pelo detalhe para medir interesse real. */
  async registerView(id: string) {
    await this.requireArticle(id);
    return this.prisma.knowledgeArticle.update({
      where: { id },
      data: { views: { increment: 1 } },
      select: { id: true, views: true },
    });
  }

  listVersions(id: string) {
    return this.prisma.knowledgeArticleVersion.findMany({
      where: { articleId: id },
      orderBy: { number: "desc" },
    });
  }

  private present(article: ArticleRecord | ArticleDetailRecord): KnowledgeArticleSummary {
    return {
      ...article,
      tags: article.tags.map((link) => ({
        id: link.tag.id,
        label: link.tag.label,
        slug: link.tag.slug,
      })),
      stepCount: article._count.steps,
      successRate: successRate(article.resolvedCount, article.usageCount),
      stale:
        article.kind === KnowledgeArticleKind.RUNBOOK &&
        article.status === KnowledgeArticleStatus.PUBLISHED &&
        isStale(article.updatedAt, RUNBOOK_STALE_DAYS),
    } as unknown as KnowledgeArticleSummary;
  }

  // ------------------------------------------------------------------ escrita

  private async resolveActor(input?: { id?: string; email?: string }): Promise<KnowledgeActor> {
    if (!input?.id) return { name: input?.email ?? "Sistema" };
    const user = await this.prisma.user.findUnique({
      where: { id: input.id },
      select: { name: true, email: true },
    });
    return { id: input.id, name: user?.name ?? user?.email ?? input.email };
  }

  private async validateRelations(dto: { categoryId?: string }) {
    if (dto.categoryId) await this.catalog.requireCategory(dto.categoryId);
  }

  /** Passos prontos para persistência, com ordem normalizada a partir de 1. */
  private stepData(steps: RunbookStepDto[]) {
    return [...steps]
      .sort((left, right) => left.order - right.order)
      .map((step, index) => ({
        order: index + 1,
        title: step.title,
        instruction: step.instruction,
        expected: step.expected,
        required: step.required ?? true,
        warning: step.warning,
        notes: step.notes,
      }));
  }

  /**
   * Cria a versão inicial de um artigo/runbook.
   *
   * A versão guarda um instantâneo do conteúdo e dos passos: sem isso o
   * histórico apontaria para o texto atual e não para o que foi publicado.
   */
  private async snapshot(
    tx: Prisma.TransactionClient,
    article: {
      id: string;
      title: string;
      summary: string;
      content: string | null;
      currentVersion: number;
    },
    note: string,
    actor: KnowledgeActor,
  ) {
    const steps = await tx.runbookStep.findMany({
      where: { articleId: article.id },
      orderBy: { order: "asc" },
    });
    return tx.knowledgeArticleVersion.create({
      data: {
        articleId: article.id,
        number: article.currentVersion,
        title: article.title,
        summary: article.summary,
        content: article.content,
        steps: steps as unknown as Prisma.InputJsonValue,
        note,
        authorId: actor.id,
        authorName: actor.name ?? "Sistema",
      },
    });
  }

  async create(
    dto: CreateKnowledgeArticleDto,
    actorInput?: { id?: string; email?: string },
  ) {
    const actor = await this.resolveActor(actorInput);
    await this.validateRelations(dto);
    const kind = dto.kind ?? KnowledgeArticleKind.ARTICLE;

    if (kind === KnowledgeArticleKind.RUNBOOK && !dto.problem) {
      throw new BadRequestException("Um runbook precisa descrever o problema que resolve.");
    }

    const last = await this.prisma.knowledgeArticle.findFirst({
      orderBy: { code: "desc" },
      select: { code: true },
    });
    const code = formatKnowledgeCode(nextKnowledgeSequence(last?.code));
    const tagLinks = await this.catalog.linkDataFor(dto.tags ?? []);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const article = await tx.knowledgeArticle.create({
          data: {
            code,
            kind,
            title: dto.title,
            summary: dto.summary,
            content: dto.content,
            categoryId: dto.categoryId,
            authorId: actor.id,
            authorName: actor.name ?? "Sistema",
            incidentCategoryKey: dto.incidentCategoryKey?.toUpperCase(),
            incidentSeverity: dto.incidentSeverity,
            assetTypeKey: dto.assetTypeKey?.toUpperCase(),
            keywords: normalizeKeywords(dto.keywords ?? []),
            problem: dto.problem,
            symptoms: dto.symptoms,
            diagnosis: dto.diagnosis,
            prerequisites: dto.prerequisites,
            validation: dto.validation,
            rollback: dto.rollback,
            escalation: dto.escalation,
            references: dto.references,
            tags: { create: tagLinks },
            steps: dto.steps ? { create: this.stepData(dto.steps) } : undefined,
          },
          include: listInclude,
        });
        await this.snapshot(tx, { ...article, currentVersion: 1 }, "Versão inicial.", actor);
        return article;
      });

      if (kind === KnowledgeArticleKind.RUNBOOK) {
        await this.eventBus?.emit("runbook.created", {
          entityId: created.id,
          actorId: actor.id,
          code: created.code,
          title: created.title,
          categoryKey: created.incidentCategoryKey ?? undefined,
        });
      }
      return this.findOne(created.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException(
          "Não foi possível gerar um código único para o artigo. Tente novamente.",
        );
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateKnowledgeArticleDto,
    actorInput?: { id?: string; email?: string },
  ) {
    const current = await this.requireArticle(id);
    await this.validateRelations(dto);
    const actor = await this.resolveActor(actorInput);

    if (requiresChangeNote(current.status) && !dto.changeNote) {
      throw new BadRequestException(
        "Informe a nota da alteração: o artigo já saiu do rascunho e a mudança precisa ser justificada.",
      );
    }

    const tagLinks = dto.tags ? await this.catalog.linkDataFor(dto.tags) : undefined;

    await this.prisma.$transaction(async (tx) => {
      if (tagLinks) {
        await tx.knowledgeTagLink.deleteMany({ where: { articleId: id } });
      }
      const updated = await tx.knowledgeArticle.update({
        where: { id },
        data: {
          title: dto.title,
          summary: dto.summary,
          content: dto.content,
          categoryId: dto.categoryId,
          incidentCategoryKey: dto.incidentCategoryKey?.toUpperCase(),
          incidentSeverity: dto.incidentSeverity,
          assetTypeKey: dto.assetTypeKey?.toUpperCase(),
          keywords: dto.keywords ? normalizeKeywords(dto.keywords) : undefined,
          problem: dto.problem,
          symptoms: dto.symptoms,
          diagnosis: dto.diagnosis,
          prerequisites: dto.prerequisites,
          validation: dto.validation,
          rollback: dto.rollback,
          escalation: dto.escalation,
          references: dto.references,
          tags: tagLinks ? { create: tagLinks } : undefined,
          // Cada edição relevante avança a versão corrente.
          currentVersion: { increment: 1 },
          versionCount: { increment: 1 },
        },
      });
      await this.snapshot(tx, updated, dto.changeNote ?? "Alteração de conteúdo.", actor);
    });

    return this.findOne(id);
  }

  /** Substitui integralmente os passos do runbook e cria uma versão. */
  async replaceSteps(
    id: string,
    dto: ReplaceRunbookStepsDto,
    actorInput?: { id?: string; email?: string },
  ) {
    const current = await this.requireArticle(id);
    if (current.kind !== KnowledgeArticleKind.RUNBOOK) {
      throw new BadRequestException("Somente runbooks possuem passos estruturados.");
    }
    if (current.status === KnowledgeArticleStatus.ARCHIVED) {
      throw new BadRequestException("Runbooks arquivados não recebem alterações.");
    }
    const actor = await this.resolveActor(actorInput);
    const steps = this.stepData(dto.steps);

    await this.prisma.$transaction(async (tx) => {
      await tx.runbookStep.deleteMany({ where: { articleId: id } });
      if (steps.length > 0) {
        await tx.runbookStep.createMany({
          data: steps.map((step) => ({ ...step, articleId: id })),
        });
      }
      const updated = await tx.knowledgeArticle.update({
        where: { id },
        data: {
          currentVersion: { increment: 1 },
          versionCount: { increment: 1 },
        },
      });
      await this.snapshot(
        tx,
        updated,
        `Passos atualizados (${steps.length} passo(s)).`,
        actor,
      );
    });

    return this.findOne(id);
  }

  // --------------------------------------------------------------- publicação

  async publish(id: string, actorInput?: { id?: string; email?: string }) {
    const current = await this.requireArticle(id);
    if (current.status === KnowledgeArticleStatus.PUBLISHED) return this.findOne(id);
    if (!canTransition(current.status, KnowledgeArticleStatus.PUBLISHED)) {
      throw new BadRequestException(
        transitionError(current.status, KnowledgeArticleStatus.PUBLISHED),
      );
    }
    if (current.summary.trim().length < 3) {
      throw new BadRequestException("O resumo é obrigatório para publicar.");
    }
    const stepCount = await this.prisma.runbookStep.count({ where: { articleId: id } });
    if (current.kind === KnowledgeArticleKind.RUNBOOK && stepCount === 0) {
      throw new BadRequestException(
        "Um runbook precisa ter ao menos um passo antes de ser publicado.",
      );
    }
    const actor = await this.resolveActor(actorInput);

    await this.prisma.knowledgeArticle.update({
      where: { id },
      data: { status: KnowledgeArticleStatus.PUBLISHED, publishedAt: new Date() },
    });

    if (current.kind === KnowledgeArticleKind.RUNBOOK) {
      await this.eventBus?.emit("runbook.published", {
        entityId: id,
        actorId: actor.id,
        code: current.code,
        title: current.title,
        stepCount,
      });
    }
    return this.findOne(id);
  }

  async sendToReview(id: string, actorInput?: { id?: string; email?: string }) {
    const current = await this.requireArticle(id);
    if (!canTransition(current.status, KnowledgeArticleStatus.REVIEW)) {
      throw new BadRequestException(
        transitionError(current.status, KnowledgeArticleStatus.REVIEW),
      );
    }
    await this.resolveActor(actorInput);
    await this.prisma.knowledgeArticle.update({
      where: { id },
      data: { status: KnowledgeArticleStatus.REVIEW, reviewedAt: new Date() },
    });
    return this.findOne(id);
  }

  async archive(id: string) {
    const current = await this.requireArticle(id);
    if (current.status === KnowledgeArticleStatus.ARCHIVED) return this.findOne(id);
    if (!canTransition(current.status, KnowledgeArticleStatus.ARCHIVED)) {
      throw new BadRequestException(
        transitionError(current.status, KnowledgeArticleStatus.ARCHIVED),
      );
    }
    await this.prisma.knowledgeArticle.update({
      where: { id },
      data: { status: KnowledgeArticleStatus.ARCHIVED, archivedAt: new Date() },
    });
    return this.findOne(id);
  }

  /** Exclusão física restrita a rascunhos; o restante é arquivado. */
  async remove(id: string) {
    const current = await this.requireArticle(id);
    if (current.status !== KnowledgeArticleStatus.DRAFT) {
      throw new BadRequestException(
        "Somente rascunhos podem ser excluídos. Archive o verbete para retirá-lo de circulação.",
      );
    }
    await this.prisma.knowledgeArticle.delete({ where: { id } });
  }

  /** Dados de apoio do editor e dos filtros. */
  async referenceData() {
    const [categories, tags, incidentCategories, assetTypes, incidents] = await Promise.all([
      this.catalog.listCategories(),
      this.catalog.listTags(),
      this.prisma.incidentCategory.findMany({
        where: { active: true },
        select: { key: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.assetType.findMany({
        where: { active: true },
        select: { key: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.incident.findMany({
        where: { status: { in: ["NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS"] } },
        select: { id: true, code: true, title: true, severity: true },
        orderBy: { openedAt: "desc" },
        take: 50,
      }),
    ]);
    return { categories, tags, incidentCategories, assetTypes, incidents };
  }

  /** Verifica se o verbete é um runbook publicado (usado pelo serviço de uso). */
  async requireExecutableRunbook(id: string) {
    const article = await this.requireArticle(id);
    if (article.kind !== KnowledgeArticleKind.RUNBOOK) {
      throw new BadRequestException("Somente runbooks podem ser executados.");
    }
    if (!isPublished(article.status)) {
      throw new BadRequestException("Somente runbooks publicados podem ser executados.");
    }
    return article;
  }
}
