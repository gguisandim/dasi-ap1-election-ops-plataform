import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  RiskEventType,
  RiskLevel,
  RiskStatus,
} from "@prisma/client";
import { EventBus } from "../../../../../packages/event-bus/src";
import { PrismaService } from "../../../../../packages/database/src";
import type { RiskDashboard, RiskSummary } from "@eops/shared/risks";
import {
  CreateRiskDto,
  MaterializeRiskDto,
  ReplaceRiskMitigationsDto,
  RiskQueryDto,
  UpdateRiskDto,
} from "./dto/risk.dto";
import { formatRiskCode, nextRiskSequence } from "./helpers/risk-code";
import {
  assessRisk,
  averageProgress,
  buildRiskMatrix,
  isEscalation,
  isRiskOverdue,
  RISK_LEVEL_WEIGHT,
} from "./helpers/risk-scoring";
import { canMaterialize, canTransition, transitionError } from "./helpers/risk-status";
import { RiskCatalogService } from "./risk-catalog.service";
import { RiskMitigationService } from "./risk-mitigation.service";
import { RiskTimelineService } from "./risk-timeline.service";
import type { RiskActor } from "./types";

const listInclude = {
  election: { select: { id: true, name: true, year: true } },
  electoralZone: { select: { id: true, number: true, name: true } },
  pollingPlace: { select: { id: true, name: true, city: true } },
  category: true,
  mitigations: { orderBy: { dueDate: "asc" as const } },
} satisfies Prisma.RiskInclude;

const detailInclude = {
  ...listInclude,
  events: { orderBy: { createdAt: "desc" as const }, take: 100 },
} satisfies Prisma.RiskInclude;

type RiskRecord = Prisma.RiskGetPayload<{ include: typeof listInclude }>;
type RiskDetailRecord = Prisma.RiskGetPayload<{ include: typeof detailInclude }>;

/**
 * Núcleo da Gestão de Riscos: registro, avaliação, painel, matriz,
 * materialização e encerramento.
 *
 * Score e classificação são sempre derivados no servidor — o cliente nunca os
 * envia, o que impede que uma classificação divergente do cálculo entre no banco.
 */
