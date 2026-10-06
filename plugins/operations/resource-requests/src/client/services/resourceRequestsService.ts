import { apiClient } from "@eops/api-client";
import type {
  FulfillmentInput,
  PagedRequests,
  ResourceRequestDashboard,
  ResourceRequestDetail,
  ResourceRequestInput,
  ResourceRequestReferences,
} from "../../types";

export const resourceRequestsService = {
  dashboard: () =>
    apiClient.get<ResourceRequestDashboard>("/resource-requests/dashboard"),
  queue: (query: Record<string, unknown> = {}) =>
    apiClient.get<PagedRequests>("/resource-requests/queue", { query }),
  list: (query: Record<string, unknown> = {}) =>
    apiClient.get<PagedRequests>("/resource-requests", { query }),
  references: (electionId?: string) =>
    apiClient.get<ResourceRequestReferences>("/resource-requests/references", {
      query: { electionId },
    }),
  detail: (id: string) =>
    apiClient.get<ResourceRequestDetail>(`/resource-requests/${id}`),
  create: (input: ResourceRequestInput) =>
    apiClient.post<ResourceRequestDetail>("/resource-requests", input),
  update: (id: string, input: Partial<ResourceRequestInput>) =>
    apiClient.patch<ResourceRequestDetail>(`/resource-requests/${id}`, input),
  submit: (id: string) =>
    apiClient.post<ResourceRequestDetail>(`/resource-requests/${id}/submit`, {}),
  triage: (
    id: string,
    input: { ownerId?: string; priority?: string; notes?: string },
  ) =>
    apiClient.post<ResourceRequestDetail>(
      `/resource-requests/${id}/triage`,
      input,
    ),
  approve: (id: string) =>
    apiClient.post<ResourceRequestDetail>(`/resource-requests/${id}/approve`, {}),
  reject: (id: string, reason: string) =>
    apiClient.post<ResourceRequestDetail>(`/resource-requests/${id}/reject`, {
      reason,
    }),
  cancel: (id: string, reason?: string) =>
    apiClient.post<ResourceRequestDetail>(`/resource-requests/${id}/cancel`, {
      reason,
    }),
  addFulfillment: (id: string, input: FulfillmentInput) =>
    apiClient.post<ResourceRequestDetail>(
      `/resource-requests/${id}/fulfillments`,
      input,
    ),
  removeFulfillment: (id: string, fulfillmentId: string) =>
    apiClient.delete<ResourceRequestDetail>(
      `/resource-requests/${id}/fulfillments/${fulfillmentId}`,
    ),
  addComment: (id: string, body: string) =>
    apiClient.post<ResourceRequestDetail>(`/resource-requests/${id}/comments`, {
      body,
    }),
  currentUser: () => apiClient.get<{ permissions: string[] }>("/auth/me"),
  elections: () => apiClient.get<Array<{ id: string; name: string }>>("/elections"),
};
