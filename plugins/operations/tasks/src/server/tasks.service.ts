import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, TaskHistoryAction, TaskPriority, TaskStatus, UserStatus } from "@prisma/client";
import { PrismaService } from "../../../../../packages/database/src";
import { EventBus } from "../../../../../packages/event-bus/src";
import { CreateTaskCommentDto, CreateTaskDependencyDto, CreateTaskDto, TasksQueryDto, UpdateTaskDto } from "./dto/tasks.dto";

const taskInclude = {
  election: { select: { id: true, name: true, year: true } },
  electoralZone: { select: { id: true, number: true, name: true } },
  pollingPlace: { select: { id: true, name: true, address: true } },
  assignee: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  dependencies: { include: { dependsOn: { select: { id: true, title: true, status: true, priority: true, dueAt: true } } } },
  comments: { include: { author: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" as const } },
  history: { include: { actor: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" as const }, take: 100 },
} satisfies Prisma.TaskInclude;

type TaskRecord = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;
type DependencyEdge = { taskId: string; dependsOnId: string };

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

function withDependencyState<T extends { status: TaskStatus; dependencies: TaskRecord["dependencies"] }>(task: T) {
  return { ...task, blockedByDependencies: hasUnfinishedDependencies(task) };
}

export function isTaskOverdue(task: { dueAt: Date | null; status: TaskStatus }, now = new Date()) {
  return Boolean(task.dueAt && task.dueAt < now && task.status !== TaskStatus.DONE && task.status !== TaskStatus.CANCELLED);
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

  async findTask(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id }, include: taskInclude });
    if (!task) throw new NotFoundException("Tarefa não encontrada.");
    return withDependencyState(task);
  }

  async createTask(dto: CreateTaskDto, actorId: string) {
    const electoralZoneId = await this.validateLocation(dto.electionId, dto.electoralZoneId, dto.pollingPlaceId);
    if (dto.assigneeId) await this.requireActiveUser(dto.assigneeId);
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
          dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
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

  async updateTask(id: string, dto: UpdateTaskDto, actorId: string) {
    const current = await this.prisma.task.findUnique({ where: { id }, include: { dependencies: { include: { dependsOn: { select: { status: true } } } } } });
    if (!current) throw new NotFoundException("Tarefa não encontrada.");
    if (dto.assigneeId) await this.requireActiveUser(dto.assigneeId);
    const electionId = dto.electionId ?? current.electionId;
    const zoneId = dto.electoralZoneId === undefined ? current.electoralZoneId ?? undefined : dto.electoralZoneId ?? undefined;
    const placeId = dto.pollingPlaceId === undefined ? current.pollingPlaceId ?? undefined : dto.pollingPlaceId ?? undefined;
    const electoralZoneId = await this.validateLocation(electionId, zoneId, placeId);
    if (dto.status === TaskStatus.DONE && hasUnfinishedDependencies(current)) throw new BadRequestException("Conclua as tarefas dependentes antes de concluir esta tarefa.");
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
    if (dto.status !== undefined) updates.completedAt = dto.status === TaskStatus.DONE ? current.completedAt ?? new Date() : null;
    const previousDependencyBlocked = hasUnfinishedDependencies(current);
    const changedAssignee = dto.assigneeId !== undefined && dto.assigneeId !== current.assigneeId;
    const changedStatus = dto.status !== undefined && dto.status !== current.status;
    const changedPriority = dto.priority !== undefined && dto.priority !== current.priority;
    const changedDueDate = dto.dueAt !== undefined && (dto.dueAt ? new Date(dto.dueAt).getTime() : null) !== current.dueAt?.getTime();
    const task = await this.prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id }, data: updates });
      const metadata: Record<string, unknown> = {};
      if (dto.title !== undefined && dto.title !== current.title) metadata.title = { from: current.title, to: dto.title };
      if (dto.description !== undefined && dto.description !== current.description) metadata.description = true;
      if (dto.electionId !== undefined && dto.electionId !== current.electionId) metadata.electionId = { from: current.electionId, to: dto.electionId };
      if (changedAssignee) metadata.assigneeId = { from: current.assigneeId, to: dto.assigneeId };
      if (changedStatus) metadata.status = { from: current.status, to: nextStatus };
      if (changedPriority) metadata.priority = { from: current.priority, to: dto.priority };
      if (changedDueDate) metadata.dueAt = { from: current.dueAt?.toISOString() ?? null, to: dto.dueAt ?? null };
      if (Object.keys(metadata).length) await tx.taskHistory.create({ data: { taskId: id, actorId, action: TaskHistoryAction.UPDATED, message: "Dados da tarefa atualizados.", metadata: metadata as Prisma.InputJsonValue } });
      if (changedAssignee) await tx.taskHistory.create({ data: { taskId: id, actorId, action: TaskHistoryAction.ASSIGNED, message: dto.assigneeId ? "Responsável atualizado." : "Responsável removido.", metadata: { from: current.assigneeId, to: dto.assigneeId } } });
      if (changedStatus) await tx.taskHistory.create({ data: { taskId: id, actorId, action: nextStatus === TaskStatus.DONE ? TaskHistoryAction.COMPLETED : nextStatus === TaskStatus.CANCELLED ? TaskHistoryAction.CANCELLED : TaskHistoryAction.STATUS_CHANGED, message: `Status alterado de ${current.status} para ${nextStatus}.`, metadata: { from: current.status, to: nextStatus } } });
      if (changedPriority) await tx.taskHistory.create({ data: { taskId: id, actorId, action: TaskHistoryAction.PRIORITY_CHANGED, message: `Prioridade alterada de ${current.priority} para ${dto.priority}.`, metadata: { from: current.priority, to: dto.priority } } });
      if (changedDueDate) await tx.taskHistory.create({ data: { taskId: id, actorId, action: TaskHistoryAction.DUE_DATE_CHANGED, message: "Prazo da tarefa atualizado.", metadata: { from: current.dueAt?.toISOString() ?? null, to: dto.dueAt ?? null } } });
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

  private async requireTask(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id }, select: { id: true } });
    if (!task) throw new NotFoundException("Tarefa não encontrada.");
    return task;
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