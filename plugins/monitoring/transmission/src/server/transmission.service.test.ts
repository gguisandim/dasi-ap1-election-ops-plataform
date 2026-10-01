import { BadRequestException } from "@nestjs/common";
import { ConnectivityStatus, TransmissionAttemptResult, TransmissionStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../../../../packages/database/src";
import { TransmissionService } from "./transmission.service";

const point = { id: "p-1", identification: "TX-001", electionId: "e-1", electoralZoneId: "z-1", pollingPlaceId: "l-1", status: TransmissionStatus.QUEUED, connectivity: ConnectivityStatus.ONLINE, attemptCount: 0, operationalDeadline: null, attempts: [], timeline: [], alerts: [], election: {}, electoralZone: {}, pollingPlace: {} };

describe("TransmissionService", () => {
  it("registra tentativa bem-sucedida com duração e atualiza o ponto", async () => {
    const tx = { transmissionAttempt: { create: vi.fn() }, transmissionPoint: { update: vi.fn() }, transmissionTimelineEvent: { createMany: vi.fn() } };
    const prisma = { transmissionPoint: { findUnique: vi.fn().mockResolvedValue(point) }, transmissionAlert: { updateMany: vi.fn() }, $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    await new TransmissionService(prisma).registerAttempt("p-1", { startedAt: "2026-10-01T10:00:00Z", endedAt: "2026-10-01T10:00:30Z", result: TransmissionAttemptResult.SUCCESS });
    expect(tx.transmissionAttempt.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ number: 1, durationMs: 30000 }) }));
    expect(tx.transmissionPoint.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: TransmissionStatus.SUCCESS, attemptCount: 1 }) }));
  });

  it("rejeita tentativa falha sem mensagem de erro", async () => {
    const prisma = { transmissionPoint: { findUnique: vi.fn().mockResolvedValue(point) } } as unknown as PrismaService;
    await expect(new TransmissionService(prisma).registerAttempt("p-1", { startedAt: "2026-10-01T10:00:00Z", endedAt: "2026-10-01T10:00:30Z", result: TransmissionAttemptResult.FAILED })).rejects.toBeInstanceOf(BadRequestException);
  });
});
