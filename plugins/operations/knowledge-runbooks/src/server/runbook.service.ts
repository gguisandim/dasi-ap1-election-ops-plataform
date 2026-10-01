import { Injectable, NotFoundException } from "@nestjs/common";
import {
  IncidentSeverity,
  KnowledgeArticleKind,
  KnowledgeArticleStatus,
  Prisma,
  RunbookUsageOutcome,
} from "@prisma/client";
import { EventBus } from "../../../../../packages/event-bus/src";
import { PrismaService } from "../../../../../packages/database/src";
import {
  KnowledgeArticleSummary,
  RunbookRecommendation,
} from "@eops/shared/knowledge";
import {
  CreateRunbookUsageDto,
  KnowledgeUsageQueryDto,
  RunbookRecommendationQueryDto,
} from "./dto/knowledge.dto";
import {
  compareRecommendations,
  MatchContext,
  scoreRunbook,
  successRate,
} from "./helpers/runbook-matching";
import { KnowledgeService } from "./knowledge.service";
import type { KnowledgeActor } from "./types";

const recommendationInclude = {
  category: true,
  tags: { include: { tag: true } },
  _count: { select: { steps: true } },
} satisfies Prisma.KnowledgeArticleInclude;

/**
 * Runbooks: recomendação a partir de um incidente, registro de uso e métricas.
 *
 * A recomendação é local e determinística — o score é calculado por regra
 * publicada (`scoreRunbook`) e devolvido junto com os componentes que o
 * formaram, para que qualquer resultado possa ser explicado.
 */
