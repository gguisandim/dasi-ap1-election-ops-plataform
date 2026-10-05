import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  PreparationChecklistHistoryAction,
  PreparationChecklistItemStatus,
  PreparationChecklistStatus,
  Prisma,
  UserStatus,
} from "@prisma/client";
import { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import type { CriticalBlocker, CriticalBlockerReason, DeadlineState } from "../types";
import {
  AddTemplateItemDto,
  CreateChecklistDto,
  CreateChecklistEvidenceDto,
  CreateTemplateDto,
  PreparationChecklistsQueryDto,
  TemplatesQueryDto,
  UpdateChecklistItemDto,
  UpdateChecklistAssigneeDto,
  UpdateChecklistDueDateDto,
  UpdateTemplateDto,
} from "./dto/preparation-checklists.dto";

const templateInclude = {
  items: { orderBy: { order: "asc" as const } },
} satisfies Prisma.PreparationChecklistTemplateInclude;

const checklistInclude = {
  election: { select: { id: true, name: true, year: true } },
  electoralZone: { select: { id: true, number: true, name: true } },
  pollingPlace: { select: { id: true, name: true, address: true } },
  template: { select: { id: true, name: true, version: true } },
  assignee: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  items: { include: { assignee: { select: { id: true, name: true, email: true } }, evidences: { include: { recordedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" as const } } }, orderBy: { order: "asc" as const } },
  history: { include: { actor: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" as const }, take: 100 },
} satisfies Prisma.PreparationChecklistInclude;

type ChecklistStatusInput = { required: boolean; evidenceRequired: boolean; status: PreparationChecklistItemStatus; evidences?: readonly unknown[] };
type DerivedItem = ChecklistStatusInput & { id: string; title: string; evidences?: readonly unknown[] };
type ChecklistDerivedInput = { dueAt: Date | string | null; status: PreparationChecklistStatus; items: readonly DerivedItem[] };

export const DEADLINE_AT_RISK_WINDOW_MS = 24 * 60 * 60 * 1000;

export function calculateChecklistProgress(items: readonly { status: PreparationChecklistItemStatus }[]) {
  if (items.length === 0) return 0;
  return Math.round((items.filter((item) => item.status === PreparationChecklistItemStatus.COMPLETED).length / items.length) * 100);
}

export function calculateReadiness(items: readonly { required: boolean; status: PreparationChecklistItemStatus }[]) {
  if (items.length === 0) return 0;
  const required = items.filter((item) => item.required);
  const pool = required.length > 0 ? required : items;
  const completed = pool.filter((item) => item.status === PreparationChecklistItemStatus.COMPLETED).length;
  return Math.round((completed / pool.length) * 100);
}

export function listCriticalBlockers(items: readonly DerivedItem[]): CriticalBlocker[] {
  const blockers: CriticalBlocker[] = [];
  for (const item of items) {
    const reasons: CriticalBlockerReason[] = [];
    if (item.required && item.status !== PreparationChecklistItemStatus.COMPLETED) reasons.push("REQUIRED_PENDING");
    if (item.evidenceRequired && (item.evidences?.length ?? 0) === 0) reasons.push("MISSING_EVIDENCE");
    if (item.status === PreparationChecklistItemStatus.BLOCKED) reasons.push("BLOCKED");
    if (reasons.length > 0) blockers.push({ itemId: item.id, title: item.title, reasons });
  }
  return blockers;
}

export function criticalBlockerKeys(blockers: readonly CriticalBlocker[]) {
  return blockers.flatMap((blocker) => blocker.reasons.map((reason) => `${blocker.itemId}:${reason}`));
}

export function deriveDeadlineState(dueAt: Date | string | null | undefined, status: PreparationChecklistStatus, now: Date = new Date()): DeadlineState {
  if (status === PreparationChecklistStatus.APPROVED) return "ON_TRACK";
  if (!dueAt) return "ON_TRACK";
  const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
  if (Number.isNaN(due.getTime())) return "ON_TRACK";
  if (now.getTime() > due.getTime()) return "OVERDUE";
  if (due.getTime() - now.getTime() <= DEADLINE_AT_RISK_WINDOW_MS) return "AT_RISK";
  return "ON_TRACK";
}

export function deriveChecklistStatus(items: readonly ChecklistStatusInput[], assigneeId?: string | null) {
  if (items.some((item) => item.required && item.status === PreparationChecklistItemStatus.BLOCKED)) return PreparationChecklistStatus.BLOCKED;
  const approvalItemsReady = items.every((item) => !item.required || item.status === PreparationChecklistItemStatus.COMPLETED);
  const evidenceReady = items.every((item) => !item.evidenceRequired || (item.evidences?.length ?? 0) > 0);
  if (approvalItemsReady && evidenceReady && assigneeId) return PreparationChecklistStatus.READY_FOR_APPROVAL;
  if (items.some((item) => item.status === PreparationChecklistItemStatus.IN_PROGRESS || item.status === PreparationChecklistItemStatus.COMPLETED)) return PreparationChecklistStatus.IN_PROGRESS;
  return PreparationChecklistStatus.PENDING;
}

function withProgress<T extends ChecklistDerivedInput>(checklist: T) {
  const items = checklist.items;
  return {
    ...checklist,
    progress: calculateChecklistProgress(items),
    readiness: calculateReadiness(items),
    criticalBlockers: listCriticalBlockers(items),
    deadlineState: deriveDeadlineState(checklist.dueAt, checklist.status),
    totals: {
      total: items.length,
      completed: items.filter((item) => item.status === PreparationChecklistItemStatus.COMPLETED).length,
      pending: items.filter((item) => item.status === PreparationChecklistItemStatus.PENDING || item.status === PreparationChecklistItemStatus.IN_PROGRESS).length,
      blocked: items.filter((item) => item.status === PreparationChecklistItemStatus.BLOCKED).length,
      requiredPending: items.filter((item) => item.required && item.status !== PreparationChecklistItemStatus.COMPLETED).length,
    },
  };
}

@Injectable()
export class PreparationChecklistsService {
  constructor(private readonly prisma: PrismaService, private readonly eventBus: EventBus) {}

  async references() {
    const [elections, zones, places, users] = await Promise.all([
      this.prisma.election.findMany({ select: { id: true, name: true, year: true }, orderBy: [{ year: "desc" }, { name: "asc" }] }),
      this.prisma.electoralZone.findMany({ select: { id: true, electionId: true, number: true, name: true }, orderBy: [{ number: "asc" }] }),
      this.prisma.pollingPlace.findMany({ select: { id: true, electoralZoneId: true, name: true }, orderBy: { name: "asc" } }),
      this.prisma.user.findMany({ where: { status: UserStatus.ACTIVE }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    ]);
    return { elections, zones, places, users };
  }

  templates(query: TemplatesQueryDto) {
    return this.prisma.preparationChecklistTemplate.findMany({ where: { active: query.active }, include: templateInclude, orderBy: { name: "asc" } });
  }

  async findTemplate(id: string) {
    const template = await this.prisma.preparationChecklistTemplate.findUnique({ where: { id }, include: templateInclude });
    if (!template) throw new NotFoundException("Modelo de checklist não encontrado.");
    return template;
  }

  async createTemplate(dto: CreateTemplateDto) {
    const items = dto.items ?? [];
    const orders = items.map((item, index) => item.order ?? index + 1);
    if (new Set(orders).size !== orders.length) throw new BadRequestException("A ordem dos itens do modelo deve ser única.");
    return this.prisma.preparationChecklistTemplate.create({
      data: {
        name: dto.name,
        description: dto.description,
        locationType: dto.locationType,
        active: dto.active,
        ...(items.length ? { items: { create: items.map((item, index) => ({ ...item, order: item.order ?? index + 1 })) } } : {}),
      },
      include: templateInclude,
    });
  }

  async updateTemplate(id: string, dto: UpdateTemplateDto) {
    const current = await this.findTemplate(id);
    const semanticChange = (dto.description !== undefined && dto.description !== current.description) || (dto.locationType !== undefined && dto.locationType !== current.locationType);
    return this.prisma.preparationChecklistTemplate.update({
      where: { id },
      data: { ...dto, ...(semanticChange ? { version: { increment: 1 } } : {}) },
      include: templateInclude,
    });
  }

  async addTemplateItem(templateId: string, dto: AddTemplateItemDto) {
    await this.findTemplate(templateId);
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.preparationChecklistTemplateItem.create({ data: { ...dto, templateId } });
      await tx.preparationChecklistTemplate.update({ where: { id: templateId }, data: { version: { increment: 1 } } });
      return item;
    });
  }

  checklists(query: PreparationChecklistsQueryDto) {
    return this.prisma.preparationChecklist.findMany({
      where: { electionId: query.electionId, electoralZoneId: query.electoralZoneId, pollingPlaceId: query.pollingPlaceId, assigneeId: query.assigneeId, status: query.status },
      include: checklistInclude,
      orderBy: { updatedAt: "desc" },
    }).then((items) => items.map(withProgress));
  }

  async overview(query: PreparationChecklistsQueryDto) {
    const rows = await this.prisma.preparationChecklist.findMany({
      where: { electionId: query.electionId, electoralZoneId: query.electoralZoneId, pollingPlaceId: query.pollingPlaceId, assigneeId: query.assigneeId, status: query.status },
      include: {
        election: { select: { id: true, name: true, year: true } },
        electoralZone: { select: { id: true, electionId: true, number: true, name: true } },
        pollingPlace: { select: { id: true, electoralZoneId: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        items: { include: { evidences: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => ({
      id: row.id,
      election: row.election,
      electoralZone: row.electoralZone,
      pollingPlace: row.pollingPlace,
      readiness: calculateReadiness(row.items),
      criticalBlockers: listCriticalBlockers(row.items).length,
      assignee: row.assignee,
      dueAt: row.dueAt,
      deadlineState: deriveDeadlineState(row.dueAt, row.status),
      status: row.status,
      progress: calculateChecklistProgress(row.items),
    }));
  }

  async findChecklist(id: string) {
    const checklist = await this.prisma.preparationChecklist.findUnique({ where: { id }, include: checklistInclude });
    if (!checklist) throw new NotFoundException("Checklist não encontrado.");
    return withProgress(checklist);
  }

  async dashboard(query: PreparationChecklistsQueryDto) {
    const checklists = await this.prisma.preparationChecklist.findMany({
      where: { electionId: query.electionId, electoralZoneId: query.electoralZoneId, pollingPlaceId: query.pollingPlaceId, assigneeId: query.assigneeId, status: query.status },
      include: checklistInclude,
      orderBy: { updatedAt: "desc" },
    });
    const summaries = checklists.map(withProgress);
    const criticalChecklists = summaries.filter((checklist) => checklist.criticalBlockers.length > 0);
    return {
      totalChecklists: checklists.length,
      approvedPlaces: checklists.filter((item) => item.status === PreparationChecklistStatus.APPROVED).length,
      awaitingApproval: checklists.filter((item) => item.status === PreparationChecklistStatus.READY_FOR_APPROVAL).length,
      blockedPlaces: checklists.filter((item) => item.status === PreparationChecklistStatus.BLOCKED).length,
      averageProgress: summaries.length ? Math.round(summaries.reduce((sum, item) => sum + item.progress, 0) / summaries.length) : 0,
      averageReadiness: summaries.length ? Math.round(summaries.reduce((sum, item) => sum + item.readiness, 0) / summaries.length) : 0,
      criticalPending: criticalChecklists.length,
      criticalBlockers: summaries.reduce((sum, item) => sum + item.criticalBlockers.length, 0),
      criticalChecklists: criticalChecklists.slice(0, 10),
    };
  }

  async createChecklist(dto: CreateChecklistDto, actorId: string) {
    await this.validateLocation(dto.electionId, dto.electoralZoneId, dto.pollingPlaceId);
    const template = await this.prisma.preparationChecklistTemplate.findUnique({ where: { id: dto.templateId }, include: templateInclude });
    if (!template?.active) throw new NotFoundException("Modelo não encontrado ou inativo.");
    if (template.locationType !== "POLLING_PLACE") throw new BadRequestException("O modelo não se aplica a locais de votação.");
    if (template.items.length === 0) throw new BadRequestException("O modelo precisa ter ao menos um item.");
    if (dto.assigneeId) await this.requireActiveUser(dto.assigneeId);
    const checklist = await this.prisma.$transaction(async (tx) => {
      const created = await tx.preparationChecklist.create({
        data: {
          electionId: dto.electionId,
          electoralZoneId: dto.electoralZoneId,
          pollingPlaceId: dto.pollingPlaceId,
          templateId: dto.templateId,
          assigneeId: dto.assigneeId,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
          templateVersion: template.version,
          items: { create: template.items.map(({ title, description, order, required, evidenceRequired }) => ({ title, description, order, required, evidenceRequired })) },
        },
      });
      await tx.preparationChecklistHistory.create({ data: { checklistId: created.id, actorId, action: PreparationChecklistHistoryAction.CREATED, message: "Checklist criado a partir de um modelo." } });
      return tx.preparationChecklist.findUniqueOrThrow({ where: { id: created.id }, include: checklistInclude });
    });
    return withProgress(checklist);
  }

  async updateItem(itemId: string, dto: UpdateChecklistItemDto, actorId: string) {
    const item = await this.prisma.preparationChecklistItem.findUnique({ where: { id: itemId }, include: { evidences: true, checklist: { include: { items: { include: { evidences: true } } } } } });
    if (!item) throw new NotFoundException("Item do checklist não encontrado.");
    if (item.checklist.status === PreparationChecklistStatus.APPROVED) throw new BadRequestException("Revogue a aprovação antes de alterar itens.");
    if (dto.assigneeId) await this.requireActiveUser(dto.assigneeId);
    const nextStatus = dto.status ?? item.status;
    if (nextStatus === PreparationChecklistItemStatus.COMPLETED && item.evidenceRequired && item.evidences.length === 0) throw new BadRequestException("Este item exige evidência para ser concluído.");
    const previousStatus = item.status;
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.preparationChecklistItem.update({
        where: { id: itemId },
        data: {
          status: dto.status,
          assigneeId: dto.assigneeId,
          observation: dto.observation,
          dueAt: dto.dueAt === undefined ? undefined : dto.dueAt ? new Date(dto.dueAt) : null,
          completedAt: dto.status === PreparationChecklistItemStatus.COMPLETED ? item.completedAt ?? new Date() : dto.status ? null : undefined,
        },
      });
      await tx.preparationChecklistHistory.create({ data: { checklistId: item.checklistId, actorId, action: PreparationChecklistHistoryAction.ITEM_UPDATED, message: `Item "${item.title}" atualizado.`, metadata: { itemId, from: previousStatus, to: nextStatus, observation: dto.observation } } });
      if (nextStatus === PreparationChecklistItemStatus.COMPLETED && previousStatus !== PreparationChecklistItemStatus.COMPLETED) {
        await tx.preparationChecklistHistory.create({ data: { checklistId: item.checklistId, actorId, action: PreparationChecklistHistoryAction.ITEM_COMPLETED, message: `Item "${item.title}" concluído.`, metadata: { itemId } } });
      }
      return this.refreshStatus(tx, item.checklistId, actorId, item.title);
    });
    if (result.enteredBlocked) await this.emitBlocked(result, actorId);
    const payload = await this.findChecklist(item.checklistId);
    await this.emitDerivedChanges(item.checklist.items, payload, actorId);
    return payload;
  }

  async updateAssignee(id: string, dto: UpdateChecklistAssigneeDto, actorId: string) {
    const checklist = await this.prisma.preparationChecklist.findUnique({ where: { id } });
    if (!checklist) throw new NotFoundException("Checklist não encontrado.");
    if (checklist.status === PreparationChecklistStatus.APPROVED) throw new BadRequestException("Revogue a aprovação antes de alterar o responsável.");
    if (dto.assigneeId === undefined) throw new BadRequestException("Informe o novo responsável ou null para remover a atribuição.");
    if (dto.assigneeId) await this.requireActiveUser(dto.assigneeId);
    await this.prisma.$transaction(async (tx) => {
      await tx.preparationChecklist.update({ where: { id }, data: { assigneeId: dto.assigneeId ?? null } });
      await tx.preparationChecklistHistory.create({ data: { checklistId: id, actorId, action: PreparationChecklistHistoryAction.ASSIGNEE_CHANGED, message: dto.assigneeId ? "Responsável pelo checklist atualizado." : "Responsável removido do checklist.", metadata: { assigneeId: dto.assigneeId } } });
      await this.refreshStatus(tx, id, actorId, "responsável atualizado");
    });
    return this.findChecklist(id);
  }

  async updateDueDate(id: string, dto: UpdateChecklistDueDateDto) {
    const checklist = await this.prisma.preparationChecklist.findUnique({ where: { id } });
    if (!checklist) throw new NotFoundException("Checklist não encontrado.");
    if (checklist.status === PreparationChecklistStatus.APPROVED) throw new BadRequestException("Revogue a aprovação antes de alterar o prazo.");
    if (dto.dueAt === undefined) throw new BadRequestException("Informe o novo prazo ou null para remover.");
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    await this.prisma.preparationChecklist.update({ where: { id }, data: { dueAt } });
    return this.findChecklist(id);
  }

  async addEvidence(itemId: string, dto: CreateChecklistEvidenceDto, actorId: string) {
    const item = await this.prisma.preparationChecklistItem.findUnique({ where: { id: itemId }, include: { checklist: { include: { items: { include: { evidences: true } } } } } });
    if (!item) throw new NotFoundException("Item do checklist não encontrado.");
    if (item.checklist.status === PreparationChecklistStatus.APPROVED) throw new BadRequestException("Revogue a aprovação antes de alterar evidências.");
    const result = await this.prisma.$transaction(async (tx) => {
      const evidence = await tx.preparationChecklistEvidence.create({ data: { ...dto, itemId, recordedById: actorId } });
      await tx.preparationChecklistHistory.create({ data: { checklistId: item.checklistId, actorId, action: PreparationChecklistHistoryAction.EVIDENCE_ADDED, message: `Evidência adicionada ao item "${item.title}".`, metadata: { itemId, evidenceId: evidence.id, url: evidence.url } } });
      const state = await this.refreshStatus(tx, item.checklistId, actorId, item.title);
      return { evidence, state };
    });
    if (result.state.enteredBlocked) await this.emitBlocked(result.state, actorId);
    const payload = await this.findChecklist(item.checklistId);
    await this.emitDerivedChanges(item.checklist.items, payload, actorId);
    return payload;
  }

  async approve(id: string, actorId: string) {
    const approval = await this.prisma.$transaction(async (tx) => {
      const checklist = await tx.preparationChecklist.findUnique({ where: { id }, include: { items: { include: { evidences: true }, orderBy: { order: "asc" } } } });
      if (!checklist) throw new NotFoundException("Checklist não encontrado.");
      if (checklist.status === PreparationChecklistStatus.APPROVED) throw new BadRequestException("O checklist já está aprovado.");
      if (checklist.status === PreparationChecklistStatus.BLOCKED) throw new BadRequestException("Resolva o bloqueio do checklist antes de aprovar.");
      if (!checklist.assigneeId) throw new BadRequestException("Atribua um responsável antes de aprovar.");
      const owner = await tx.user.findUnique({ where: { id: checklist.assigneeId }, select: { id: true, status: true } });
      if (!owner || owner.status !== UserStatus.ACTIVE) throw new BadRequestException("O responsável precisa estar ativo.");
      if (checklist.items.some((item) => item.required && item.status !== PreparationChecklistItemStatus.COMPLETED)) throw new BadRequestException("Todos os itens obrigatórios precisam estar concluídos.");
      if (checklist.items.some((item) => item.evidenceRequired && item.evidences.length === 0)) throw new BadRequestException("Registre evidência em todos os itens que a exigem.");
      if (checklist.items.some((item) => item.status === PreparationChecklistItemStatus.BLOCKED)) throw new BadRequestException("Resolva os itens bloqueados antes de aprovar.");
      const approvedAt = new Date();
      await tx.preparationChecklist.update({ where: { id }, data: { status: PreparationChecklistStatus.APPROVED, approvedAt, approvedById: actorId } });
      await tx.preparationChecklistHistory.create({ data: { checklistId: id, actorId, action: PreparationChecklistHistoryAction.APPROVED, message: "Checklist aprovado para o local de votação.", metadata: { approvedAt: approvedAt.toISOString() } } });
      return { electionId: checklist.electionId, electoralZoneId: checklist.electoralZoneId, pollingPlaceId: checklist.pollingPlaceId, approvedAt };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") throw new ConflictException("O checklist mudou durante a aprovação. Atualize e tente novamente.");
      throw error;
    });
    await this.eventBus.emit("preparation_checklist.approved", { entityId: id, actorId, checklistId: id, electionId: approval.electionId, electoralZoneId: approval.electoralZoneId, pollingPlaceId: approval.pollingPlaceId, approvedBy: actorId, approvedAt: approval.approvedAt.toISOString() });
    return this.findChecklist(id);
  }

  async revokeApproval(id: string, actorId: string) {
    const checklist = await this.prisma.preparationChecklist.findUnique({ where: { id } });
    if (!checklist) throw new NotFoundException("Checklist não encontrado.");
    if (checklist.status !== PreparationChecklistStatus.APPROVED) throw new BadRequestException("Somente checklists aprovados podem ter a aprovação revogada.");
    const state = await this.prisma.$transaction(async (tx) => {
      await tx.preparationChecklist.update({ where: { id }, data: { status: PreparationChecklistStatus.IN_PROGRESS, approvedAt: null, approvedById: null } });
      await tx.preparationChecklistHistory.create({ data: { checklistId: id, actorId, action: PreparationChecklistHistoryAction.APPROVAL_REVOKED, message: "A aprovação do checklist foi revogada." } });
      return this.refreshStatus(tx, id, actorId, "Aprovação revogada");
    });
    if (state.enteredBlocked) await this.emitBlocked(state, actorId);
    return this.findChecklist(id);
  }

  private async refreshStatus(tx: Prisma.TransactionClient, checklistId: string, actorId: string, reason: string) {
    const checklist = await tx.preparationChecklist.findUnique({ where: { id: checklistId }, include: { items: { include: { evidences: true } } } });
    if (!checklist) throw new NotFoundException("Checklist não encontrado.");
    if (checklist.status === PreparationChecklistStatus.APPROVED) return { enteredBlocked: false, checklist };
    const status = deriveChecklistStatus(checklist.items, checklist.assigneeId);
    const enteredBlocked = status === PreparationChecklistStatus.BLOCKED && checklist.status !== status;
    if (status !== checklist.status) await tx.preparationChecklist.update({ where: { id: checklistId }, data: { status } });
    if (enteredBlocked) await tx.preparationChecklistHistory.create({ data: { checklistId, actorId, action: PreparationChecklistHistoryAction.BLOCKED, message: `Checklist bloqueado: ${reason}.`, metadata: { reason } } });
    return { enteredBlocked, checklist: { ...checklist, status } };
  }

  private async emitBlocked(result: { checklist: { id: string; electionId: string; pollingPlaceId: string }; enteredBlocked: boolean }, actorId: string) {
    if (result.enteredBlocked) await this.eventBus.emit("preparation_checklist.blocked", { entityId: result.checklist.id, actorId, checklistId: result.checklist.id, electionId: result.checklist.electionId, pollingPlaceId: result.checklist.pollingPlaceId, reason: "Há item bloqueado no checklist." });
  }

  private async emitDerivedChanges(before: readonly DerivedItem[], after: { id: string; electionId: string; pollingPlaceId: string; readiness: number; items: readonly DerivedItem[] }, actorId: string) {
    const from = calculateReadiness(before);
    const to = after.readiness;
    if (from !== to) await this.eventBus.emit("preparation_checklist.readiness_changed", { entityId: after.id, actorId, checklistId: after.id, electionId: after.electionId, pollingPlaceId: after.pollingPlaceId, from, to });
    const existing = new Set(criticalBlockerKeys(listCriticalBlockers(before)));
    const detected = criticalBlockerKeys(listCriticalBlockers(after.items)).filter((key) => !existing.has(key));
    if (detected.length > 0) await this.eventBus.emit("preparation_checklist.blocker_detected", { entityId: after.id, actorId, checklistId: after.id, electionId: after.electionId, pollingPlaceId: after.pollingPlaceId, blockers: detected });
  }

  private async requireActiveUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!user || user.status !== UserStatus.ACTIVE) throw new BadRequestException("O responsável não existe ou está inativo.");
  }

  private async validateLocation(electionId: string, electoralZoneId: string, pollingPlaceId: string) {
    const [election, zone, place] = await Promise.all([
      this.prisma.election.findUnique({ where: { id: electionId }, select: { id: true } }),
      this.prisma.electoralZone.findUnique({ where: { id: electoralZoneId }, select: { id: true, electionId: true } }),
      this.prisma.pollingPlace.findUnique({ where: { id: pollingPlaceId }, select: { id: true, electoralZoneId: true, electoralZone: { select: { electionId: true } } } }),
    ]);
    if (!election || !zone || !place) throw new NotFoundException("Pleito, zona eleitoral ou local de votação não encontrado.");
    if (zone.electionId !== electionId || place.electoralZone.electionId !== electionId) throw new BadRequestException("A zona e o local precisam pertencer ao pleito informado.");
    if (place.electoralZoneId !== electoralZoneId) throw new BadRequestException("O local de votação não pertence à zona informada.");
  }
}
