import { apiClient } from "@eops/api-client";
import type {
  EligibleIncident,
  PagedPostmortems,
  PostmortemDashboard,
  PostmortemDetail,
  PostmortemInsights,
  PostmortemReferences,
} from "../../types";

export interface CauseInput {
  type: string;
  category: string;
  statement: string;
  evidence?: string;
  parentId?: string;
  order?: number;
}

export interface LessonInput {
  type: string;
  title: string;
  description: string;
  category?: string;
}

export interface ActionInput {
  title: string;
  description?: string;
  priority?: string;
  ownerUserId?: string;
  dueAt?: string;
  taskId?: string;
  status?: string;
}

export const postmortemsService = {
  dashboard: () => apiClient.get<PostmortemDashboard>("/postmortems/dashboard"),
  insights: () => apiClient.get<PostmortemInsights>("/postmortems/insights"),
  references: () => apiClient.get<PostmortemReferences>("/postmortems/references"),
  eligibleIncidents: (electionId?: string) =>
    apiClient.get<EligibleIncident[]>("/postmortems/eligible-incidents", {
      query: { electionId },
    }),
  list: (query: Record<string, unknown> = {}) =>
    apiClient.get<PagedPostmortems>("/postmortems", { query }),
  detail: (id: string) => apiClient.get<PostmortemDetail>(`/postmortems/${id}`),

  create: (input: { primaryIncidentId: string; title: string; ownerId?: string }) =>
    apiClient.post<PostmortemDetail>("/postmortems", input),
  update: (id: string, input: Record<string, unknown>) =>
    apiClient.patch<PostmortemDetail>(`/postmortems/${id}`, input),

  addCause: (id: string, input: CauseInput) =>
    apiClient.post<PostmortemDetail>(`/postmortems/${id}/causes`, input),
  updateCause: (id: string, causeId: string, input: Partial<CauseInput>) =>
    apiClient.patch<PostmortemDetail>(`/postmortems/${id}/causes/${causeId}`, input),
  removeCause: (id: string, causeId: string) =>
    apiClient.delete<PostmortemDetail>(`/postmortems/${id}/causes/${causeId}`),

  addLesson: (id: string, input: LessonInput) =>
    apiClient.post<PostmortemDetail>(`/postmortems/${id}/lessons`, input),
  updateLesson: (id: string, lessonId: string, input: Partial<LessonInput>) =>
    apiClient.patch<PostmortemDetail>(`/postmortems/${id}/lessons/${lessonId}`, input),
  removeLesson: (id: string, lessonId: string) =>
    apiClient.delete<PostmortemDetail>(`/postmortems/${id}/lessons/${lessonId}`),

  addAction: (id: string, input: ActionInput) =>
    apiClient.post<PostmortemDetail>(`/postmortems/${id}/actions`, input),
  updateAction: (id: string, actionId: string, input: Partial<ActionInput>) =>
    apiClient.patch<PostmortemDetail>(`/postmortems/${id}/actions/${actionId}`, input),
  removeAction: (id: string, actionId: string) =>
    apiClient.delete<PostmortemDetail>(`/postmortems/${id}/actions/${actionId}`),

  setRelatedIncidents: (id: string, incidentIds: string[]) =>
    apiClient.put<PostmortemDetail>(`/postmortems/${id}/related-incidents`, {
      incidentIds,
    }),
  setReviewers: (id: string, userIds: string[]) =>
    apiClient.put<PostmortemDetail>(`/postmortems/${id}/reviewers`, { userIds }),

  addTimelineEntry: (
    id: string,
    input: { occurredAt: string; title: string; description?: string },
  ) => apiClient.post<PostmortemDetail>(`/postmortems/${id}/timeline`, input),
  removeTimelineEntry: (id: string, entryId: string) =>
    apiClient.delete<PostmortemDetail>(`/postmortems/${id}/timeline/${entryId}`),
  importTimeline: (
    id: string,
    input: { includeIncidentEvents?: boolean; includeTasks?: boolean } = {},
  ) =>
    apiClient.post<{
      postmortem: PostmortemDetail;
      imported: number;
      skipped: number;
    }>(`/postmortems/${id}/timeline/import`, input),

  submitForReview: (id: string) =>
    apiClient.post<PostmortemDetail>(`/postmortems/${id}/submit-for-review`, {}),
  review: (id: string, decision: string, comment?: string) =>
    apiClient.post<PostmortemDetail>(`/postmortems/${id}/reviews`, {
      decision,
      comment,
    }),
  publish: (id: string) =>
    apiClient.post<PostmortemDetail>(`/postmortems/${id}/publish`, {}),
  archive: (id: string) =>
    apiClient.post<PostmortemDetail>(`/postmortems/${id}/archive`, {}),

  currentUser: () => apiClient.get<{ permissions: string[] }>("/auth/me"),
};
