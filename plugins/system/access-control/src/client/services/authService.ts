import { apiClient } from "@eops/api-client";
import type { CurrentUser, UserStatus } from "@eops/shared/auth";
import type { RoleRecord, UserDetailRecord, UserRecord } from "../types";
export const authService = {
  login: (email: string, password: string) => apiClient.post<{ token: string; user: CurrentUser }, { email: string; password: string }>("/auth/login", { email, password }),
  me: () => apiClient.get<CurrentUser>("/auth/me"),
  logout: () => apiClient.post<void, Record<string, never>>("/auth/logout", {}),
};
export const userService = {
  list: () => apiClient.get<UserRecord[]>("/users"),
  roles: () => apiClient.get<RoleRecord[]>("/users/roles"),
  get: (id: string) => apiClient.get<UserDetailRecord>(`/users/${id}`),
  create: (input: { name: string; email: string; password: string; roleIds: string[] }) => apiClient.post<UserDetailRecord>("/users", input),
  update: (id: string, input: { name?: string; status?: UserStatus; roleIds?: string[] }) => apiClient.patch<UserDetailRecord, typeof input>(`/users/${id}`, input),
  addRoles: (id: string, roleIds: string[]) => apiClient.post<UserDetailRecord, { roleIds: string[] }>(`/users/${id}/roles`, { roleIds }),
  replaceRoles: (id: string, roleIds: string[]) => apiClient.patch<UserDetailRecord, { roleIds: string[] }>(`/users/${id}/roles`, { roleIds }),
  removeRole: (id: string, roleId: string) => apiClient.delete<UserDetailRecord>(`/users/${id}/roles/${roleId}`),
  updateStatus: (id: string, status: UserStatus) => apiClient.patch<UserDetailRecord, { status: UserStatus }>(`/users/${id}/status`, { status }),
};
