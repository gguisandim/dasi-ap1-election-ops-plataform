import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { FieldAllocationStatus, FieldCheckType, FieldTeamStatus, MemberAvailability, Prisma } from "@prisma/client";
import { PrismaService } from "../../../../../packages/database/src";
import { EventBus } from "../../../../../packages/event-bus/src";
import { CreateAllocationDto, CreateCheckDto, CreateMemberDto, CreateRoleDto, CreateShiftDto, CreateSpecialtyDto, CreateTeamDto, FieldTeamsQueryDto, UpdateCatalogDto, UpdateMemberDto, UpdateTeamDto } from "./dto/field-teams.dto";

const memberInclude = { role: true, specialties: { include: { specialty: true } } } satisfies Prisma.FieldMemberInclude;
const teamInclude = {
  election: { select: { id: true, name: true, year: true } },
  members: { include: memberInclude, orderBy: { name: "asc" as const } },
  shifts: { include: { member: true, electoralZone: true, pollingPlace: true }, orderBy: { startsAt: "asc" as const } },
  allocations: { include: { member: true, electoralZone: true, pollingPlace: true }, orderBy: { startsAt: "desc" as const } },
} satisfies Prisma.FieldTeamInclude;

@Injectable()
export class FieldTeamsService {
  constructor(private readonly prisma: PrismaService, private readonly eventBus?: EventBus) {}

  findAll(query: FieldTeamsQueryDto) {
    return this.prisma.fieldTeam.findMany({ where: { electionId: query.electionId, status: query.status, allocations: query.zoneId || query.pollingPlaceId ? { some: { electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId } } : undefined }, include: teamInclude, orderBy: { name: "asc" } });
  }
  async findOne(id: string) { const team = await this.prisma.fieldTeam.findUnique({ where: { id }, include: teamInclude }); if (!team) throw new NotFoundException("Equipe não encontrada."); return team; }

