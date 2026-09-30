import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../../packages/database/src";
import {
  CreateElectoralZoneDto,
  UpdateElectoralZoneDto,
} from "./dto/electoral-zone.dto";

@Injectable()
export class ElectoralZonesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(electionId?: string, search?: string) {
    const zones = await this.prisma.electoralZone.findMany({
      where: {
        electionId,
        OR: search
          ? [
              { name: { contains: search, mode: "insensitive" } },
              { municipality: { contains: search, mode: "insensitive" } },
            ]
          : undefined,
      },
      include: {
        election: { select: { id: true, name: true, year: true } },
        pollingPlaces: { select: { _count: { select: { sections: true } } } },
      },
      orderBy: [{ number: "asc" }],
    });
    return zones.map(({ pollingPlaces, ...zone }) => ({
      ...zone,
      pollingPlaceCount: pollingPlaces.length,
      sectionCount: pollingPlaces.reduce(
        (total, place) => total + place._count.sections,
        0,
      ),
    }));
  }

  async findOne(id: string) {
    const zone = await this.prisma.electoralZone.findUnique({
      where: { id },
      include: {
        election: { select: { id: true, name: true, year: true } },
        pollingPlaces: {
          include: { _count: { select: { sections: true } } },
          orderBy: { name: "asc" },
        },
      },
    });
    if (!zone) throw new NotFoundException("Zona eleitoral não encontrada.");
    const { pollingPlaces, ...data } = zone;
    return {
      ...data,
      pollingPlaceCount: pollingPlaces.length,
      sectionCount: pollingPlaces.reduce(
        (total, place) => total + place._count.sections,
        0,
      ),
      pollingPlaces: pollingPlaces.map(({ _count, ...place }) => ({
        ...place,
        sectionCount: _count.sections,
      })),
    };
  }

  async create(dto: CreateElectoralZoneDto) {
    const election = await this.prisma.election.findUnique({
      where: { id: dto.electionId },
    });
    if (!election) throw new NotFoundException("Pleito não encontrado.");
    try {
      return await this.prisma.electoralZone.create({
        data: { ...dto, state: dto.state.toUpperCase() },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("O número da zona já existe neste pleito.");
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateElectoralZoneDto) {
    await this.findOne(id);
    return this.prisma.electoralZone.update({
      where: { id },
      data: { ...dto, state: dto.state?.toUpperCase() },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.electoralZone.delete({ where: { id } });
  }
}
