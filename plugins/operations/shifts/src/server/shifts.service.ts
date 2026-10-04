import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FieldShiftAssignmentStatus,
  FieldShiftHistoryAction,
  FieldShiftStatus,
  FieldTeamStatus,
  MemberAvailability,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import type { ShiftCoverage } from "@eops/shared/workforce";
import {
  CopyShiftDto,
  CreateShiftAssignmentDto,
  CreateShiftDto,
  CreateShiftTemplateDto,
  ReplaceAssignmentDto,
  ShiftsQueryDto,
  SpecialtyRequirementDto,
  UpdateShiftDto,
  UpdateShiftTemplateDto,
} from "./dto/shifts.dto";
import {
  hasScheduleConflict,
  planReplacement,
  type ScheduleInterval,
} from "./shift-rules";

const shiftInclude = {
  team: {
    include: {
      election: { select: { id: true, name: true, year: true } },
    },
  },
  electoralZone: {
    select: { id: true, electionId: true, number: true, name: true },
  },
  pollingPlace: {
    select: {
      id: true,
      electoralZoneId: true,
      name: true,
      address: true,
    },
  },
  member: { include: { role: true } },
  assignments: {
    include: {
      member: {
        include: {
          role: true,
          team: { select: { id: true, name: true, code: true } },
          specialties: { include: { specialty: true } },
        },
      },
      role: true,
    },
    orderBy: [{ status: "asc" as const }, { member: { name: "asc" as const } }],
  },
  specialtyRequirements: {
    include: { specialty: true },
    orderBy: { specialty: { name: "asc" as const } },
  },
  replacements: {
    include: {
      originalAssignment: {
        include: { member: { select: { id: true, name: true } } },
      },
      substituteAssignment: {
        include: { member: { select: { id: true, name: true } } },
      },
      replacedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
  history: {
    include: {
      actor: { select: { id: true, name: true } },
      assignment: {
        include: { member: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" as const },
    take: 100,
  },
} satisfies Prisma.FieldShiftInclude;

const templateInclude = {
  team: { select: { id: true, name: true, code: true, electionId: true } },
  electoralZone: {
    select: { id: true, electionId: true, number: true, name: true },
  },
  pollingPlace: {
    select: { id: true, electoralZoneId: true, name: true },
  },
  specialtyRequirements: {
    include: { specialty: true },
    orderBy: { specialty: { name: "asc" as const } },
  },
} satisfies Prisma.FieldShiftTemplateInclude;

type ShiftRecord = Prisma.FieldShiftGetPayload<{
  include: typeof shiftInclude;
}>;

export function countAssignmentConflicts(
  shifts: readonly { id: string; assignments: readonly ScheduleInterval[] }[],
) {
  const assignments = shifts.flatMap((shift) =>
    shift.assignments.map((assignment) => ({
      ...assignment,
      shiftId: shift.id,
    })),
  );
  let conflicts = 0;
  for (let index = 0; index < assignments.length; index += 1) {
    const candidate = assignments[index];
    if (!candidate) continue;
    for (
      let otherIndex = index + 1;
      otherIndex < assignments.length;
      otherIndex += 1
    ) {
      const other = assignments[otherIndex];
      if (!other || other.shiftId === candidate.shiftId) continue;
      if (hasScheduleConflict(candidate, [other])) conflicts += 1;
    }
  }
  return conflicts;
}

export function calculateCoverage(
  shift: Pick<
    ShiftRecord,
    "requiredOperators" | "assignments" | "specialtyRequirements"
  >,
): ShiftCoverage {
  const operational = shift.assignments.filter(
    (assignment) =>
      assignment.status === FieldShiftAssignmentStatus.SCHEDULED ||
      assignment.status === FieldShiftAssignmentStatus.PRESENT ||
      (assignment.status === FieldShiftAssignmentStatus.ON_CALL &&
        assignment.onCallActivatedAt !== null),
  );
  const availableOperators = new Set(
    operational.map((assignment) => assignment.memberId),
  ).size;
  const percentage = Math.min(
    100,
    Math.floor((availableOperators / shift.requiredOperators) * 100),
  );
  const specialties = shift.specialtyRequirements.map((requirement) => {
    const assignedCount = new Set(
      operational
        .filter((assignment) =>
          assignment.member.specialties.some(
            (item) => item.specialtyId === requirement.specialtyId,
          ),
        )
        .map((assignment) => assignment.memberId),
    ).size;
    return {
      specialtyId: requirement.specialtyId,
      specialtyName: requirement.specialty.name,
      requiredCount: requirement.requiredCount,
      assignedCount,
      met: assignedCount >= requirement.requiredCount,
    };
  });
  const hasSkillGap = specialties.some((item) => !item.met);
  const state =
    availableOperators === 0
      ? "EMPTY"
      : availableOperators < shift.requiredOperators / 2
        ? "CRITICAL"
        : availableOperators < shift.requiredOperators
          ? "PARTIAL"
          : hasSkillGap
            ? "CRITICAL"
            : "FULL";
  return {
    requiredOperators: shift.requiredOperators,
    availableOperators,
    percentage,
    state,
    assigned: shift.assignments.filter(
      (item) =>
        item.status !== FieldShiftAssignmentStatus.ABSENT &&
        item.status !== FieldShiftAssignmentStatus.REPLACED,
    ).length,
    present: shift.assignments.filter(
      (item) => item.status === FieldShiftAssignmentStatus.PRESENT,
    ).length,
    absent: shift.assignments.filter(
      (item) => item.status === FieldShiftAssignmentStatus.ABSENT,
    ).length,
    onCall: shift.assignments.filter(
      (item) => item.status === FieldShiftAssignmentStatus.ON_CALL,
    ).length,
    specialties,
  };
}

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async references() {
    const [elections, zones, places, teams, members, roles, specialties] =
      await Promise.all([
        this.prisma.election.findMany({
          select: { id: true, name: true, year: true },
          orderBy: [{ year: "desc" }, { name: "asc" }],
        }),
        this.prisma.electoralZone.findMany({
          select: { id: true, electionId: true, number: true, name: true },
          orderBy: { number: "asc" },
        }),
        this.prisma.pollingPlace.findMany({
          select: { id: true, electoralZoneId: true, name: true },
          orderBy: { name: "asc" },
        }),
        this.prisma.fieldTeam.findMany({
          select: {
            id: true,
            electionId: true,
            name: true,
            code: true,
            status: true,
          },
          orderBy: { name: "asc" },
        }),
        this.prisma.fieldMember.findMany({
          select: {
            id: true,
            teamId: true,
            name: true,
            roleId: true,
            status: true,
            role: { select: { name: true } },
            specialties: {
              select: {
                specialty: { select: { id: true, name: true, key: true } },
              },
            },
          },
          orderBy: { name: "asc" },
        }),
        this.prisma.fieldRole.findMany({
          where: { active: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        this.prisma.fieldSpecialty.findMany({
          where: { active: true },
          select: { id: true, key: true, name: true },
          orderBy: { name: "asc" },
        }),
      ]);
    return { elections, zones, places, teams, members, roles, specialties };
  }

  async shifts(query: ShiftsQueryDto) {
    const records = await this.prisma.fieldShift.findMany({
      where: this.buildWhere(query),
      include: shiftInclude,
      orderBy: [{ startsAt: "asc" }, { name: "asc" }],
    });
    return records.map((shift) => this.withCoverage(shift));
  }

  async calendar(query: ShiftsQueryDto) {
    this.validateQueryRange(query);
    const shifts = await this.shifts(query);
    return {
      startsFrom: query.startsFrom ?? null,
      startsTo: query.startsTo ?? null,
      items: shifts,
    };
  }

  async coverage(query: ShiftsQueryDto) {
    this.validateQueryRange(query);
    const shifts = await this.shifts(query);
    return {
      startsFrom: query.startsFrom ?? null,
      startsTo: query.startsTo ?? null,
      items: shifts.map((shift) => ({
        shiftId: shift.id,
        name: this.shiftName(shift),
        startsAt: shift.startsAt,
        endsAt: shift.endsAt,
        status: shift.status,
        team: shift.team,
        electoralZone: shift.electoralZone,
        pollingPlace: shift.pollingPlace,
        coverage: shift.coverage,
      })),
    };
  }

  async dashboard(query: ShiftsQueryDto) {
    const shifts = await this.shifts({
      ...query,
      status: undefined,
      assignmentStatus: undefined,
    });
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 86400000);
    const todaysShifts = shifts.filter(
      (shift) => shift.startsAt >= today && shift.startsAt < tomorrow,
    );
    const assignments = shifts.flatMap((shift) => shift.assignments);
    return {
      today: todaysShifts.length,
      inProgress: shifts.filter(
        (shift) => shift.status === FieldShiftStatus.IN_PROGRESS,
      ).length,
      fullCoverage: shifts.filter((shift) => shift.coverage.state === "FULL")
        .length,
      partialCoverage: shifts.filter(
        (shift) => shift.coverage.state === "PARTIAL",
      ).length,
      criticalCoverage: shifts.filter(
        (shift) =>
          shift.coverage.state === "CRITICAL" ||
          shift.coverage.state === "EMPTY",
      ).length,
      scheduledOperators: new Set(
        assignments
          .filter((item) => item.status !== FieldShiftAssignmentStatus.REPLACED)
          .map((item) => item.memberId),
      ).size,
      presentOperators: new Set(
        assignments
          .filter(
            (item) =>
              item.status === FieldShiftAssignmentStatus.PRESENT ||
              (item.status === FieldShiftAssignmentStatus.ON_CALL &&
                item.onCallActivatedAt),
          )
          .map((item) => item.memberId),
      ).size,
      absences: assignments.filter(
        (item) => item.status === FieldShiftAssignmentStatus.ABSENT,
      ).length,
      replacements: shifts.reduce(
        (total, shift) => total + shift.replacements.length,
        0,
      ),
      onCall: assignments.filter(
        (item) =>
          item.status === FieldShiftAssignmentStatus.ON_CALL &&
          !item.onCallActivatedAt,
      ).length,
      conflicts: countAssignmentConflicts(shifts),
      insufficientCoverage: shifts.filter(
        (shift) =>
          shift.coverage.state !== "FULL" &&
          shift.status !== FieldShiftStatus.CANCELLED,
      ).length,
      attentionShifts: shifts
        .filter(
          (shift) =>
            shift.coverage.state !== "FULL" &&
            shift.status !== FieldShiftStatus.CANCELLED,
        )
        .slice(0, 12),
      todaysShifts,
    };
  }

  async findOne(id: string) {
    const shift = await this.prisma.fieldShift.findUnique({
      where: { id },
      include: shiftInclude,
    });
    if (!shift) throw new NotFoundException("Turno não encontrado.");
    return {
      ...this.withCoverage(shift),
      conflicts: await this.findConflicts(shift),
    };
  }

  async createShift(dto: CreateShiftDto, actorId: string) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    this.validateInterval(startsAt, endsAt);
    const [election, team] = await Promise.all([
      this.prisma.election.findUnique({
        where: { id: dto.electionId },
        select: { id: true },
      }),
      this.prisma.fieldTeam.findUnique({
        where: { id: dto.teamId },
        select: { id: true, electionId: true, status: true },
      }),
    ]);
    if (!election) throw new NotFoundException("Pleito não encontrado.");
    if (!team || team.electionId !== dto.electionId)
      throw new BadRequestException(
        "A equipe precisa pertencer ao pleito informado.",
      );
    if (team.status !== FieldTeamStatus.ACTIVE)
      throw new BadRequestException("A equipe do turno precisa estar ativa.");
    const electoralZoneId = await this.validateLocation(
      dto.electionId,
      dto.electoralZoneId,
      dto.pollingPlaceId,
    );
    await this.validateRequirements(dto.specialtyRequirements);
    const shift = await this.prisma.$transaction(async (tx) => {
      const created = await tx.fieldShift.create({
        data: {
          teamId: dto.teamId,
          name: dto.name,
          startsAt,
          endsAt,
          requiredOperators: dto.requiredOperators,
          electoralZoneId,
          pollingPlaceId: dto.pollingPlaceId,
          notes: dto.notes,
          specialtyRequirements: {
            create: (dto.specialtyRequirements ?? []).map((requirement) => ({
              specialtyId: requirement.specialtyId,
              requiredCount: requirement.requiredCount,
            })),
          },
        },
        select: { id: true },
      });
      await tx.fieldShiftHistory.create({
        data: {
          shiftId: created.id,
          actorId,
          action: FieldShiftHistoryAction.CREATED,
          description: "Turno criado.",
          metadata: {
            name: dto.name,
            teamId: dto.teamId,
            requiredOperators: dto.requiredOperators,
          },
        },
      });
      return tx.fieldShift.findUniqueOrThrow({
        where: { id: created.id },
        include: shiftInclude,
      });
    });
    await this.eventBus.emit("shift.created", {
      entityId: shift.id,
      actorId,
      name: this.shiftName(shift),
      electionId: dto.electionId,
      teamId: shift.teamId,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });
    await this.emitCoverageAlert(shift, undefined, actorId);
    return this.withCoverage(shift);
  }

  async updateShift(id: string, dto: UpdateShiftDto, actorId: string) {
    const current = await this.requireShift(id);
    if (
      current.status === FieldShiftStatus.COMPLETED ||
      current.status === FieldShiftStatus.CANCELLED
    )
      throw new BadRequestException("Um turno encerrado não pode ser editado.");
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : current.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : current.endsAt;
    this.validateInterval(startsAt, endsAt);
    const zoneId =
      dto.electoralZoneId === undefined
        ? (current.electoralZoneId ?? undefined)
        : dto.electoralZoneId;
    const placeId =
      dto.pollingPlaceId === undefined
        ? (current.pollingPlaceId ?? undefined)
        : dto.pollingPlaceId;
    const locationChanged =
      dto.electoralZoneId !== undefined || dto.pollingPlaceId !== undefined;
    const electoralZoneId = locationChanged
      ? await this.validateLocation(current.team.electionId, zoneId, placeId)
      : current.electoralZoneId;
    if (dto.specialtyRequirements)
      await this.validateRequirements(dto.specialtyRequirements);

    const nextAssignments = current.assignments.map((assignment) => ({
      id: assignment.id,
      memberId: assignment.memberId,
      startsAt:
        assignment.startsAt.getTime() === current.startsAt.getTime()
          ? startsAt
          : assignment.startsAt,
      endsAt:
        assignment.endsAt.getTime() === current.endsAt.getTime()
          ? endsAt
          : assignment.endsAt,
      status: assignment.status,
    }));
    for (const assignment of nextAssignments) {
      if (assignment.startsAt < startsAt || assignment.endsAt > endsAt)
        throw new BadRequestException(
          "O novo período não pode excluir o horário de uma alocação existente.",
        );
      await this.ensureNoConflict(id, assignment, assignment.id);
      await this.ensureAvailable(
        assignment.memberId,
        assignment.startsAt,
        assignment.endsAt,
      );
    }

    const data: Prisma.FieldShiftUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.requiredOperators !== undefined)
      data.requiredOperators = dto.requiredOperators;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.startsAt !== undefined) data.startsAt = startsAt;
    if (dto.endsAt !== undefined) data.endsAt = endsAt;
    if (locationChanged) {
      data.electoralZoneId = electoralZoneId;
      data.pollingPlaceId = dto.pollingPlaceId ?? null;
    }
    const changes = [
      ...Object.keys(data),
      ...(dto.specialtyRequirements ? ["specialtyRequirements"] : []),
    ];
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.fieldShift.update({ where: { id }, data });
      for (const assignment of nextAssignments) {
        await tx.fieldShiftAssignment.update({
          where: { id: assignment.id },
          data: {
            startsAt: assignment.startsAt,
            endsAt: assignment.endsAt,
          },
        });
      }
      if (dto.specialtyRequirements) {
        await tx.fieldShiftSpecialtyRequirement.deleteMany({
          where: { shiftId: id },
        });
        await tx.fieldShiftSpecialtyRequirement.createMany({
          data: dto.specialtyRequirements.map((requirement) => ({
            shiftId: id,
            specialtyId: requirement.specialtyId,
            requiredCount: requirement.requiredCount,
          })),
        });
      }
      await tx.fieldShiftHistory.create({
        data: {
          shiftId: id,
          actorId,
          action: FieldShiftHistoryAction.UPDATED,
          description: "Dados do turno atualizados.",
          metadata: { changes },
        },
      });
      return tx.fieldShift.findUniqueOrThrow({
        where: { id },
        include: shiftInclude,
      });
    });
    await this.eventBus.emit("shift.updated", {
      entityId: id,
      actorId,
      name: this.shiftName(updated),
      electionId: updated.team.electionId,
      changes,
    });
    await this.emitCoverageAlert(updated, calculateCoverage(current), actorId);
    return this.withCoverage(updated);
  }

  async createAssignment(
    shiftId: string,
    dto: CreateShiftAssignmentDto,
    actorId: string,
  ) {
    const shift = await this.requireShift(shiftId);
    if (
      shift.status === FieldShiftStatus.CANCELLED ||
      shift.status === FieldShiftStatus.COMPLETED
    )
      throw new BadRequestException(
        "Não é possível alocar pessoas em um turno encerrado.",
      );
    if (dto.roleId) await this.requireActiveRole(dto.roleId);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : shift.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : shift.endsAt;
    this.validateInterval(startsAt, endsAt);
    if (startsAt < shift.startsAt || endsAt > shift.endsAt)
      throw new BadRequestException(
        "A alocação precisa estar dentro do período do turno.",
      );
    const member = await this.requireTeamMember(
      dto.memberId,
      shift.teamId,
      startsAt,
      endsAt,
    );
    const before = calculateCoverage(shift);
    const status = dto.status ?? FieldShiftAssignmentStatus.SCHEDULED;
    const candidate: ScheduleInterval = {
      memberId: member.id,
      startsAt,
      endsAt,
      status,
    };
    const assignment = await this.serialized(async (tx) => {
      await this.ensureNoConflict(shiftId, candidate, undefined, tx);
      const created = await tx.fieldShiftAssignment.create({
        data: {
          shiftId,
          memberId: member.id,
          roleId: dto.roleId,
          status,
          startsAt,
          endsAt,
          notes: dto.notes,
        },
      });
      await tx.fieldShiftHistory.create({
        data: {
          shiftId,
          assignmentId: created.id,
          actorId,
          action:
            status === FieldShiftAssignmentStatus.ON_CALL
              ? FieldShiftHistoryAction.ON_CALL_REGISTERED
              : FieldShiftHistoryAction.ASSIGNED,
          description:
            status === FieldShiftAssignmentStatus.ON_CALL
              ? "Operador registrado para sobreaviso."
              : "Operador alocado no turno.",
          metadata: { memberId: member.id, status },
        },
      });
      return tx.fieldShiftAssignment.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          member: { include: { role: true, team: true } },
          role: true,
        },
      });
    });
    const updated = await this.requireShift(shiftId);
    await this.eventBus.emit("shift.assignment_added", {
      entityId: assignment.id,
      actorId,
      shiftId,
      electionId: shift.team.electionId,
      memberId: member.id,
      memberName: member.name,
      status,
    });
    await this.emitCoverageAlert(updated, before, actorId);
    return assignment;
  }

  async registerPresence(
    shiftId: string,
    assignmentId: string,
    actorId: string,
  ) {
    const { shift, assignment } = await this.requireAssignment(
      shiftId,
      assignmentId,
    );
    if (
      assignment.status === FieldShiftAssignmentStatus.ABSENT ||
      assignment.status === FieldShiftAssignmentStatus.REPLACED
    )
      throw new BadRequestException(
        "A alocação já foi encerrada ou substituída.",
      );
    if (assignment.status === FieldShiftAssignmentStatus.PRESENT)
      throw new BadRequestException("A presença já foi registrada.");
    const before = calculateCoverage(shift);
    const presentAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.fieldShiftAssignment.update({
        where: { id: assignmentId },
        data: {
          status: FieldShiftAssignmentStatus.PRESENT,
          presentAt,
          onCallActivatedAt:
            assignment.status === FieldShiftAssignmentStatus.ON_CALL
              ? presentAt
              : assignment.onCallActivatedAt,
        },
      });
      await tx.fieldShiftHistory.create({
        data: {
          shiftId,
          assignmentId,
          actorId,
          action:
            assignment.status === FieldShiftAssignmentStatus.ON_CALL
              ? FieldShiftHistoryAction.ON_CALL_ACTIVATED
              : FieldShiftHistoryAction.PRESENCE_REGISTERED,
          description:
            assignment.status === FieldShiftAssignmentStatus.ON_CALL
              ? "Operador de sobreaviso acionado e presente."
              : "Presença registrada.",
        },
      });
      return result;
    });
    const current = await this.requireShift(shiftId);
    await this.eventBus.emit("shift.presence_registered", {
      entityId: updated.id,
      actorId,
      shiftId,
      electionId: shift.team.electionId,
      memberId: assignment.memberId,
      memberName: assignment.member.name,
      occurredAt: presentAt.toISOString(),
    });
    await this.emitCoverageAlert(current, before, actorId);
    return updated;
  }

  async registerAbsence(
    shiftId: string,
    assignmentId: string,
    reason: string | undefined,
    actorId: string,
  ) {
    const { shift, assignment } = await this.requireAssignment(
      shiftId,
      assignmentId,
    );
    if (
      assignment.status === FieldShiftAssignmentStatus.ABSENT ||
      assignment.status === FieldShiftAssignmentStatus.REPLACED
    )
      throw new BadRequestException(
        "A alocação já foi encerrada ou substituída.",
      );
    const before = calculateCoverage(shift);
    const absentAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.fieldShiftAssignment.update({
        where: { id: assignmentId },
        data: {
          status: FieldShiftAssignmentStatus.ABSENT,
          absenceReason: reason,
          absenceRecordedAt: absentAt,
        },
      });
      await tx.fieldShiftHistory.create({
        data: {
          shiftId,
          assignmentId,
          actorId,
          action: FieldShiftHistoryAction.ABSENCE_REGISTERED,
          description: "Falta registrada para " + assignment.member.name + ".",
          metadata: { reason, absentAt: absentAt.toISOString() },
        },
      });
      return result;
    });
    const current = await this.requireShift(shiftId);
    await this.eventBus.emit("shift.absence_registered", {
      entityId: updated.id,
      actorId,
      shiftId,
      electionId: shift.team.electionId,
      memberId: assignment.memberId,
      memberName: assignment.member.name,
      reason,
    });
    await this.emitCoverageAlert(current, before, actorId);
    return updated;
  }

  async activateOnCall(shiftId: string, assignmentId: string, actorId: string) {
    const { shift, assignment } = await this.requireAssignment(
      shiftId,
      assignmentId,
    );
    if (assignment.status !== FieldShiftAssignmentStatus.ON_CALL)
      throw new BadRequestException("A alocação não está em sobreaviso.");
    if (assignment.onCallActivatedAt)
      throw new BadRequestException("O sobreaviso já foi acionado.");
    await this.ensureAvailable(
      assignment.memberId,
      assignment.startsAt,
      assignment.endsAt,
    );
    const before = calculateCoverage(shift);
    const activatedAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.fieldShiftAssignment.update({
        where: { id: assignmentId },
        data: { onCallActivatedAt: activatedAt },
      });
      await tx.fieldShiftHistory.create({
        data: {
          shiftId,
          assignmentId,
          actorId,
          action: FieldShiftHistoryAction.ON_CALL_ACTIVATED,
          description: "Sobreaviso de " + assignment.member.name + " acionado.",
          metadata: { activatedAt: activatedAt.toISOString() },
        },
      });
      return result;
    });
    const current = await this.requireShift(shiftId);
    await this.eventBus.emit("shift.on_call_activated", {
      entityId: updated.id,
      actorId,
      shiftId,
      electionId: shift.team.electionId,
      memberId: assignment.memberId,
      memberName: assignment.member.name,
      activatedAt: activatedAt.toISOString(),
    });
    await this.emitCoverageAlert(current, before, actorId);
    return updated;
  }

  async replaceAssignment(
    shiftId: string,
    assignmentId: string,
    dto: ReplaceAssignmentDto,
    actorId: string,
  ) {
    const { shift, assignment } = await this.requireAssignment(
      shiftId,
      assignmentId,
    );
    const plan = planReplacement(
      {
        id: assignment.id,
        memberId: assignment.memberId,
        startsAt: assignment.startsAt,
        endsAt: assignment.endsAt,
        status: assignment.status,
      },
      dto.substituteMemberId,
    );
    const substitute = await this.requireTeamMember(
      dto.substituteMemberId,
      shift.teamId,
      plan.startsAt,
      plan.endsAt,
    );
    if (dto.roleId) await this.requireActiveRole(dto.roleId);
    const before = calculateCoverage(shift);
    const replacement = await this.serialized(async (tx) => {
      await this.ensureNoConflict(
        shiftId,
        {
          memberId: substitute.id,
          startsAt: plan.startsAt,
          endsAt: plan.endsAt,
          status: FieldShiftAssignmentStatus.SCHEDULED,
        },
        undefined,
        tx,
      );
      const substituteAssignment = await tx.fieldShiftAssignment.create({
        data: {
          shiftId,
          memberId: substitute.id,
          roleId: dto.roleId ?? assignment.roleId,
          startsAt: plan.startsAt,
          endsAt: plan.endsAt,
          status: FieldShiftAssignmentStatus.SCHEDULED,
          notes: dto.reason,
        },
      });
      await tx.fieldShiftAssignment.update({
        where: { id: assignmentId },
        data: { status: FieldShiftAssignmentStatus.REPLACED },
      });
      const replacementRecord = await tx.fieldShiftReplacement.create({
        data: {
          shiftId,
          originalAssignmentId: plan.originalAssignmentId,
          substituteAssignmentId: substituteAssignment.id,
          replacedById: actorId,
          reason: dto.reason,
        },
      });
      await tx.fieldShiftHistory.create({
        data: {
          shiftId,
          assignmentId,
          actorId,
          action: FieldShiftHistoryAction.REPLACED,
          description:
            assignment.member.name +
            " substituído por " +
            substitute.name +
            ".",
          metadata: {
            originalAssignmentId: assignmentId,
            substituteAssignmentId: substituteAssignment.id,
            reason: dto.reason,
          },
        },
      });
      return replacementRecord;
    });
    const current = await this.requireShift(shiftId);
    await this.eventBus.emit("shift.replacement_created", {
      entityId: replacement.id,
      actorId,
      shiftId,
      electionId: shift.team.electionId,
      originalMemberId: assignment.memberId,
      substituteMemberId: substitute.id,
      substituteName: substitute.name,
      reason: dto.reason,
    });
    await this.emitCoverageAlert(current, before, actorId);
    return replacement;
  }

  async changeStatus(id: string, status: FieldShiftStatus, actorId: string) {
    const current = await this.requireShift(id);
    const valid =
      status === FieldShiftStatus.IN_PROGRESS
        ? current.status === FieldShiftStatus.SCHEDULED
        : status === FieldShiftStatus.COMPLETED
          ? current.status === FieldShiftStatus.IN_PROGRESS
          : status === FieldShiftStatus.CANCELLED
            ? current.status !== FieldShiftStatus.COMPLETED &&
              current.status !== FieldShiftStatus.CANCELLED
            : false;
    if (!valid)
      throw new BadRequestException(
        "Transição de status inválida para este turno.",
      );
    const action =
      status === FieldShiftStatus.IN_PROGRESS
        ? FieldShiftHistoryAction.STARTED
        : status === FieldShiftStatus.COMPLETED
          ? FieldShiftHistoryAction.COMPLETED
          : FieldShiftHistoryAction.CANCELLED;
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.fieldShift.update({
        where: { id },
        data: { status },
        include: shiftInclude,
      });
      await tx.fieldShiftHistory.create({
        data: {
          shiftId: id,
          actorId,
          action,
          description: "Status do turno alterado para " + status + ".",
          metadata: { from: current.status, to: status },
        },
      });
      return result;
    });
    if (status === FieldShiftStatus.IN_PROGRESS)
      await this.eventBus.emit("shift.started", {
        entityId: id,
        actorId,
        name: this.shiftName(updated),
        electionId: updated.team.electionId,
      });
    if (status === FieldShiftStatus.COMPLETED)
      await this.eventBus.emit("shift.completed", {
        entityId: id,
        actorId,
        name: this.shiftName(updated),
        electionId: updated.team.electionId,
      });
    if (status === FieldShiftStatus.CANCELLED)
      await this.eventBus.emit("shift.cancelled", {
        entityId: id,
        actorId,
        name: this.shiftName(updated),
        electionId: updated.team.electionId,
        from: current.status,
        to: status,
      });
    return this.withCoverage(updated);
  }

  templates(teamId?: string, active?: boolean) {
    return this.prisma.fieldShiftTemplate.findMany({
      where: { teamId, active },
      include: templateInclude,
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
  }

  async createTemplate(dto: CreateShiftTemplateDto, actorId: string) {
    const team = await this.requireActiveTeam(dto.teamId);
    await this.validateLocation(
      team.electionId,
      dto.electoralZoneId,
      dto.pollingPlaceId,
    );
    await this.validateRequirements(dto.specialtyRequirements);
    const template = await this.prisma.fieldShiftTemplate.create({
      data: {
        teamId: dto.teamId,
        name: dto.name,
        startMinute: dto.startMinute,
        durationMinutes: dto.durationMinutes,
        requiredOperators: dto.requiredOperators,
        electoralZoneId: dto.electoralZoneId,
        pollingPlaceId: dto.pollingPlaceId,
        notes: dto.notes,
        active: dto.active,
        specialtyRequirements: {
          create: (dto.specialtyRequirements ?? []).map((requirement) => ({
            specialtyId: requirement.specialtyId,
            requiredCount: requirement.requiredCount,
          })),
        },
      },
      include: templateInclude,
    });
    await this.eventBus.emit("shift.template_created", {
      entityId: template.id,
      actorId,
      name: template.name,
      teamId: template.teamId,
    });
    return template;
  }

  async updateTemplate(
    id: string,
    dto: UpdateShiftTemplateDto,
    actorId: string,
  ) {
    const current = await this.prisma.fieldShiftTemplate.findUnique({
      where: { id },
      include: templateInclude,
    });
    if (!current) throw new NotFoundException("Template não encontrado.");
    if (dto.specialtyRequirements)
      await this.validateRequirements(dto.specialtyRequirements);
    const zoneId =
      dto.electoralZoneId === undefined
        ? (current.electoralZoneId ?? undefined)
        : dto.electoralZoneId;
    const placeId =
      dto.pollingPlaceId === undefined
        ? (current.pollingPlaceId ?? undefined)
        : dto.pollingPlaceId;
    if (dto.electoralZoneId !== undefined || dto.pollingPlaceId !== undefined)
      await this.validateLocation(current.team.electionId, zoneId, placeId);
    const { specialtyRequirements, ...data } = dto;
    const template = await this.prisma.$transaction(async (tx) => {
      await tx.fieldShiftTemplate.update({ where: { id }, data });
      if (specialtyRequirements) {
        await tx.fieldShiftTemplateSpecialtyRequirement.deleteMany({
          where: { templateId: id },
        });
        await tx.fieldShiftTemplateSpecialtyRequirement.createMany({
          data: specialtyRequirements.map((requirement) => ({
            templateId: id,
            specialtyId: requirement.specialtyId,
            requiredCount: requirement.requiredCount,
          })),
        });
      }
      return tx.fieldShiftTemplate.findUniqueOrThrow({
        where: { id },
        include: templateInclude,
      });
    });
    await this.eventBus.emit("shift.template_updated", {
      entityId: id,
      actorId,
      name: template.name,
      teamId: template.teamId,
      changes: Object.keys(dto),
    });
    return template;
  }

  async createFromTemplate(
    dto: { templateId: string; date: string },
    actorId: string,
  ) {
    const template = await this.prisma.fieldShiftTemplate.findUnique({
      where: { id: dto.templateId },
      include: templateInclude,
    });
    if (!template || !template.active)
      throw new NotFoundException("Template não encontrado ou inativo.");
    const day = new Date(dto.date);
    if (!Number.isFinite(day.getTime()))
      throw new BadRequestException("Data inválida.");
    const startsAt = new Date(day);
    startsAt.setUTCHours(0, template.startMinute, 0, 0);
    const endsAt = new Date(
      startsAt.getTime() + template.durationMinutes * 60000,
    );
    return this.createShift(
      {
        electionId: template.team.electionId,
        teamId: template.teamId,
        name: template.name,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        requiredOperators: template.requiredOperators,
        electoralZoneId: template.electoralZoneId ?? undefined,
        pollingPlaceId: template.pollingPlaceId ?? undefined,
        notes: template.notes ?? undefined,
        specialtyRequirements: template.specialtyRequirements.map((item) => ({
          specialtyId: item.specialtyId,
          requiredCount: item.requiredCount,
        })),
      },
      actorId,
    );
  }

  async copyShift(id: string, dto: CopyShiftDto, actorId: string) {
    const source = await this.requireShift(id);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    this.validateInterval(startsAt, endsAt);
    const duration = source.endsAt.getTime() - source.startsAt.getTime();
    if (endsAt.getTime() - startsAt.getTime() !== duration)
      throw new BadRequestException(
        "A cópia deve preservar a duração do turno original.",
      );
    if (dto.copyAssignments) {
      for (const assignment of source.assignments.filter(
        (item) =>
          item.status !== FieldShiftAssignmentStatus.ABSENT &&
          item.status !== FieldShiftAssignmentStatus.REPLACED,
      )) {
        await this.requireTeamMember(
          assignment.memberId,
          source.teamId,
          startsAt,
          endsAt,
        );
        await this.ensureNoConflict(
          "new-shift",
          {
            memberId: assignment.memberId,
            startsAt,
            endsAt,
            status: FieldShiftAssignmentStatus.SCHEDULED,
          },
          undefined,
        );
      }
    }
    const copied = await this.serialized(async (tx) => {
      const created = await tx.fieldShift.create({
        data: {
          teamId: source.teamId,
          name: source.name,
          startsAt,
          endsAt,
          requiredOperators: source.requiredOperators,
          electoralZoneId: source.electoralZoneId,
          pollingPlaceId: source.pollingPlaceId,
          notes: source.notes,
          specialtyRequirements: {
            create: source.specialtyRequirements.map((requirement) => ({
              specialtyId: requirement.specialtyId,
              requiredCount: requirement.requiredCount,
            })),
          },
          assignments: dto.copyAssignments
            ? {
                create: source.assignments
                  .filter(
                    (item) =>
                      item.status !== FieldShiftAssignmentStatus.ABSENT &&
                      item.status !== FieldShiftAssignmentStatus.REPLACED,
                  )
                  .map((assignment) => ({
                    memberId: assignment.memberId,
                    roleId: assignment.roleId,
                    status: FieldShiftAssignmentStatus.SCHEDULED,
                    startsAt,
                    endsAt,
                    notes: assignment.notes,
                  })),
              }
            : undefined,
        },
        select: { id: true },
      });
      await tx.fieldShiftHistory.create({
        data: {
          shiftId: created.id,
          actorId,
          action: FieldShiftHistoryAction.CREATED,
          description: "Turno copiado.",
          metadata: {
            sourceShiftId: source.id,
            copiedAssignments: dto.copyAssignments === true,
          },
        },
      });
      return tx.fieldShift.findUniqueOrThrow({
        where: { id: created.id },
        include: shiftInclude,
      });
    });
    await this.eventBus.emit("shift.created", {
      entityId: copied.id,
      actorId,
      name: this.shiftName(copied),
      electionId: copied.team.electionId,
      teamId: copied.teamId,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });
    await this.emitCoverageAlert(copied, undefined, actorId);
    return this.withCoverage(copied);
  }

  private buildWhere(query: ShiftsQueryDto): Prisma.FieldShiftWhereInput {
    return {
      team: query.electionId ? { electionId: query.electionId } : undefined,
      teamId: query.teamId,
      electoralZoneId: query.electoralZoneId,
      pollingPlaceId: query.pollingPlaceId,
      status: query.status,
      startsAt:
        query.startsFrom || query.startsTo
          ? {
              gte: query.startsFrom ? new Date(query.startsFrom) : undefined,
              lte: query.startsTo ? new Date(query.startsTo) : undefined,
            }
          : undefined,
      OR: query.memberId
        ? [
            { memberId: query.memberId },
            {
              assignments: {
                some: {
                  memberId: query.memberId,
                  status: query.assignmentStatus,
                },
              },
            },
          ]
        : undefined,
      assignments:
        query.assignmentStatus && !query.memberId
          ? { some: { status: query.assignmentStatus } }
          : undefined,
    };
  }

  private withCoverage<T extends ShiftRecord>(shift: T) {
    return { ...shift, coverage: calculateCoverage(shift) };
  }

  private async requireShift(id: string) {
    const shift = await this.prisma.fieldShift.findUnique({
      where: { id },
      include: shiftInclude,
    });
    if (!shift) throw new NotFoundException("Turno não encontrado.");
    return shift;
  }

  private async requireAssignment(shiftId: string, assignmentId: string) {
    const shift = await this.requireShift(shiftId);
    const assignment = shift.assignments.find(
      (item) => item.id === assignmentId,
    );
    if (!assignment)
      throw new NotFoundException("Alocação não encontrada neste turno.");
    return { shift, assignment };
  }

  private async findConflicts(shift: ShiftRecord) {
    const activeAssignments = shift.assignments.filter(
      (item) => item.status !== FieldShiftAssignmentStatus.ABSENT && item.status !== FieldShiftAssignmentStatus.REPLACED,
    );
    const memberIds = [...new Set(activeAssignments.map((item) => item.memberId))];
    if (!memberIds.length) return [];
    const [overlaps, unavailable] = await Promise.all([
      this.prisma.fieldShiftAssignment.findMany({
        where: {
          memberId: { in: memberIds },
          shiftId: { not: shift.id },
          status: { notIn: [FieldShiftAssignmentStatus.ABSENT, FieldShiftAssignmentStatus.REPLACED] },
          startsAt: { lt: shift.endsAt },
          endsAt: { gt: shift.startsAt },
          shift: { status: { not: FieldShiftStatus.CANCELLED } },
        },
        include: { member: { select: { id: true, name: true } }, shift: { select: { id: true, name: true } } },
      }),
      this.prisma.fieldMemberUnavailability.findMany({
        where: { memberId: { in: memberIds }, startsAt: { lt: shift.endsAt }, endsAt: { gt: shift.startsAt } },
        include: { member: { select: { id: true, name: true } } },
      }),
    ]);
    return [
      ...overlaps.map((item) => ({ id: "assignment:" + item.id, type: "SCHEDULE_OVERLAP" as const, memberId: item.memberId, memberName: item.member.name, startsAt: item.startsAt, endsAt: item.endsAt, message: "Conflito com " + (item.shift.name ?? "outro turno") + "." })),
      ...unavailable.map((item) => ({ id: "unavailability:" + item.id, type: "UNAVAILABLE" as const, memberId: item.memberId, memberName: item.member.name, startsAt: item.startsAt, endsAt: item.endsAt, message: item.reason })),
    ];
  }

  private async requireActiveTeam(teamId: string) {
    const team = await this.prisma.fieldTeam.findUnique({
      where: { id: teamId },
      select: { id: true, electionId: true, status: true },
    });
    if (!team || team.status !== FieldTeamStatus.ACTIVE)
      throw new BadRequestException("A equipe precisa existir e estar ativa.");
    return team;
  }

  private async requireTeamMember(
    memberId: string,
    teamId: string,
    startsAt: Date,
    endsAt: Date,
  ) {
    const member = await this.prisma.fieldMember.findUnique({
      where: { id: memberId },
      include: {
        team: { select: { id: true, electionId: true, status: true } },
        role: true,
      },
    });
    if (!member)
      throw new NotFoundException("Membro de equipe não encontrado.");
    if (member.teamId !== teamId)
      throw new BadRequestException(
        "O operador precisa pertencer à equipe do turno.",
      );
    if (member.team.status !== FieldTeamStatus.ACTIVE)
      throw new BadRequestException("A equipe do operador não está ativa.");
    if (
      member.status === MemberAvailability.UNAVAILABLE ||
      member.status === MemberAvailability.OFF_DUTY
    )
      throw new ConflictException(
        "O operador está indisponível para assignment.",
      );
    await this.ensureAvailable(memberId, startsAt, endsAt);
    return member;
  }

  private async ensureAvailable(
    memberId: string,
    startsAt: Date,
    endsAt: Date,
  ) {
    const unavailable = await this.prisma.fieldMemberUnavailability.findFirst({
      where: {
        memberId,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true, reason: true },
    });
    if (unavailable)
      throw new ConflictException(
        "O operador está indisponível neste intervalo: " +
          unavailable.reason +
          ".",
      );
  }

  private async requireActiveRole(roleId: string) {
    const role = await this.prisma.fieldRole.findUnique({
      where: { id: roleId },
      select: { id: true, active: true },
    });
    if (!role?.active)
      throw new BadRequestException(
        "A função operacional não existe ou está inativa.",
      );
  }

  private async validateRequirements(requirements?: SpecialtyRequirementDto[]) {
    if (!requirements?.length) return;
    if (
      new Set(requirements.map((item) => item.specialtyId)).size !==
      requirements.length
    )
      throw new BadRequestException(
        "Uma especialidade não pode ser exigida mais de uma vez.",
      );
    const count = await this.prisma.fieldSpecialty.count({
      where: {
        id: { in: requirements.map((item) => item.specialtyId) },
        active: true,
      },
    });
    if (count !== requirements.length)
      throw new BadRequestException(
        "Uma ou mais especialidades não existem ou estão inativas.",
      );
  }

  private validateInterval(startsAt: Date, endsAt: Date) {
    if (
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime()) ||
      endsAt <= startsAt
    )
      throw new BadRequestException(
        "O horário final deve ser posterior ao inicial.",
      );
  }

  private validateQueryRange(query: ShiftsQueryDto) {
    if (!query.startsFrom || !query.startsTo) return;
    const startsAt = new Date(query.startsFrom);
    const endsAt = new Date(query.startsTo);
    this.validateInterval(startsAt, endsAt);
    if (endsAt.getTime() - startsAt.getTime() > 62 * 86400000)
      throw new BadRequestException(
        "O intervalo de calendário deve ter no máximo 62 dias.",
      );
  }

  private async ensureNoConflict(
    shiftId: string,
    candidate: ScheduleInterval,
    excludeAssignmentId?: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const [assignments, legacyShifts] = await Promise.all([
      tx.fieldShiftAssignment.findMany({
        where: {
          memberId: candidate.memberId,
          id: excludeAssignmentId ? { not: excludeAssignmentId } : undefined,
          shiftId: { not: shiftId },
          status: {
            notIn: [
              FieldShiftAssignmentStatus.ABSENT,
              FieldShiftAssignmentStatus.REPLACED,
            ],
          },
          shift: {
            status: { not: FieldShiftStatus.CANCELLED },
            startsAt: { lt: candidate.endsAt },
            endsAt: { gt: candidate.startsAt },
          },
        },
        select: {
          id: true,
          memberId: true,
          startsAt: true,
          endsAt: true,
          status: true,
        },
      }),
      tx.fieldShift.findMany({
        where: {
          memberId: candidate.memberId,
          id: { not: shiftId },
          status: { not: FieldShiftStatus.CANCELLED },
          startsAt: { lt: candidate.endsAt },
          endsAt: { gt: candidate.startsAt },
        },
        select: {
          id: true,
          memberId: true,
          startsAt: true,
          endsAt: true,
        },
      }),
    ]);
    const otherIntervals: ScheduleInterval[] = [
      ...assignments.map((item) => ({
        id: item.id,
        memberId: item.memberId,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        status: item.status,
      })),
      ...legacyShifts.map((item) => ({
        id: item.id,
        memberId: candidate.memberId,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        status: FieldShiftAssignmentStatus.SCHEDULED,
      })),
    ];
    if (hasScheduleConflict(candidate, otherIntervals))
      throw new ConflictException(
        "O operador já possui outro turno neste intervalo.",
      );
  }

  private async serialized<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    try {
      return await this.prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      )
        throw new ConflictException(
          "A escala mudou durante esta operação. Atualize os dados e tente novamente.",
        );
      throw error;
    }
  }

  private async validateLocation(
    electionId: string,
    zoneId?: string,
    placeId?: string,
  ) {
    const election = await this.prisma.election.findUnique({
      where: { id: electionId },
      select: { id: true },
    });
    if (!election) throw new NotFoundException("Pleito não encontrado.");
    let resolvedZoneId = zoneId;
    if (zoneId) {
      const zone = await this.prisma.electoralZone.findUnique({
        where: { id: zoneId },
        select: { id: true, electionId: true },
      });
      if (!zone) throw new NotFoundException("Zona eleitoral não encontrada.");
      if (zone.electionId !== electionId)
        throw new BadRequestException(
          "A zona precisa pertencer ao pleito informado.",
        );
    }
    if (placeId) {
      const place = await this.prisma.pollingPlace.findUnique({
        where: { id: placeId },
        select: {
          id: true,
          electoralZoneId: true,
          electoralZone: { select: { electionId: true } },
        },
      });
      if (!place)
        throw new NotFoundException("Local de votação não encontrado.");
      if (place.electoralZone.electionId !== electionId)
        throw new BadRequestException(
          "O local precisa pertencer ao pleito informado.",
        );
      if (resolvedZoneId && place.electoralZoneId !== resolvedZoneId)
        throw new BadRequestException("O local não pertence à zona informada.");
      resolvedZoneId = place.electoralZoneId;
    }
    return resolvedZoneId ?? null;
  }

  private async emitCoverageAlert(
    shift: ShiftRecord,
    previous: ShiftCoverage | undefined,
    actorId: string,
  ) {
    const coverage = calculateCoverage(shift);
    if (
      coverage.state === "FULL" ||
      shift.status === FieldShiftStatus.CANCELLED ||
      (previous && previous.state !== "FULL")
    )
      return;
    await this.prisma.fieldShiftHistory.create({
      data: {
        shiftId: shift.id,
        actorId,
        action: FieldShiftHistoryAction.COVERAGE_INSUFFICIENT,
        description:
          "Cobertura insuficiente: " +
          coverage.availableOperators +
          "/" +
          coverage.requiredOperators +
          " operadores.",
        metadata: coverage as unknown as Prisma.InputJsonValue,
      },
    });
    await this.eventBus.emit("shift.coverage_insufficient", {
      entityId: shift.id,
      actorId,
      name: this.shiftName(shift),
      electionId: shift.team.electionId,
      requiredOperators: coverage.requiredOperators,
      availableOperators: coverage.availableOperators,
    });
  }

  private shiftName(shift: Pick<ShiftRecord, "name" | "id">) {
    return shift.name ?? "Turno " + shift.id.slice(-6);
  }
}
