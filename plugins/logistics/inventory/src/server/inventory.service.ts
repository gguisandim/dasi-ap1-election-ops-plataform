import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AssetCondition, AssetStatus, IncidentStatus, Prisma } from "@prisma/client";
import { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import { AssetQueryDto, CreateAssetDto, CreateAssetTypeDto, MoveAssetDto, UpdateAssetDto, UpdateAssetTypeDto } from "./dto/asset.dto";

const includeLocation = {
  type: true,
  electoralZone: { select: { id: true, number: true, name: true, municipality: true } },
  pollingPlace: { select: { id: true, name: true, city: true } },
} satisfies Prisma.AssetInclude;

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService, private readonly eventBus?: EventBus) {}

  private where(query: AssetQueryDto): Prisma.AssetWhereInput {
    return {
      typeId: query.typeId,
      status: query.status,
      condition: query.condition,
      electoralZoneId: query.zoneId,
      pollingPlaceId: query.pollingPlaceId,
      OR: query.search ? [
        { assetTag: { contains: query.search, mode: "insensitive" } },
        { name: { contains: query.search, mode: "insensitive" } },
        { serialNumber: { contains: query.search, mode: "insensitive" } },
        { manufacturer: { contains: query.search, mode: "insensitive" } },
        { model: { contains: query.search, mode: "insensitive" } },
      ] : undefined,
    };
  }

  async findAll(query: AssetQueryDto) {
    const where = this.where(query);
    const [items, total] = await Promise.all([
      this.prisma.asset.findMany({ where, include: includeLocation, orderBy: { assetTag: "asc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.asset.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) };
  }

  async dashboard() {
    const [total, unavailable, maintenance, inTransit, allocated] = await Promise.all([
      this.prisma.asset.count(),
      this.prisma.asset.count({ where: { condition: { in: [AssetCondition.DAMAGED, AssetCondition.UNAVAILABLE] } } }),
      this.prisma.asset.count({ where: { status: AssetStatus.MAINTENANCE } }),
      this.prisma.asset.count({ where: { status: AssetStatus.IN_TRANSIT } }),
      this.prisma.asset.count({ where: { status: { in: [AssetStatus.ALLOCATED, AssetStatus.IN_USE] } } }),
    ]);
    return { total, unavailable, maintenance, inTransit, allocated };
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        ...includeLocation,
        movements: { include: { fromZone: true, fromPollingPlace: true, toZone: true, toPollingPlace: true }, orderBy: { movedAt: "desc" } },
        assignments: { orderBy: { assignedAt: "desc" } },
        incidents: { where: { status: { notIn: [IncidentStatus.CLOSED, IncidentStatus.CANCELLED] } }, select: { id: true, code: true, title: true, severity: true, status: true } },
      },
    });
    if (!asset) throw new NotFoundException("Ativo não encontrado.");
    return asset;
  }

  private async validateLocation(electoralZoneId?: string, pollingPlaceId?: string) {
    const [zone, place] = await Promise.all([
      electoralZoneId ? this.prisma.electoralZone.findUnique({ where: { id: electoralZoneId } }) : null,
      pollingPlaceId ? this.prisma.pollingPlace.findUnique({ where: { id: pollingPlaceId } }) : null,
    ]);
    if (electoralZoneId && !zone) throw new NotFoundException("Zona eleitoral não encontrada.");
    if (pollingPlaceId && !place) throw new NotFoundException("Local de votação não encontrado.");
    if (zone && place && place.electoralZoneId !== zone.id) throw new BadRequestException("O local não pertence à zona informada.");
    return { zone, place };
  }

  async create(dto: CreateAssetDto, actorId?: string) {
    const type = await this.prisma.assetType.findUnique({ where: { id: dto.typeId } });
    if (!type?.active) throw new NotFoundException("Tipo de ativo não encontrado ou inativo.");
    const { place } = await this.validateLocation(dto.electoralZoneId, dto.pollingPlaceId);
    const electoralZoneId = place?.electoralZoneId ?? dto.electoralZoneId;
    try {
      const asset = await this.prisma.asset.create({ data: { ...dto, assetTag: dto.assetTag.toUpperCase(), electoralZoneId }, include: includeLocation });
      await this.eventBus?.emit("asset.created", { entityId: asset.id, actorId, assetTag: asset.assetTag, name: asset.name });
      return asset;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Já existe um ativo com esse patrimônio.");
      throw error;
    }
  }

  async update(id: string, dto: UpdateAssetDto, actorId?: string) {
    const current = await this.findOne(id);
    if (dto.typeId) {
      const type = await this.prisma.assetType.findUnique({ where: { id: dto.typeId } });
      if (!type?.active) throw new NotFoundException("Tipo de ativo não encontrado ou inativo.");
    }
    const asset = await this.prisma.asset.update({ where: { id }, data: dto, include: includeLocation });
    if (dto.status && dto.status !== current.status) await this.eventBus?.emit("asset.status_changed", { entityId: asset.id, actorId, assetTag: asset.assetTag, from: current.status, to: dto.status });
    return asset;
  }

  async move(id: string, dto: MoveAssetDto, actorId?: string) {
    const asset = await this.findOne(id);
    const { zone, place } = await this.validateLocation(dto.toZoneId, dto.toPollingPlaceId);
    const toZoneId = place?.electoralZoneId ?? zone?.id;
    const statusAfter = dto.statusAfter ?? (place ? AssetStatus.IN_USE : zone ? AssetStatus.ALLOCATED : AssetStatus.AVAILABLE);
    const originLabel = asset.pollingPlace?.name ?? (asset.electoralZone ? `Zona ${asset.electoralZone.number}` : "Depósito central");
    const destinationLabel = place?.name ?? (zone ? `Zona ${zone.number}` : "Depósito central");
    const movement = await this.prisma.$transaction(async (tx) => {
      await tx.assetAssignment.updateMany({ where: { assetId: id, endedAt: null }, data: { endedAt: new Date() } });
      const movement = await tx.assetMovement.create({
        data: {
          assetId: id, fromZoneId: asset.electoralZoneId, fromPollingPlaceId: asset.pollingPlaceId,
          toZoneId, toPollingPlaceId: place?.id, originLabel, destinationLabel,
          responsibleId: dto.responsibleId, responsibleName: dto.responsibleName, reason: dto.reason,
          statusBefore: asset.status, statusAfter, movedAt: dto.movedAt ? new Date(dto.movedAt) : undefined,
        },
      });
      await tx.asset.update({ where: { id }, data: { electoralZoneId: toZoneId, pollingPlaceId: place?.id ?? null, status: statusAfter } });
      await tx.assetAssignment.create({ data: { assetId: id, electoralZoneId: toZoneId, pollingPlaceId: place?.id, assignedToId: dto.responsibleId, assignedToName: dto.responsibleName } });
      return movement;
    });
    await this.eventBus?.emit("asset.moved", { entityId: asset.id, actorId, assetTag: asset.assetTag, origin: originLabel, destination: destinationLabel, responsibleName: dto.responsibleName });
    return movement;
  }

  async remove(id: string) { await this.findOne(id); await this.prisma.asset.delete({ where: { id } }); }
  listTypes() { return this.prisma.assetType.findMany({ orderBy: { name: "asc" } }); }
  async createType(dto: CreateAssetTypeDto) {
    try { return await this.prisma.assetType.create({ data: { ...dto, key: dto.key.toUpperCase() } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Já existe um tipo com essa chave."); throw error; }
  }
  async updateType(id: string, dto: UpdateAssetTypeDto) {
    const type = await this.prisma.assetType.findUnique({ where: { id } });
    if (!type) throw new NotFoundException("Tipo de ativo não encontrado.");
    return this.prisma.assetType.update({ where: { id }, data: dto });
  }
}
