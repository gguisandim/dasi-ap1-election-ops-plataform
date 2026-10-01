import { apiClient } from "@eops/api-client";
import type { CurrentUser, RoleSummary, UserStatus, UserSummary } from "@eops/shared/auth";
export const authService = {
  login: (email: string, password: string) => apiClient.post<{ token: string; user: CurrentUser }, { email: string; password: string }>("/auth/login", { email, password }),
  me: () => apiClient.get<CurrentUser>("/auth/me"),
  logout: () => apiClient.post<void, Record<string, never>>("/auth/logout", {}),
};
export const userService = {
  list: () => apiClient.get<UserSummary[]>("/users"), roles: () => apiClient.get<RoleSummary[]>("/users/roles"),
  create: (input: { name: string; email: string; password: string; roleIds: string[] }) => apiClient.post<UserSummary>("/users", input),
  update: (id: string, input: { name?: string; status?: UserStatus; roleIds?: string[] }) => apiClient.patch<UserSummary, typeof input>(`/users/${id}`, input),
};
