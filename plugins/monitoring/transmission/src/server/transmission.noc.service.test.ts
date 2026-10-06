import { BadRequestException, ConflictException } from "@nestjs/common";
import { ConnectivityStatus, TransmissionFailoverStatus, TransmissionStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import type { EventBus } from "@eops/event-bus";
import { buildIntervals, connectivityDurations, downtimeMinutes, observedMinutes, uptimePercent } from "@eops/shared/transmission";
import { TransmissionService } from "./transmission.service";

const MINUTE = 60_000;
const base = new Date("2026-10-01T00:00:00Z").getTime();
const at = (minutes: number) => new Date(base + minutes * MINUTE);

const point = {
  id: "p-1",
  identification: "TX-001",
  electionId: "e-1",
  electoralZoneId: "z-1",
  pollingPlaceId: "l-1",
  status: TransmissionStatus.QUEUED,
  connectivity: ConnectivityStatus.ONLINE,
};

const window = { from: base, to: base + 60 * MINUTE };

describe("SLA — fórmulas puras (SPEC 3.5)", () => {
  it("calcula uptime, downtime, degradado e observado ponderando pelo tempo observado", () => {
    const intervals = buildIntervals(
      [
        { to: ConnectivityStatus.ONLINE, occurredAt: at(0) },
        { to: ConnectivityStatus.DEGRADED, occurredAt: at(30) },
        { to: ConnectivityStatus.OFFLINE, occurredAt: at(40) },
        { to: ConnectivityStatus.ONLINE, occurredAt: at(60) },
      ],
      at(60),
    );
    const durations = connectivityDurations(intervals, window);
    expect(downtimeMinutes(intervals, window)).toBe(20);
    expect(observedMinutes(intervals, window)).toBe(60);
    expect(uptimePercent(intervals, window)).toBe(50);
    expect(durations.degradedMs / MINUTE).toBe(10);
    expect(durations.unknownMs).toBe(0);
  });

  it("exclui UNKNOWN do uptime e do denominador observado", () => {
    const intervals = buildIntervals(
      [
        { to: ConnectivityStatus.ONLINE, occurredAt: at(0) },
        { to: ConnectivityStatus.UNKNOWN, occurredAt: at(30) },
      ],
      at(60),
    );
    expect(observedMinutes(intervals, window)).toBe(30);
    expect(uptimePercent(intervals, window)).toBe(100);
  });

  it("retorna null quando não há janela observada (sem leitura)", () => {
    const durations = connectivityDurations([], window);
    expect(observedMinutes([], window)).toBe(0);
    expect(durations.unknownMs / MINUTE).toBe(60);
    expect(uptimePercent([], window)).toBeNull();
  });
});

describe("TransmissionService — transições e intervalos", () => {
  it("fecha o intervalo anterior calculando durationSeconds no servidor", async () => {
    const tx = {
      transmissionPoint: { update: vi.fn().mockResolvedValue({}) },
      transmissionTimelineEvent: { create: vi.fn().mockResolvedValue({}) },
      transmissionStateTransition: {
        findFirst: vi.fn().mockResolvedValue({ id: "t-prev", occurredAt: at(0) }),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({ id: "t-new" }),
      },
    };
    const prisma = {
      transmissionPoint: { findUnique: vi.fn().mockResolvedValue(point) },
      transmissionAlert: { updateMany: vi.fn().mockResolvedValue({}) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const emit = vi.fn();
    await new TransmissionService(prisma, { emit } as unknown as EventBus).updateConnectivity("p-1", { connectivity: ConnectivityStatus.DEGRADED, checkedAt: at(30).toISOString(), reason: "Queda parcial" }, "u-1");
    expect(tx.transmissionStateTransition.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ pointId: "p-1", circuitId: null }) }));
    expect(tx.transmissionStateTransition.update).toHaveBeenCalledWith({ where: { id: "t-prev" }, data: { durationSeconds: 1800 } });
    expect(tx.transmissionStateTransition.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ from: ConnectivityStatus.ONLINE, to: ConnectivityStatus.DEGRADED, reason: "Queda parcial" }) }));
    expect(emit).toHaveBeenCalledWith("transmission.state_transition", expect.objectContaining({ reason: "Queda parcial", from: ConnectivityStatus.ONLINE, to: ConnectivityStatus.DEGRADED }));
  });

  it("rejeita mudança de status de circuito sem transição (from = to)", async () => {
    const circuit = { id: "c-1", pointId: "p-1", code: "C1", status: ConnectivityStatus.ONLINE, isPrimary: true, point: { id: "p-1", identification: "TX-001", connectivity: ConnectivityStatus.ONLINE } };
    const prisma = { transmissionCircuit: { findUnique: vi.fn().mockResolvedValue(circuit) } } as unknown as PrismaService;
    await expect(new TransmissionService(prisma).updateCircuit("c-1", { status: ConnectivityStatus.ONLINE }, "u-1")).rejects.toBeInstanceOf(ConflictException);
  });

  it("calcula o SLA do ponto a partir das transições persistidas", async () => {
    const transitions = [
      { to: ConnectivityStatus.ONLINE, occurredAt: at(0) },
      { to: ConnectivityStatus.OFFLINE, occurredAt: at(30) },
      { to: ConnectivityStatus.ONLINE, occurredAt: at(40) },
    ];
    const prisma = {
      transmissionPoint: { findUnique: vi.fn().mockResolvedValue(point) },
      transmissionStateTransition: { findMany: vi.fn().mockResolvedValue(transitions) },
    } as unknown as PrismaService;
    const sla = await new TransmissionService(prisma).pointSla("p-1", { from: at(0).toISOString(), to: at(60).toISOString() });
    expect(sla.uptimePercent).toBe(83.3);
    expect(sla.offlineMinutes).toBe(10);
    expect(sla.observedMinutes).toBe(60);
    expect(sla.transitions).toBe(3);
  });
});

