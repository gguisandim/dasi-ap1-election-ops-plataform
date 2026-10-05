import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import { PERMISSIONS, PLATFORM_PERMISSION_KEYS } from "@eops/security";
import { assertAtLeastOneActiveRoleGrantsManage, assertSystemRoleDeactivation, assertSystemRoleDeletion } from "./access-invariants";
import { buildPermissionCatalog, deriveRoleKey, RolesService, validatePermissionKeys } from "./roles.service";

function createService(prisma: Record<string, unknown>, eventBus = { emit: vi.fn() }) {
  return { service: new RolesService(prisma as unknown as PrismaService, eventBus as never), eventBus };
}

describe("catálogo de permissões", () => {
  it("deriva os grupos de PERMISSIONS de @eops/security sem lista paralela", () => {
    const catalog = buildPermissionCatalog();
    const keys = catalog.flatMap((group) => group.permissions.map((entry) => entry.key));
    expect(new Set(keys)).toEqual(new Set(PLATFORM_PERMISSION_KEYS));
    expect(keys).toContain(PERMISSIONS.roles.read);
    expect(keys).toContain(PERMISSIONS.roles.manage);
    const roles = catalog.find((group) => group.domain === "roles");
    expect(roles?.permissions.map((entry) => entry.action)).toEqual(["manage", "read"]);
  });

  it("aceita apenas chaves do catálogo e remove duplicatas", () => {
    expect(validatePermissionKeys([PERMISSIONS.users.read, PERMISSIONS.users.read])).toEqual([PERMISSIONS.users.read]);
    expect(() => validatePermissionKeys(["permissao.arbitraria"])).toThrow(BadRequestException);
  });

  it("normaliza a chave derivada do nome", () => {
    expect(deriveRoleKey("Coordenador de Campo")).toBe("COORDENADOR_DE_CAMPO");
    expect(deriveRoleKey("Operação Ágil")).toBe("OPERACAO_AGIL");
    expect(deriveRoleKey("!!!")).toBe("PERFIL");
  });
});

describe("proteção de perfis de sistema", () => {
  it("impede exclusão e desativação de perfis de sistema", () => {
    expect(() => assertSystemRoleDeletion({ system: true })).toThrow(BadRequestException);
    expect(() => assertSystemRoleDeactivation({ system: true }, false)).toThrow(BadRequestException);
    expect(() => assertSystemRoleDeactivation({ system: true }, true)).not.toThrow();
    expect(() => assertSystemRoleDeactivation({ system: false }, false)).not.toThrow();
  });

  it("recusa desativar perfil de sistema pelo serviço", async () => {
    const role = { id: "role-1", key: "ADMIN", name: "Administrador", description: null, system: true, active: true, permissions: [{ permission: { key: PERMISSIONS.users.manage } }] };
    const prisma = { role: { findUnique: vi.fn().mockResolvedValue(role) } };
    const { service, eventBus } = createService(prisma);
    await expect(service.update("role-1", { active: false }, "actor-1")).rejects.toBeInstanceOf(BadRequestException);
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it("recusa excluir perfil com usuários vinculados recomendando desativação", async () => {
    const role = { id: "role-1", key: "CUSTOM", name: "Personalizado", description: null, system: false, active: true, permissions: [] };
    const prisma = { role: { findUnique: vi.fn().mockResolvedValue(role) }, userRole: { count: vi.fn().mockResolvedValue(2) } };
    const { service, eventBus } = createService(prisma);
    await expect(service.remove("role-1", "actor-1")).rejects.toBeInstanceOf(BadRequestException);
    expect(eventBus.emit).not.toHaveBeenCalled();
  });
});

describe("invariante I1", () => {
  it("exige ao menos um perfil ativo com users.manage", () => {
    expect(() => assertAtLeastOneActiveRoleGrantsManage([{ id: "role-1", active: false, permissionKeys: [PERMISSIONS.users.manage] }])).toThrow(BadRequestException);
    expect(() => assertAtLeastOneActiveRoleGrantsManage([{ id: "role-1", active: true, permissionKeys: [PERMISSIONS.users.read] }])).toThrow(BadRequestException);
    expect(() => assertAtLeastOneActiveRoleGrantsManage([{ id: "role-1", active: true, permissionKeys: [PERMISSIONS.users.manage] }])).not.toThrow();
  });
});
