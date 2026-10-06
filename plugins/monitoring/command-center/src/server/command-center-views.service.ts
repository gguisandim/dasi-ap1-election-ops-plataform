import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CommandCenterLayoutMode, Prisma } from "@prisma/client";
import { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import { PERMISSIONS } from "@eops/security";
import { OPERATIONAL_THRESHOLDS } from "@eops/shared/command-center";
import type {
  CreateSavedViewDto,
  UpdateSavedViewDto,
} from "./dto/command-center.dto";

const ALLOWED_FILTER_KEYS = new Set([
  "severity",
  "sourceType",
  "electionId",
  "electoralZoneId",
  "statusState",
]);

/**
 * Normaliza e restringe os filtros aceitos por uma saved view. Qualquer chave
 * fora do contrato é rejeitada: o filtro é persistido como JSON e não pode
 * virar um canal para armazenar dados arbitrários.
 */
export function normalizeViewFilters(
  filters: Record<string, unknown> | undefined,
): Prisma.InputJsonValue {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(filters ?? {})) {
    if (!ALLOWED_FILTER_KEYS.has(key))
      throw new BadRequestException(`Filtro não suportado: ${key}.`);
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      result[key] = value.trim();
      continue;
    }
    if (
      Array.isArray(value) &&
      value.every((entry) => typeof entry === "string")
    ) {
      result[key] = [...new Set(value.map((entry) => entry.trim()))].filter(
        Boolean,
      );
      continue;
    }
    throw new BadRequestException(`Valor inválido para o filtro ${key}.`);
  }
  return result as Prisma.InputJsonValue;
}

export function normalizeRefreshSeconds(value?: number): number {
  const { min, max, default: fallback } =
    OPERATIONAL_THRESHOLDS.viewRefreshSeconds;
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < min || value > max)
    throw new BadRequestException(
      `O intervalo de atualização deve estar entre ${min} e ${max} segundos.`,
    );
  return value;
}

@Injectable()
export class CommandCenterViewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async list(actorId: string, permissions: readonly string[]) {
    const items = await this.prisma.commandCenterSavedView.findMany({
      // Visões privadas são visíveis apenas para o owner; compartilhadas são
      // visíveis para qualquer usuário com command-center.read.
      where: { OR: [{ ownerId: actorId }, { shared: true }] },
      include: { owner: { select: { id: true, name: true } } },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
    return items.map((item) => ({
      ...item,
      editable: this.canEdit(item, actorId, permissions),
    }));
  }

  async create(
    dto: CreateSavedViewDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    const total = await this.prisma.commandCenterSavedView.count({
      where: { ownerId: actorId },
    });
    if (total >= OPERATIONAL_THRESHOLDS.maxViewsPerOwner)
      throw new ConflictException(
        `Limite de ${OPERATIONAL_THRESHOLDS.maxViewsPerOwner} visões por usuário atingido.`,
      );
    const name = dto.name.trim();
    if (!name) throw new BadRequestException("Informe um nome para a visão.");
    const shared = dto.shared ?? false;
    if (shared && !permissions.includes(PERMISSIONS.commandCenter.manage))
      throw new ForbiddenException(
        "Somente quem gerencia o Command Center pode compartilhar visões.",
      );
    const filters = normalizeViewFilters(dto.filters);
    const refreshSeconds = normalizeRefreshSeconds(dto.refreshSeconds);
    const layoutMode = dto.layoutMode ?? CommandCenterLayoutMode.STANDARD;
    const isDefault = dto.isDefault ?? false;

    const record = await this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.commandCenterSavedView.findUnique({
        where: { ownerId_name: { ownerId: actorId, name } },
        select: { id: true },
      });
      if (duplicate)
        throw new ConflictException("Já existe uma visão com esse nome.");
      if (isDefault) await this.clearDefault(tx, actorId);
      return tx.commandCenterSavedView.create({
        data: {
          ownerId: actorId,
          name,
          description: dto.description?.trim() || null,
          filters,
          refreshSeconds,
          layoutMode,
          isDefault,
          shared,
        },
      });
    });

    if (record.shared)
      await this.eventBus.emit("command_center.shared_view_created", {
        entityId: record.id,
        actorId,
        name: record.name,
        layoutMode: record.layoutMode,
      });

    return { ...record, editable: true };
  }

  async update(
    id: string,
    dto: UpdateSavedViewDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    const current = await this.require(id);
    this.assertCanEdit(current, actorId, permissions);
    if (dto.shared === true && !permissions.includes(PERMISSIONS.commandCenter.manage))
      throw new ForbiddenException(
        "Somente quem gerencia o Command Center pode compartilhar visões.",
      );
    const name = dto.name?.trim();
    if (dto.name !== undefined && !name)
      throw new BadRequestException("Informe um nome para a visão.");

    const record = await this.prisma.$transaction(async (tx) => {
      if (name && name !== current.name) {
        const duplicate = await tx.commandCenterSavedView.findUnique({
          where: { ownerId_name: { ownerId: current.ownerId, name } },
          select: { id: true },
        });
        if (duplicate)
          throw new ConflictException("Já existe uma visão com esse nome.");
      }
      if (dto.isDefault) await this.clearDefault(tx, current.ownerId);
      return tx.commandCenterSavedView.update({
        where: { id },
        data: {
          name,
          description:
            dto.description === undefined
              ? undefined
              : dto.description.trim() || null,
          filters:
            dto.filters === undefined
              ? undefined
              : normalizeViewFilters(dto.filters),
          refreshSeconds:
            dto.refreshSeconds === undefined
              ? undefined
              : normalizeRefreshSeconds(dto.refreshSeconds),
          layoutMode: dto.layoutMode,
          isDefault: dto.isDefault,
          shared: dto.shared,
        },
      });
    });

    if (record.shared && !current.shared)
      await this.eventBus.emit("command_center.shared_view_created", {
        entityId: record.id,
        actorId,
        name: record.name,
        layoutMode: record.layoutMode,
      });

    return { ...record, editable: true };
  }

  async remove(id: string, actorId: string, permissions: readonly string[]) {
    const current = await this.require(id);
    this.assertCanEdit(current, actorId, permissions);
    await this.prisma.commandCenterSavedView.delete({ where: { id } });
    return { id, deleted: true };
  }

  private canEdit(
    view: { ownerId: string; shared: boolean },
    actorId: string,
    permissions: readonly string[],
  ) {
    if (view.shared)
      return (
        view.ownerId === actorId ||
        permissions.includes(PERMISSIONS.commandCenter.manage)
      );
    return view.ownerId === actorId;
  }

  private assertCanEdit(
    view: { ownerId: string; shared: boolean },
    actorId: string,
    permissions: readonly string[],
  ) {
    if (!this.canEdit(view, actorId, permissions))
      throw new ForbiddenException("Você não pode alterar esta visão.");
  }

  private async require(id: string) {
    const record = await this.prisma.commandCenterSavedView.findUnique({
      where: { id },
    });
    if (!record) throw new NotFoundException("Visão não encontrada.");
    return record;
  }

  private async clearDefault(tx: Prisma.TransactionClient, ownerId: string) {
    await tx.commandCenterSavedView.updateMany({
      where: { ownerId, isDefault: true },
      data: { isDefault: false },
    });
  }
}
