import { BadRequestException } from "@nestjs/common";
import { UserStatus } from "@prisma/client";
import { PERMISSIONS } from "@eops/security";

/** Permissão que sustenta as invariantes I1/I2 de administração da plataforma. */
export const ADMINISTRATIVE_PERMISSION = PERMISSIONS.users.manage;

export interface RolePermissionLike {
  permission: { key: string };
}

export interface RoleState {
  id: string;
  key?: string;
  active: boolean;
  permissionKeys: string[];
}

export interface UserRoleRef {
  roleId: string;
  role: { active: boolean; permissionKeys: string[] };
}

export interface UserRoleState {
  id: string;
  status: UserStatus;
  roles: UserRoleRef[];
}

export function toRoleState(role: {
  id: string;
  key: string;
  active: boolean;
  permissions: RolePermissionLike[];
}): RoleState {
  return { id: role.id, key: role.key, active: role.active, permissionKeys: role.permissions.map((entry) => entry.permission.key) };
}

export function toUserRoleState(user: {
  id: string;
  status: UserStatus;
  roles: Array<{ roleId: string; role: { active: boolean; permissions: RolePermissionLike[] } }>;
}): UserRoleState {
  return {
    id: user.id,
    status: user.status,
    roles: user.roles.map((entry) => ({ roleId: entry.roleId, role: { active: entry.role.active, permissionKeys: entry.role.permissions.map((permission) => permission.permission.key) } })),
  };
}

/** Projeta um usuário sobre o estado canônico (possivelmente alterado) dos perfis. */
export function projectUserState(user: UserRoleState, roles: RoleState[]): UserRoleState {
  const byId = new Map(roles.map((role) => [role.id, role]));
  return {
    ...user,
    roles: user.roles.map(({ roleId, role }) => {
      const projected = byId.get(roleId);
      return { roleId, role: projected ? { active: projected.active, permissionKeys: projected.permissionKeys } : role };
    }),
  };
}

export function buildUserRoleState(userId: string, status: UserStatus, roleIds: string[], roles: RoleState[]): UserRoleState {
  const byId = new Map(roles.map((role) => [role.id, role]));
  return {
    id: userId,
    status,
    roles: roleIds.map((roleId) => {
      const role = byId.get(roleId);
      return { roleId, role: { active: role?.active ?? false, permissionKeys: role?.permissionKeys ?? [] } };
    }),
  };
}

export function roleGrants(role: RoleState, permission: string) {
  return role.active && role.permissionKeys.includes(permission);
}

export function userHolds(user: UserRoleState, permission: string) {
  return user.status === UserStatus.ACTIVE && user.roles.some(({ role }) => role.active && role.permissionKeys.includes(permission));
}

/** I1 — pelo menos um perfil ativo precisa conceder users.manage. */
export function assertAtLeastOneActiveRoleGrantsManage(roles: RoleState[]) {
  if (!roles.some((role) => roleGrants(role, ADMINISTRATIVE_PERMISSION))) {
    throw new BadRequestException("A operação deixaria a plataforma sem perfil ativo com a permissão users.manage.");
  }
}

/** I2 — pelo menos um usuário ACTIVE precisa possuir users.manage por perfil ativo. */
export function assertAtLeastOneActiveUserCanManage(users: UserRoleState[]) {
  if (!users.some((user) => userHolds(user, ADMINISTRATIVE_PERMISSION))) {
    throw new BadRequestException("A operação deixaria a plataforma sem usuário ativo com a permissão users.manage.");
  }
}

export function assertAdministrativeInvariants(roles: RoleState[], users: UserRoleState[]) {
  assertAtLeastOneActiveRoleGrantsManage(roles);
  assertAtLeastOneActiveUserCanManage(users);
}

/** I3 — um usuário não pode alterar o próprio status para um valor não-ACTIVE. */
export function assertSelfStatusTransition(targetId: string, actorId: string, nextStatus: UserStatus) {
  if (targetId === actorId && nextStatus !== UserStatus.ACTIVE) {
    throw new BadRequestException("Você não pode alterar o próprio status para um valor não-ACTIVE.");
  }
}

/** I4 — um usuário não pode remover de si o perfil que garante users.manage. */
export function assertSelfRoleRemovalKeepsManage(before: UserRoleState, after: UserRoleState, actorId: string) {
  if (before.id !== actorId) return;
  if (userHolds(before, ADMINISTRATIVE_PERMISSION) && !userHolds(after, ADMINISTRATIVE_PERMISSION)) {
    throw new BadRequestException("Você não pode remover de si o perfil que garante a permissão users.manage.");
  }
}

export function assertSystemRoleDeletion(role: { system: boolean }) {
  if (role.system) throw new BadRequestException("Perfis de sistema não podem ser excluídos; ajuste ou desative conforme a política.");
}

export function assertSystemRoleDeactivation(role: { system: boolean }, nextActive: boolean) {
  if (role.system && !nextActive) throw new BadRequestException("Perfis de sistema não podem ser desativados.");
}

export function computeEffectivePermissions(assignments: Array<{ role: { active: boolean; permissions: RolePermissionLike[] } }>): string[] {
  const keys = new Set<string>();
  for (const { role } of assignments) {
    if (!role.active) continue;
    for (const { permission } of role.permissions) keys.add(permission.key);
  }
  return [...keys].sort();
}

export function computePermissionsByRole(assignments: Array<{ roleId: string; role: { permissions: RolePermissionLike[] } }>): Record<string, string[]> {
  return Object.fromEntries(
    assignments.map(({ roleId, role }) => [roleId, [...new Set(role.permissions.map((entry) => entry.permission.key))].sort()]),
  );
}

export function sameRoleSet(a: string[], b: string[]) {
  const left = [...new Set(a)].sort();
  const right = [...new Set(b)].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
