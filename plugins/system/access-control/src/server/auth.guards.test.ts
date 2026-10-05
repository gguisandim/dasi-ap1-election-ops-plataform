import { ForbiddenException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { AuthenticationGuard, PermissionGuard } from "./auth.guards";

vi.mock("./security", () => ({ verifyToken: () => ({ sub: "user-1", email: "user@example.test", roles: [], permissions: [] }) }));

function context(permissions: string[]) {
  const request = { user: { id: "user-1", email: "user@example.test", roles: ["OPERATOR"], permissions } };
  return { getHandler: vi.fn(), getClass: vi.fn(), switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}
function authContext() {
  const request: { headers: { authorization?: string }; user?: unknown } = { headers: { authorization: "Bearer token" } };
  return { request, context: { getHandler: vi.fn(), getClass: vi.fn(), switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext };
}
describe("PermissionGuard", () => {
  it("retorna 403 para usuário sem permissão", () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(["incidents.assign"]) } as unknown as Reflector;
    expect(() => new PermissionGuard(reflector).canActivate(context(["incidents.read"]))).toThrow(ForbiddenException);
  });
  it("autoriza usuário com todas as permissões exigidas", () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(["incidents.read", "incidents.assign"]) } as unknown as Reflector;
    expect(new PermissionGuard(reflector).canActivate(context(["incidents.read", "incidents.assign"]))).toBe(true);
  });
});
describe("AuthenticationGuard", () => {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
  it("rejeita usuário inexistente ou com status não-ACTIVE", async () => {
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(null) } };
    const missing = authContext();
    await expect(new AuthenticationGuard(reflector, prisma as never).canActivate(missing.context)).rejects.toBeInstanceOf(UnauthorizedException);
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "user@example.test", status: "INACTIVE", roles: [] });
    const inactive = authContext();
    await expect(new AuthenticationGuard(reflector, prisma as never).canActivate(inactive.context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it("resolve permissões atuais apenas de perfis ativos", async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "user-1",
          email: "user@example.test",
          status: "ACTIVE",
          roles: [
            { role: { key: "OPERATOR", active: true, permissions: [{ permission: { key: "roles.read" } }] } },
            { role: { key: "OLD", active: false, permissions: [{ permission: { key: "users.manage" } }] } },
          ],
        }),
      },
    };
    const request = authContext();
    await expect(new AuthenticationGuard(reflector, prisma as never).canActivate(request.context)).resolves.toBe(true);
    expect(request.request.user).toEqual({ id: "user-1", email: "user@example.test", roles: ["OPERATOR"], permissions: ["roles.read"] });
  });
});
