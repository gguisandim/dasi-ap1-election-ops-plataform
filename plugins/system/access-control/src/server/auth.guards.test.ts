import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { PermissionGuard } from "./auth.guards";

function context(permissions: string[]) {
  const request = { user: { id: "user-1", email: "user@example.test", roles: ["OPERATOR"], permissions } };
  return { getHandler: vi.fn(), getClass: vi.fn(), switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
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
