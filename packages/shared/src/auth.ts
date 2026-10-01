export type UserStatus = "ACTIVE" | "INACTIVE" | "LOCKED";
export interface CurrentUser { id: string; name: string; email: string; status: UserStatus; roles: string[]; permissions: string[]; }
export interface RoleSummary { id: string; key: string; name: string; description: string | null; permissions: Array<{ permission: { id: string; key: string; description: string } }>; }
export interface UserSummary { id: string; name: string; email: string; status: UserStatus; roles: Array<{ role: RoleSummary }>; createdAt: string; updatedAt: string; }
