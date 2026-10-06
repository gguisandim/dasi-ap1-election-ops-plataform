import type {
  PostmortemAction,
  PostmortemActionStatus,
  PostmortemCauseCategory,
  PostmortemCauseType,
  PostmortemLessonType,
  PostmortemReviewDecision,
  PostmortemStatus,
  PostmortemTimelineSource,
} from "@eops/shared/postmortems";

export type {
  PostmortemAction,
  PostmortemActionStatus,
  PostmortemCauseCategory,
  PostmortemCauseType,
  PostmortemLessonType,
  PostmortemReviewDecision,
  PostmortemStatus,
  PostmortemTimelineSource,
};

export interface PostmortemCause {
  id: string;
  postmortemId: string;
  parentId?: string | null;
  type: PostmortemCauseType;
  category: PostmortemCauseCategory;
  statement: string;
  evidence?: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface PostmortemLesson {
  id: string;
  type: PostmortemLessonType;
  title: string;
  description: string;
  category?: PostmortemCauseCategory | null;
  createdAt: string;
}

export interface PostmortemActionItem {
  id: string;
  title: string;
  description?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: PostmortemActionStatus;
  dueAt?: string | null;
  completedAt?: string | null;
  overdue: boolean;
  ownerUser?: { id: string; name: string } | null;
  task?: { id: string; title: string; status: string } | null;
  createdAt: string;
}

export interface PostmortemTimelineEntry {
  id: string;
  occurredAt: string;
  sourceType: PostmortemTimelineSource;
  sourceId?: string | null;
  title: string;
  description?: string | null;
  imported: boolean;
  createdBy?: { id: string; name: string } | null;
}

export interface PostmortemReview {
  id: string;
  decision: PostmortemReviewDecision;
  comment?: string | null;
  createdAt: string;
  reviewer: { id: string; name: string };
}

export interface PostmortemReviewer {
  id: string;
  userId: string;
  user: { id: string; name: string; status: string };
}

export interface PostmortemApproval {
  approved: boolean;
  pendingReviewerIds: string[];
  changesRequestedBy: string[];
}

export interface PostmortemRecord {
  id: string;
  code: string;
  title: string;
  status: PostmortemStatus;
  primaryIncidentId: string;
  executiveSummary?: string | null;
  impactSummary?: string | null;
  detectionSummary?: string | null;
  responseSummary?: string | null;
  resolutionSummary?: string | null;
  rootCauseSummary?: string | null;
  lessonsSummary?: string | null;
  submittedForReviewAt?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  primaryIncident: {
    id: string;
    code: string;
    title: string;
    severity: string;
    status: string;
    openedAt: string;
    resolvedAt?: string | null;
    closedAt?: string | null;
    electionId: string;
    electoralZoneId?: string | null;
    pollingPlaceId?: string | null;
  };
  createdBy: { id: string; name: string; email: string };
  owner?: { id: string; name: string; email: string } | null;
  publishedBy?: { id: string; name: string; email: string } | null;
  relatedIncidents: Array<{
    incident: {
      id: string;
      code: string;
      title: string;
      severity: string;
      status: string;
    };
  }>;
  causes: PostmortemCause[];
  lessons: PostmortemLesson[];
  actions: PostmortemActionItem[];
  reviewers: PostmortemReviewer[];
  reviews: PostmortemReview[];
  timeline: PostmortemTimelineEntry[];
  approval: PostmortemApproval;
}

export interface PostmortemDetail extends PostmortemRecord {
  availableActions: PostmortemAction[];
}

export interface PostmortemSummary {
  id: string;
  code: string;
  title: string;
  status: PostmortemStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  owner?: { id: string; name: string } | null;
  primaryIncident: {
    id: string;
    code: string;
    title: string;
    severity: string;
  };
  _count: { actions: number; lessons: number; causes: number };
}

export interface PostmortemDashboard {
  generatedAt: string;
  counters: {
    draft: number;
    inReview: number;
    changesRequested: number;
    approved: number;
    published: number;
    archived: number;
    overdueActionItems: number;
  };
  criticalIncidentsWithoutPostmortem: number;
  recentPublished: Array<{
    id: string;
    code: string;
    title: string;
    publishedAt?: string | null;
    primaryIncident: { code: string; severity: string };
  }>;
}

export interface PostmortemInsights {
  generatedAt: string;
  sampleSize: number;
  causesByCategory: Array<{ key: PostmortemCauseCategory; count: number }>;
  causesByType: Array<{ key: PostmortemCauseType; count: number }>;
  recurringCauses: Array<{
    category: PostmortemCauseCategory;
    type: PostmortemCauseType;
    postmortemCount: number;
  }>;
  lessonsByType: Array<{ key: PostmortemLessonType; count: number }>;
  lessonsByCategory: Array<{ key: PostmortemCauseCategory | null; count: number }>;
  incidentsBySeverity: Array<{ key: string; count: number }>;
  actionItems: { open: number; done: number; cancelled: number; overdue: number };
  averageTimeToPublishHours: number | null;
  publishedCount: number;
}

export interface EligibleIncident {
  id: string;
  code: string;
  title: string;
  severity: string;
  status: string;
  openedAt: string;
  resolvedAt?: string | null;
  hasActivePostmortem: boolean;
}

export interface PostmortemReferences {
  incidents: EligibleIncident[];
  users: Array<{ id: string; name: string; email: string }>;
  tasks: Array<{ id: string; title: string; status: string; electionId: string }>;
  elections: Array<{ id: string; name: string }>;
}

export interface PagedPostmortems {
  items: PostmortemSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
