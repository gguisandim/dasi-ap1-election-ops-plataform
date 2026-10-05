import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { FieldDispatchStatus, Prisma, TaskExecutionMode, TaskHistoryAction, TaskPriority, TaskStatus, UserStatus } from "@prisma/client";
import { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import {
  BulkUpdateTasksDto,
  CreateChecklistItemDto,
  CreateMilestoneDto,
  CreateSavedFilterDto,
  CreateSubtaskDto,
  CreateTaskCommentDto,
  CreateTaskDependencyDto,
  CreateTaskDto,
  CreateTaskLabelDto,
  TasksQueryDto,
  UpdateChecklistItemDto,
  UpdateMilestoneDto,
  UpdateTaskDto,
} from "./dto/tasks.dto";

const taskInclude = {
  election: { select: { id: true, name: true, year: true } },
  electoralZone: { select: { id: true, number: true, name: true } },
  pollingPlace: { select: { id: true, name: true, address: true } },
  assignee: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  parent: { select: { id: true, title: true } },
  subtasks: { select: { id: true, title: true, status: true, priority: true, assigneeId: true }, orderBy: { createdAt: "asc" as const } },
  milestone: { select: { id: true, name: true, dueAt: true } },
  labels: { include: { label: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" as const } },
  checklistItems: { include: { doneBy: { select: { id: true, name: true } } }, orderBy: { order: "asc" as const } },
  dependencies: { include: { dependsOn: { select: { id: true, title: true, status: true, priority: true, dueAt: true } } } },
  dependents: { include: { task: { select: { id: true, title: true, status: true, priority: true, dueAt: true } } } },
  comments: { include: { author: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" as const } },
  history: { include: { actor: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" as const }, take: 100 },
  specialtyRequirements: { include: { specialty: { select: { id: true, key: true, name: true } } }, orderBy: { specialty: { name: "asc" as const } } },
} satisfies Prisma.TaskInclude;

type TaskRecord = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;
type DependencyEdge = { taskId: string; dependsOnId: string };

/** Dependências obrigatórias ainda não concluídas bloqueiam a tarefa (derivado, nunca persistido). */
export function hasUnfinishedDependencies(task: { status: TaskStatus; dependencies: readonly { dependsOn: { status: TaskStatus } }[] }) {
  return task.status !== TaskStatus.DONE && task.status !== TaskStatus.CANCELLED && task.dependencies.some(({ dependsOn }) => dependsOn.status !== TaskStatus.DONE);
}

export function wouldCreateDependencyCycle(taskId: string, dependsOnId: string, edges: readonly DependencyEdge[]) {
  if (taskId === dependsOnId) return true;
  const dependencies = new Map<string, string[]>();
  for (const edge of edges) dependencies.set(edge.taskId, [...(dependencies.get(edge.taskId) ?? []), edge.dependsOnId]);
  const visited = new Set<string>();
  const pending = [dependsOnId];
  while (pending.length) {
    const current = pending.pop()!;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...(dependencies.get(current) ?? []));
  }
  return false;
}

/** Uma tarefa só aceita subtarefas quando ela própria não é subtarefa (profundidade máxima 2). */
export function canAcceptSubtasks(parent: { parentId: string | null }) {
  return parent.parentId === null;
}

/** Existe subtarefa que ainda não terminou (DONE/CANCELLED são terminais). */
export function hasUnfinishedSubtasks(task: { subtasks: readonly { status: TaskStatus }[] }) {
  return task.subtasks.some(({ status }) => status !== TaskStatus.DONE && status !== TaskStatus.CANCELLED);
}

export function isTaskOverdue(task: { dueAt: Date | null; status: TaskStatus }, now = new Date()) {
  return Boolean(task.dueAt && task.dueAt < now && task.status !== TaskStatus.DONE && task.status !== TaskStatus.CANCELLED);
}

/** Despacho ativo é o que ainda pode vincular a tarefa a uma equipe de campo. */
export function isActiveDispatchStatus(status: FieldDispatchStatus) {
  return status !== FieldDispatchStatus.CANCELLED && status !== FieldDispatchStatus.REJECTED && status !== FieldDispatchStatus.COMPLETED;
}

/** Campos de mutação presentes no payload de lote; usado para validar e registrar o evento. */
export function bulkUpdateFields(dto: Pick<BulkUpdateTasksDto, "status" | "priority" | "assigneeId" | "addLabelIds" | "removeLabelIds">) {
  const fields: string[] = [];
  if (dto.status !== undefined) fields.push("status");
  if (dto.priority !== undefined) fields.push("priority");
  if (dto.assigneeId !== undefined) fields.push("assigneeId");
  if (dto.addLabelIds !== undefined || dto.removeLabelIds !== undefined) fields.push("labels");
  return fields;
}

export function deriveDependencyGraph(task: {
  dependencies: readonly { dependsOn: TaskRecord["dependencies"][number]["dependsOn"] }[];
  dependents: readonly { task: TaskRecord["dependents"][number]["task"] }[];
}) {
  return {
    blockedBy: task.dependencies.map((edge) => edge.dependsOn),
    blocks: task.dependents.map((edge) => edge.task),
  };
}

type WorkloadTask = {
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  dueAt: Date | null;
  assignee: { id: string; name: string } | null;
  blockedByDependencies: boolean;
  dispatches: readonly { teamId: string; status: FieldDispatchStatus; team: { id: string; code: string; name: string } }[];
};

export interface WorkloadAssigneeRow {
  assigneeId: string | null;
  name: string;
  total: number;
  pending: number;
  inProgress: number;
  blocked: number;
  overdue: number;
  critical: number;
}

/** Agregação de carga de trabalho puramente derivada, sem persistência. */
export function buildWorkload(tasks: readonly WorkloadTask[], now = new Date()) {
  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const byAssignee = new Map<string, WorkloadAssigneeRow>();
  const byTeam = new Map<string, { teamId: string | null; teamName: string; count: number }>();
  for (const task of tasks) {
    byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
    byPriority[task.priority] = (byPriority[task.priority] ?? 0) + 1;
    const assigneeKey = task.assigneeId ?? "__none__";
    const row = byAssignee.get(assigneeKey) ?? {
      assigneeId: task.assigneeId,
      name: task.assignee?.name ?? "Sem responsável",
      total: 0,
      pending: 0,
      inProgress: 0,
      blocked: 0,
      overdue: 0,
      critical: 0,
    };
    row.total += 1;
    if (task.status === TaskStatus.PENDING) row.pending += 1;
    if (task.status === TaskStatus.IN_PROGRESS) row.inProgress += 1;
    if (task.status === TaskStatus.BLOCKED || task.blockedByDependencies) row.blocked += 1;
    if (isTaskOverdue(task, now)) row.overdue += 1;
    if (task.priority === TaskPriority.CRITICAL) row.critical += 1;
    byAssignee.set(assigneeKey, row);
    const activeDispatch = task.dispatches.find((dispatch) => isActiveDispatchStatus(dispatch.status));
    const teamKey = activeDispatch?.teamId ?? "__none__";
    const teamRow = byTeam.get(teamKey) ?? { teamId: activeDispatch?.teamId ?? null, teamName: activeDispatch?.team.name ?? "Sem equipe", count: 0 };
    teamRow.count += 1;
    byTeam.set(teamKey, teamRow);
  }
  return {
    byAssignee: [...byAssignee.values()].sort((first, second) => second.total - first.total || first.name.localeCompare(second.name)),
    byStatus,
    byPriority,
    byTeam: [...byTeam.values()].sort((first, second) => second.count - first.count || first.teamName.localeCompare(second.teamName)),
  };
}

function withDependencyState<T extends { status: TaskStatus; dependencies: readonly { dependsOn: { status: TaskStatus } }[] }>(task: T) {
  return { ...task, blockedByDependencies: hasUnfinishedDependencies(task) };
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService, private readonly eventBus: EventBus) {}

  async references() {
    const [elections, zones, places, users] = await Promise.all([
      this.prisma.election.findMany({ select: { id: true, name: true, year: true }, orderBy: [{ year: "desc" }, { name: "asc" }] }),
      this.prisma.electoralZone.findMany({ select: { id: true, electionId: true, number: true, name: true }, orderBy: { number: "asc" } }),
      this.prisma.pollingPlace.findMany({ select: { id: true, electoralZoneId: true, name: true }, orderBy: { name: "asc" } }),
      this.prisma.user.findMany({ where: { status: UserStatus.ACTIVE }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    ]);
    return { elections, zones, places, users };
  }

  async tasks(query: TasksQueryDto) {
    const tasks = await this.prisma.task.findMany({
      where: {
        electionId: query.electionId,
        electoralZoneId: query.electoralZoneId,
        pollingPlaceId: query.pollingPlaceId,
        assigneeId: query.assigneeId,
        status: query.status,
        priority: query.priority,
        executionMode: query.executionMode,
        milestoneId: query.milestoneId,
        ...(query.labelId ? { labels: { some: { labelId: query.labelId } } } : {}),
        ...(query.search ? { OR: [{ title: { contains: query.search, mode: "insensitive" } }, { description: { contains: query.search, mode: "insensitive" } }] } : {}),
      },
      include: taskInclude,
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
    });
    return tasks.map(withDependencyState).filter((task) => query.overdue === undefined || isTaskOverdue(task) === query.overdue);
  }

  async dashboard(query: TasksQueryDto) {
    const tasks = await this.tasks({ ...query, status: undefined, priority: undefined, overdue: undefined });
    const overdueTasks = tasks.filter((task) => isTaskOverdue(task));
    const blockedTasks = tasks.filter((task) => task.status === TaskStatus.BLOCKED || task.blockedByDependencies);
    const attentionTasks = tasks.filter((task) => task.priority === TaskPriority.CRITICAL || isTaskOverdue(task) || task.status === TaskStatus.BLOCKED || task.blockedByDependencies)
      .sort((first, second) => Number(isTaskOverdue(second)) - Number(isTaskOverdue(first)) || Number(second.priority === TaskPriority.CRITICAL) - Number(first.priority === TaskPriority.CRITICAL))
      .slice(0, 12);
    return {
      total: tasks.length,
      pending: tasks.filter((task) => task.status === TaskStatus.PENDING).length,
      inProgress: tasks.filter((task) => task.status === TaskStatus.IN_PROGRESS).length,
      blocked: blockedTasks.length,
      done: tasks.filter((task) => task.status === TaskStatus.DONE).length,
      overdue: overdueTasks.length,
      critical: tasks.filter((task) => task.priority === TaskPriority.CRITICAL).length,
      attentionTasks,
    };
  }

  async workload(query: TasksQueryDto) {
    const tasks = await this.prisma.task.findMany({
      where: { electionId: query.electionId, electoralZoneId: query.electoralZoneId, pollingPlaceId: query.pollingPlaceId },
      include: {
        assignee: { select: { id: true, name: true } },
        dependencies: { include: { dependsOn: { select: { status: true } } } },
        dispatches: { select: { teamId: true, status: true, team: { select: { id: true, code: true, name: true } } } },
      },
    });
    return buildWorkload(tasks.map(withDependencyState));
  }

  async findTask(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id }, include: taskInclude });
    if (!task) throw new NotFoundException("Tarefa não encontrada.");
    return withDependencyState(task);
  }

  async dependencies(id: string) {
    const task = await this.findTask(id);
    return { ...deriveDependencyGraph(task), blockedByDependencies: task.blockedByDependencies };
  }

  async subtasks(parentId: string) {
    await this.requireTask(parentId);
    return this.prisma.task.findMany({ where: { parentId }, include: taskInclude, orderBy: { createdAt: "asc" } });
  }

  async createTask(dto: CreateTaskDto, actorId: string) {
    if (dto.parentId) return this.createSubtask(dto.parentId, dto, actorId);
    const electoralZoneId = await this.validateLocation(dto.electionId, dto.electoralZoneId, dto.pollingPlaceId);
    if (dto.assigneeId) await this.requireActiveUser(dto.assigneeId);
    await this.requireActiveSpecialties(dto.requiredSpecialtyIds);
    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          title: dto.title,
          description: dto.description,
          electionId: dto.electionId,
          electoralZoneId,
          pollingPlaceId: dto.pollingPlaceId,
          assigneeId: dto.assigneeId,
          createdById: actorId,
          priority: dto.priority ?? TaskPriority.MEDIUM,
          executionMode: dto.executionMode ?? TaskExecutionMode.OFFICE,
          requiredTeamSize: dto.requiredTeamSize ?? undefined,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
          specialtyRequirements: dto.requiredSpecialtyIds?.length
            ? {
                create: dto.requiredSpecialtyIds.map((specialtyId) => ({
                  specialtyId,
                  requiredCount: 1,
                })),
              }
            : undefined,
        },
      });
      await tx.taskHistory.create({ data: { taskId: created.id, actorId, action: TaskHistoryAction.CREATED, message: "Tarefa criada." } });
      if (dto.assigneeId) await tx.taskHistory.create({ data: { taskId: created.id, actorId, action: TaskHistoryAction.ASSIGNED, message: "Responsável atribuído.", metadata: { assigneeId: dto.assigneeId } } });
      return tx.task.findUniqueOrThrow({ where: { id: created.id }, include: taskInclude });
    });
    await this.eventBus.emit("task.created", { entityId: task.id, actorId, title: task.title, electionId: task.electionId, priority: task.priority });
    if (task.assigneeId) await this.eventBus.emit("task.assigned", { entityId: task.id, actorId, title: task.title, electionId: task.electionId, assigneeId: task.assigneeId });
    return withDependencyState(task);
  }

  async createSubtask(parentId: string, dto: CreateSubtaskDto, actorId: string) {
    const parent = await this.prisma.task.findUnique({
      where: { id: parentId },
      select: { id: true, electionId: true, electoralZoneId: true, pollingPlaceId: true, parentId: true, status: true, dependencies: { include: { dependsOn: { select: { status: true } } } } },
    });
    if (!parent) throw new NotFoundException("Tarefa principal não encontrada.");
    if (!canAcceptSubtasks(parent)) throw new BadRequestException("Uma subtarefa não pode receber novas subtarefas.");
    const declaredElectionId = (dto as Partial<CreateTaskDto>).electionId;
    if (declaredElectionId && declaredElectionId !== parent.electionId) throw new BadRequestException("A subtarefa precisa pertencer ao mesmo pleito do pai.");
    if (dto.assigneeId) await this.requireActiveUser(dto.assigneeId);
    await this.requireActiveSpecialties(dto.requiredSpecialtyIds);
    const electoralZoneId = await this.validateLocation(parent.electionId, dto.electoralZoneId ?? parent.electoralZoneId ?? undefined, dto.pollingPlaceId ?? parent.pollingPlaceId ?? undefined);
    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          title: dto.title,
          description: dto.description,
          electionId: parent.electionId,
          electoralZoneId,
          pollingPlaceId: dto.pollingPlaceId ?? parent.pollingPlaceId ?? undefined,
          assigneeId: dto.assigneeId,
          createdById: actorId,
          parentId,
          priority: dto.priority ?? TaskPriority.MEDIUM,
          executionMode: dto.executionMode ?? TaskExecutionMode.OFFICE,
          requiredTeamSize: dto.requiredTeamSize ?? undefined,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
          specialtyRequirements: dto.requiredSpecialtyIds?.length ? { create: dto.requiredSpecialtyIds.map((specialtyId) => ({ specialtyId, requiredCount: 1 })) } : undefined,
        },
      });
      await tx.taskHistory.create({ data: { taskId: created.id, actorId, action: TaskHistoryAction.CREATED, message: "Subtarefa criada." } });
      if (dto.assigneeId) await tx.taskHistory.create({ data: { taskId: created.id, actorId, action: TaskHistoryAction.ASSIGNED, message: "Responsável atribuído.", metadata: { assigneeId: dto.assigneeId } } });
      return tx.task.findUniqueOrThrow({ where: { id: created.id }, include: taskInclude });
    });
    await this.eventBus.emit("task.subtask_created", { entityId: task.id, actorId, title: task.title, electionId: task.electionId, parentId });
    return withDependencyState(task);
  }

  async updateTask(id: string, dto: UpdateTaskDto, actorId: string) {
    const current = await this.prisma.task.findUnique({
      where: { id },
      include: { dependencies: { include: { dependsOn: { select: { status: true } } } }, subtasks: { select: { status: true } }, labels: { include: { label: { select: { id: true, name: true } } } } },
    });
    if (!current) throw new NotFoundException("Tarefa não encontrada.");
    if (dto.assigneeId) await this.requireActiveUser(dto.assigneeId);
    if (dto.requiredSpecialtyIds) await this.requireActiveSpecialties(dto.requiredSpecialtyIds);
    const electionId = dto.electionId ?? current.electionId;
    const zoneId = dto.electoralZoneId === undefined ? current.electoralZoneId ?? undefined : dto.electoralZoneId ?? undefined;
    const placeId = dto.pollingPlaceId === undefined ? current.pollingPlaceId ?? undefined : dto.pollingPlaceId ?? undefined;
    const electoralZoneId = await this.validateLocation(electionId, zoneId, placeId);
    if (dto.status === TaskStatus.DONE && hasUnfinishedDependencies(current)) throw new BadRequestException("Conclua as tarefas dependentes antes de concluir esta tarefa.");
    if (dto.status === TaskStatus.DONE && hasUnfinishedSubtasks(current)) throw new BadRequestException("Conclua as subtarefas antes de concluir esta tarefa.");
    if (dto.milestoneId) await this.requireMilestoneInElection(dto.milestoneId, electionId);
    const labelIds = dto.labelIds === undefined ? undefined : [...new Set(dto.labelIds)];
    if (labelIds?.length) await this.requireLabels(labelIds);
    const nextStatus = dto.status ?? current.status;
    const updates: Record<string, unknown> = {};
    if (dto.title !== undefined) updates.title = dto.title;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.electionId !== undefined) updates.electionId = electionId;
    if (dto.electoralZoneId !== undefined || dto.pollingPlaceId !== undefined || dto.electionId !== undefined) updates.electoralZoneId = electoralZoneId;
    if (dto.pollingPlaceId !== undefined) updates.pollingPlaceId = dto.pollingPlaceId;
    if (dto.assigneeId !== undefined) updates.assigneeId = dto.assigneeId;
    if (dto.priority !== undefined) updates.priority = dto.priority;
    if (dto.status !== undefined) updates.status = dto.status;
    if (dto.dueAt !== undefined) updates.dueAt = dto.dueAt === null ? null : new Date(dto.dueAt);
    if (dto.executionMode !== undefined) updates.executionMode = dto.executionMode;
    if (dto.requiredTeamSize !== undefined) updates.requiredTeamSize = dto.requiredTeamSize;
    if (dto.milestoneId !== undefined) updates.milestoneId = dto.milestoneId;
    if (dto.status !== undefined) updates.completedAt = dto.status === TaskStatus.DONE ? current.completedAt ?? new Date() : null;
    const previousDependencyBlocked = hasUnfinishedDependencies(current);
    const changedAssignee = dto.assigneeId !== undefined && dto.assigneeId !== current.assigneeId;
    const changedStatus = dto.status !== undefined && dto.status !== current.status;
    const changedPriority = dto.priority !== undefined && dto.priority !== current.priority;
    const changedDueDate = dto.dueAt !== undefined && (dto.dueAt ? new Date(dto.dueAt).getTime() : null) !== current.dueAt?.getTime();
    const changedExecutionMode = dto.executionMode !== undefined && dto.executionMode !== current.executionMode;
    const changedRequirements = dto.requiredSpecialtyIds !== undefined || dto.requiredTeamSize !== undefined;
    const changedLabels = dto.labelIds !== undefined;
    const changedMilestone = dto.milestoneId !== undefined && dto.milestoneId !== current.milestoneId;
    const task = await this.prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id }, data: updates });
      if (dto.requiredSpecialtyIds !== undefined) {
        await tx.taskSpecialtyRequirement.deleteMany({ where: { taskId: id } });
        if (dto.requiredSpecialtyIds.length)
          await tx.taskSpecialtyRequirement.createMany({
            data: dto.requiredSpecialtyIds.map((specialtyId) => ({ taskId: id, specialtyId, requiredCount: 1 })),
            skipDuplicates: true,
          });
      }
      if (labelIds !== undefined) {
        await tx.taskLabelAssignment.deleteMany({ where: { taskId: id } });
        if (labelIds.length) await tx.taskLabelAssignment.createMany({ data: labelIds.map((labelId) => ({ taskId: id, labelId })), skipDuplicates: true });
      }
      const metadata: Record<string, unknown> = {};
      if (dto.title !== undefined && dto.title !== current.title) metadata.title = { from: current.title, to: dto.title };
      if (dto.description !== undefined && dto.description !== current.description) metadata.description = true;
      if (dto.electionId !== undefined && dto.electionId !== current.electionId) metadata.electionId = { from: current.electionId, to: dto.electionId };
      if (changedAssignee) metadata.assigneeId = { from: current.assigneeId, to: dto.assigneeId };
      if (changedStatus) metadata.status = { from: current.status, to: nextStatus };
      if (changedPriority) metadata.priority = { from: current.priority, to: dto.priority };
      if (changedDueDate) metadata.dueAt = { from: current.dueAt?.toISOString() ?? null, to: dto.dueAt ?? null };
      if (changedExecutionMode) metadata.executionMode = { from: current.executionMode, to: dto.executionMode };
      if (changedRequirements) metadata.fieldRequirements = { requiredTeamSize: dto.requiredTeamSize ?? null, requiredSpecialtyIds: dto.requiredSpecialtyIds ?? null };
      if (Object.keys(metadata).length) await tx.taskHistory.create({ data: { taskId: id, actorId, action: TaskHistoryAction.UPDATED, message: "Dados da tarefa atualizados.", metadata: metadata as Prisma.InputJsonValue } });
      if (changedAssignee) await tx.taskHistory.create({ data: { taskId: id, actorId, action: TaskHistoryAction.ASSIGNED, message: dto.assigneeId ? "Responsável atualizado." : "Responsável removido.", metadata: { from: current.assigneeId, to: dto.assigneeId } } });
      if (changedStatus) await tx.taskHistory.create({ data: { taskId: id, actorId, action: nextStatus === TaskStatus.DONE ? TaskHistoryAction.COMPLETED : nextStatus === TaskStatus.CANCELLED ? TaskHistoryAction.CANCELLED : TaskHistoryAction.STATUS_CHANGED, message: `Status alterado de ${current.status} para ${nextStatus}.`, metadata: { from: current.status, to: nextStatus } } });
      if (changedPriority) await tx.taskHistory.create({ data: { taskId: id, actorId, action: TaskHistoryAction.PRIORITY_CHANGED, message: `Prioridade alterada de ${current.priority} para ${dto.priority}.`, metadata: { from: current.priority, to: dto.priority } } });
      if (changedDueDate) await tx.taskHistory.create({ data: { taskId: id, actorId, action: TaskHistoryAction.DUE_DATE_CHANGED, message: "Prazo da tarefa atualizado.", metadata: { from: current.dueAt?.toISOString() ?? null, to: dto.dueAt ?? null } } });
      if (changedLabels) await tx.taskHistory.create({ data: { taskId: id, actorId, action: TaskHistoryAction.UPDATED, message: "Rótulos da tarefa atualizados.", metadata: { labelIds } } });
      if (changedMilestone) await tx.taskHistory.create({ data: { taskId: id, actorId, action: TaskHistoryAction.UPDATED, message: dto.milestoneId ? "Marco da tarefa atualizado." : "Marco da tarefa removido.", metadata: { milestoneId: dto.milestoneId } } });
      return tx.task.findUniqueOrThrow({ where: { id }, include: taskInclude });
    });
    if (changedAssignee) await this.eventBus.emit("task.assigned", { entityId: id, actorId, title: task.title, electionId: task.electionId, assigneeId: task.assigneeId });
    if (changedStatus) {
      await this.eventBus.emit("task.status_changed", { entityId: id, actorId, title: task.title, electionId: task.electionId, from: current.status, to: task.status });
      if (task.status === TaskStatus.DONE) await this.eventBus.emit("task.completed", { entityId: id, actorId, title: task.title, electionId: task.electionId });
      if (task.status === TaskStatus.BLOCKED && current.status !== TaskStatus.BLOCKED) await this.eventBus.emit("task.blocked", { entityId: id, actorId, title: task.title, electionId: task.electionId, reason: "Status definido como bloqueado." });
    }
    if (!previousDependencyBlocked && hasUnfinishedDependencies(task)) await this.eventBus.emit("task.blocked", { entityId: id, actorId, title: task.title, electionId: task.electionId, reason: "Há dependências ainda não concluídas." });
    return withDependencyState(task);
  }

  async bulkUpdate(dto: BulkUpdateTasksDto, actorId: string) {
    const fields = bulkUpdateFields(dto);
    if (!fields.length) throw new BadRequestException("Informe ao menos uma alteração para aplicar em lote.");
    const ids = [...new Set(dto.ids)];
    const tasks = await this.prisma.task.findMany({
      where: { id: { in: ids } },
      include: { dependencies: { include: { dependsOn: { select: { status: true } } } }, subtasks: { select: { status: true } } },
    });
    if (tasks.length !== ids.length) throw new BadRequestException("Uma ou mais tarefas do lote não foram encontradas.");
    if (dto.assigneeId) await this.requireActiveUser(dto.assigneeId);
    const labelIds = [...new Set([...(dto.addLabelIds ?? []), ...(dto.removeLabelIds ?? [])])];
    if (labelIds.length) await this.requireLabels(labelIds);
    if (dto.status === TaskStatus.DONE) {
      for (const task of tasks) {
        if (hasUnfinishedDependencies(task)) throw new BadRequestException(`A tarefa "${task.title}" possui dependências não concluídas.`);
        if (hasUnfinishedSubtasks(task)) throw new BadRequestException(`A tarefa "${task.title}" possui subtarefas pendentes.`);
      }
    }
    await this.prisma.$transaction(async (tx) => {
      for (const task of tasks) {
        const data: Record<string, unknown> = {};
        if (dto.status !== undefined) {
          data.status = dto.status;
          data.completedAt = dto.status === TaskStatus.DONE ? task.completedAt ?? new Date() : null;
        }
        if (dto.priority !== undefined) data.priority = dto.priority;
        if (dto.assigneeId !== undefined) data.assigneeId = dto.assigneeId;
        if (Object.keys(data).length) await tx.task.update({ where: { id: task.id }, data });
        if (dto.addLabelIds?.length) await tx.taskLabelAssignment.createMany({ data: dto.addLabelIds.map((labelId) => ({ taskId: task.id, labelId })), skipDuplicates: true });
        if (dto.removeLabelIds?.length) await tx.taskLabelAssignment.deleteMany({ where: { taskId: task.id, labelId: { in: dto.removeLabelIds } } });
        await tx.taskHistory.create({ data: { taskId: task.id, actorId, action: TaskHistoryAction.UPDATED, message: "Tarefa atualizada em lote.", metadata: { fields } as Prisma.InputJsonValue } });
      }
    });
    await this.eventBus.emit("task.bulk_updated", { entityId: ids[0], actorId, taskIds: ids, count: ids.length, fields });
    return { count: ids.length, fields };
  }

  async addComment(id: string, dto: CreateTaskCommentDto, actorId: string) {
    await this.requireTask(id);
    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.taskComment.create({ data: { taskId: id, authorId: actorId, content: dto.content } });
      await tx.taskHistory.create({ data: { taskId: id, actorId, action: TaskHistoryAction.COMMENT_ADDED, message: "Comentário adicionado.", metadata: { commentId: created.id } } });
      return tx.taskComment.findUniqueOrThrow({ where: { id: created.id }, include: { author: { select: { id: true, name: true, email: true } } } });
    });
    return comment;
  }

  async addDependency(id: string, dto: CreateTaskDependencyDto, actorId: string) {
    const targetId = dto.dependsOnId;
    const result = await this.prisma.$transaction(async (tx) => {
      const [task, target, edges] = await Promise.all([
        tx.task.findUnique({ where: { id }, select: { id: true, status: true, title: true, electionId: true, dependencies: { include: { dependsOn: { select: { status: true } } } } } }),
        tx.task.findUnique({ where: { id: targetId }, select: { id: true, title: true } }),
        tx.taskDependency.findMany({ select: { taskId: true, dependsOnId: true } }),
      ]);
      if (!task || !target) throw new NotFoundException("Tarefa ou dependência não encontrada.");
      if (wouldCreateDependencyCycle(id, targetId, edges)) throw new BadRequestException("Esta dependência criaria um ciclo entre tarefas.");
      const wasBlocked = hasUnfinishedDependencies(task);
      await tx.taskDependency.create({ data: { taskId: id, dependsOnId: targetId } });
      await tx.taskHistory.create({ data: { taskId: id, actorId, action: TaskHistoryAction.DEPENDENCY_ADDED, message: `Dependência adicionada: ${target.title}.`, metadata: { dependsOnId: targetId } } });
      return { task, wasBlocked };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Esta dependência já existe.");
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") throw new ConflictException("As dependências mudaram simultaneamente. Atualize e tente novamente.");
      throw error;
    });
    const task = await this.findTask(id);
    if (!result.wasBlocked && task.blockedByDependencies) await this.eventBus.emit("task.blocked", { entityId: id, actorId, title: task.title, electionId: task.electionId, reason: "Há dependências ainda não concluídas." });
    return task;
  }

  async removeDependency(id: string, dependsOnId: string, actorId: string) {
    await this.requireTask(id);
    const existing = await this.prisma.taskDependency.findUnique({ where: { taskId_dependsOnId: { taskId: id, dependsOnId } }, include: { dependsOn: { select: { title: true } } } });
    if (!existing) throw new NotFoundException("Dependência não encontrada.");
    await this.prisma.$transaction(async (tx) => {
      await tx.taskDependency.delete({ where: { taskId_dependsOnId: { taskId: id, dependsOnId } } });
      await tx.taskHistory.create({ data: { taskId: id, actorId, action: TaskHistoryAction.DEPENDENCY_REMOVED, message: `Dependência removida: ${existing.dependsOn.title}.`, metadata: { dependsOnId } } });
    });
    return this.findTask(id);
  }

  async addChecklistItem(taskId: string, dto: CreateChecklistItemDto, actorId: string) {
    await this.requireTask(taskId);
    const item = await this.prisma.$transaction(async (tx) => {
      let order = dto.order;
      if (order === undefined) {
        const last = await tx.taskChecklistItem.findFirst({ where: { taskId }, orderBy: { order: "desc" }, select: { order: true } });
        order = (last?.order ?? -1) + 1;
      } else if (await tx.taskChecklistItem.findUnique({ where: { taskId_order: { taskId, order } } })) {
        throw new BadRequestException("Já existe um item do checklist com esta ordem.");
      }
      const created = await tx.taskChecklistItem.create({ data: { taskId, title: dto.title, order } });
      await tx.taskHistory.create({ data: { taskId, actorId, action: TaskHistoryAction.UPDATED, message: "Item do checklist interno adicionado.", metadata: { checklistItemId: created.id } } });
      return tx.taskChecklistItem.findUniqueOrThrow({ where: { id: created.id }, include: { doneBy: { select: { id: true, name: true } } } });
    });
    return item;
  }

  async updateChecklistItem(itemId: string, dto: UpdateChecklistItemDto, actorId: string) {
    const item = await this.prisma.taskChecklistItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException("Item do checklist não encontrado.");
    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.order !== undefined && dto.order !== item.order) {
      if (await this.prisma.taskChecklistItem.findUnique({ where: { taskId_order: { taskId: item.taskId, order: dto.order } } })) throw new BadRequestException("Já existe um item do checklist com esta ordem.");
      data.order = dto.order;
    }
    if (dto.done !== undefined) {
      data.done = dto.done;
      data.doneAt = dto.done ? new Date() : null;
      data.doneById = dto.done ? actorId : null;
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.taskChecklistItem.update({ where: { id: itemId }, data });
      const message = dto.done === undefined ? "Item do checklist interno atualizado." : dto.done ? "Item do checklist interno concluído." : "Item do checklist interno reaberto.";
      await tx.taskHistory.create({ data: { taskId: item.taskId, actorId, action: TaskHistoryAction.UPDATED, message, metadata: { checklistItemId: itemId } } });
    });
    return this.prisma.taskChecklistItem.findUniqueOrThrow({ where: { id: itemId }, include: { doneBy: { select: { id: true, name: true } } } });
  }

  async deleteChecklistItem(itemId: string, actorId: string) {
    const item = await this.prisma.taskChecklistItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException("Item do checklist não encontrado.");
    await this.prisma.$transaction(async (tx) => {
      await tx.taskChecklistItem.delete({ where: { id: itemId } });
      await tx.taskHistory.create({ data: { taskId: item.taskId, actorId, action: TaskHistoryAction.UPDATED, message: "Item do checklist interno removido.", metadata: { checklistItemId: itemId } } });
    });
    return { id: itemId };
  }

  async labels() {
    return this.prisma.taskLabel.findMany({ orderBy: { name: "asc" } });
  }

  async createLabel(dto: CreateTaskLabelDto) {
    try {
      return await this.prisma.taskLabel.create({ data: { name: dto.name } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Já existe um rótulo com este nome.");
      throw error;
    }
  }

  async deleteLabel(id: string) {
    const label = await this.prisma.taskLabel.findUnique({ where: { id } });
    if (!label) throw new NotFoundException("Rótulo não encontrado.");
    await this.prisma.taskLabel.delete({ where: { id } });
    return { id };
  }

  async milestones(electionId?: string) {
    return this.prisma.taskMilestone.findMany({ where: { electionId }, orderBy: [{ dueAt: "asc" }, { name: "asc" }] });
  }

  async createMilestone(dto: CreateMilestoneDto) {
    const election = await this.prisma.election.findUnique({ where: { id: dto.electionId }, select: { id: true } });
    if (!election) throw new NotFoundException("Pleito não encontrado.");
    try {
      return await this.prisma.taskMilestone.create({ data: { electionId: dto.electionId, name: dto.name, description: dto.description, dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Já existe um marco com este nome neste pleito.");
      throw error;
    }
  }

  async updateMilestone(id: string, dto: UpdateMilestoneDto) {
    const milestone = await this.prisma.taskMilestone.findUnique({ where: { id } });
    if (!milestone) throw new NotFoundException("Marco não encontrado.");
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.dueAt !== undefined) data.dueAt = dto.dueAt === null ? null : new Date(dto.dueAt);
    try {
      return await this.prisma.taskMilestone.update({ where: { id }, data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Já existe um marco com este nome neste pleito.");
      throw error;
    }
  }

  async savedFilters(userId: string) {
    return this.prisma.taskSavedFilter.findMany({ where: { userId }, orderBy: { name: "asc" } });
  }

  async createSavedFilter(dto: CreateSavedFilterDto, userId: string) {
    try {
      return await this.prisma.taskSavedFilter.create({ data: { userId, name: dto.name, filters: dto.filters as Prisma.InputJsonValue } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Já existe um filtro salvo com este nome.");
      throw error;
    }
  }

  async deleteSavedFilter(id: string, userId: string) {
    const filter = await this.prisma.taskSavedFilter.findUnique({ where: { id } });
    if (!filter || filter.userId !== userId) throw new NotFoundException("Filtro salvo não encontrado.");
    await this.prisma.taskSavedFilter.delete({ where: { id } });
    return { id };
  }

  private async requireTask(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id }, select: { id: true } });
    if (!task) throw new NotFoundException("Tarefa não encontrada.");
    return task;
  }

  private async requireLabels(ids: string[]) {
    const count = await this.prisma.taskLabel.count({ where: { id: { in: ids } } });
    if (count !== ids.length) throw new BadRequestException("Um ou mais rótulos são inválidos.");
  }

  private async requireMilestoneInElection(id: string, electionId: string) {
    const milestone = await this.prisma.taskMilestone.findUnique({ where: { id }, select: { id: true, electionId: true } });
    if (!milestone) throw new NotFoundException("Marco não encontrado.");
    if (milestone.electionId !== electionId) throw new BadRequestException("O marco precisa pertencer ao mesmo pleito da tarefa.");
  }

  /**
   * Requisitos de campo reutilizam a entidade de especialidade existente.
   * A leitura usa o schema Prisma compartilhado; nenhum plugin é importado.
   */
  private async requireActiveSpecialties(ids?: string[]) {
    if (!ids?.length) return;
    const count = await this.prisma.fieldSpecialty.count({
      where: { id: { in: ids }, active: true },
    });
    if (count !== ids.length)
      throw new BadRequestException("Uma ou mais especialidades são inválidas.");
  }

  private async requireActiveUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!user || user.status !== UserStatus.ACTIVE) throw new BadRequestException("O responsável não existe ou está inativo.");
  }

  private async validateLocation(electionId: string, electoralZoneId?: string, pollingPlaceId?: string) {
    const election = await this.prisma.election.findUnique({ where: { id: electionId }, select: { id: true } });
    if (!election) throw new NotFoundException("Pleito não encontrado.");
    let resolvedZoneId = electoralZoneId;
    if (electoralZoneId) {
      const zone = await this.prisma.electoralZone.findUnique({ where: { id: electoralZoneId }, select: { id: true, electionId: true } });
      if (!zone) throw new NotFoundException("Zona eleitoral não encontrada.");
      if (zone.electionId !== electionId) throw new BadRequestException("A zona eleitoral precisa pertencer ao pleito informado.");
    }
    if (pollingPlaceId) {
      const place = await this.prisma.pollingPlace.findUnique({ where: { id: pollingPlaceId }, select: { id: true, electoralZoneId: true, electoralZone: { select: { electionId: true } } } });
      if (!place) throw new NotFoundException("Local de votação não encontrado.");
      if (place.electoralZone.electionId !== electionId) throw new BadRequestException("O local de votação precisa pertencer ao pleito informado.");
      if (resolvedZoneId && place.electoralZoneId !== resolvedZoneId) throw new BadRequestException("O local de votação não pertence à zona informada.");
      resolvedZoneId = place.electoralZoneId;
    }
    return resolvedZoneId ?? null;
  }
}
