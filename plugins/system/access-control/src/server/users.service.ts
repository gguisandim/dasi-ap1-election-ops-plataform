import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { PrismaService } from "../../../../../packages/database/src";
import { EventBus } from "../../../../../packages/event-bus/src";
import { CreateUserDto, UpdateUserDto } from "./dto/auth.dto";
import { hashPassword } from "./security";

const includeAccess = { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } as const;
function withoutPassword<T extends { passwordHash: string }>(user: T) { const { passwordHash, ...safe } = user; void passwordHash; return safe; }

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly eventBus: EventBus) {}
  async list() { return (await this.prisma.user.findMany({ include: includeAccess, orderBy: { name: "asc" } })).map(withoutPassword); }
  roles() { return this.prisma.role.findMany({ include: { permissions: { include: { permission: true } } }, orderBy: { name: "asc" } }); }
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: includeAccess });
    if (!user) throw new NotFoundException("Usuário não encontrado.");
    return withoutPassword(user);
  }
  private async validateRoles(roleIds: string[]) {
    if ((await this.prisma.role.count({ where: { id: { in: roleIds } } })) !== new Set(roleIds).size) throw new NotFoundException("Um ou mais perfis não foram encontrados.");
  }
  async create(dto: CreateUserDto, actorId: string) {
    await this.validateRoles(dto.roleIds);
    try {
      const user = await this.prisma.user.create({ data: { name: dto.name, email: dto.email.toLowerCase(), passwordHash: await hashPassword(dto.password), roles: { create: dto.roleIds.map((roleId) => ({ roleId })) } }, include: includeAccess });
      await this.eventBus.emit("user.created", { entityId: user.id, actorId, email: user.email, name: user.name });
      return withoutPassword(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Já existe um usuário com esse e-mail.");
      throw error;
    }
  }
  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const current = await this.findOne(id);
    if (dto.roleIds) await this.validateRoles(dto.roleIds);
    const user = await this.prisma.$transaction(async (tx) => {
      if (dto.roleIds) { await tx.userRole.deleteMany({ where: { userId: id } }); await tx.userRole.createMany({ data: dto.roleIds.map((roleId) => ({ userId: id, roleId })) }); }
      return tx.user.update({ where: { id }, data: { name: dto.name, status: dto.status }, include: includeAccess });
    });
    await this.prisma.auditEvent.create({ data: { actorId, action: AuditAction.UPDATE, entityType: "User", entityId: id, oldData: { name: current.name, status: current.status }, newData: { name: user.name, status: user.status, roleIds: dto.roleIds } } });
    return withoutPassword(user);
  }
}
