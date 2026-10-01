import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../../packages/database/src";
import { EventBus } from "../../../../../packages/event-bus/src";
import {
  CreateElectionDto,
  CreateRoundDto,
  UpdateElectionDto,
  UpdateRoundDto,
} from "./dto/election.dto";

@Injectable()
export class ElectionsService {
  constructor(private readonly prisma: PrismaService, private readonly eventBus?: EventBus) {}

  async findAll() {
    const elections = await this.prisma.election.findMany({
      include: {
        rounds: { orderBy: { roundNumber: "asc" } },
        _count: { select: { zones: true } },
      },
      orderBy: [{ year: "desc" }, { name: "asc" }],
    });
    return Promise.all(
      elections.map(async ({ _count, ...election }) => {
        const [pollingPlaceCount, sectionCount] = await Promise.all([
          this.prisma.pollingPlace.count({
            where: { electoralZone: { electionId: election.id } },
          }),
          this.prisma.pollingSection.count({
            where: {
              pollingPlace: { electoralZone: { electionId: election.id } },
            },
          }),
        ]);
        return {
          ...election,
          zoneCount: _count.zones,
          pollingPlaceCount,
          sectionCount,
        };
      }),
    );
  }

  async findOne(id: string) {
    const election = await this.prisma.election.findUnique({
      where: { id },
      include: {
        rounds: { orderBy: { roundNumber: "asc" } },
        _count: { select: { zones: true } },
      },
    });
    if (!election) throw new NotFoundException("Pleito não encontrado.");
    const { _count, ...data } = election;
    const [pollingPlaceCount, sectionCount] = await Promise.all([
      this.prisma.pollingPlace.count({
        where: { electoralZone: { electionId: id } },
      }),
      this.prisma.pollingSection.count({
        where: { pollingPlace: { electoralZone: { electionId: id } } },
      }),
    ]);
    return {
      ...data,
      zoneCount: _count.zones,
      pollingPlaceCount,
      sectionCount,
    };
  }

  async create(dto: CreateElectionDto) {
    const { rounds, ...data } = dto;
    const election = await this.prisma.election.create({
      data: {
        ...data,
        rounds: rounds
          ? {
              create: rounds.map((round) => ({
                ...round,
                date: new Date(round.date),
              })),
            }
          : undefined,
      },
      include: { rounds: true },
    });
    await this.eventBus?.emit("election.created", { entityId: election.id, name: election.name, year: election.year });
    return election;
  }

  async update(id: string, dto: UpdateElectionDto) {
    await this.findOne(id);
    return this.prisma.election.update({
      where: { id },
      data: dto,
      include: { rounds: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.election.delete({ where: { id } });
  }

  async createRound(electionId: string, dto: CreateRoundDto) {
    await this.findOne(electionId);
    try {
      return await this.prisma.electionRound.create({
        data: { ...dto, electionId, date: new Date(dto.date) },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "Já existe um turno com esse número no pleito.",
        );
      }
      throw error;
    }
  }

  async updateRound(id: string, dto: UpdateRoundDto) {
    const round = await this.prisma.electionRound.findUnique({ where: { id } });
    if (!round) throw new NotFoundException("Turno não encontrado.");
    return this.prisma.electionRound.update({
      where: { id },
      data: { ...dto, date: dto.date ? new Date(dto.date) : undefined },
    });
  }

  async removeRound(id: string) {
    const round = await this.prisma.electionRound.findUnique({ where: { id } });
    if (!round) throw new NotFoundException("Turno não encontrado.");
    await this.prisma.electionRound.delete({ where: { id } });
  }
}
