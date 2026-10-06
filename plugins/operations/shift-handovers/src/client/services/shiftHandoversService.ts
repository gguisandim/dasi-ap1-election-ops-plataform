import { apiClient } from "@eops/api-client";
import type { HandoverInput, HandoverStatus, ShiftHandover } from "../../types";

export interface HandoverContext {
  shift: { id: string; name?: string | null; status: string; startsAt: string; endsAt: string };
  recipients: Array<{ id: string; name: string; email: string }>;
  incidents: Array<{ id: string; code: string; title: string; severity: string; status: string }>;
  tasks: Array<{ id: string; title: string; priority: string; status: string }>;
  assets: Array<{ id: string; assetTag: string; name: string; status: string; condition: string }>;
}

export const shiftHandoversService = {
  dashboard: () => apiClient.get<{ drafts: number; pending: number; pendingForMe: number; confirmedToday: number; recent: ShiftHandover[] }>("/shift-handovers/dashboard"),
  list: (query: Record<string, unknown> = {}) => apiClient.get<{ items: ShiftHandover[]; page: number; pageSize: number; total: number; totalPages: number }>("/shift-handovers", { query }),
  detail: (id: string) => apiClient.get<ShiftHandover>(`/shift-handovers/${id}`),
  context: (shiftId: string) => apiClient.get<HandoverContext>("/shift-handovers/context", { query: { shiftId } }),
  shifts: () => apiClient.get<Array<{ id: string; name?: string | null; status: string; startsAt: string; team: { name: string } }>>("/shifts", { query: { startsFrom: new Date(Date.now() - 7 * 86400000).toISOString() } }),
  create: (input: HandoverInput) => apiClient.post<ShiftHandover>("/shift-handovers", input),
  update: (id: string, input: Partial<HandoverInput>) => apiClient.patch<ShiftHandover>(`/shift-handovers/${id}`, input),
  submit: (id: string) => apiClient.post<ShiftHandover>(`/shift-handovers/${id}/submit`, {}),
  confirm: (id: string) => apiClient.post<ShiftHandover>(`/shift-handovers/${id}/confirm`, {}),
  cancel: (id: string, reason?: string) => apiClient.post<ShiftHandover>(`/shift-handovers/${id}/cancel`, { reason }),
};

export const statusLabel: Record<HandoverStatus, string> = {
  DRAFT: "Rascunho",
  PENDING_CONFIRMATION: "Aguardando confirmação",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
};
