import type { UserStatus } from "@eops/shared/auth";

export interface RolePermissionRef {
  permission: { id: string; key: string; description: string };
}

export interface RoleRecord {
  id: string;
  key: string;
  name: string;
  description: string | null;
  system: boolean;
  active: boolean;
  permissions: RolePermissionRef[];
}

export interface UserRoleEntry {
  roleId: string;
  role: RoleRecord;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  roles: UserRoleEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface UserDetailRecord extends UserRecord {
  permissionsByRole: Record<string, string[]>;
  effectivePermissions: string[];
}

export interface PermissionCatalogEntry {
  key: string;
  action: string;
}

export interface PermissionCatalogGroup {
  domain: string;
  label: string;
  permissions: PermissionCatalogEntry[];
}
