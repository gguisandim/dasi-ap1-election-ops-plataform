import type { TaskPriority, TaskStatus } from "../types";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  BLOCKED: "Bloqueada",
  DONE: "Concluída",
  CANCELLED: "Cancelada",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export const TASK_STATUSES: TaskStatus[] = ["PENDING", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"];
export const TASK_PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function isTaskOverdue(task: { dueAt: string | null; status: TaskStatus }) {
  return Boolean(task.dueAt && new Date(task.dueAt) < new Date() && task.status !== "DONE" && task.status !== "CANCELLED");
}