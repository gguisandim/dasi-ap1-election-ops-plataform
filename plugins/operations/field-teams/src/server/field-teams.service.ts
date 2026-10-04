import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FieldAllocationStatus,
  FieldCheckType,
  FieldShiftAssignmentStatus,
  FieldShiftStatus,
  FieldTeamStatus,
  MemberAvailability,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import {
  AvailabilityQueryDto,
  CreateAllocationDto,
  CreateCheckDto,
  CreateMemberDto,
  CreateRoleDto,
  CreateSpecialtyDto,
  CreateTeamDto,
  CreateUnavailabilityDto,
  FieldTeamsQueryDto,
  UpdateCatalogDto,
  UpdateMemberDto,
  UpdateTeamDto,
  UpdateUnavailabilityDto,
} from "./dto/field-teams.dto";

const memberInclude = {
  role: true,
  specialties: { include: { specialty: true } },
  unavailability: { orderBy: { startsAt: "desc" as const } },
} satisfies Prisma.FieldMemberInclude;

const teamInclude = {
  election: { select: { id: true, name: true, year: true } },
  members: { include: memberInclude, orderBy: { name: "asc" as const } },
  allocations: {
    include: { member: true, electoralZone: true, pollingPlace: true },
    orderBy: { startsAt: "desc" as const },
  },
} satisfies Prisma.FieldTeamInclude;

export function resolveAvailability(
  status: MemberAvailability,
  unavailable: boolean,
  assignments: readonly {
    status: FieldShiftAssignmentStatus;
    onCallActivatedAt: Date | null;
  }[],
) {
  if (unavailable) return MemberAvailability.UNAVAILABLE;
  if (
    assignments.some(
      (item) =>
        item.status === FieldShiftAssignmentStatus.PRESENT ||
        (item.status === FieldShiftAssignmentStatus.ON_CALL &&
          item.onCallActivatedAt),
    )
  )
    return MemberAvailability.ON_DUTY;
  if (assignments.length) return MemberAvailability.ASSIGNED;
  return status;
}

