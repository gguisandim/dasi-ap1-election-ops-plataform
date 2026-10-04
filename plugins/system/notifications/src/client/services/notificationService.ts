import { apiClient } from "@eops/api-client";
import type { Paginated } from "@eops/shared/common";

export interface Notification { id: string; type: "INFO" | "WARNING" | "CRITICAL" | "SUCCESS"; title: string; message: string; eventName: string | null; entityType: string | null; entityId: string | null; readAt: string | null; createdAt: string; }
export interface NotificationFilters { readState?: "ALL" | "READ" | "UNREAD"; type?: Notification["type"] | ""; eventName?: string; from?: string; to?: string; page?: number; pageSize?: number; }
export interface NotificationPreference { eventName: string; domain: string; label: string; description: string; enabled: boolean; }

function changed() { if (typeof window !== "undefined") window.dispatchEvent(new Event("eops:notifications-changed")); }

export const notificationService = {
  list: (query: NotificationFilters = {}) => apiClient.get<Paginated<Notification>>("/notifications", { query }),
  unreadCount: () => apiClient.get<{ count: number }>("/notifications/unread-count"),
  read: async (id: string) => { const result = await apiClient.patch(`/notifications/${id}/read`, {}); changed(); return result; },
  unread: async (id: string) => { const result = await apiClient.patch(`/notifications/${id}/unread`, {}); changed(); return result; },
  readAll: async () => { const result = await apiClient.patch<void, Record<string, never>>("/notifications/read-all", {}); changed(); return result; },
  preferences: () => apiClient.get<NotificationPreference[]>("/notifications/preferences"),
  updatePreferences: (preferences: { eventName: string; enabled: boolean }[]) => apiClient.put<NotificationPreference[], { preferences: { eventName: string; enabled: boolean }[] }>("/notifications/preferences", { preferences }),
};
