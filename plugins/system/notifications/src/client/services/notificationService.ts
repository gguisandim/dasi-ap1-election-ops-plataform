import { apiClient } from "@eops/api-client";
export interface Notification { id: string; type: "INFO" | "WARNING" | "CRITICAL" | "SUCCESS"; title: string; message: string; eventName: string | null; entityType: string | null; entityId: string | null; readAt: string | null; createdAt: string; }
export const notificationService = { list: () => apiClient.get<{ items: Notification[]; unread: number }>("/notifications"), read: (id: string) => apiClient.patch(`/notifications/${id}/read`, {}), readAll: () => apiClient.patch<void, Record<string, never>>("/notifications/read-all", {}) };
