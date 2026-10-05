import { BadRequestException } from "@nestjs/common";
import { UserStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import { PERMISSIONS } from "@eops/security";
import {
  assertAtLeastOneActiveUserCanManage,
  assertSelfRoleRemovalKeepsManage,
  assertSelfStatusTransition,
  buildUserRoleState,
  computeEffectivePermissions,
  computePermissionsByRole,
} from "./access-invariants";
import { UsersService } from "./users.service";

function createService(prisma: Record<string, unknown>, eventBus = { emit: vi.fn() }) {
  return { service: new UsersService(prisma as unknown as PrismaService, eventBus as never), eventBus };
}

const adminRole = { id: "role-admin", key: "ADMIN", name: "Administrador", active: true, permissions: [{ permission: { key: PERMISSIONS.users.manage } }] };
const adminUser = { id: "user-1", name: "Admin", email: "admin@eops.local", passwordHash: "hash", status: UserStatus.ACTIVE, roles: [{ roleId: "role-admin", role: adminRole }] };

describe("permissões efetivas derivadas", () => {
  it("faz a união ordenada apenas de perfis ativos", () => {
    const assignments = [
      { role: { active: true, permissions: [{ permission: { key: "b.read" } }, { permission: { key: "a.read" } }] } },
      { role: { active: false, permissions: [{ permission: { key: "c.read" } }] } },
      { role: { active: true, permissions: [{ permission: { key: "a.read" } }] } },
    ];
    expect(computeEffectivePermissions(assignments)).toEqual(["a.read", "b.read"]);
    expect(computeEffectivePermissions([{ role: { active: false, permissions: [{ permission: { key: "x" } }] } }])).toEqual([]);
  });

  it("agrupa permissões por perfil vinculado", () => {
    const result = computePermissionsByRole([
      { roleId: "role-admin", role: { permissions: [{ permission: { key: "users.manage" } }, { permission: { key: "users.read" } }] } },
    ]);
    expect(result).toEqual({ "role-admin": ["users.manage", "users.read"] });
  });
});

describe("invariante I2 — último administrador", () => {
  it("exige ao menos um usuário ativo com users.manage", () => {
    const active = { id: "user-1", status: UserStatus.ACTIVE, roles: [{ roleId: "role-admin", role: { active: true, permissionKeys: [PERMISSIONS.users.manage] } }] };
    const inactive = { id: "user-1", status: UserStatus.INACTIVE, roles: [{ roleId: "role-admin", role: { active: true, permissionKeys: [PERMISSIONS.users.manage] } }] };
    expect(() => assertAtLeastOneActiveUserCanManage([inactive])).toThrow(BadRequestException);
    expect(() => assertAtLeastOneActiveUserCanManage([active])).not.toThrow();
  });

  it("recusa desativar o último administrador pelo serviço", async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(adminUser), findMany: vi.fn().mockResolvedValue([adminUser]) },
      role: { findMany: vi.fn().mockResolvedValue([adminRole]) },
    };
    const { service, eventBus } = createService(prisma);
    await expect(service.updateStatus("user-1", UserStatus.INACTIVE, "actor-2")).rejects.toBeInstanceOf(BadRequestException);
    expect(eventBus.emit).not.toHaveBeenCalled();
  });
});

describe("transições de estado da conta", () => {
  it("I3 — recusa alterar o próprio status para não-ACTIVE", () => {
    expect(() => assertSelfStatusTransition("user-1", "user-1", UserStatus.INACTIVE)).toThrow(BadRequestException);
    expect(() => assertSelfStatusTransition("user-1", "user-1", UserStatus.ACTIVE)).not.toThrow();
    expect(() => assertSelfStatusTransition("user-2", "user-1", UserStatus.LOCKED)).not.toThrow();
  });

  it("recusa autodesativação pelo serviço", async () => {
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(adminUser) } };
    const { service } = createService(prisma);
    await expect(service.updateStatus("user-1", UserStatus.INACTIVE, "user-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("I4 — recusa remover de si o perfil que garante users.manage", () => {
    const before = buildUserRoleState("user-1", UserStatus.ACTIVE, ["role-admin"], [adminRole].map((role) => ({ id: role.id, key: role.key, active: role.active, permissionKeys: role.permissions.map((entry) => entry.permission.key) })));
    const withoutAdmin = buildUserRoleState("user-1", UserStatus.ACTIVE, [], []);
    expect(() => assertSelfRoleRemovalKeepsManage(before, withoutAdmin, "user-1")).toThrow(BadRequestException);
    expect(() => assertSelfRoleRemovalKeepsManage(before, withoutAdmin, "user-2")).not.toThrow();
  });
});
