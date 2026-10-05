import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserStatus } from "@prisma/client";
import { PrismaService } from "@eops/database";
import { PUBLIC_ROUTE, REQUIRED_PERMISSIONS } from "@eops/security";
import type { AuthenticatedRequest } from "@eops/security";
import { verifyToken } from "./security";

const userAccess = { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } as const;

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedException("Autenticação necessária.");
    const payload = verifyToken(header.slice(7));
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: userAccess });
    if (!user || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException("Usuário inativo ou inexistente.");
    const activeRoles = user.roles.map((entry) => entry.role).filter((role) => role.active);
    request.user = {
      id: user.id,
      email: user.email,
      roles: activeRoles.map((role) => role.key),
      permissions: [...new Set(activeRoles.flatMap((role) => role.permissions.map((permission) => permission.permission.key)))].sort(),
    };
    return true;
  }
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!required.every((permission) => request.user.permissions.includes(permission))) throw new ForbiddenException("Permissão insuficiente.");
    return true;
  }
}
