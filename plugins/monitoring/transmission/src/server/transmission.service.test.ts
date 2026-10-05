import { BadRequestException } from "@nestjs/common";
import { ConnectivityStatus, TransmissionAlertStatus, TransmissionAttemptResult, TransmissionStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import type { EventBus } from "@eops/event-bus";
import { TransmissionService, calculateFailureStreak, deriveDeadlineState } from "./transmission.service";

const point = { id: "p-1", identification: "TX-001", electionId: "e-1", electoralZoneId: "z-1", pollingPlaceId: "l-1", status: TransmissionStatus.QUEUED, connectivity: ConnectivityStatus.ONLINE, attemptCount: 0, operationalDeadline: null, attempts: [], timeline: [], alerts: [], election: {}, electoralZone: {}, pollingPlace: {} };

describe("deriveDeadlineState", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  it("prioriza COMPLETED quando o status é SUCCESS", () => {
    expect(deriveDeadlineState(TransmissionStatus.SUCCESS, new Date("2026-10-05T10:00:00Z"), now)).toBe("COMPLETED");
  });
  it("classifica ON_TRACK, DUE_SOON e OVERDUE a partir do prazo", () => {
    expect(deriveDeadlineState(TransmissionStatus.QUEUED, null, now)).toBe("ON_TRACK");
    expect(deriveDeadlineState(TransmissionStatus.QUEUED, new Date("2026-10-05T11:59:00Z"), now)).toBe("OVERDUE");
    expect(deriveDeadlineState(TransmissionStatus.QUEUED, new Date("2026-10-05T12:30:00Z"), now)).toBe("DUE_SOON");
    expect(deriveDeadlineState(TransmissionStatus.QUEUED, new Date("2026-10-05T14:00:00Z"), now)).toBe("ON_TRACK");
  });
});

describe("calculateFailureStreak", () => {
  it("conta tentativas consecutivas não-SUCCESS a partir da mais recente", () => {
    expect(calculateFailureStreak([{ result: TransmissionAttemptResult.SUCCESS, number: 1 }])).toBe(0);
    expect(calculateFailureStreak([{ result: TransmissionAttemptResult.SUCCESS, number: 1 }, { result: TransmissionAttemptResult.FAILED, number: 2 }, { result: TransmissionAttemptResult.TIMEOUT, number: 3 }])).toBe(2);
    expect(calculateFailureStreak([{ result: TransmissionAttemptResult.FAILED, number: 3 }, { result: TransmissionAttemptResult.FAILED, number: 2 }, { result: TransmissionAttemptResult.SUCCESS, number: 1 }])).toBe(2);
  });
});

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

  it("reconhece alerta gravando ator e data e emitindo evento", async () => {
    const alert = { id: "a-1", pointId: "p-1", type: "POINT_OFFLINE", status: TransmissionAlertStatus.OPEN, message: "Offline", notes: null, acknowledgedAt: null, acknowledgedById: null, resolvedAt: null, resolvedById: null, point: { id: "p-1", identification: "TX-001" } };
    const update = vi.fn().mockResolvedValue({ ...alert, status: TransmissionAlertStatus.ACKNOWLEDGED });
    const emit = vi.fn();
    const prisma = { transmissionAlert: { findUnique: vi.fn().mockResolvedValue(alert), update } } as unknown as PrismaService;
    await new TransmissionService(prisma, { emit } as unknown as EventBus).updateAlert("a-1", { status: TransmissionAlertStatus.ACKNOWLEDGED }, "u-1");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: TransmissionAlertStatus.ACKNOWLEDGED, acknowledgedById: "u-1" }) }));
    expect(emit).toHaveBeenCalledWith("transmission.alert_acknowledged", expect.anything());
  });

  it("rejeita transição regressiva de alerta sem atualizar", async () => {
    const alert = { id: "a-1", pointId: "p-1", type: "POINT_OFFLINE", status: TransmissionAlertStatus.RESOLVED, message: "Offline", notes: null, acknowledgedAt: null, acknowledgedById: null, resolvedAt: new Date(), resolvedById: null, point: { id: "p-1", identification: "TX-001" } };
    const update = vi.fn();
    const prisma = { transmissionAlert: { findUnique: vi.fn().mockResolvedValue(alert), update } } as unknown as PrismaService;
    await expect(new TransmissionService(prisma).updateAlert("a-1", { status: TransmissionAlertStatus.OPEN })).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it("recusa retry de ponto com status não elegível", async () => {
    const transaction = vi.fn();
    const prisma = { transmissionPoint: { findUnique: vi.fn().mockResolvedValue({ ...point, status: TransmissionStatus.SUCCESS }) }, $transaction: transaction } as unknown as PrismaService;
    await expect(new TransmissionService(prisma).retry("p-1", {})).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("retry em lote é atômico: um id inelegível cancela toda a operação", async () => {
    const transaction = vi.fn();
    const prisma = { transmissionPoint: { findMany: vi.fn().mockResolvedValue([{ id: "p-1", status: TransmissionStatus.FAILED }, { id: "p-2", status: TransmissionStatus.SUCCESS }]) }, $transaction: transaction } as unknown as PrismaService;
    await expect(new TransmissionService(prisma).retryBulk({ ids: ["p-1", "p-2"], reason: "Operação" })).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("agrega a visão NOC com taxas e agregados por zona", async () => {
    const points = [
      { id: "p-1", identification: "TX-001", status: TransmissionStatus.SUCCESS, connectivity: ConnectivityStatus.ONLINE, latencyMs: 100, operationalDeadline: null, electoralZoneId: "z-1", pollingPlaceId: "l-1", electoralZone: { id: "z-1", number: 1, name: "Zona 1" }, pollingPlace: { id: "l-1", name: "Local 1" } },
      { id: "p-2", identification: "TX-002", status: TransmissionStatus.FAILED, connectivity: ConnectivityStatus.OFFLINE, latencyMs: 200, operationalDeadline: new Date("2026-10-05T13:00:00Z"), electoralZoneId: "z-1", pollingPlaceId: "l-2", electoralZone: { id: "z-1", number: 1, name: "Zona 1" }, pollingPlace: { id: "l-2", name: "Local 2" } },
      { id: "p-3", identification: "TX-003", status: TransmissionStatus.QUEUED, connectivity: ConnectivityStatus.DEGRADED, latencyMs: null, operationalDeadline: new Date("2026-10-05T12:30:00Z"), electoralZoneId: "z-2", pollingPlaceId: "l-3", electoralZone: { id: "z-2", number: 2, name: "Zona 2" }, pollingPlace: { id: "l-3", name: "Local 3" } },
    ];
    const prisma = { transmissionPoint: { findMany: vi.fn().mockResolvedValue(points) }, transmissionAttempt: { count: vi.fn().mockResolvedValue(5) } } as unknown as PrismaService;
    const noc = await new TransmissionService(prisma).noc({}, new Date("2026-10-05T12:00:00Z"));
    expect(noc.totals).toMatchObject({ total: 3, success: 1, queued: 1, failed: 1, offline: 1 });
    expect(noc.rates).toEqual({ successRate: 33.3, failureRate: 33.3 });
    expect(noc.risk).toEqual({ deadlineRisk: 2, overdue: 0, dueSoon: 2 });
    expect(noc.volume.attemptsToday).toBe(5);
    expect(noc.byZone.find((zone) => zone.zoneId === "z-1")).toMatchObject({ total: 2, success: 1, failed: 1, offline: 1, deadlineRisk: 1, successRate: 50, averageLatencyMs: 150 });
  });
});
