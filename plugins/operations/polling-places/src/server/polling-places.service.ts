import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../../packages/database/src";
import {
  CreatePollingPlaceDto,
  PollingPlaceQueryDto,
  UpdatePollingPlaceDto,
} from "./dto/polling-place.dto";

const includeRelations = {
  electoralZone: {
    select: {
      id: true,
      number: true,
      name: true,
      municipality: true,
      election: { select: { id: true, name: true } },
    },
  },
  sections: { select: { registeredVoters: true } },
} satisfies Prisma.PollingPlaceInclude;

function serializePlace(
  place: Prisma.PollingPlaceGetPayload<{ include: typeof includeRelations }>,
) {
  return {
    ...place,
    latitude: place.latitude === null ? null : Number(place.latitude),
    longitude: place.longitude === null ? null : Number(place.longitude),
    sectionCount: place.sections.length,
    registeredVoters: place.sections.reduce(
      (total, section) => total + section.registeredVoters,
      0,
    ),
    sections: undefined,
  };
}

@Injectable()
export class PollingPlacesService {
  constructor(private readonly prisma: PrismaService) {}

  private where(query: PollingPlaceQueryDto): Prisma.PollingPlaceWhereInput {
    return {
      electoralZoneId: query.zoneId,
      monitoringStatus: query.status,
      city: query.municipality,
      electoralZone: query.electionId
        ? { electionId: query.electionId }
        : undefined,
      OR: query.search
        ? [
            { name: { contains: query.search, mode: "insensitive" } },
            { address: { contains: query.search, mode: "insensitive" } },
            { district: { contains: query.search, mode: "insensitive" } },
            { city: { contains: query.search, mode: "insensitive" } },
          ]
        : undefined,
    };
  }

  async findAll(query: PollingPlaceQueryDto) {
    const where = this.where(query);
    const [items, total] = await Promise.all([
      this.prisma.pollingPlace.findMany({
        where,
        include: includeRelations,
        orderBy: { name: "asc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.pollingPlace.count({ where }),
    ]);
    return {
      items: items.map(serializePlace),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async findForMap(query: PollingPlaceQueryDto) {
    const items = await this.prisma.pollingPlace.findMany({
      where: {
        ...this.where(query),
        latitude: { not: null },
        longitude: { not: null },
      },
      include: includeRelations,
      orderBy: { name: "asc" },
    });
    return items.map(serializePlace);
  }

  async findOne(id: string) {
    const place = await this.prisma.pollingPlace.findUnique({
      where: { id },
      include: {
        ...includeRelations,
        sections: {
          select: {
            id: true,
            number: true,
            registeredVoters: true,
            status: true,
          },
          orderBy: { number: "asc" },
        },
      },
    });
    if (!place) throw new NotFoundException("Local de votação não encontrado.");
    return {
      ...place,
      latitude: place.latitude === null ? null : Number(place.latitude),
      longitude: place.longitude === null ? null : Number(place.longitude),
      sectionCount: place.sections.length,
      registeredVoters: place.sections.reduce(
        (total, section) => total + section.registeredVoters,
        0,
      ),
    };
  }

  async create(dto: CreatePollingPlaceDto) {
    const zone = await this.prisma.electoralZone.findUnique({
      where: { id: dto.electoralZoneId },
    });
    if (!zone) throw new NotFoundException("Zona eleitoral não encontrada.");
    return this.prisma.pollingPlace.create({
      data: { ...dto, state: dto.state.toUpperCase() },
    });
  }

  async update(id: string, dto: UpdatePollingPlaceDto) {
    await this.findOne(id);
    return this.prisma.pollingPlace.update({
      where: { id },
      data: { ...dto, state: dto.state?.toUpperCase() },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.pollingPlace.delete({ where: { id } });
  }
}
