import { ConflictException } from "@nestjs/common";
import { FieldTeamStatus, MemberAvailability } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import type { EventBus } from "@eops/event-bus";
import { ShiftsService } from "./shifts.service";

type AvailabilityProbe = {
  requireTeamMember(
    memberId: string,
    teamId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<unknown>;
};

describe("availability-aware assignment", () => {
  const startsAt = new Date("2026-10-04T08:00:00Z");
  const endsAt = new Date("2026-10-04T14:00:00Z");

  it("rejects a member whose base availability blocks assignment", async () => {
    const prisma = {
      fieldMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: "member-1",
          teamId: "team-1",
          status: MemberAvailability.UNAVAILABLE,
          team: {
            id: "team-1",
            electionId: "election-1",
            status: FieldTeamStatus.ACTIVE,
          },
          role: {},
        }),
      },
    } as unknown as PrismaService;
    const service = new ShiftsService(prisma, {} as EventBus);
    await expect(
      (service as unknown as AvailabilityProbe).requireTeamMember(
        "member-1",
        "team-1",
        startsAt,
        endsAt,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects an overlapping operational unavailability period", async () => {
    const prisma = {
      fieldMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: "member-1",
          teamId: "team-1",
          status: MemberAvailability.AVAILABLE,
          team: {
            id: "team-1",
            electionId: "election-1",
            status: FieldTeamStatus.ACTIVE,
          },
          role: {},
        }),
      },
      fieldMemberUnavailability: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "period-1", reason: "Férias" }),
      },
    } as unknown as PrismaService;
    const service = new ShiftsService(prisma, {} as EventBus);
    await expect(
      (service as unknown as AvailabilityProbe).requireTeamMember(
        "member-1",
        "team-1",
        startsAt,
        endsAt,
      ),
    ).rejects.toThrow("Férias");
  });
});