describe("TransmissionService — circuitos e failover", () => {
  it("impede dois circuitos primários ativos no mesmo ponto", async () => {
    const create = vi.fn();
    const prisma = {
      transmissionPoint: { findUnique: vi.fn().mockResolvedValue(point) },
      transmissionCircuit: { findFirst: vi.fn().mockResolvedValue({ id: "c-1", code: "C1" }), create },
    } as unknown as PrismaService;
    await expect(new TransmissionService(prisma).createCircuit("p-1", { code: "c2", name: "Link 2", status: ConnectivityStatus.ONLINE, isPrimary: true }, "u-1")).rejects.toBeInstanceOf(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejeita failover para circuito de outro ponto", async () => {
    const prisma = {
      transmissionPoint: { findUnique: vi.fn().mockResolvedValue(point) },
      transmissionCircuit: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    await expect(new TransmissionService(prisma).startFailover("p-1", { toCircuitId: "c-x", reason: "Perda de link" }, "u-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejeita failover para circuito de destino inativo", async () => {
    const prisma = {
      transmissionPoint: { findUnique: vi.fn().mockResolvedValue(point) },
      transmissionCircuit: { findUnique: vi.fn().mockResolvedValue({ id: "c-dest", pointId: "p-1", code: "C2", status: ConnectivityStatus.OFFLINE }) },
    } as unknown as PrismaService;
    await expect(new TransmissionService(prisma).startFailover("p-1", { toCircuitId: "c-dest", reason: "Perda de link" }, "u-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("impede dois failovers ACTIVE no mesmo ponto", async () => {
    const prisma = {
      transmissionPoint: { findUnique: vi.fn().mockResolvedValue(point) },
      transmissionCircuit: {
        findUnique: vi.fn().mockResolvedValue({ id: "c-dest", pointId: "p-1", code: "C2", status: ConnectivityStatus.ONLINE }),
        findFirst: vi.fn().mockResolvedValue({ id: "c-pri", pointId: "p-1", status: ConnectivityStatus.ONLINE }),
      },
      transmissionFailover: { findFirst: vi.fn().mockResolvedValue({ id: "f-active" }) },
    } as unknown as PrismaService;
    await expect(new TransmissionService(prisma).startFailover("p-1", { toCircuitId: "c-dest", reason: "Perda de link" }, "u-1")).rejects.toBeInstanceOf(ConflictException);
  });

  it("só recupera failover no estado ACTIVE", async () => {
    const prisma = {
      transmissionFailover: { findUnique: vi.fn().mockResolvedValue({ id: "f-1", pointId: "p-1", status: TransmissionFailoverStatus.RECOVERED, notes: null, fromCircuit: { id: "c-pri", status: ConnectivityStatus.ONLINE }, toCircuit: { id: "c-dest", status: ConnectivityStatus.ONLINE } }) },
    } as unknown as PrismaService;
    await expect(new TransmissionService(prisma).recoverFailover("p-1", "f-1", {}, "u-1")).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("TransmissionService — correlação com RBAC (SPEC 3.6)", () => {
  const correlationPoint = { id: "p-1", identification: "TX-001", electionId: "e-1", electoralZoneId: "z-1", pollingPlaceId: "l-1", electoralZone: { id: "z-1", number: 1, name: "Zona 1" }, pollingPlace: { id: "l-1", name: "Local 1" } };

  function prisma() {
    return {
      transmissionPoint: { findUnique: vi.fn().mockResolvedValue(correlationPoint) },
      incident: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
      resourceRequest: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
      postmortem: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
      shiftHandover: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;
  }

  it("oculta seções e não expõe contagem quando falta a permissão do domínio", async () => {
    const result = await new TransmissionService(prisma()).correlation({ pointId: "p-1" }, ["transmission.read"]);
    expect(result.incidents).toEqual({ available: false });
    expect(result.resourceRequests).toEqual({ available: false });
    expect(result.postmortems).toEqual({ available: false });
    expect(result.handovers).toEqual({ available: false });
    expect(result.attentionItems).toEqual({ available: false });
    expect(result.incidents).not.toHaveProperty("total");
  });

  it("expõe a seção quando o ator possui a permissão de leitura do domínio", async () => {
    const result = await new TransmissionService(prisma()).correlation({ pointId: "p-1" }, ["transmission.read", "incidents.read", "command-center.read"]);
    expect(result.incidents).toEqual({ available: true, total: 0, items: [] });
    expect(result.resourceRequests).toEqual({ available: false });
    expect(result.attentionItems).toMatchObject({ available: true, route: "/command-center" });
  });
});