@Injectable()
export class RiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: RiskCatalogService,
    private readonly mitigations: RiskMitigationService,
    private readonly timeline: RiskTimelineService,
    private readonly eventBus?: EventBus,
  ) {}

  // ------------------------------------------------------------------ leitura

  private where(query: RiskQueryDto): Prisma.RiskWhereInput {
    const today = new Date();
    return {
      status: query.status,
      level: query.level,
      probability: query.matrixProbability ?? query.probability,
      impact: query.matrixImpact ?? query.impact,
      categoryId: query.categoryId,
      electionId: query.electionId,
      electoralZoneId: query.electoralZoneId,
      pollingPlaceId: query.pollingPlaceId,
      ownerId: query.ownerId,
      responsibleId: query.responsibleId,
      identifiedAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
      mitigations: query.withoutMitigation
        ? { none: {} }
        : query.withOverdueMitigation
          ? {
              some: {
                dueDate: { lt: today },
                status: { notIn: ["COMPLETED", "CANCELLED"] },
              },
            }
          : undefined,
      OR: query.search
        ? [
            { code: { contains: query.search, mode: "insensitive" } },
            { title: { contains: query.search, mode: "insensitive" } },
            { description: { contains: query.search, mode: "insensitive" } },
            { ownerName: { contains: query.search, mode: "insensitive" } },
            { responsibleName: { contains: query.search, mode: "insensitive" } },
          ]
        : undefined,
    };
  }

  async findAll(query: RiskQueryDto) {
    const where = this.where(query);
    const [items, total] = await Promise.all([
      this.prisma.risk.findMany({
        where,
        include: listInclude,
        // Maior severidade primeiro; dentro da mesma faixa, maior score.
        orderBy: [{ level: "desc" }, { score: "desc" }, { identifiedAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.risk.count({ where }),
    ]);
    return {
      items: items.map((item) => this.present(item)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async findOne(id: string) {
    const risk = await this.prisma.risk.findUnique({ where: { id }, include: detailInclude });
    if (!risk) throw new NotFoundException("Risco não encontrado.");
    return { ...this.present(risk), timeline: risk.events };
  }

  async requireRisk(id: string) {
    const risk = await this.prisma.risk.findUnique({ where: { id }, include: listInclude });
    if (!risk) throw new NotFoundException("Risco não encontrado.");
    return risk;
  }

  private present(risk: RiskRecord | RiskDetailRecord): RiskSummary {
    const mitigations = risk.mitigations;
    return {
      ...risk,
      mitigations: this.mitigations.present(mitigations as never),
      mitigationProgress: averageProgress(
        mitigations.map((mitigation) => ({
          status: mitigation.status,
          progress: mitigation.progress,
        })),
      ),
      hasOverdueMitigation: this.mitigations
        .present(mitigations as never)
        .some((mitigation) => mitigation.overdue),
      overdue: isRiskOverdue({ dueDate: risk.dueDate, status: risk.status }),
    } as unknown as RiskSummary;
  }

  timelineFor(id: string) {
    return this.requireRisk(id).then(() => this.timeline.list(id));
  }

  /** Matriz 5×5 com a contagem e os IDs dos riscos de cada combinação. */
  async matrix(query: RiskQueryDto) {
    const risks = await this.prisma.risk.findMany({
      where: { ...this.where({ ...query, matrixProbability: undefined, matrixImpact: undefined }) },
      select: { id: true, probability: true, impact: true, score: true, level: true },
    });
    const grouped = new Map<string, string[]>();
    for (const risk of risks) {
      const key = `${risk.probability}:${risk.impact}`;
      grouped.set(key, [...(grouped.get(key) ?? []), risk.id]);
    }
    return buildRiskMatrix().map((row) =>
      row.map((cell) => ({
        ...cell,
        total: grouped.get(`${cell.probability}:${cell.impact}`)?.length ?? 0,
        riskIds: grouped.get(`${cell.probability}:${cell.impact}`) ?? [],
      })),
    );
  }

  /** Painel: indicadores, distribuições e a matriz preenchida. */
  async dashboard(electionId?: string): Promise<RiskDashboard> {
    const today = new Date();
    const scoped: Prisma.RiskWhereInput = electionId ? { electionId } : {};

    const [
      total,
      closed,
      accepted,
      materialized,
      withoutMitigation,
      overdueMitigations,
      levelGroups,
      statusGroups,
      categoryGroups,
      zoneGroups,
      scoreAggregate,
      risks,
    ] = await Promise.all([
      this.prisma.risk.count({ where: scoped }),
      this.prisma.risk.count({ where: { ...scoped, status: RiskStatus.CLOSED } }),
      this.prisma.risk.count({ where: { ...scoped, status: RiskStatus.ACCEPTED } }),
      this.prisma.risk.count({ where: { ...scoped, status: RiskStatus.MATERIALIZED } }),
      this.prisma.risk.count({ where: { ...scoped, mitigations: { none: {} } } }),
      this.prisma.riskMitigation.count({
        where: {
          dueDate: { lt: today },
          status: { notIn: ["COMPLETED", "CANCELLED"] },
          risk: scoped,
        },
      }),
      this.prisma.risk.groupBy({ by: ["level"], where: scoped, _count: { _all: true } }),
      this.prisma.risk.groupBy({ by: ["status"], where: scoped, _count: { _all: true } }),
      this.prisma.risk.groupBy({
        by: ["categoryId"],
        where: scoped,
        _count: { _all: true },
        orderBy: { _count: { categoryId: "desc" } },
      }),
      this.prisma.risk.groupBy({
        by: ["electoralZoneId"],
        where: { ...scoped, electoralZoneId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { electoralZoneId: "desc" } },
      }),
      this.prisma.risk.aggregate({ where: scoped, _avg: { score: true } }),
      this.prisma.risk.findMany({
        where: scoped,
        select: { id: true, probability: true, impact: true, score: true, level: true },
      }),
    ]);

    const [categories, zones] = await Promise.all([
      this.prisma.riskCategory.findMany({
        where: { id: { in: categoryGroups.map((group) => group.categoryId) } },
        select: { id: true, name: true },
      }),
      this.prisma.electoralZone.findMany({
        where: {
          id: { in: zoneGroups.map((group) => group.electoralZoneId).filter((id): id is string => Boolean(id)) },
        },
        select: { id: true, number: true, name: true },
      }),
    ]);
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const zoneNames = new Map(
      zones.map((zone) => [zone.id, `Zona ${zone.number} · ${zone.name}`]),
    );

    const grouped = new Map<string, string[]>();
    const byLevel = new Map<RiskLevel, number>();
    for (const risk of risks) {
      const key = `${risk.probability}:${risk.impact}`;
      grouped.set(key, [...(grouped.get(key) ?? []), risk.id]);
      byLevel.set(risk.level, (byLevel.get(risk.level) ?? 0) + 1);
    }

    const levelCount = (level: RiskLevel) => byLevel.get(level) ?? 0;

    return {
      total,
      active: total - closed,
      critical: levelCount(RiskLevel.CRITICAL),
      high: levelCount(RiskLevel.HIGH),
      withoutMitigation,
      overdueMitigations,
      materialized,
      closed,
      accepted,
      averageScore: Math.round((scoreAggregate._avg.score ?? 0) * 10) / 10,
      byCategory: categoryGroups.map((group) => ({
        key: group.categoryId,
        label: categoryNames.get(group.categoryId) ?? "Categoria removida",
        total: group._count._all,
      })),
      byZone: zoneGroups.map((group) => ({
        key: group.electoralZoneId ?? "none",
        label: zoneNames.get(group.electoralZoneId ?? "") ?? "Zona removida",
        total: group._count._all,
      })),
      byLevel: levelGroups
        .map((group) => ({ key: group.level, label: group.level, total: group._count._all }))
        .sort(
          (left, right) =>
            RISK_LEVEL_WEIGHT[right.key as RiskLevel] - RISK_LEVEL_WEIGHT[left.key as RiskLevel],
        ),
      byStatus: statusGroups.map((group) => ({
        key: group.status,
        label: group.status,
        total: group._count._all,
      })),
      matrix: buildRiskMatrix().map((row) =>
        row.map((cell) => ({
          ...cell,
          total: grouped.get(`${cell.probability}:${cell.impact}`)?.length ?? 0,
          riskIds: grouped.get(`${cell.probability}:${cell.impact}`) ?? [],
        })),
      ),
    };
  }

  // ------------------------------------------------------------------ escrita

  private async resolveActor(input?: { id?: string; email?: string }): Promise<RiskActor> {
    if (!input?.id) return { name: input?.email ?? "Sistema" };
    const user = await this.prisma.user.findUnique({
      where: { id: input.id },
      select: { name: true, email: true },
    });
    return { id: input.id, name: user?.name ?? user?.email ?? input.email };
  }

  private async validateRelations(dto: {
    electionId?: string;
    electoralZoneId?: string | null;
    pollingPlaceId?: string | null;
    categoryId?: string;
  }) {
    if (dto.categoryId) await this.catalog.require(dto.categoryId);
    if (dto.electionId) {
      const election = await this.prisma.election.findUnique({
        where: { id: dto.electionId },
        select: { id: true },
      });
      if (!election) throw new NotFoundException("Pleito não encontrado.");
    }
    const [zone, place] = await Promise.all([
      dto.electoralZoneId
        ? this.prisma.electoralZone.findUnique({
            where: { id: dto.electoralZoneId },
            select: { id: true, electionId: true },
          })
        : null,
      dto.pollingPlaceId
        ? this.prisma.pollingPlace.findUnique({
            where: { id: dto.pollingPlaceId },
            select: { id: true, electoralZoneId: true, electoralZone: { select: { electionId: true } } },
          })
        : null,
    ]);
    if (dto.electoralZoneId && !zone) throw new NotFoundException("Zona eleitoral não encontrada.");
    if (dto.pollingPlaceId && !place) throw new NotFoundException("Local de votação não encontrado.");
    if (zone && dto.electionId && zone.electionId !== dto.electionId) {
      throw new BadRequestException("A zona não pertence ao pleito informado.");
    }
    if (place && dto.electionId && place.electoralZone.electionId !== dto.electionId) {
      throw new BadRequestException("O local não pertence ao pleito informado.");
    }
    if (place && zone && place.electoralZoneId !== zone.id) {
      throw new BadRequestException("O local não pertence à zona informada.");
    }
  }

  async create(dto: CreateRiskDto, actorInput?: { id?: string; email?: string }) {
    const actor = await this.resolveActor(actorInput);
    await this.validateRelations(dto);

    const last = await this.prisma.risk.findFirst({
      orderBy: { code: "desc" },
      select: { code: true },
    });
    const code = formatRiskCode(nextRiskSequence(last?.code));
    const assessment = assessRisk(dto.probability, dto.impact);
    const mitigations = dto.mitigations ?? [];

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const risk = await tx.risk.create({
          data: {
            code,
            title: dto.title,
            description: dto.description,
            electionId: dto.electionId,
            electoralZoneId: dto.electoralZoneId,
            pollingPlaceId: dto.pollingPlaceId,
            categoryId: dto.categoryId,
            ownerName: dto.ownerName,
            responsibleName: dto.responsibleName,
            probability: dto.probability,
            impact: dto.impact,
            score: assessment.score,
            level: assessment.level,
            status: dto.status ?? RiskStatus.IDENTIFIED,
            identifiedAt: dto.identifiedAt ? new Date(dto.identifiedAt) : undefined,
            dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
            observations: dto.observations,
          },
        });
        await tx.riskEvent.create({
          data: this.timeline.dataFor(risk.id, {
            type: RiskEventType.CREATED,
            message: `Risco registrado com score ${assessment.score} (${assessment.level}).`,
            actorId: actor.id,
            actorName: actor.name,
            metadata: { score: assessment.score, level: assessment.level, code },
          }),
        });
        if (mitigations.length > 0) {
          await this.mitigations.replaceWithin(tx, risk.id, mitigations, actor);
        }
        return risk;
      });

      await this.eventBus?.emit("risk.created", {
        entityId: created.id,
        actorId: actor.id,
        code: created.code,
        title: created.title,
        electionId: created.electionId,
        score: created.score,
        level: created.level,
      });
      return this.findOne(created.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException(
          "Não foi possível gerar um código único para o risco. Tente novamente.",
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateRiskDto, actorInput?: { id?: string; email?: string }) {
    const current = await this.requireRisk(id);
    await this.validateRelations(dto);
    const actor = await this.resolveActor(actorInput);

    const probability = dto.probability ?? current.probability;
    const impact = dto.impact ?? current.impact;
    const assessment = assessRisk(probability, impact);
    const scoreChanged = assessment.score !== current.score;
    const ownerChanged = dto.ownerName !== undefined && dto.ownerName !== current.ownerName;

    // A primeira avaliação move o risco de IDENTIFIED para ASSESSED.
    const nextStatus =
      dto.status ??
      (scoreChanged && current.status === RiskStatus.IDENTIFIED
        ? RiskStatus.ASSESSED
        : undefined);

    if (nextStatus && nextStatus !== current.status) {
      if (!canTransition(current.status, nextStatus)) {
        throw new BadRequestException(transitionError(current.status, nextStatus));
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.risk.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          electoralZoneId: dto.electoralZoneId,
          pollingPlaceId: dto.pollingPlaceId,
          categoryId: dto.categoryId,
          ownerName: dto.ownerName,
          responsibleName: dto.responsibleName,
          probability,
          impact,
          score: assessment.score,
          level: assessment.level,
          status: nextStatus,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          observations: dto.observations,
          acceptedAt: nextStatus === RiskStatus.ACCEPTED ? new Date() : undefined,
        },
      });

      if (scoreChanged || ownerChanged || (nextStatus && nextStatus !== current.status)) {
        await tx.riskEvent.create({
          data: this.timeline.dataFor(id, {
            type: scoreChanged ? RiskEventType.SCORE_CHANGED : RiskEventType.OWNER_CHANGED,
            message: scoreChanged
              ? `Score alterado de ${current.score} (${current.level}) para ${assessment.score} (${assessment.level}).`
              : ownerChanged
                ? `Proprietário alterado de ${current.ownerName} para ${dto.ownerName}.`
                : `Situação alterada de ${current.status} para ${nextStatus}.`,
            actorId: actor.id,
            actorName: actor.name,
            metadata: scoreChanged
              ? {
                  fromScore: current.score,
                  toScore: assessment.score,
                  fromLevel: current.level,
                  toLevel: assessment.level,
                }
              : undefined,
          }),
        });
      }
      if (nextStatus && nextStatus !== current.status && scoreChanged) {
        await tx.riskEvent.create({
          data: this.timeline.dataFor(id, {
            type: RiskEventType.STATUS_CHANGED,
            message: `Situação alterada de ${current.status} para ${nextStatus}.`,
            actorId: actor.id,
            actorName: actor.name,
          }),
        });
      }
    });

    if (isEscalation(current.level, assessment.level)) {
      await this.eventBus?.emit("risk.escalated", {
        entityId: id,
        actorId: actor.id,
        code: current.code,
        title: current.title,
        fromLevel: current.level,
        toLevel: assessment.level,
        score: assessment.score,
      });
    }
    return this.findOne(id);
  }

  replaceMitigations(
    id: string,
    dto: ReplaceRiskMitigationsDto,
    actorInput?: { id?: string; email?: string },
  ) {
    return this.requireRisk(id)
      .then((risk) => {
        if (risk.status === RiskStatus.CLOSED) {
          throw new BadRequestException("Riscos encerrados não recebem novas mitigações.");
        }
        return this.resolveActor(actorInput);
      })
      .then((actor) =>
        this.prisma.$transaction((tx) =>
          this.mitigations.replaceWithin(tx, id, dto.mitigations, actor),
        ),
      )
      .then(() => this.findOne(id));
  }

  /**
   * Registra a materialização: o risco deixou de ser hipótese.
   *
   * O incidente real é associado por ID — nenhum plugin de incidentes é importado;
   * a ligação acontece por referência e pelo evento `risk.materialized`.
   */
  async materialize(
    id: string,
    dto: MaterializeRiskDto,
    actorInput?: { id?: string; email?: string },
  ) {
    const current = await this.requireRisk(id);
    if (!canMaterialize(current.status)) {
      throw new BadRequestException(
        current.status === RiskStatus.MATERIALIZED
          ? "Este risco já foi registrado como materializado."
          : "Riscos encerrados não podem ser materializados.",
      );
    }
    if (dto.incidentId) {
      const incident = await this.prisma.incident.findUnique({
        where: { id: dto.incidentId },
        select: { id: true, code: true },
      });
      if (!incident) throw new NotFoundException("Incidente informado não encontrado.");
    }
    const actor = await this.resolveActor(actorInput);
    const materializedAt = dto.materializedAt ? new Date(dto.materializedAt) : new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.risk.update({
        where: { id },
        data: {
          status: RiskStatus.MATERIALIZED,
          materializedAt,
          actualImpact: dto.actualImpact,
          materializationNotes: dto.notes,
          incidentId: dto.incidentId,
        },
      });
      await tx.riskEvent.create({
        data: this.timeline.dataFor(id, {
          type: RiskEventType.MATERIALIZED,
          message: `Risco materializado. Impacto real: ${dto.actualImpact}`,
          actorId: actor.id,
          actorName: actor.name,
          metadata: { incidentId: dto.incidentId, materializedAt: materializedAt.toISOString() },
        }),
      });
    });

    await this.eventBus?.emit("risk.materialized", {
      entityId: id,
      actorId: actor.id,
      code: current.code,
      title: current.title,
      level: current.level,
      actualImpact: dto.actualImpact,
      incidentId: dto.incidentId,
    });
    return this.findOne(id);
  }

  async close(id: string, actorInput?: { id?: string; email?: string }) {
    const current = await this.requireRisk(id);
    if (current.status === RiskStatus.CLOSED) return this.findOne(id);
    if (!canTransition(current.status, RiskStatus.CLOSED)) {
      throw new BadRequestException(transitionError(current.status, RiskStatus.CLOSED));
    }
    const actor = await this.resolveActor(actorInput);

    await this.prisma.$transaction(async (tx) => {
      await tx.risk.update({
        where: { id },
        data: { status: RiskStatus.CLOSED, closedAt: new Date() },
      });
      await tx.riskEvent.create({
        data: this.timeline.dataFor(id, {
          type: RiskEventType.CLOSED,
          message: "Risco encerrado.",
          actorId: actor.id,
          actorName: actor.name,
        }),
      });
    });

    await this.eventBus?.emit("risk.closed", {
      entityId: id,
      actorId: actor.id,
      code: current.code,
      title: current.title,
      level: current.level,
    });
    return this.findOne(id);
  }

  /**
   * Exclusão física restrita: só risco recém-identificado, sem mitigação e nunca
   * materializado. Risco tratado é histórico e permanece.
   */
  async remove(id: string) {
    const current = await this.requireRisk(id);
    if (current.status !== RiskStatus.IDENTIFIED) {
      throw new BadRequestException(
        "Somente riscos ainda não tratados podem ser excluídos. Encerre o risco para retirá-lo da operação.",
      );
    }
    if (current.mitigations.length > 0) {
      throw new BadRequestException(
        "Riscos com plano de mitigação não podem ser excluídos. Encerre-os.",
      );
    }
    await this.prisma.risk.delete({ where: { id } });
  }

  /**
   * Dados de apoio do formulário, dos filtros e do vínculo de materialização.
   *
   * Os incidentes são lidos do banco central apenas como referência (id, código e
   * título) para associar a materialização — nenhuma implementação de outro plugin
   * é importada.
   */
  async referenceData() {
    const [elections, categories, zones, places, users, incidents] = await Promise.all([
      this.prisma.election.findMany({
        select: { id: true, name: true, year: true, status: true },
        orderBy: { year: "desc" },
      }),
      this.catalog.list(),
      this.prisma.electoralZone.findMany({
        select: { id: true, number: true, name: true, electionId: true },
        orderBy: { number: "asc" },
      }),
      this.prisma.pollingPlace.findMany({
        select: { id: true, name: true, city: true, electoralZoneId: true },
        orderBy: { name: "asc" },
        take: 500,
      }),
      this.prisma.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
        take: 500,
      }),
      this.prisma.incident.findMany({
        select: { id: true, code: true, title: true },
        orderBy: { openedAt: "desc" },
        take: 100,
      }),
    ]);
    return { elections, categories, zones, places, users, incidents };
  }
}
