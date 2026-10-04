import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import { ElectionsService } from "./elections.service";

describe("ElectionsService", () => {
  it("responde 404 quando o pleito não existe", async () => {
    const prisma = {
      election: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    await expect(new ElectionsService(prisma).findOne("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});
