export type TaskStatus = "PENDING" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TaskExecutionMode = "OFFICE" | "FIELD" | "MIXED";

export interface PersonReference { id: string; name: string; email: string; }
export interface ElectionReference { id: string; name: string; year: number; }
export interface ZoneReference { id: string; electionId: string; number: number; name: string; }
export interface PlaceReference { id: string; electoralZoneId: string; name: string; }
export interface TaskReferences { elections: ElectionReference[]; zones: ZoneReference[]; places: PlaceReference[]; users: PersonReference[]; }
export interface TaskDependency { dependsOn: { id: string; title: string; status: TaskStatus; priority: TaskPriority; dueAt: string | null }; }
export interface TaskComment { id: string; content: string; createdAt: string; author: PersonReference | null; }
export interface TaskHistory { id: string; action: string; message: string; createdAt: string; actor: { id: string; name: string } | null; }
export interface TaskSpecialtyRequirement {
  id: string;
  specialtyId: string;
  requiredCount: number;
  specialty: { id: string; key: string; name: string };
}
export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  executionMode: TaskExecutionMode;
  requiredTeamSize: number | null;
  assigneeId: string | null;
  electionId: string;
  electoralZoneId: string | null;
  pollingPlaceId: string | null;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  election: ElectionReference;
  electoralZone: ZoneReference | null;
  pollingPlace: PlaceReference & { address: string } | null;
  assignee: PersonReference | null;
  createdBy: PersonReference | null;
  dependencies: TaskDependency[];
  comments: TaskComment[];
  history: TaskHistory[];
  specialtyRequirements: TaskSpecialtyRequirement[];
  blockedByDependencies: boolean;
}
export interface TaskFilters {
  electionId?: string;
  electoralZoneId?: string;
  pollingPlaceId?: string;
  assigneeId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  executionMode?: TaskExecutionMode;
  overdue?: boolean;
  search?: string;
}
export interface TasksDashboard {
  total: number;
  pending: number;
  inProgress: number;
  blocked: number;
  done: number;
  overdue: number;
  critical: number;
  attentionTasks: Task[];
}