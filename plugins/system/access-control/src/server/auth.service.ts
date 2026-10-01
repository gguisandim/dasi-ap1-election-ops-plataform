import { Injectable, UnauthorizedException } from "@nestjs/common";
import { AuditAction, UserStatus } from "@prisma/client";
import { PrismaService } from "../../../../../packages/database/src";
import { LoginDto } from "./dto/auth.dto";
import { signToken, verifyPassword } from "./security";

const userAccess = {
  roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
} as const;

function publicUser(user: { id: string; name: string; email: string; status: UserStatus; roles: Array<{ role: { key: string; permissions: Array<{ permission: { key: string } }> } }> }) {
  const roles = user.roles.map((entry) => entry.role.key);
  const permissions = [...new Set(user.roles.flatMap((entry) => entry.role.permissions.map((permission) => permission.permission.key)))].sort();
  return { id: user.id, name: user.name, email: user.email, status: user.status, roles, permissions };
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() }, include: userAccess });
    if (!user || user.status !== UserStatus.ACTIVE || !(await verifyPassword(dto.password, user.passwordHash))) throw new UnauthorizedException("E-mail ou senha inválidos.");
    const result = publicUser(user);
    const token = signToken({ sub: result.id, email: result.email, roles: result.roles, permissions: result.permissions });
    await this.prisma.auditEvent.create({ data: { actorId: user.id, action: AuditAction.LOGIN, entityType: "User", entityId: user.id, metadata: { source: "password" } } });
    return { token, user: result };
  }
  async me(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: userAccess });
    if (!user || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException("Usuário inativo ou inexistente.");
    return publicUser(user);
  }
  async logout(id: string) {
    await this.prisma.auditEvent.create({ data: { actorId: id, action: AuditAction.LOGOUT, entityType: "User", entityId: id } });
  }
}
