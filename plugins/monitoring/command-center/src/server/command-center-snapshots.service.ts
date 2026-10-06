import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CommandCenterHealth, Prisma } from "@prisma/client";
import { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import {
  OPERATIONAL_THRESHOLDS,
  diffSnapshotMetrics,
  type OperationalHealth,
  type OperationalSnapshotPayload,
  type OperationalSummary,
} from "@eops/shared/command-center";
import type {
  CreateSnapshotDto,
  SnapshotQueryDto,
} from "./dto/command-center.dto";
import { CommandCenterService } from "./command-center.service";

/**
 * Extrai somente os agregados permitidos de um summary já filtrado por
 * permissão. Nada além de métricas, itens mais relevantes e resumo por zona é
 * persistido — a SPEC proíbe copiar listas completas de entidades para o JSON.
 */
export function buildSnapshotPayload(
  summary: OperationalSummary,
  zoneSummaries: Array<{
    zoneId: string;
    zoneName: string;
    health: OperationalHealth;
    itemCount: number;
  }>,
): OperationalSnapshotPayload {
  const ranked = [...summary.criticalItems, ...summary.warnings];
  return {
    scope: summary.scope,
    health: summary.health,
    metrics: summary.metrics,
    topItems: ranked.slice(0, OPERATIONAL_THRESHOLDS.snapshotTopItems),
    zones: zoneSummaries,
  };
}

/** Métricas numéricas comparáveis entre dois snapshots. */
export function comparableMetrics(
  payload: unknown,
): Record<string, number> {
  if (!payload || typeof payload !== "object") return {};
  const metrics = (payload as { metrics?: unknown }).metrics;
  if (!metrics || typeof metrics !== "object") return {};
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(metrics)) {
    if (typeof value === "number") result[key] = value;
  }
  return result;
}

@Injectable()
export class CommandCenterSnapshotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
    private readonly commandCenter: CommandCenterService,
  ) {}

  async list(query: SnapshotQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.CommandCenterSnapshotWhereInput = {
      electionId: query.electionId,
      electoralZoneId: query.electoralZoneId,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.commandCenterSnapshot.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          health: true,
          electionId: true,
          electoralZoneId: true,
          createdAt: true,
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.commandCenterSnapshot.count({ where }),
    ]);
    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOne(id: string) {
    const record = await this.prisma.commandCenterSnapshot.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        election: { select: { id: true, name: true } },
        electoralZone: { select: { id: true, name: true, number: true } },
      },
    });
    if (!record) throw new NotFoundException("Snapshot não encontrado.");
    return record;
  }

  /** Compara um snapshot com o estado atual, usando apenas deltas de métricas. */
  async compare(id: string, permissions: readonly string[]) {
    const snapshot = await this.findOne(id);
    const payload = snapshot.payload as unknown as OperationalSnapshotPayload;
    const scope = payload?.scope ?? {};
    const current = await this.commandCenter.summary(permissions, scope);
    const before = comparableMetrics(payload);
    const after = comparableMetrics({
      metrics: current.metrics,
    } satisfies Partial<OperationalSummary>);
    return {
      snapshot: {
        id: snapshot.id,
        name: snapshot.name,
        createdAt: snapshot.createdAt,
        health: snapshot.health,
      },
      current: { generatedAt: current.generatedAt, health: current.health },
      deltas: diffSnapshotMetrics(before, after),
    };
  }

  async create(
    dto: CreateSnapshotDto,
    actorId: string,
    permissions: readonly string[],
  ) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException("Informe um nome para o snapshot.");
    const scope = {
      electionId: dto.electionId,
      electoralZoneId: dto.electoralZoneId,
    };
    const [summary, zones] = await Promise.all([
      this.commandCenter.summary(permissions, scope),
      this.commandCenter.zones(permissions, scope),
    ]);
    const payload = buildSnapshotPayload(
      summary,
      zones.zones.slice(0, 50).map((zone) => ({
        zoneId: zone.zoneId,
        zoneName: zone.zoneName,
        health: zone.health,
        itemCount: zone.itemCount,
      })),
    );

    const record = await this.prisma.commandCenterSnapshot.create({
      data: {
        createdById: actorId,
        name,
        description: dto.description?.trim() || null,
        electionId: dto.electionId ?? null,
        electoralZoneId: dto.electoralZoneId ?? null,
        health: summary.health as CommandCenterHealth,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });

    await this.eventBus.emit("command_center.snapshot_created", {
      entityId: record.id,
      actorId,
      name: record.name,
      health: record.health,
      electionId: record.electionId,
      electoralZoneId: record.electoralZoneId,
    });

    return record;
  }
}