@Injectable()
export class FieldTeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus?: EventBus,
  ) {}

  findAll(query: FieldTeamsQueryDto) {
    return this.prisma.fieldTeam.findMany({
      where: {
        electionId: query.electionId,
        status: query.status,
        allocations:
          query.zoneId || query.pollingPlaceId
            ? {
                some: {
                  electoralZoneId: query.zoneId,
                  pollingPlaceId: query.pollingPlaceId,
                },
              }
            : undefined,
      },
      include: teamInclude,
      orderBy: { name: "asc" },
    });
  }

  async findOne(id: string) {
    const team = await this.prisma.fieldTeam.findUnique({
      where: { id },
      include: teamInclude,
    });
    if (!team) throw new NotFoundException("Equipe não encontrada.");
    return team;
  }

  async dashboard(query: FieldTeamsQueryDto) {
    const now = new Date();
    const allocationWhere = {
      electionId: query.electionId,
      electoralZoneId: query.zoneId,
      pollingPlaceId: query.pollingPlaceId,
      status: FieldAllocationStatus.ACTIVE,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gte: now } }],
    };
    const [activeTeams, members, zones, places, allocations] =
      await Promise.all([
        this.prisma.fieldTeam.count({
          where: {
            electionId: query.electionId,
            status: FieldTeamStatus.ACTIVE,
          },
        }),
        this.prisma.fieldMember.findMany({
          where: { team: { electionId: query.electionId } },
          select: {
            status: true,
            specialties: { select: { specialtyId: true } },
            unavailability: {
              where: { startsAt: { lte: now }, endsAt: { gt: now } },
              select: { id: true },
            },
            shiftAssignments: {
              where: {
                startsAt: { lte: now },
                endsAt: { gt: now },
                status: {
                  notIn: [
                    FieldShiftAssignmentStatus.ABSENT,
                    FieldShiftAssignmentStatus.REPLACED,
                  ],
                },
                shift: { status: { not: FieldShiftStatus.CANCELLED } },
              },
              select: { status: true, onCallActivatedAt: true },
            },
            allocations: {
              where: {
                status: FieldAllocationStatus.ACTIVE,
                startsAt: { lte: now },
                OR: [{ endsAt: null }, { endsAt: { gt: now } }],
              },
              select: { id: true },
            },
          },
        }),
        this.prisma.electoralZone.findMany({
          where: { electionId: query.electionId, id: query.zoneId },
          select: { id: true },
        }),
        this.prisma.pollingPlace.findMany({
          where: {
            id: query.pollingPlaceId,
            electoralZoneId: query.zoneId,
            electoralZone: { electionId: query.electionId },
          },
          select: { id: true },
        }),
        this.prisma.fieldAllocation.findMany({
          where: allocationWhere,
          select: { electoralZoneId: true, pollingPlaceId: true },
        }),
      ]);
    const coveredZones = new Set(
      allocations.map((item) => item.electoralZoneId).filter(Boolean),
    );
    const coveredPlaces = new Set(
      allocations.map((item) => item.pollingPlaceId).filter(Boolean),
    );
    const effectiveStatuses = members.map((item) =>
      resolveAvailability(
        item.status,
        item.unavailability.length > 0,
        item.shiftAssignments,
      ),
    );
    return {
      activeTeams,
      availablePeople: effectiveStatuses.filter(
        (status) => status === MemberAvailability.AVAILABLE,
      ).length,
      unavailablePeople: effectiveStatuses.filter(
        (status) =>
          status === MemberAvailability.UNAVAILABLE ||
          status === MemberAvailability.OFF_DUTY,
      ).length,
      onDutyPeople: effectiveStatuses.filter(
        (status) => status === MemberAvailability.ON_DUTY,
      ).length,
      unallocatedPeople: members.filter((item) => !item.allocations.length)
        .length,
      peopleWithoutSpecialties: members.filter(
        (item) => !item.specialties.length,
      ).length,
      uncoveredZones: zones.filter((item) => !coveredZones.has(item.id)).length,
      uncoveredPlaces: places.filter((item) => !coveredPlaces.has(item.id))
        .length,
    };
  }

  async createTeam(dto: CreateTeamDto) {
    if (
      !(await this.prisma.election.findUnique({
        where: { id: dto.electionId },
      }))
    ) {
      throw new NotFoundException("Pleito não encontrado.");
    }
    try {
      return await this.prisma.fieldTeam.create({
        data: { ...dto, code: dto.code.toUpperCase() },
        include: teamInclude,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Código de equipe já cadastrado.");
      }
      throw error;
    }
  }

  async updateTeam(id: string, dto: UpdateTeamDto) {
    await this.findOne(id);
    return this.prisma.fieldTeam.update({
      where: { id },
      data: dto,
      include: teamInclude,
    });
  }

  listMembers(teamId?: string, status?: MemberAvailability) {
    return this.prisma.fieldMember.findMany({
      where: { teamId, status },
      include: { ...memberInclude, team: { include: { election: true } } },
      orderBy: { name: "asc" },
    });
  }

  async findMember(id: string) {
    const member = await this.prisma.fieldMember.findUnique({
      where: { id },
      include: { ...memberInclude, team: { include: { election: true } } },
    });
    if (!member) throw new NotFoundException("Membro não encontrado.");
    return member;
  }

  async createMember(dto: CreateMemberDto) {
    const [team, role, specialtyCount] = await Promise.all([
      this.prisma.fieldTeam.findUnique({ where: { id: dto.teamId } }),
      this.prisma.fieldRole.findUnique({ where: { id: dto.roleId } }),
      this.prisma.fieldSpecialty.count({
        where: { id: { in: dto.specialtyIds ?? [] }, active: true },
      }),
    ]);
    if (!team) throw new NotFoundException("Equipe não encontrada.");
    if (!role?.active)
      throw new NotFoundException("Função não encontrada ou inativa.");
    if (specialtyCount !== (dto.specialtyIds ?? []).length)
      throw new BadRequestException(
        "Uma ou mais especialidades são inválidas.",
      );
    const { specialtyIds, ...data } = dto;
    return this.prisma.fieldMember.create({
      data: {
        ...data,
        specialties: {
          create: (specialtyIds ?? []).map((specialtyId) => ({ specialtyId })),
        },
      },
      include: memberInclude,
    });
  }

  async updateMember(id: string, dto: UpdateMemberDto, actorId: string) {
    const current = await this.prisma.fieldMember.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Membro não encontrado.");
    if (dto.specialtyIds) {
      const count = await this.prisma.fieldSpecialty.count({
        where: { id: { in: dto.specialtyIds }, active: true },
      });
      if (count !== dto.specialtyIds.length)
        throw new BadRequestException(
          "Uma ou mais especialidades são inválidas.",
        );
    }
    const { specialtyIds, ...data } = dto;
    const member = await this.prisma.$transaction(async (tx) => {
      await tx.fieldMember.update({ where: { id }, data });
      if (specialtyIds) {
        await tx.fieldMemberSpecialty.deleteMany({ where: { memberId: id } });
        await tx.fieldMemberSpecialty.createMany({
          data: specialtyIds.map((specialtyId) => ({
            memberId: id,
            specialtyId,
          })),
          skipDuplicates: true,
        });
      }
      return tx.fieldMember.findUniqueOrThrow({
        where: { id },
        include: memberInclude,
      });
    });
    if (dto.status && dto.status !== current.status) {
      await this.eventBus?.emit("field_member.availability_changed", {
        entityId: id,
        actorId,
        memberName: member.name,
        from: current.status,
        to: dto.status,
      });
    }
    if (specialtyIds) {
      await this.eventBus?.emit("field_member.specialty_changed", {
        entityId: id,
        actorId,
        memberName: member.name,
        specialtyIds,
      });
    }
    return member;
  }

  async availability(query: AvailabilityQueryDto) {
    const startsAt = query.startsAt ? new Date(query.startsAt) : new Date();
    const endsAt = query.endsAt
      ? new Date(query.endsAt)
      : new Date(startsAt.getTime() + 1);
    this.validateInterval(startsAt, endsAt);
    const members = await this.prisma.fieldMember.findMany({
      where: { teamId: query.teamId },
      include: {
        role: true,
        team: true,
        specialties: { include: { specialty: true } },
        unavailability: {
          where: { startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
          orderBy: { startsAt: "asc" },
        },
        shiftAssignments: {
          where: {
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
            status: {
              notIn: [
                FieldShiftAssignmentStatus.ABSENT,
                FieldShiftAssignmentStatus.REPLACED,
              ],
            },
            shift: { status: { not: FieldShiftStatus.CANCELLED } },
          },
          select: {
            id: true,
            status: true,
            onCallActivatedAt: true,
            startsAt: true,
            endsAt: true,
            shiftId: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
    return members.map((member) => ({
      ...member,
      effectiveStatus: resolveAvailability(
        member.status,
        member.unavailability.length > 0,
        member.shiftAssignments,
      ),
    }));
  }

  async capabilities(teamId: string) {
    await this.findOne(teamId);
    const specialties = await this.prisma.fieldSpecialty.findMany({
      where: { active: true },
      include: {
        members: {
          where: {
            member: {
              teamId,
              status: {
                notIn: [
                  MemberAvailability.UNAVAILABLE,
                  MemberAvailability.OFF_DUTY,
                ],
              },
            },
          },
          include: {
            member: { select: { id: true, name: true, status: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    });
    return specialties.map((specialty) => ({
      id: specialty.id,
      key: specialty.key,
      name: specialty.name,
      memberCount: specialty.members.length,
      members: specialty.members.map((item) => item.member),
    }));
  }

  async createUnavailability(
    memberId: string,
    dto: CreateUnavailabilityDto,
    actorId: string,
  ) {
    const member = await this.findMember(memberId);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    this.validateInterval(startsAt, endsAt);
    await this.ensureNoUnavailabilityConflict(memberId, startsAt, endsAt);
    const period = await this.prisma.fieldMemberUnavailability.create({
      data: {
        memberId,
        startsAt,
        endsAt,
        reason: dto.reason,
        notes: dto.notes,
        actorId,
      },
      include: { actor: { select: { id: true, name: true } } },
    });
    await this.eventBus?.emit("field_member.unavailability_created", {
      entityId: period.id,
      actorId,
      memberId,
      memberName: member.name,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      reason: dto.reason,
    });
    return period;
  }

  async updateUnavailability(
    memberId: string,
    periodId: string,
    dto: UpdateUnavailabilityDto,
    actorId: string,
  ) {
    const [member, current] = await Promise.all([
      this.findMember(memberId),
      this.prisma.fieldMemberUnavailability.findFirst({
        where: { id: periodId, memberId },
      }),
    ]);
    if (!current)
      throw new NotFoundException(
        "Período de indisponibilidade não encontrado.",
      );
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : current.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : current.endsAt;
    this.validateInterval(startsAt, endsAt);
    await this.ensureNoUnavailabilityConflict(
      memberId,
      startsAt,
      endsAt,
      periodId,
    );
    const period = await this.prisma.fieldMemberUnavailability.update({
      where: { id: periodId },
      data: { ...dto, startsAt, endsAt, actorId },
      include: { actor: { select: { id: true, name: true } } },
    });
    await this.eventBus?.emit("field_member.unavailability_created", {
      entityId: period.id,
      actorId,
      memberId,
      memberName: member.name,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      reason: period.reason,
    });
    return period;
  }

  async removeUnavailability(
    memberId: string,
    periodId: string,
    actorId: string,
  ) {
    const [member, period] = await Promise.all([
      this.findMember(memberId),
      this.prisma.fieldMemberUnavailability.findFirst({
        where: { id: periodId, memberId },
      }),
    ]);
    if (!period)
      throw new NotFoundException(
        "Período de indisponibilidade não encontrado.",
      );
    await this.prisma.fieldMemberUnavailability.delete({
      where: { id: periodId },
    });
    await this.eventBus?.emit("field_member.unavailability_removed", {
      entityId: period.id,
      actorId,
      memberId,
      memberName: member.name,
      startsAt: period.startsAt.toISOString(),
      endsAt: period.endsAt.toISOString(),
      reason: period.reason,
    });
    return { id: periodId, removed: true };
  }

  roles() {
    return this.prisma.fieldRole.findMany({ orderBy: { name: "asc" } });
  }

  specialties() {
    return this.prisma.fieldSpecialty.findMany({ orderBy: { name: "asc" } });
  }

  async createRole(dto: CreateRoleDto) {
    try {
      return await this.prisma.fieldRole.create({
        data: { ...dto, key: dto.key.toUpperCase() },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException("Função já cadastrada.");
      throw error;
    }
  }

  async createSpecialty(dto: CreateSpecialtyDto) {
    try {
      return await this.prisma.fieldSpecialty.create({
        data: { ...dto, key: dto.key.toUpperCase() },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException("Especialidade já cadastrada.");
      throw error;
    }
  }

  updateRole(id: string, dto: UpdateCatalogDto) {
    return this.prisma.fieldRole.update({ where: { id }, data: dto });
  }

  updateSpecialty(id: string, dto: UpdateCatalogDto) {
    return this.prisma.fieldSpecialty.update({ where: { id }, data: dto });
  }

  allocations(query: FieldTeamsQueryDto) {
    return this.prisma.fieldAllocation.findMany({
      where: {
        electionId: query.electionId,
        electoralZoneId: query.zoneId,
        pollingPlaceId: query.pollingPlaceId,
      },
      include: {
        team: true,
        member: true,
        electoralZone: true,
        pollingPlace: true,
      },
      orderBy: { startsAt: "desc" },
    });
  }

  async createAllocation(dto: CreateAllocationDto, actorId?: string) {
    if (!dto.teamId && !dto.memberId)
      throw new BadRequestException("Informe uma equipe ou um membro.");
    if (
      !dto.electoralZoneId &&
      !dto.pollingPlaceId &&
      !dto.routeId &&
      !dto.activity
    )
      throw new BadRequestException("Informe zona, local, rota ou atividade.");
    const [team, member] = await Promise.all([
      dto.teamId
        ? this.prisma.fieldTeam.findUnique({ where: { id: dto.teamId } })
        : null,
      dto.memberId
        ? this.prisma.fieldMember.findUnique({
            where: { id: dto.memberId },
            include: { team: true },
          })
        : null,
    ]);
    if (dto.teamId && (!team || team.electionId !== dto.electionId))
      throw new BadRequestException("Equipe incompatível com o pleito.");
    if (dto.memberId && (!member || member.team.electionId !== dto.electionId))
      throw new BadRequestException("Membro incompatível com o pleito.");
    await this.validateLocation(
      dto.electoralZoneId,
      dto.pollingPlaceId,
      dto.electionId,
    );
    const allocation = await this.prisma.fieldAllocation.create({
      data: {
        ...dto,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      },
      include: {
        team: true,
        member: true,
        electoralZone: true,
        pollingPlace: true,
      },
    });
    if (dto.memberId) {
      await this.prisma.fieldMember.update({
        where: { id: dto.memberId },
        data: {
          status:
            dto.status === FieldAllocationStatus.ACTIVE
              ? MemberAvailability.ON_DUTY
              : MemberAvailability.ASSIGNED,
        },
      });
    } else if (dto.teamId) {
      await this.prisma.fieldMember.updateMany({
        where: {
          teamId: dto.teamId,
          status: MemberAvailability.AVAILABLE,
        },
        data: {
          status:
            dto.status === FieldAllocationStatus.ACTIVE
              ? MemberAvailability.ON_DUTY
              : MemberAvailability.ASSIGNED,
        },
      });
    }
    await this.eventBus?.emit("field_team.allocated", {
      entityId: allocation.id,
      actorId,
      teamId: dto.teamId,
      memberId: dto.memberId,
      electionId: dto.electionId,
      electoralZoneId: dto.electoralZoneId,
      pollingPlaceId: dto.pollingPlaceId,
      routeId: dto.routeId,
    });
    return allocation;
  }

  checks(query: FieldTeamsQueryDto) {
    return this.prisma.fieldCheckEvent.findMany({
      where: {
        electoralZoneId: query.zoneId,
        pollingPlaceId: query.pollingPlaceId,
        member: { team: { electionId: query.electionId } },
      },
      include: {
        member: { include: { team: true, role: true } },
        electoralZone: true,
        pollingPlace: true,
      },
      orderBy: { occurredAt: "desc" },
    });
  }

  async createCheck(dto: CreateCheckDto, actorId?: string) {
    const member = await this.prisma.fieldMember.findUnique({
      where: { id: dto.memberId },
      include: { team: true },
    });
    if (!member) throw new NotFoundException("Membro não encontrado.");
    await this.validateLocation(
      dto.electoralZoneId,
      dto.pollingPlaceId,
      member.team.electionId,
    );
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    const event = await this.prisma.$transaction(async (tx) => {
      const created = await tx.fieldCheckEvent.create({
        data: { ...dto, occurredAt },
      });
      await tx.fieldMember.update({
        where: { id: member.id },
        data: {
          status:
            dto.type === FieldCheckType.CHECK_IN
              ? MemberAvailability.ON_DUTY
              : MemberAvailability.OFF_DUTY,
        },
      });
      return created;
    });
    await this.eventBus?.emit(
      dto.type === FieldCheckType.CHECK_IN
        ? "field_member.checked_in"
        : "field_member.checked_out",
      {
        entityId: event.id,
        actorId,
        memberId: member.id,
        memberName: member.name,
        electoralZoneId: dto.electoralZoneId,
        pollingPlaceId: dto.pollingPlaceId,
        occurredAt: occurredAt.toISOString(),
      },
    );
    return event;
  }

  private validateInterval(startsAt: Date, endsAt: Date) {
    if (
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime()) ||
      endsAt <= startsAt
    ) {
      throw new BadRequestException("O fim deve ser posterior ao início.");
    }
  }

  private async ensureNoUnavailabilityConflict(
    memberId: string,
    startsAt: Date,
    endsAt: Date,
    excludeId?: string,
  ) {
    const existing = await this.prisma.fieldMemberUnavailability.findFirst({
      where: {
        memberId,
        id: excludeId ? { not: excludeId } : undefined,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true },
    });
    if (existing)
      throw new ConflictException(
        "Já existe indisponibilidade neste intervalo.",
      );
  }

  private async validateLocation(
    zoneId: string | undefined,
    placeId: string | undefined,
    electionId: string,
  ) {
    const [zone, place] = await Promise.all([
      zoneId
        ? this.prisma.electoralZone.findUnique({ where: { id: zoneId } })
        : null,
      placeId
        ? this.prisma.pollingPlace.findUnique({
            where: { id: placeId },
            include: { electoralZone: true },
          })
        : null,
    ]);
    if (zoneId && (!zone || zone.electionId !== electionId))
      throw new BadRequestException("Zona incompatível com o pleito.");
    if (placeId && (!place || place.electoralZone.electionId !== electionId))
      throw new BadRequestException("Local incompatível com o pleito.");
    if (zone && place && place.electoralZoneId !== zone.id)
      throw new BadRequestException("O local não pertence à zona.");
  }
}
