export type ChecklistStatus = "PENDING" | "IN_PROGRESS" | "READY_FOR_APPROVAL" | "APPROVED" | "BLOCKED";
export type ChecklistItemStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";
export type DeadlineState = "ON_TRACK" | "AT_RISK" | "OVERDUE";
export type CriticalBlockerReason = "REQUIRED_PENDING" | "MISSING_EVIDENCE" | "BLOCKED";

export interface PersonReference { id: string; name: string; email: string; }
export interface ElectionReference { id: string; name: string; year: number; }
export interface ZoneReference { id: string; electionId: string; number: number; name: string; }
export interface PlaceReference { id: string; electoralZoneId: string; name: string; }
export interface PreparationReferences { elections: ElectionReference[]; zones: ZoneReference[]; places: PlaceReference[]; users: PersonReference[]; }
export interface TemplateItem { id: string; title: string; description: string | null; order: number; required: boolean; evidenceRequired: boolean; }
export interface ChecklistTemplate { id: string; name: string; description: string | null; active: boolean; version: number; items: TemplateItem[]; }
export interface Evidence { id: string; description: string; url: string; createdAt: string; recordedBy: { id: string; name: string }; }
export interface ChecklistItem extends TemplateItem {
  status: ChecklistItemStatus;
  assigneeId: string | null;
  assignee: PersonReference | null;
  observation: string | null;
  dueAt: string | null;
  completedAt: string | null;
  evidences: Evidence[];
}
export interface CriticalBlocker { itemId: string; title: string; reasons: CriticalBlockerReason[]; }
export interface ChecklistHistory { id: string; action: string; message: string; createdAt: string; actor: { id: string; name: string } | null; }
export interface ChecklistTotals { total: number; completed: number; pending: number; blocked: number; requiredPending: number; }
export interface PreparationChecklist {
  id: string;
  electionId: string;
  electoralZoneId: string;
  pollingPlaceId: string;
  status: ChecklistStatus;
  dueAt: string | null;
  templateVersion: number;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  election: ElectionReference;
  electoralZone: ZoneReference;
  pollingPlace: PlaceReference & { address: string };
  template: { id: string; name: string; version: number };
  assignee: PersonReference | null;
  approvedBy: PersonReference | null;
  items: ChecklistItem[];
  history: ChecklistHistory[];
  progress: number;
  readiness: number;
  criticalBlockers: CriticalBlocker[];
  deadlineState: DeadlineState;
  totals: ChecklistTotals;
}
export interface ChecklistOverviewRow {
  id: string;
  election: ElectionReference;
  electoralZone: ZoneReference;
  pollingPlace: PlaceReference;
  readiness: number;
  criticalBlockers: number;
  assignee: PersonReference | null;
  dueAt: string | null;
  deadlineState: DeadlineState;
  status: ChecklistStatus;
  progress: number;
}
export interface ChecklistFilters {
  electionId?: string;
  electoralZoneId?: string;
  pollingPlaceId?: string;
  assigneeId?: string;
  status?: ChecklistStatus;
}
export interface PreparationDashboard {
  totalChecklists: number;
  approvedPlaces: number;
  awaitingApproval: number;
  blockedPlaces: number;
  averageProgress: number;
  averageReadiness: number;
  criticalPending: number;
  criticalBlockers: number;
  criticalChecklists: PreparationChecklist[];
}
