import { apiClient } from "@eops/api-client";
import type { PermissionCatalogGroup, RoleRecord } from "../types";

export const rolesService = {
  catalog: () => apiClient.get<PermissionCatalogGroup[]>("/permissions"),
  list: () => apiClient.get<RoleRecord[]>("/roles"),
  role: (id: string) => apiClient.get<RoleRecord>(`/roles/${id}`),
  create: (input: { name: string; description?: string; key?: string; permissionKeys: string[] }) => apiClient.post<RoleRecord>("/roles", input),
  update: (id: string, input: { name?: string; description?: string; permissionKeys?: string[]; active?: boolean }) => apiClient.patch<RoleRecord>(`/roles/${id}`, input),
  remove: (id: string) => apiClient.delete<void>(`/roles/${id}`),
};
