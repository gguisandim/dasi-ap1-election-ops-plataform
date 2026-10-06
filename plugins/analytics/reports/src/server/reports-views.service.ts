import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import { PERMISSIONS } from "@eops/security";
import {
  REPORT_MAX_VIEWS_PER_OWNER,
  REPORT_VIEW_FILTER_KEYS,
  assertReportGranularity,
  isReportMetric,
} from "@eops/shared/reports";
import type { CreateReportViewDto, UpdateReportViewDto } from "./dto/analytics.dto";

const ALLOWED_FILTER_KEYS = new Set<string>(REPORT_VIEW_FILTER_KEYS);

/**
 * Normaliza e restringe os filtros aceitos por uma saved view. Qualquer chave
 * fora da whitelist e rejeitada: o filtro e persistido como JSON e nao pode
 * virar canal para armazenar dados arbitrarios (SPEC 2.7).
 */
export function normalizeViewFilters(
  filters: Record<string, unknown> | undefined,
): Prisma.InputJsonValue {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(filters ?? {})) {
    if (!ALLOWED_FILTER_KEYS.has(key))
      throw new BadRequestException(`Filtro nao suportado: ${key}.`);
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) result[key] = trimmed;
      continue;
    }
    if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
      result[key] = [...new Set(value.map((entry) => entry.trim()))].filter(Boolean);
      continue;
    }
    throw new BadRequestException(`Valor invalido para o filtro ${key}.`);
  }
  return result as Prisma.InputJsonValue;
}

/** Restringe a lista de metricas salvas ao vocabulario fechado (SPEC 2.3). */
export function normalizeViewMetrics(metrics: readonly string[] | undefined): Prisma.InputJsonValue {
  const unique = [...new Set((metrics ?? []).map((metric) => metric.trim()))].filter(Boolean);
  for (const metric of unique)
    if (!isReportMetric(metric)) throw new BadRequestException(`Metrica fora do vocabulario: ${metric}.`);
  return unique as Prisma.InputJsonValue;
}

function normalizeGranularity(value: string | undefined): string {
  return value === undefined ? "day" : assertReportGranularity(value);
}

@Injectable()
export class ReportsViewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async list(actorId: string, permissions: readonly string[]) {
    const items = await this.prisma.reportSavedView.findMany({
      where: { OR: [{ ownerId: actorId }, { shared: true }] },
      include: { owner: { select: { id: true, name: true } } },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
    return items.map((item) => ({ ...item, editable: this.canEdit(item, actorId, permissions) }));
  }

  async create(dto: CreateReportViewDto, actorId: string, permissions: readonly string[]) {
    const total = await this.prisma.reportSavedView.count({ where: { ownerId: actorId } });
    if (total >= REPORT_MAX_VIEWS_PER_OWNER)
      throw new ConflictException(
        `Limite de ${REPORT_MAX_VIEWS_PER_OWNER} visoes por usuario atingido.`,
      );
    const name = dto.name.trim();
    if (!name) throw new BadRequestException("Informe um nome para a visao.");
    const shared = dto.shared ?? false;
    if (shared && !permissions.includes(PERMISSIONS.reports.manage))
      throw new ForbiddenException("Somente quem gerencia relatorios pode compartilhar visoes.");

    const record = await this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.reportSavedView.findUnique({
        where: { ownerId_name: { ownerId: actorId, name } },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException("Ja existe uma visao com esse nome.");
      if (dto.isDefault) await this.clearDefault(tx, actorId);
      return tx.reportSavedView.create({
        data: {
          ownerId: actorId,
          name,
          description: dto.description?.trim() || null,
          filters: normalizeViewFilters(dto.filters),
          metricsJson: normalizeViewMetrics(dto.metricsJson),
          granularity: normalizeGranularity(dto.granularity),
          isDefault: dto.isDefault ?? false,
          shared,
        },
      });
    });

    await this.eventBus.emit("report_view.created", {
      entityId: record.id,
      actorId,
      name: record.name,
      granularity: record.granularity,
    });
    if (record.shared)
      await this.eventBus.emit("report_view.shared", {
        entityId: record.id,
        actorId,
        name: record.name,
      });

    return { ...record, editable: true };
  }

  async update(
    id: string,
    dto: UpdateReportViewDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    this.assertCanEdit(current, actorId, permissions);
    if (dto.shared === true && !permissions.includes(PERMISSIONS.reports.manage))
      throw new ForbiddenException("Somente quem gerencia relatorios pode compartilhar visoes.");
    const name = dto.name?.trim();
    if (dto.name !== undefined && !name)
      throw new BadRequestException("Informe um nome para a visao.");

    const record = await this.prisma.$transaction(async (tx) => {
      if (name && name !== current.name) {
        const duplicate = await tx.reportSavedView.findUnique({
          where: { ownerId_name: { ownerId: current.ownerId, name } },
          select: { id: true },
        });
        if (duplicate) throw new ConflictException("Ja existe uma visao com esse nome.");
      }
      if (dto.isDefault) await this.clearDefault(tx, current.ownerId);
      return tx.reportSavedView.update({
        where: { id },
        data: {
          name,
          description:
            dto.description === undefined ? undefined : dto.description.trim() || null,
          filters: dto.filters === undefined ? undefined : normalizeViewFilters(dto.filters),
          metricsJson:
            dto.metricsJson === undefined ? undefined : normalizeViewMetrics(dto.metricsJson),
          granularity:
            dto.granularity === undefined ? undefined : normalizeGranularity(dto.granularity),
          isDefault: dto.isDefault,
          shared: dto.shared,
        },
      });
    });

    if (record.shared && !current.shared)
      await this.eventBus.emit("report_view.shared", {
        entityId: record.id,
        actorId,
        name: record.name,
      });

    return { ...record, editable: true };
  }

  async remove(id: string, actorId: string, permissions: readonly string[]) {
    const current = await this.require(id);
    this.assertCanEdit(current, actorId, permissions);
    await this.prisma.reportSavedView.delete({ where: { id } });
    return { id, deleted: true };
  }

  private canEdit(
    view: { ownerId: string; shared: boolean },
    actorId: string,
    permissions: readonly string[],
  ) {
    if (view.shared)
      return view.ownerId === actorId || permissions.includes(PERMISSIONS.reports.manage);
    return view.ownerId === actorId;
  }

  private assertCanEdit(
    view: { ownerId: string; shared: boolean },
    actorId: string,
    permissions: readonly string[],
  ) {
    if (!this.canEdit(view, actorId, permissions))
      throw new ForbiddenException("Voce nao pode alterar esta visao.");
  }

  private async require(id: string) {
    const record = await this.prisma.reportSavedView.findUnique({ where: { id } });
    if (!record) throw new NotFoundException("Visao nao encontrada.");
    return record;
  }

  private async clearDefault(tx: Prisma.TransactionClient, ownerId: string) {
    await tx.reportSavedView.updateMany({
      where: { ownerId, isDefault: true },
      data: { isDefault: false },
    });
  }
}
