import { BadRequestException } from "@nestjs/common";
import { FieldCheckType, MemberAvailability } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import { FieldTeamsService } from "./field-teams.service";

describe("FieldTeamsService", () => {
  it("registra check-in e altera disponibilidade para em serviço", async () => {
    const event = { id: "check-1" };
    const tx = { fieldCheckEvent: { create: vi.fn().mockResolvedValue(event) }, fieldMember: { update: vi.fn() } };
    const prisma = { fieldMember: { findUnique: vi.fn().mockResolvedValue({ id: "member-1", name: "Ana", team: { electionId: "e-1" } }) }, $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    await new FieldTeamsService(prisma).createCheck({ memberId: "member-1", type: FieldCheckType.CHECK_IN });
    expect(tx.fieldCheckEvent.create).toHaveBeenCalled();
    expect(tx.fieldMember.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: MemberAvailability.ON_DUTY } }));
  });

  it("exige equipe ou membro para uma alocação", async () => {
    const service = new FieldTeamsService({} as PrismaService);
    await expect(service.createAllocation({ electionId: "e-1", activity: "Suporte", startsAt: "2026-10-01T10:00:00Z" })).rejects.toBeInstanceOf(BadRequestException);
  });
});