  async dashboard(query: FieldTeamsQueryDto) {
    const now = new Date(); const nextWeek = new Date(now.getTime() + 7 * 86400000);
    const allocationWhere = { electionId: query.electionId, electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId, status: FieldAllocationStatus.ACTIVE, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gte: now } }] };
    const [teams, members, zones, places, allocations, upcomingShifts] = await Promise.all([
      this.prisma.fieldTeam.count({ where: { electionId: query.electionId, status: FieldTeamStatus.ACTIVE } }),
      this.prisma.fieldMember.findMany({ where: { team: { electionId: query.electionId } }, select: { status: true } }),
      this.prisma.electoralZone.findMany({ where: { electionId: query.electionId, id: query.zoneId }, select: { id: true } }),
      this.prisma.pollingPlace.findMany({ where: { id: query.pollingPlaceId, electoralZoneId: query.zoneId, electoralZone: { electionId: query.electionId } }, select: { id: true } }),
      this.prisma.fieldAllocation.findMany({ where: allocationWhere, select: { electoralZoneId: true, pollingPlaceId: true } }),
      this.prisma.fieldShift.findMany({ where: { team: { electionId: query.electionId }, startsAt: { gte: now, lte: nextWeek } }, include: { team: true, member: true, electoralZone: true, pollingPlace: true }, orderBy: { startsAt: "asc" }, take: 12 }),
    ]);
    const coveredZones = new Set(allocations.map((item) => item.electoralZoneId).filter(Boolean)); const coveredPlaces = new Set(allocations.map((item) => item.pollingPlaceId).filter(Boolean));
    return { activeTeams: teams, availablePeople: members.filter((item) => item.status === MemberAvailability.AVAILABLE).length, onDutyPeople: members.filter((item) => item.status === MemberAvailability.ON_DUTY).length, uncoveredZones: zones.filter((item) => !coveredZones.has(item.id)).length, uncoveredPlaces: places.filter((item) => !coveredPlaces.has(item.id)).length, upcomingShifts };
  }

  async createTeam(dto: CreateTeamDto) {
    if (!await this.prisma.election.findUnique({ where: { id: dto.electionId } })) throw new NotFoundException("Pleito não encontrado.");
    try { return await this.prisma.fieldTeam.create({ data: { ...dto, code: dto.code.toUpperCase() }, include: teamInclude }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Código de equipe já cadastrado."); throw error; }
  }
  async updateTeam(id: string, dto: UpdateTeamDto) { await this.findOne(id); return this.prisma.fieldTeam.update({ where: { id }, data: dto, include: teamInclude }); }

  listMembers(teamId?: string, status?: MemberAvailability) { return this.prisma.fieldMember.findMany({ where: { teamId, status }, include: { ...memberInclude, team: { include: { election: true } } }, orderBy: { name: "asc" } }); }
  async createMember(dto: CreateMemberDto) {
    const [team, role, specialties] = await Promise.all([this.prisma.fieldTeam.findUnique({ where: { id: dto.teamId } }), this.prisma.fieldRole.findUnique({ where: { id: dto.roleId } }), this.prisma.fieldSpecialty.count({ where: { id: { in: dto.specialtyIds ?? [] }, active: true } })]);
    if (!team) throw new NotFoundException("Equipe não encontrada."); if (!role?.active) throw new NotFoundException("Função não encontrada ou inativa."); if (specialties !== (dto.specialtyIds ?? []).length) throw new BadRequestException("Uma ou mais especialidades são inválidas.");
    const { specialtyIds, ...data } = dto; return this.prisma.fieldMember.create({ data: { ...data, specialties: { create: (specialtyIds ?? []).map((specialtyId) => ({ specialtyId })) } }, include: memberInclude });
  }
  async updateMember(id: string, dto: UpdateMemberDto) {
    const current = await this.prisma.fieldMember.findUnique({ where: { id } }); if (!current) throw new NotFoundException("Membro não encontrado.");
    const { specialtyIds, ...data } = dto;
    return this.prisma.$transaction(async (tx) => { await tx.fieldMember.update({ where: { id }, data }); if (specialtyIds) { await tx.fieldMemberSpecialty.deleteMany({ where: { memberId: id } }); await tx.fieldMemberSpecialty.createMany({ data: specialtyIds.map((specialtyId) => ({ memberId: id, specialtyId })), skipDuplicates: true }); } return tx.fieldMember.findUniqueOrThrow({ where: { id }, include: memberInclude }); });
  }

  roles() { return this.prisma.fieldRole.findMany({ orderBy: { name: "asc" } }); }
  specialties() { return this.prisma.fieldSpecialty.findMany({ orderBy: { name: "asc" } }); }
  async createRole(dto: CreateRoleDto) { try { return await this.prisma.fieldRole.create({ data: { ...dto, key: dto.key.toUpperCase() } }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Função já cadastrada."); throw error; } }
  async createSpecialty(dto: CreateSpecialtyDto) { try { return await this.prisma.fieldSpecialty.create({ data: { ...dto, key: dto.key.toUpperCase() } }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Especialidade já cadastrada."); throw error; } }
  updateRole(id: string, dto: UpdateCatalogDto) { return this.prisma.fieldRole.update({ where: { id }, data: dto }); }
  updateSpecialty(id: string, dto: UpdateCatalogDto) { return this.prisma.fieldSpecialty.update({ where: { id }, data: dto }); }

  shifts(query: FieldTeamsQueryDto) { return this.prisma.fieldShift.findMany({ where: { team: { electionId: query.electionId }, electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId }, include: { team: true, member: true, electoralZone: true, pollingPlace: true }, orderBy: { startsAt: "asc" } }); }
  async createShift(dto: CreateShiftDto) {
    const startsAt = new Date(dto.startsAt); const endsAt = new Date(dto.endsAt); if (endsAt <= startsAt) throw new BadRequestException("O turno deve terminar após o início.");
    const team = await this.findOne(dto.teamId); if (dto.memberId && !team.members.some((item) => item.id === dto.memberId)) throw new BadRequestException("O membro não pertence à equipe.");
    await this.validateLocation(dto.electoralZoneId, dto.pollingPlaceId, team.electionId);
    return this.prisma.fieldShift.create({ data: { ...dto, startsAt, endsAt }, include: { team: true, member: true, electoralZone: true, pollingPlace: true } });
  }

  allocations(query: FieldTeamsQueryDto) { return this.prisma.fieldAllocation.findMany({ where: { electionId: query.electionId, electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId }, include: { team: true, member: true, electoralZone: true, pollingPlace: true }, orderBy: { startsAt: "desc" } }); }
  async createAllocation(dto: CreateAllocationDto, actorId?: string) {
    if (!dto.teamId && !dto.memberId) throw new BadRequestException("Informe uma equipe ou um membro."); if (!dto.electoralZoneId && !dto.pollingPlaceId && !dto.routeId && !dto.activity) throw new BadRequestException("Informe zona, local, rota ou atividade.");
    const [team, member] = await Promise.all([dto.teamId ? this.prisma.fieldTeam.findUnique({ where: { id: dto.teamId } }) : null, dto.memberId ? this.prisma.fieldMember.findUnique({ where: { id: dto.memberId }, include: { team: true } }) : null]);
    if (dto.teamId && (!team || team.electionId !== dto.electionId)) throw new BadRequestException("Equipe incompatível com o pleito."); if (dto.memberId && (!member || member.team.electionId !== dto.electionId)) throw new BadRequestException("Membro incompatível com o pleito.");
    await this.validateLocation(dto.electoralZoneId, dto.pollingPlaceId, dto.electionId);
    const allocation = await this.prisma.fieldAllocation.create({ data: { ...dto, startsAt: new Date(dto.startsAt), endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined }, include: { team: true, member: true, electoralZone: true, pollingPlace: true } });
    if (dto.memberId) await this.prisma.fieldMember.update({ where: { id: dto.memberId }, data: { status: dto.status === FieldAllocationStatus.ACTIVE ? MemberAvailability.ON_DUTY : MemberAvailability.ASSIGNED } });
    else if (dto.teamId) await this.prisma.fieldMember.updateMany({ where: { teamId: dto.teamId, status: MemberAvailability.AVAILABLE }, data: { status: dto.status === FieldAllocationStatus.ACTIVE ? MemberAvailability.ON_DUTY : MemberAvailability.ASSIGNED } });
    await this.eventBus?.emit("field_team.allocated", { entityId: allocation.id, actorId, teamId: dto.teamId, memberId: dto.memberId, electionId: dto.electionId, electoralZoneId: dto.electoralZoneId, pollingPlaceId: dto.pollingPlaceId, routeId: dto.routeId });
    return allocation;
  }

  checks(query: FieldTeamsQueryDto) { return this.prisma.fieldCheckEvent.findMany({ where: { electoralZoneId: query.zoneId, pollingPlaceId: query.pollingPlaceId, member: { team: { electionId: query.electionId } } }, include: { member: { include: { team: true, role: true } }, electoralZone: true, pollingPlace: true }, orderBy: { occurredAt: "desc" } }); }
  async createCheck(dto: CreateCheckDto, actorId?: string) {
    const member = await this.prisma.fieldMember.findUnique({ where: { id: dto.memberId }, include: { team: true } }); if (!member) throw new NotFoundException("Membro não encontrado.");
    await this.validateLocation(dto.electoralZoneId, dto.pollingPlaceId, member.team.electionId);
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    const event = await this.prisma.$transaction(async (tx) => { const created = await tx.fieldCheckEvent.create({ data: { ...dto, occurredAt } }); await tx.fieldMember.update({ where: { id: member.id }, data: { status: dto.type === FieldCheckType.CHECK_IN ? MemberAvailability.ON_DUTY : MemberAvailability.OFF_DUTY } }); return created; });
    await this.eventBus?.emit(dto.type === FieldCheckType.CHECK_IN ? "field_member.checked_in" : "field_member.checked_out", { entityId: event.id, actorId, memberId: member.id, memberName: member.name, electoralZoneId: dto.electoralZoneId, pollingPlaceId: dto.pollingPlaceId, occurredAt: occurredAt.toISOString() });
    return event;
  }

  private async validateLocation(zoneId: string | undefined, placeId: string | undefined, electionId: string) {
    const [zone, place] = await Promise.all([zoneId ? this.prisma.electoralZone.findUnique({ where: { id: zoneId } }) : null, placeId ? this.prisma.pollingPlace.findUnique({ where: { id: placeId }, include: { electoralZone: true } }) : null]);
    if (zoneId && (!zone || zone.electionId !== electionId)) throw new BadRequestException("Zona incompatível com o pleito."); if (placeId && (!place || place.electoralZone.electionId !== electionId)) throw new BadRequestException("Local incompatível com o pleito."); if (zone && place && place.electoralZoneId !== zone.id) throw new BadRequestException("O local não pertence à zona.");
  }
}
