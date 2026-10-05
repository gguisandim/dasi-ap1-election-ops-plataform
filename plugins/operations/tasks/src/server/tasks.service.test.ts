import { FieldDispatchStatus, TaskPriority, TaskStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildWorkload,
  bulkUpdateFields,
  canAcceptSubtasks,
  deriveDependencyGraph,
  hasUnfinishedDependencies,
  hasUnfinishedSubtasks,
  isActiveDispatchStatus,
  isTaskOverdue,
  wouldCreateDependencyCycle,
} from "./tasks.service";

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

  it("derives the dependency graph without persisting it", () => {
    const graph = deriveDependencyGraph({
      dependencies: [{ dependsOn: { id: "dep", title: "Dep", status: TaskStatus.PENDING, priority: TaskPriority.HIGH, dueAt: null } }],
      dependents: [{ task: { id: "blocked", title: "Blocked", status: TaskStatus.IN_PROGRESS, priority: TaskPriority.LOW, dueAt: null } }],
    });
    expect(graph.blockedBy.map((item) => item.id)).toEqual(["dep"]);
    expect(graph.blocks.map((item) => item.id)).toEqual(["blocked"]);
  });
});

describe("task subtask rules", () => {
  it("only allows subtasks on root tasks (max depth 2)", () => {
    expect(canAcceptSubtasks({ parentId: null })).toBe(true);
    expect(canAcceptSubtasks({ parentId: "parent" })).toBe(false);
  });

  it("detects unfinished subtasks and ignores terminal ones", () => {
    expect(hasUnfinishedSubtasks({ subtasks: [{ status: TaskStatus.PENDING }] })).toBe(true);
    expect(hasUnfinishedSubtasks({ subtasks: [{ status: TaskStatus.BLOCKED }, { status: TaskStatus.DONE }] })).toBe(true);
    expect(hasUnfinishedSubtasks({ subtasks: [{ status: TaskStatus.DONE }, { status: TaskStatus.CANCELLED }] })).toBe(false);
    expect(hasUnfinishedSubtasks({ subtasks: [] })).toBe(false);
  });
});

describe("task bulk update fields", () => {
  it("lists only the mutation fields present in the payload", () => {
    expect(bulkUpdateFields({})).toEqual([]);
    expect(bulkUpdateFields({ status: TaskStatus.DONE })).toEqual(["status"]);
    expect(bulkUpdateFields({ priority: TaskPriority.HIGH, assigneeId: "user-1" })).toEqual(["priority", "assigneeId"]);
    expect(bulkUpdateFields({ addLabelIds: ["label-1"], removeLabelIds: ["label-2"] })).toEqual(["labels"]);
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

describe("task workload aggregation", () => {
  const now = new Date("2026-10-01T12:00:00.000Z");
  const base = {
    priority: TaskPriority.MEDIUM,
    dueAt: null,
    assigneeId: "user-1",
    assignee: { id: "user-1", name: "Ana" },
    blockedByDependencies: false as boolean,
    dispatches: [] as Array<{ teamId: string; status: FieldDispatchStatus; team: { id: string; code: string; name: string } }>,
  };

  it("aggregates per assignee, status, priority and team", () => {
    const workload = buildWorkload([
      { ...base, status: TaskStatus.IN_PROGRESS, dueAt: new Date("2026-10-01T11:00:00.000Z"), priority: TaskPriority.CRITICAL, dispatches: [{ teamId: "team-1", status: FieldDispatchStatus.ACCEPTED, team: { id: "team-1", code: "E1", name: "Equipe 1" } }] },
      { ...base, status: TaskStatus.BLOCKED, blockedByDependencies: true },
      { ...base, status: TaskStatus.DONE, assigneeId: null, assignee: null },
    ], now);
    expect(workload.byStatus[TaskStatus.IN_PROGRESS]).toBe(1);
    expect(workload.byStatus[TaskStatus.DONE]).toBe(1);
    const ana = workload.byAssignee.find((row) => row.assigneeId === "user-1")!;
    expect(ana.total).toBe(2);
    expect(ana.inProgress).toBe(1);
    expect(ana.blocked).toBe(1);
    expect(ana.overdue).toBe(1);
    expect(ana.critical).toBe(1);
    expect(workload.byTeam.find((row) => row.teamId === "team-1")?.count).toBe(1);
    expect(workload.byTeam.find((row) => row.teamId === null)?.count).toBe(2);
  });

  it("only treats non-terminal dispatches as active", () => {
    expect(isActiveDispatchStatus(FieldDispatchStatus.ACCEPTED)).toBe(true);
    expect(isActiveDispatchStatus(FieldDispatchStatus.IN_PROGRESS)).toBe(true);
    expect(isActiveDispatchStatus(FieldDispatchStatus.COMPLETED)).toBe(false);
    expect(isActiveDispatchStatus(FieldDispatchStatus.CANCELLED)).toBe(false);
    expect(isActiveDispatchStatus(FieldDispatchStatus.REJECTED)).toBe(false);
  });
});
