import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AssetCondition,
  AssetMaintenanceStatus,
  AssetStatus,
  FieldShiftStatus,
  IncidentStatus,
  Prisma,
  ShiftHandoverHistoryAction,
  ShiftHandoverStatus,
  TaskStatus,
  UserStatus,
} from "@prisma/client";
import { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import { PERMISSIONS } from "@eops/security";
import type { CreateHandoverDto, HandoverQueryDto, UpdateHandoverDto } from "./dto/shift-handovers.dto";

const participant = { select: { id: true, name: true, email: true } } as const;
const handoverInclude = {
  shift: {
    include: {
      team: { include: { election: { select: { id: true, name: true } } } },
      electoralZone: { select: { id: true, name: true, number: true } },
      pollingPlace: { select: { id: true, name: true } },
    },
  },
  sender: participant,
  recipient: participant,
  confirmedBy: participant,
  cancelledBy: participant,
  incidents: { include: { incident: { select: { id: true, code: true, title: true, status: true, severity: true } } } },
  tasks: { include: { task: { select: { id: true, title: true, status: true, priority: true } } } },
  assets: { include: { asset: { select: { id: true, assetTag: true, name: true, status: true, condition: true } } } },
  history: {
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.ShiftHandoverInclude;

type HandoverRecord = Prisma.ShiftHandoverGetPayload<{ include: typeof handoverInclude }>;

export function normalizeReferenceIds(values?: readonly string[]) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

export function allowedLifecycleTransition(from: ShiftHandoverStatus, to: ShiftHandoverStatus) {
  return (
    (from === ShiftHandoverStatus.DRAFT &&
      (to === ShiftHandoverStatus.PENDING_CONFIRMATION || to === ShiftHandoverStatus.CANCELLED)) ||
    (from === ShiftHandoverStatus.PENDING_CONFIRMATION &&
      (to === ShiftHandoverStatus.CONFIRMED || to === ShiftHandoverStatus.CANCELLED))
  );
}

export function availableHandoverActions(
  handover: Pick<HandoverRecord, "status" | "senderUserId" | "recipientUserId">,
  actorId: string,
  permissions: readonly string[],
) {
  const actions: string[] = [];
  const manages = permissions.includes(PERMISSIONS.shiftHandovers.manage);
  const confirms = permissions.includes(PERMISSIONS.shiftHandovers.confirm);
  if (handover.status === ShiftHandoverStatus.DRAFT && handover.senderUserId === actorId && manages) {
    actions.push("edit", "submit", "cancel");
  }
  if (
    handover.status === ShiftHandoverStatus.PENDING_CONFIRMATION &&
    handover.recipientUserId === actorId &&
    confirms
  ) actions.push("confirm");
  if (
    handover.status === ShiftHandoverStatus.PENDING_CONFIRMATION &&
    handover.senderUserId === actorId &&
    manages
  ) actions.push("cancel");
  return actions;
}

@Injectable()
export class ShiftHandoversService {
  constructor(private readonly prisma: PrismaService, private readonly eventBus: EventBus) {}

  async dashboard(actorId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [drafts, pending, pendingForMe, confirmedToday, recent] = await this.prisma.$transaction([
      this.prisma.shiftHandover.count({ where: { senderUserId: actorId, status: ShiftHandoverStatus.DRAFT } }),
      this.prisma.shiftHandover.count({ where: { status: ShiftHandoverStatus.PENDING_CONFIRMATION } }),
      this.prisma.shiftHandover.count({ where: { recipientUserId: actorId, status: ShiftHandoverStatus.PENDING_CONFIRMATION } }),
      this.prisma.shiftHandover.count({ where: { status: ShiftHandoverStatus.CONFIRMED, confirmedAt: { gte: start } } }),
      this.prisma.shiftHandover.findMany({ include: handoverInclude, orderBy: { updatedAt: "desc" }, take: 8 }),
    ]);
    return { drafts, pending, pendingForMe, confirmedToday, recent };
  }

  async list(query: HandoverQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ShiftHandoverWhereInput = {
      shiftId: query.shiftId,
      status: query.status,
      senderUserId: query.senderUserId,
      recipientUserId: query.recipientUserId,
      shift: query.electionId ? { team: { electionId: query.electionId } } : undefined,
      createdAt: query.from || query.to ? {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      } : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.shiftHandover.findMany({ where, include: handoverInclude, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.shiftHandover.count({ where }),
    ]);
    return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async context(shiftId: string) {
    const shift = await this.shiftContext(shiftId);
    const electionId = shift.team.electionId;
    const [incidents, tasks, assets, recipients] = await Promise.all([
      this.prisma.incident.findMany({
        where: { electionId, status: { notIn: [IncidentStatus.CLOSED, IncidentStatus.CANCELLED] } },
        select: { id: true, code: true, title: true, status: true, severity: true, slaDeadline: true, electoralZoneId: true, pollingPlaceId: true },
        orderBy: [{ severity: "desc" }, { slaDeadline: "asc" }], take: 100,
      }),
      this.prisma.task.findMany({
        where: { electionId, status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] } },
        select: { id: true, title: true, status: true, priority: true, dueAt: true, electoralZoneId: true, pollingPlaceId: true },
        orderBy: [{ priority: "desc" }, { dueAt: "asc" }], take: 100,
      }),
      this.prisma.asset.findMany({
        where: { OR: [
          { status: { in: [AssetStatus.MAINTENANCE, AssetStatus.LOST] } },
          { condition: { in: [AssetCondition.ATTENTION, AssetCondition.DAMAGED, AssetCondition.UNAVAILABLE] } },
          { maintenances: { some: { status: { in: [AssetMaintenanceStatus.OPEN, AssetMaintenanceStatus.IN_PROGRESS] } } } },
          { assignments: { some: { endedAt: null, OR: [{ problemDetected: true }, { expectedReturnAt: { lt: new Date() } }] } } },
        ] },
        select: { id: true, assetTag: true, name: true, status: true, condition: true, electoralZoneId: true, pollingPlaceId: true },
        orderBy: { updatedAt: "desc" }, take: 100,
      }),
      this.prisma.user.findMany({ where: { status: UserStatus.ACTIVE }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    ]);
    const proximity = (item: { electoralZoneId: string | null; pollingPlaceId: string | null }) =>
      item.pollingPlaceId && item.pollingPlaceId === shift.pollingPlaceId ? 2 :
        item.electoralZoneId && item.electoralZoneId === shift.electoralZoneId ? 1 : 0;
    return {
      shift,
      incidents: incidents.sort((a, b) => proximity(b) - proximity(a)),
      tasks: tasks.sort((a, b) => proximity(b) - proximity(a)),
      assets: assets.sort((a, b) => proximity(b) - proximity(a)),
      recipients,
    };
  }

  async findOne(id: string, actorId: string, permissions: readonly string[] = []) {
    const record = await this.prisma.shiftHandover.findUnique({ where: { id }, include: handoverInclude });
    if (!record) throw new NotFoundException("Passagem de turno não encontrada.");
    return { ...record, availableActions: availableHandoverActions(record, actorId, permissions) };
  }

  async create(dto: CreateHandoverDto, actorId: string, permissions: readonly string[] = []) {
    await this.validateRecipient(dto.recipientUserId, actorId);
    const refs = await this.validateReferences(dto.shiftId, dto.incidentIds, dto.taskIds, dto.assetIds);
    const record = await this.prisma.shiftHandover.create({
      data: {
        shiftId: dto.shiftId,
        senderUserId: actorId,
        recipientUserId: dto.recipientUserId,
        summary: dto.summary.trim(),
        pendingNotes: dto.pendingNotes?.trim() || null,
        observations: dto.observations?.trim() || null,
        incidents: { createMany: { data: refs.incidentIds.map((incidentId) => ({ incidentId })) } },
        tasks: { createMany: { data: refs.taskIds.map((taskId) => ({ taskId })) } },
        assets: { createMany: { data: refs.assetIds.map((assetId) => ({ assetId })) } },
        history: { create: { actorId, action: ShiftHandoverHistoryAction.CREATED, description: "Passagem criada como rascunho." } },
      },
      include: handoverInclude,
    });
    await this.eventBus.emit("shift_handover.created", { entityId: record.id, actorId, shiftId: record.shiftId, senderUserId: actorId, recipientUserId: record.recipientUserId });
    return { ...record, availableActions: availableHandoverActions(record, actorId, permissions) };
  }

  async update(id: string, dto: UpdateHandoverDto, actorId: string, permissions: readonly string[] = []) {
    const current = await this.requireEditable(id, actorId);
    const recipientUserId = dto.recipientUserId ?? current.recipientUserId;
    await this.validateRecipient(recipientUserId, actorId);
    const currentIncidentIds = current.incidents.map((item) => item.incidentId);
    const currentTaskIds = current.tasks.map((item) => item.taskId);
    const currentAssetIds = current.assets.map((item) => item.assetId);
    const refs = await this.validateReferences(
      current.shiftId,
      dto.incidentIds ?? currentIncidentIds,
      dto.taskIds ?? currentTaskIds,
      dto.assetIds ?? currentAssetIds,
    );
    const changes = Object.keys(dto).filter((key) => (dto as Record<string, unknown>)[key] !== undefined);
    const historyData: Prisma.ShiftHandoverHistoryCreateManyInput[] = [
      { handoverId: id, actorId, action: ShiftHandoverHistoryAction.UPDATED, description: "Conteúdo da passagem atualizado.", metadata: { changes } },
    ];
    const referenceHistory = (
      before: string[],
      after: string[],
      added: ShiftHandoverHistoryAction,
      removed: ShiftHandoverHistoryAction,
      key: string,
    ) => {
      after.filter((value) => !before.includes(value)).forEach((value) => historyData.push({ handoverId: id, actorId, action: added, description: "Referência associada à passagem.", metadata: { [key]: value } }));
      before.filter((value) => !after.includes(value)).forEach((value) => historyData.push({ handoverId: id, actorId, action: removed, description: "Referência removida da passagem.", metadata: { [key]: value } }));
    };
    if (dto.incidentIds) referenceHistory(currentIncidentIds, refs.incidentIds, ShiftHandoverHistoryAction.INCIDENT_ADDED, ShiftHandoverHistoryAction.INCIDENT_REMOVED, "incidentId");
    if (dto.taskIds) referenceHistory(currentTaskIds, refs.taskIds, ShiftHandoverHistoryAction.TASK_ADDED, ShiftHandoverHistoryAction.TASK_REMOVED, "taskId");
    if (dto.assetIds) referenceHistory(currentAssetIds, refs.assetIds, ShiftHandoverHistoryAction.ASSET_ADDED, ShiftHandoverHistoryAction.ASSET_REMOVED, "assetId");
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.shiftHandover.update({ where: { id }, data: {
        recipientUserId,
        summary: dto.summary?.trim(),
        pendingNotes: dto.pendingNotes === undefined ? undefined : dto.pendingNotes.trim() || null,
        observations: dto.observations === undefined ? undefined : dto.observations.trim() || null,
      } });
      if (dto.incidentIds) { await tx.shiftHandoverIncident.deleteMany({ where: { handoverId: id } }); await tx.shiftHandoverIncident.createMany({ data: refs.incidentIds.map((incidentId) => ({ handoverId: id, incidentId })) }); }
      if (dto.taskIds) { await tx.shiftHandoverTask.deleteMany({ where: { handoverId: id } }); await tx.shiftHandoverTask.createMany({ data: refs.taskIds.map((taskId) => ({ handoverId: id, taskId })) }); }
      if (dto.assetIds) { await tx.shiftHandoverAsset.deleteMany({ where: { handoverId: id } }); await tx.shiftHandoverAsset.createMany({ data: refs.assetIds.map((assetId) => ({ handoverId: id, assetId })) }); }
      await tx.shiftHandoverHistory.createMany({ data: historyData });
      return tx.shiftHandover.findUniqueOrThrow({ where: { id }, include: handoverInclude });
    });
    await this.eventBus.emit("shift_handover.updated", { entityId: id, actorId, shiftId: record.shiftId, senderUserId: record.senderUserId, recipientUserId: record.recipientUserId, changes });
    return { ...record, availableActions: availableHandoverActions(record, actorId, permissions) };
  }

  async submit(id: string, actorId: string, permissions: readonly string[] = []) {
    const current = await this.requireEditable(id, actorId);
    if (!current.summary.trim()) throw new BadRequestException("Informe um resumo antes de enviar.");
    if (current.shift.status !== FieldShiftStatus.IN_PROGRESS && current.shift.status !== FieldShiftStatus.COMPLETED) {
      throw new ConflictException("A passagem só pode ser enviada para turno iniciado ou concluído.");
    }
    await this.validateRecipient(current.recipientUserId, actorId);
    await this.validateReferences(current.shiftId, current.incidents.map((item) => item.incidentId), current.tasks.map((item) => item.taskId), current.assets.map((item) => item.assetId));
    return this.transition(current, ShiftHandoverStatus.PENDING_CONFIRMATION, actorId, permissions);
  }

  async confirm(id: string, actorId: string, permissions: readonly string[] = []) {
    const current = await this.raw(id);
    if (current.recipientUserId !== actorId) throw new ForbiddenException("Somente o destinatário pode confirmar esta passagem.");
    return this.transition(current, ShiftHandoverStatus.CONFIRMED, actorId, permissions);
  }

  async cancel(id: string, reason: string | undefined, actorId: string, permissions: readonly string[] = []) {
    const current = await this.raw(id);
    if (current.senderUserId !== actorId) throw new ForbiddenException("Somente o remetente pode cancelar esta passagem.");
    if (current.status === ShiftHandoverStatus.PENDING_CONFIRMATION && !reason?.trim()) {
      throw new BadRequestException("Informe o motivo do cancelamento.");
    }
    return this.transition(current, ShiftHandoverStatus.CANCELLED, actorId, permissions, reason?.trim());
  }

  private async transition(current: HandoverRecord, to: ShiftHandoverStatus, actorId: string, permissions: readonly string[], reason?: string) {
    if (!allowedLifecycleTransition(current.status, to)) throw new ConflictException(`Transição ${current.status} → ${to} não permitida.`);
    const now = new Date();
    const action = to === ShiftHandoverStatus.PENDING_CONFIRMATION ? ShiftHandoverHistoryAction.SUBMITTED : to === ShiftHandoverStatus.CONFIRMED ? ShiftHandoverHistoryAction.CONFIRMED : ShiftHandoverHistoryAction.CANCELLED;
    const record = await this.prisma.shiftHandover.update({
      where: { id: current.id },
      data: {
        status: to,
        submittedAt: to === ShiftHandoverStatus.PENDING_CONFIRMATION ? now : undefined,
        confirmedAt: to === ShiftHandoverStatus.CONFIRMED ? now : undefined,
        confirmedById: to === ShiftHandoverStatus.CONFIRMED ? actorId : undefined,
        cancelledAt: to === ShiftHandoverStatus.CANCELLED ? now : undefined,
        cancelledById: to === ShiftHandoverStatus.CANCELLED ? actorId : undefined,
        cancellationReason: to === ShiftHandoverStatus.CANCELLED ? reason ?? null : undefined,
        history: { create: { actorId, action, description: to === ShiftHandoverStatus.PENDING_CONFIRMATION ? "Passagem enviada para confirmação." : to === ShiftHandoverStatus.CONFIRMED ? "Recebimento da passagem confirmado." : "Passagem cancelada.", metadata: { from: current.status, to, ...(reason ? { reason } : {}) } } },
      }, include: handoverInclude,
    });
    const payload = { entityId: record.id, actorId, shiftId: record.shiftId, shiftName: record.shift.name ?? "Turno", senderUserId: record.senderUserId, recipientUserId: record.recipientUserId, from: current.status, to };
    if (to === ShiftHandoverStatus.PENDING_CONFIRMATION) await this.eventBus.emit("shift_handover.submitted", { ...payload, submittedAt: now.toISOString() });
    else if (to === ShiftHandoverStatus.CONFIRMED) await this.eventBus.emit("shift_handover.confirmed", { ...payload, confirmedAt: now.toISOString() });
    else await this.eventBus.emit("shift_handover.cancelled", { ...payload, reason, cancelledAt: now.toISOString() });
    return { ...record, availableActions: availableHandoverActions(record, actorId, permissions) };
  }

  private async requireEditable(id: string, actorId: string) {
    const record = await this.raw(id);
    if (record.senderUserId !== actorId) throw new ForbiddenException("Somente o remetente pode editar esta passagem.");
    if (record.status !== ShiftHandoverStatus.DRAFT) throw new ConflictException("Somente rascunhos podem ser editados.");
    return record;
  }

  private async raw(id: string) {
    const record = await this.prisma.shiftHandover.findUnique({ where: { id }, include: handoverInclude });
    if (!record) throw new NotFoundException("Passagem de turno não encontrada.");
    return record;
  }

  private async validateRecipient(recipientUserId: string, senderUserId: string) {
    if (recipientUserId === senderUserId) throw new BadRequestException("Remetente e destinatário devem ser diferentes.");
    const recipient = await this.prisma.user.findUnique({ where: { id: recipientUserId }, select: { status: true } });
    if (!recipient || recipient.status !== UserStatus.ACTIVE) throw new BadRequestException("Selecione um destinatário ativo.");
  }

  private async shiftContext(shiftId: string) {
    const shift = await this.prisma.fieldShift.findUnique({
      where: { id: shiftId },
      select: { id: true, name: true, status: true, startsAt: true, endsAt: true, electoralZoneId: true, pollingPlaceId: true, team: { select: { id: true, name: true, electionId: true } } },
    });
    if (!shift) throw new NotFoundException("Turno não encontrado.");
    return shift;
  }

  private async validateReferences(shiftId: string, incidentValues?: readonly string[], taskValues?: readonly string[], assetValues?: readonly string[]) {
    const shift = await this.shiftContext(shiftId);
    const incidentIds = normalizeReferenceIds(incidentValues);
    const taskIds = normalizeReferenceIds(taskValues);
    const assetIds = normalizeReferenceIds(assetValues);
    const [incidents, tasks, assets] = await Promise.all([
      this.prisma.incident.findMany({ where: { id: { in: incidentIds } }, select: { id: true, electionId: true, electoralZoneId: true, pollingPlaceId: true } }),
      this.prisma.task.findMany({ where: { id: { in: taskIds } }, select: { id: true, electionId: true, electoralZoneId: true, pollingPlaceId: true } }),
      this.prisma.asset.findMany({ where: { id: { in: assetIds } }, select: { id: true, electoralZoneId: true, pollingPlaceId: true } }),
    ]);
    if (incidents.length !== incidentIds.length || tasks.length !== taskIds.length || assets.length !== assetIds.length) throw new BadRequestException("Uma ou mais referências não existem.");
    const locationCompatible = (item: { electoralZoneId: string | null; pollingPlaceId: string | null }) =>
      !(shift.electoralZoneId && item.electoralZoneId && shift.electoralZoneId !== item.electoralZoneId) &&
      !(shift.pollingPlaceId && item.pollingPlaceId && shift.pollingPlaceId !== item.pollingPlaceId);
    if (incidents.some((item) => item.electionId !== shift.team.electionId || !locationCompatible(item))) throw new BadRequestException("Incidente incompatível com o pleito ou local do turno.");
    if (tasks.some((item) => item.electionId !== shift.team.electionId || !locationCompatible(item))) throw new BadRequestException("Tarefa incompatível com o pleito ou local do turno.");
    if (assets.some((item) => !locationCompatible(item))) throw new BadRequestException("Ativo incompatível com o local do turno.");
    return { incidentIds, taskIds, assetIds };
  }
}
