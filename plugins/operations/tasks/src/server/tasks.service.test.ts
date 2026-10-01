import { TaskStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { hasUnfinishedDependencies, isTaskOverdue, wouldCreateDependencyCycle } from "./tasks.service";

describe("task dependency rules", () => {
  it("marks active tasks with unfinished dependencies as blocked", () => {
    expect(hasUnfinishedDependencies({ status: TaskStatus.IN_PROGRESS, dependencies: [{ dependsOn: { status: TaskStatus.PENDING } }] })).toBe(true);
    expect(hasUnfinishedDependencies({ status: TaskStatus.IN_PROGRESS, dependencies: [{ dependsOn: { status: TaskStatus.DONE } }] })).toBe(false);
    expect(hasUnfinishedDependencies({ status: TaskStatus.DONE, dependencies: [{ dependsOn: { status: TaskStatus.PENDING } }] })).toBe(false);
  });

  it("rejects direct and indirect dependency cycles", () => {
    const edges = [{ taskId: "task-a", dependsOnId: "task-b" }, { taskId: "task-b", dependsOnId: "task-c" }];
    expect(wouldCreateDependencyCycle("task-c", "task-a", edges)).toBe(true);
    expect(wouldCreateDependencyCycle("task-a", "task-a", edges)).toBe(true);
    expect(wouldCreateDependencyCycle("task-a", "task-c", edges)).toBe(false);
  });
});

describe("task overdue rule", () => {
  const now = new Date("2026-10-01T12:00:00.000Z");

  it("derives lateness from due date and excludes terminal states", () => {
    expect(isTaskOverdue({ dueAt: new Date("2026-10-01T11:59:59.000Z"), status: TaskStatus.PENDING }, now)).toBe(true);
    expect(isTaskOverdue({ dueAt: new Date("2026-10-01T12:00:01.000Z"), status: TaskStatus.PENDING }, now)).toBe(false);
    expect(isTaskOverdue({ dueAt: new Date("2026-10-01T11:00:00.000Z"), status: TaskStatus.DONE }, now)).toBe(false);
    expect(isTaskOverdue({ dueAt: new Date("2026-10-01T11:00:00.000Z"), status: TaskStatus.CANCELLED }, now)).toBe(false);
  });
});