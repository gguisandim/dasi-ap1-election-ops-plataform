import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UserStatus } from "@prisma/client";
import { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import { CreateUserDto, UpdateUserDto } from "./dto/auth.dto";
import { hashPassword } from "./security";
import {
  assertAtLeastOneActiveRoleGrantsManage,
  assertAtLeastOneActiveUserCanManage,
  assertSelfRoleRemovalKeepsManage,
  assertSelfStatusTransition,
  buildUserRoleState,
  computeEffectivePermissions,
  computePermissionsByRole,
  projectUserState,
  sameRoleSet,
  toRoleState,
  toUserRoleState,
  type RoleState,
} from "./access-invariants";

const includeAccess = { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } as const;
const roleInclude = { permissions: { include: { permission: true } } } as const;
function withoutPassword<T extends { passwordHash: string }>(user: T) { const { passwordHash, ...safe } = user; void passwordHash; return safe; }

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly eventBus: EventBus) {}

  async list() { return (await this.prisma.user.findMany({ include: includeAccess, orderBy: { name: "asc" } })).map(withoutPassword); }
  roles() { return this.prisma.role.findMany({ include: roleInclude, orderBy: { name: "asc" } }); }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: includeAccess });
    if (!user) throw new NotFoundException("Usuário não encontrado.");
    return {
      ...withoutPassword(user),
      permissionsByRole: computePermissionsByRole(user.roles),
      effectivePermissions: computeEffectivePermissions(user.roles),
    };
  }

  private async loadUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: includeAccess });
    if (!user) throw new NotFoundException("Usuário não encontrado.");
    return user;
  }

  private async loadStates() {
    const roles = await this.prisma.role.findMany({ include: roleInclude });
    const roleStates: RoleState[] = roles.map(toRoleState);
    const activeUsers = await this.prisma.user.findMany({ where: { status: UserStatus.ACTIVE }, include: includeAccess });
    return { roleStates, activeUsers: activeUsers.map(toUserRoleState) };
  }

  /** Resolve os perfis informados garantindo que todos existam. */
  private async resolveRoles(roleIds: string[]) {
    const unique = [...new Set(roleIds)];
    const roles = await this.prisma.role.findMany({ where: { id: { in: unique } } });
    if (roles.length !== unique.length) throw new NotFoundException("Um ou mais perfis não foram encontrados.");
    return unique;
  }

  private async applyRoles(id: string, nextRoleIds: string[], actorId: string) {
    const user = await this.loadUser(id);
    const nextIds = await this.resolveRoles(nextRoleIds);
    const { roleStates, activeUsers } = await this.loadStates();
    const beforeIds = user.roles.map((entry) => entry.roleId);
    const beforeState = buildUserRoleState(user.id, user.status, beforeIds, roleStates);
    const targetState = buildUserRoleState(user.id, user.status, nextIds, roleStates);
    assertSelfRoleRemovalKeepsManage(beforeState, targetState, actorId);
    const projected = activeUsers.map((candidate) => (candidate.id === id ? projectUserState(targetState, roleStates) : projectUserState(candidate, roleStates)));
    assertAtLeastOneActiveRoleGrantsManage(roleStates);
    assertAtLeastOneActiveUserCanManage(projected);

    if (!sameRoleSet(beforeIds, nextIds)) {
      await this.prisma.$transaction(async (tx) => {
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (nextIds.length) await tx.userRole.createMany({ data: nextIds.map((roleId) => ({ userId: id, roleId })) });
      });
      const keyOf = (roleId: string) => roleStates.find((role) => role.id === roleId)?.key ?? roleId;
      await this.eventBus.emit("access.user_roles_changed", {
        entityId: id,
        actorId,
        userId: id,
        from: beforeState.roles.map((entry) => keyOf(entry.roleId)).sort(),
        to: targetState.roles.map((entry) => keyOf(entry.roleId)).sort(),
      });
    }
    return this.findOne(id);
  }

  addRoles(id: string, roleIds: string[], actorId: string) {
    return this.loadUser(id).then((user) => this.applyRoles(id, [...user.roles.map((entry) => entry.roleId), ...roleIds], actorId));
  }

  replaceRoles(id: string, roleIds: string[], actorId: string) {
    return this.applyRoles(id, roleIds, actorId);
  }

  removeRole(id: string, roleId: string, actorId: string) {
    return this.loadUser(id).then((user) => this.applyRoles(id, user.roles.map((entry) => entry.roleId).filter((value) => value !== roleId), actorId));
  }

  async updateStatus(id: string, status: UserStatus, actorId: string) {
    const user = await this.loadUser(id);
    assertSelfStatusTransition(id, actorId, status);
    if (status !== UserStatus.ACTIVE && user.status === UserStatus.ACTIVE) {
      const { roleStates, activeUsers } = await this.loadStates();
      const targetState = projectUserState(toUserRoleState(user), roleStates);
      const projected = activeUsers.map((candidate) => (candidate.id === id ? { ...targetState, status } : projectUserState(candidate, roleStates)));
      assertAtLeastOneActiveUserCanManage(projected);
      assertAtLeastOneActiveRoleGrantsManage(roleStates);
    }
    if (user.status !== status) {
      await this.prisma.user.update({ where: { id }, data: { status } });
      await this.eventBus.emit("access.user_status_changed", { entityId: id, actorId, userId: id, from: user.status, to: status });
    }
    return this.findOne(id);
  }

  async create(dto: CreateUserDto, actorId: string) {
    await this.resolveRoles(dto.roleIds);
    try {
      const user = await this.prisma.user.create({ data: { name: dto.name, email: dto.email.toLowerCase(), passwordHash: await hashPassword(dto.password), roles: { create: dto.roleIds.map((roleId) => ({ roleId })) } }, include: includeAccess });
      await this.eventBus.emit("user.created", { entityId: user.id, actorId, email: user.email, name: user.name });
      return withoutPassword(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Já existe um usuário com esse e-mail.");
      throw error;
    }
  }

  /** Compatibilidade: delega às mesmas validações dos endpoints explícitos. */
  async update(id: string, dto: UpdateUserDto, actorId: string) {
    await this.loadUser(id);
    if (dto.name !== undefined) await this.prisma.user.update({ where: { id }, data: { name: dto.name } });
    if (dto.roleIds) await this.applyRoles(id, dto.roleIds, actorId);
    if (dto.status) await this.updateStatus(id, dto.status, actorId);
    return this.findOne(id);
  }
}
