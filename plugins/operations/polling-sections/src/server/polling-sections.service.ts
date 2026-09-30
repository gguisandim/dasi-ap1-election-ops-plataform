import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../../packages/database/src";
import {
  CreatePollingSectionDto,
  UpdatePollingSectionDto,
} from "./dto/polling-section.dto";

const hierarchy = {
  pollingPlace: {
    select: {
      id: true,
      name: true,
      electoralZone: {
        select: {
          id: true,
          number: true,
          name: true,
          municipality: true,
          election: { select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.PollingSectionInclude;

@Injectable()
export class PollingSectionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(pollingPlaceId?: string) {
    return this.prisma.pollingSection.findMany({
      where: { pollingPlaceId },
      include: hierarchy,
      orderBy: { number: "asc" },
    });
  }

  async findOne(id: string) {
    const section = await this.prisma.pollingSection.findUnique({
      where: { id },
      include: hierarchy,
    });
    if (!section)
      throw new NotFoundException("Seção eleitoral não encontrada.");
    return section;
  }

  async create(dto: CreatePollingSectionDto) {
    const place = await this.prisma.pollingPlace.findUnique({
      where: { id: dto.pollingPlaceId },
    });
    if (!place) throw new NotFoundException("Local de votação não encontrado.");
    try {
      return await this.prisma.pollingSection.create({
        data: dto,
        include: hierarchy,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("O número da seção já existe neste local.");
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdatePollingSectionDto) {
    await this.findOne(id);
    return this.prisma.pollingSection.update({
      where: { id },
      data: dto,
      include: hierarchy,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.pollingSection.delete({ where: { id } });
  }
}
