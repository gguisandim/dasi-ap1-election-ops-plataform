import { BadRequestException, NotFoundException } from "@nestjs/common";
import { TaskPriority, TaskStatus } from "@prisma/client";
import type { PrismaService } from "@eops/database";
import type { EventBus } from "@eops/event-bus";
import { describe, expect, it, vi } from "vitest";
import { TasksService } from "./tasks.service";

function createService() {
  const taskSavedFilter = { findUnique: vi.fn(), delete: vi.fn() };
  const task = { findMany: vi.fn(), update: vi.fn() };
  const taskLabel = { count: vi.fn() };
  const user = { findUnique: vi.fn() };
  const tx = {
    task: { update: vi.fn() },
    taskLabelAssignment: { createMany: vi.fn(), deleteMany: vi.fn() },
    taskHistory: { create: vi.fn() },
  };
  const prisma = {
    taskSavedFilter,
    task,
    taskLabel,
    user,
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const eventBus = { emit: vi.fn() };
  const service = new TasksService(prisma as unknown as PrismaService, eventBus as unknown as EventBus);
  return { service, prisma, taskLabel, user, tx, eventBus };
}

describe("saved filter ownership", () => {
  it("hides another user's filter behind a 404", async () => {
    const { service, prisma } = createService();
    prisma.taskSavedFilter.findUnique.mockResolvedValue({ id: "filter-1", userId: "other-user" });
    await expect(service.deleteSavedFilter("filter-1", "current-user")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.taskSavedFilter.delete).not.toHaveBeenCalled();
  });

  it("deletes the filter when owned by the caller", async () => {
    const { service, prisma } = createService();
    prisma.taskSavedFilter.findUnique.mockResolvedValue({ id: "filter-1", userId: "current-user" });
    await expect(service.deleteSavedFilter("filter-1", "current-user")).resolves.toEqual({ id: "filter-1" });
    expect(prisma.taskSavedFilter.delete).toHaveBeenCalledWith({ where: { id: "filter-1" } });
  });
});

describe("bulk update", () => {
  const task = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    title: `Tarefa ${id}`,
    status: TaskStatus.PENDING,
    priority: TaskPriority.LOW,
    completedAt: null,
    dependencies: [] as Array<{ dependsOn: { status: TaskStatus } }>,
    subtasks: [] as Array<{ status: TaskStatus }>,
    ...overrides,
  });

  it("rejects a payload without any mutation field", async () => {
    const { service, prisma } = createService();
    await expect(service.bulkUpdate({ ids: ["a"] }, "actor")).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it("invalidates the whole batch when any task is missing", async () => {
    const { service, prisma } = createService();
    prisma.task.findMany.mockResolvedValue([task("a")]);
    await expect(service.bulkUpdate({ ids: ["a", "b"], status: TaskStatus.IN_PROGRESS }, "actor")).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects the batch when a task still has unfinished dependencies or subtasks", async () => {
    const { service, prisma } = createService();
    prisma.task.findMany.mockResolvedValue([
      task("a", { dependencies: [{ dependsOn: { status: TaskStatus.PENDING } }] }),
      task("b"),
    ]);
    await expect(service.bulkUpdate({ ids: ["a", "b"], status: TaskStatus.DONE }, "actor")).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("applies the batch atomically and emits a single event", async () => {
    const { service, prisma, tx, eventBus } = createService();
    prisma.task.findMany.mockResolvedValue([task("a"), task("b")]);
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", status: "ACTIVE" });
    prisma.taskLabel.count.mockResolvedValue(1);
    const result = await service.bulkUpdate({ ids: ["a", "b"], priority: TaskPriority.HIGH, assigneeId: "user-1", addLabelIds: ["label-1"] }, "actor");
    expect(result).toEqual({ count: 2, fields: ["priority", "assigneeId", "labels"] });
    expect(tx.task.update).toHaveBeenCalledTimes(2);
    expect(tx.taskHistory.create).toHaveBeenCalledTimes(2);
    expect(eventBus.emit).toHaveBeenCalledTimes(1);
    expect(eventBus.emit).toHaveBeenCalledWith("task.bulk_updated", expect.objectContaining({ count: 2, fields: ["priority", "assigneeId", "labels"] }));
  });
});