@Injectable()
export class RunbookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledge: KnowledgeService,
    private readonly eventBus?: EventBus,
  ) {}

  // ------------------------------------------------------------- recomendação

  /** Monta o contexto a partir de um incidente existente. */
  private async contextFromIncident(incidentId: string): Promise<MatchContext> {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: {
        title: true,
        description: true,
        severity: true,
        category: { select: { key: true } },
        asset: { select: { type: { select: { key: true } } } },
      },
    });
    if (!incident) throw new NotFoundException("Incidente não encontrado.");
    return {
      categoryKey: incident.category.key,
      severity: incident.severity,
      assetTypeKey: incident.asset?.type.key ?? null,
      text: `${incident.title} ${incident.description}`,
    };
  }

  async recommend(
    query: RunbookRecommendationQueryDto,
    actorInput?: { id?: string; email?: string },
  ): Promise<RunbookRecommendation[]> {
    const context: MatchContext = query.incidentId
      ? await this.contextFromIncident(query.incidentId)
      : {
          categoryKey: query.categoryKey,
          severity: query.severity,
          assetTypeKey: query.assetTypeKey,
          text: query.text,
        };

    const candidates = await this.prisma.knowledgeArticle.findMany({
      where: {
        kind: KnowledgeArticleKind.RUNBOOK,
        status: KnowledgeArticleStatus.PUBLISHED,
      },
      include: recommendationInclude,
    });

    const recommendations: RunbookRecommendation[] = [];
    for (const candidate of candidates) {
      const { score, breakdown, reasons } = scoreRunbook(context, {
        incidentCategoryKey: candidate.incidentCategoryKey,
        incidentSeverity: candidate.incidentSeverity,
        assetTypeKey: candidate.assetTypeKey,
        keywords: candidate.keywords,
      });
      if (score <= 0) continue;
      recommendations.push({
        article: {
          ...candidate,
          tags: candidate.tags.map((link) => ({
            id: link.tag.id,
            label: link.tag.label,
            slug: link.tag.slug,
          })),
          stepCount: candidate._count.steps,
          successRate: successRate(candidate.resolvedCount, candidate.usageCount),
          stale: false,
        } as unknown as KnowledgeArticleSummary,
        score,
        breakdown,
        reasons,
      });
    }

    recommendations.sort((left, right) =>
      compareRecommendations(
        {
          score: left.score,
          resolvedCount: left.article.resolvedCount,
          successRate: left.article.successRate,
          usageCount: left.article.usageCount,
          title: left.article.title,
        },
        {
          score: right.score,
          resolvedCount: right.article.resolvedCount,
          successRate: right.article.successRate,
          usageCount: right.article.usageCount,
          title: right.article.title,
        },
      ),
    );

    const limited = recommendations.slice(0, query.limit);

    if (query.incidentId && limited.length > 0) {
      const actor = await this.resolveActor(actorInput);
      await this.eventBus?.emit("runbook.matched", {
        entityId: query.incidentId,
        actorId: actor.id,
        incidentId: query.incidentId,
        matchCount: limited.length,
      });
    }
    return limited;
  }

  // -------------------------------------------------------------------- uso

  private async resolveActor(input?: { id?: string; email?: string }): Promise<KnowledgeActor> {
    if (!input?.id) return { name: input?.email ?? "Sistema" };
    const user = await this.prisma.user.findUnique({
      where: { id: input.id },
      select: { name: true, email: true },
    });
    return { id: input.id, name: user?.name ?? user?.email ?? input.email };
  }

  /**
   * Registra a execução de um runbook.
   *
   * Os contadores agregados (`usageCount`, `resolvedCount`) vivem no próprio
   * artigo para que métricas e ordenação de recomendação não precisem agregar a
   * tabela de uso a cada consulta.
   */
  async registerUsage(
    articleId: string,
    dto: CreateRunbookUsageDto,
    actorInput?: { id?: string; email?: string },
  ) {
    const article = await this.knowledge.requireExecutableRunbook(articleId);
    const actor = await this.resolveActor(actorInput);
    const resolved = dto.outcome === RunbookUsageOutcome.RESOLVED;

    const usage = await this.prisma.$transaction(async (tx) => {
      const created = await tx.runbookUsage.create({
        data: {
          articleId,
          incidentId: dto.incidentId,
          incidentCode: dto.incidentCode,
          userId: actor.id,
          userName: actor.name ?? "Sistema",
          outcome: dto.outcome,
          resolved,
          stepsCompleted: dto.stepsCompleted,
          notes: dto.notes,
          finishedAt: dto.finishedAt ? new Date(dto.finishedAt) : new Date(),
        },
      });
      await tx.knowledgeArticle.update({
        where: { id: articleId },
        data: {
          usageCount: { increment: 1 },
          resolvedCount: resolved ? { increment: 1 } : undefined,
        },
      });
      return created;
    });

    await this.eventBus?.emit("runbook.executed", {
      entityId: articleId,
      actorId: actor.id,
      code: article.code,
      title: article.title,
      outcome: dto.outcome,
      resolved,
      incidentId: dto.incidentId,
    });
    return usage;
  }

  async listUsages(query: KnowledgeUsageQueryDto) {
    const where: Prisma.RunbookUsageWhereInput = {
      articleId: query.articleId,
      incidentId: query.incidentId,
      outcome: query.outcome,
    };
    const [items, total] = await Promise.all([
      this.prisma.runbookUsage.findMany({
        where,
        include: {
          article: { select: { id: true, code: true, title: true, kind: true } },
        },
        orderBy: { startedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.runbookUsage.count({ where }),
    ]);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  usagesForArticle(articleId: string, limit = 50) {
    return this.prisma.runbookUsage.findMany({
      where: { articleId },
      orderBy: { startedAt: "desc" },
      take: limit,
    });
  }

  // ---------------------------------------------------------------- métricas

  /**
   * Métricas de uso e curadoria: mais utilizados, taxa de sucesso, categorias
   * com menos cobertura, publicados sem uso e runbooks desatualizados.
   */
  async metrics() {
    const publishedRunbooks: Prisma.KnowledgeArticleWhereInput = {
      kind: KnowledgeArticleKind.RUNBOOK,
      status: KnowledgeArticleStatus.PUBLISHED,
    };

    const [mostUsed, byOutcome, coverageGroups, unused, stale, categories] = await Promise.all([
      this.prisma.knowledgeArticle.findMany({
        where: publishedRunbooks,
        orderBy: [{ usageCount: "desc" }, { title: "asc" }],
        take: 10,
        select: {
          id: true,
          code: true,
          title: true,
          usageCount: true,
          resolvedCount: true,
          categoryId: true,
          updatedAt: true,
        },
      }),
      this.prisma.runbookUsage.groupBy({
        by: ["outcome"],
        _count: { _all: true },
      }),
      this.prisma.knowledgeArticle.groupBy({
        by: ["categoryId"],
        where: publishedRunbooks,
        _count: { _all: true },
      }),
      this.prisma.knowledgeArticle.findMany({
        where: { ...publishedRunbooks, usageCount: 0 },
        select: { id: true, code: true, title: true, publishedAt: true },
        orderBy: { publishedAt: "asc" },
        take: 20,
      }),
      this.knowledge.findAll({ staleOnly: true, page: 1, pageSize: 20 }).then((result) => result.items),
      this.prisma.knowledgeCategory.findMany({ orderBy: { name: "asc" } }),
    ]);

    const outcomeCounts = byOutcome.reduce<Record<string, number>>((accumulator, row) => {
      accumulator[row.outcome] = row._count._all;
      return accumulator;
    }, {});
    const totalUsages = Object.values(outcomeCounts).reduce((sum, value) => sum + value, 0);

    const countByCategory = new Map(
      coverageGroups.map((group) => [group.categoryId, group._count._all]),
    );

    return {
      mostUsed: mostUsed.map((article) => ({
        ...article,
        successRate: successRate(article.resolvedCount, article.usageCount),
      })),
      outcomes: {
        total: totalUsages,
        resolved: outcomeCounts[RunbookUsageOutcome.RESOLVED] ?? 0,
        partiallyResolved: outcomeCounts[RunbookUsageOutcome.PARTIALLY_RESOLVED] ?? 0,
        notResolved: outcomeCounts[RunbookUsageOutcome.NOT_RESOLVED] ?? 0,
        successRate: successRate(outcomeCounts[RunbookUsageOutcome.RESOLVED] ?? 0, totalUsages),
      },
      coverage: [
        ...categories.map((category) => ({
          categoryId: category.id,
          name: category.name,
          runbooks: countByCategory.get(category.id) ?? 0,
        })),
        { categoryId: null, name: "Sem categoria", runbooks: countByCategory.get(null) ?? 0 },
      ].sort(
        (left, right) =>
          left.runbooks - right.runbooks || left.name.localeCompare(right.name, "pt-BR"),
      ),
      unused,
      stale,
    };
  }

  /** Severidades disponíveis para associação, expostas para o formulário. */
  severities(): IncidentSeverity[] {
    return Object.values(IncidentSeverity);
  }
}
