import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UserStatus } from "@prisma/client";
import { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import { PERMISSIONS, PLATFORM_PERMISSION_KEYS } from "@eops/security";
import { CreateRoleDto, UpdateRoleDto } from "./dto/roles.dto";
import {
  assertAdministrativeInvariants,
  assertSystemRoleDeactivation,
  assertSystemRoleDeletion,
  projectUserState,
  toRoleState,
  toUserRoleState,
  type RoleState,
} from "./access-invariants";

export interface PermissionCatalogEntry { key: string; action: string }
export interface PermissionCatalogGroup { domain: string; label: string; permissions: PermissionCatalogEntry[] }

const roleInclude = { permissions: { include: { permission: true } } } as const;
const userRolesInclude = { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } as const;

/**
 * Catálogo derivado exclusivamente de `PERMISSIONS` de @eops/security.
 * Nunca manter uma lista paralela de permissões no plugin.
 */
export function buildPermissionCatalog(): PermissionCatalogGroup[] {
  const groups = new Map<string, Set<string>>();
  for (const group of Object.values(PERMISSIONS) as ReadonlyArray<Record<string, string>>) {
    for (const key of Object.values(group)) {
      const domain = key.slice(0, key.lastIndexOf("."));
      const bucket = groups.get(domain) ?? new Set<string>();
      bucket.add(key);
      groups.set(domain, bucket);
    }
  }
  return [...groups.entries()]
    .map(([domain, keys]) => ({
      domain,
      label: domain.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "),
      permissions: [...keys].sort().map((key) => ({ key, action: key.slice(key.lastIndexOf(".") + 1) })),
    }))
    .sort((left, right) => left.domain.localeCompare(right.domain));
}

export function validatePermissionKeys(permissionKeys: string[]): string[] {
  const unique = [...new Set(permissionKeys)];
  const invalid = unique.filter((key) => !(PLATFORM_PERMISSION_KEYS as readonly string[]).includes(key));
  if (invalid.length) throw new BadRequestException(`Permissões fora do catálogo: ${invalid.join(", ")}.`);
  return unique;
}

export function deriveRoleKey(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return normalized || "PERFIL";
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService, private readonly eventBus: EventBus) {}

  catalog() {
    return buildPermissionCatalog();
  }

  list() {
    return this.prisma.role.findMany({ include: roleInclude, orderBy: [{ system: "desc" }, { name: "asc" }] });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id }, include: roleInclude });
    if (!role) throw new NotFoundException("Perfil não encontrado.");
    return role;
  }

  private async permissionIds(permissionKeys: string[], client: PrismaService | Prisma.TransactionClient = this.prisma) {
    const records = await client.permission.findMany({ where: { key: { in: permissionKeys } }, select: { id: true, key: true } });
    if (records.length !== permissionKeys.length) throw new BadRequestException("Catálogo de permissões indisponível para uma das chaves solicitadas.");
    return records;
  }

  private async loadStates() {
    const roles = await this.prisma.role.findMany({ include: roleInclude });
    const roleStates = roles.map(toRoleState);
    const users = await this.prisma.user.findMany({ where: { status: UserStatus.ACTIVE }, include: userRolesInclude });
    return { roleStates, userStates: users.map(toUserRoleState) };
  }

  async create(dto: CreateRoleDto, actorId: string) {
    const permissionKeys = validatePermissionKeys(dto.permissionKeys);
    const key = deriveRoleKey(dto.key ?? dto.name);
    if (await this.prisma.role.findUnique({ where: { key }, select: { id: true } })) throw new ConflictException("Já existe um perfil com essa chave.");
    const permissions = await this.permissionIds(permissionKeys);
    const role = await this.prisma.role.create({
      data: {
        key,
        name: dto.name,
        description: dto.description ?? null,
        system: false,
        active: true,
        permissions: { create: permissions.map(({ id }) => ({ permissionId: id })) },
      },
      include: roleInclude,
    });
    await this.eventBus.emit("access.role_created", { entityId: role.id, actorId, key: role.key, name: role.name, permissionKeys });
    return role;
  }

  async update(id: string, dto: UpdateRoleDto, actorId: string) {
    const current = await this.findOne(id);
    const nextActive = dto.active ?? current.active;
    const nextPermissionKeys = dto.permissionKeys ? validatePermissionKeys(dto.permissionKeys) : current.permissions.map((entry) => entry.permission.key);
    assertSystemRoleDeactivation(current, nextActive);

    const { roleStates, userStates } = await this.loadStates();
    const projectedRoles: RoleState[] = roleStates.map((role) => (role.id === id ? { ...role, active: nextActive, permissionKeys: nextPermissionKeys } : role));
    const projectedUsers = userStates.map((user) => projectUserState(user, projectedRoles));
    assertAdministrativeInvariants(projectedRoles, projectedUsers);

    await this.prisma.$transaction(async (tx) => {
      if (dto.permissionKeys) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        const permissions = await this.permissionIds(nextPermissionKeys, tx);
        if (permissions.length) await tx.rolePermission.createMany({ data: permissions.map(({ id: permissionId }) => ({ roleId: id, permissionId })) });
      }
      await tx.role.update({ where: { id }, data: { name: dto.name, description: dto.description, active: dto.active } });
    });

    const role = await this.findOne(id);
    if (current.active && !nextActive) {
      await this.eventBus.emit("access.role_deactivated", { entityId: role.id, actorId, key: role.key, name: role.name });
    } else {
      await this.eventBus.emit("access.role_updated", { entityId: role.id, actorId, key: role.key, name: role.name, permissionKeys: nextPermissionKeys });
    }
    return role;
  }

  async remove(id: string, actorId: string) {
    const role = await this.findOne(id);
    assertSystemRoleDeletion(role);
    const assignedUsers = await this.prisma.userRole.count({ where: { roleId: id } });
    if (assignedUsers > 0) throw new BadRequestException("Perfil possui usuários vinculados; desative-o em vez de excluir.");
    await this.prisma.role.delete({ where: { id } });
    await this.eventBus.emit("access.role_deactivated", { entityId: role.id, actorId, key: role.key, name: role.name });
  }
}
