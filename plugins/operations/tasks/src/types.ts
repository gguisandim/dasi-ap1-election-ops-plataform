export type TaskStatus = "PENDING" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TaskExecutionMode = "OFFICE" | "FIELD" | "MIXED";

export interface PersonReference { id: string; name: string; email: string; }
export interface ElectionReference { id: string; name: string; year: number; }
export interface ZoneReference { id: string; electionId: string; number: number; name: string; }
export interface PlaceReference { id: string; electoralZoneId: string; name: string; }
export interface TaskReferences { elections: ElectionReference[]; zones: ZoneReference[]; places: PlaceReference[]; users: PersonReference[]; }
export interface TaskDependency { dependsOn: { id: string; title: string; status: TaskStatus; priority: TaskPriority; dueAt: string | null }; }
export interface TaskDependent { task: { id: string; title: string; status: TaskStatus; priority: TaskPriority; dueAt: string | null }; }
export interface TaskComment { id: string; content: string; createdAt: string; author: PersonReference | null; }
export interface TaskHistory { id: string; action: string; message: string; createdAt: string; actor: { id: string; name: string } | null; }
export interface TaskSpecialtyRequirement {
  id: string;
  specialtyId: string;
  requiredCount: number;
  specialty: { id: string; key: string; name: string };
}
export interface TaskSubtask { id: string; title: string; status: TaskStatus; priority: TaskPriority; assigneeId: string | null; }
export interface TaskMilestone { id: string; electionId: string; name: string; description: string | null; dueAt: string | null; }
export interface TaskMilestoneSummary { id: string; name: string; dueAt: string | null; }
export interface TaskLabel { id: string; name: string; }
export interface TaskLabelAssignment { label: TaskLabel; }
export interface TaskChecklistItem {
  id: string;
  taskId: string;
  title: string;
  order: number;
  done: boolean;
  doneAt: string | null;
  doneBy: { id: string; name: string } | null;
}
export interface TaskSavedFilter { id: string; name: string; filters: TaskFilters; createdAt: string; updatedAt: string; }
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
  parentId: string | null;
  milestoneId: string | null;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  election: ElectionReference;
  electoralZone: ZoneReference | null;
  pollingPlace: PlaceReference & { address: string } | null;
  assignee: PersonReference | null;
  createdBy: PersonReference | null;
  parent: { id: string; title: string } | null;
  subtasks: TaskSubtask[];
  milestone: TaskMilestoneSummary | null;
  labels: TaskLabelAssignment[];
  checklistItems: TaskChecklistItem[];
  dependencies: TaskDependency[];
  dependents: TaskDependent[];
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
  labelId?: string;
  milestoneId?: string;
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
export interface TaskDependencyGraph {
  blockedBy: TaskDependency["dependsOn"][];
  blocks: TaskDependent["task"][];
  blockedByDependencies: boolean;
}
export interface TaskWorkloadAssigneeRow {
  assigneeId: string | null;
  name: string;
  total: number;
  pending: number;
  inProgress: number;
  blocked: number;
  overdue: number;
  critical: number;
}
export interface TaskWorkloadTeamRow { teamId: string | null; teamName: string; count: number; }
export interface TaskWorkload {
  byAssignee: TaskWorkloadAssigneeRow[];
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byTeam: TaskWorkloadTeamRow[];
}
export interface BulkTaskUpdate {
  ids: string[];
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  addLabelIds?: string[];
  removeLabelIds?: string[];
}
