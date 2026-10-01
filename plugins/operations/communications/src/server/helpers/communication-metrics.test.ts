import { describe, expect, it } from "vitest";
import {
  addCounts,
  buildMetrics,
  emptyCounts,
  outstandingConfirmations,
  rate,
} from "./communication-metrics";

describe("taxas", () => {
  it("calcula percentual com uma casa decimal", () => {
    expect(rate(1, 3)).toBe(33.3);
    expect(rate(2, 2)).toBe(100);
  });

  it("retorna zero quando não há denominador", () => {
    expect(rate(5, 0)).toBe(0);
  });
});

describe("indicadores de acompanhamento", () => {
  it("soma lido e confirmado na taxa de leitura", () => {
    const metrics = buildMetrics({ PENDING: 5, DELIVERED: 3, VIEWED: 1, CONFIRMED: 1 });
    expect(metrics.total).toBe(10);
    expect(metrics.delivered).toBe(5);
    expect(metrics.viewed).toBe(2);
    expect(metrics.readRate).toBe(20);
    expect(metrics.confirmationRate).toBe(10);
    expect(metrics.pending).toBe(5);
  });

  it("considera entregue tudo que saiu de PENDING", () => {
    const metrics = buildMetrics({ PENDING: 0, DELIVERED: 0, VIEWED: 0, CONFIRMED: 4 });
    expect(metrics.deliveryRate).toBe(100);
    expect(metrics.confirmationRate).toBe(100);
  });

  it("zera as taxas quando não há destinatários", () => {
    const metrics = buildMetrics(emptyCounts());
    expect(metrics).toEqual({
      total: 0,
      delivered: 0,
      viewed: 0,
      confirmed: 0,
      pending: 0,
      deliveryRate: 0,
      readRate: 0,
      confirmationRate: 0,
    });
  });

  it("conta pendências de confirmação como tudo que não confirmou", () => {
    expect(outstandingConfirmations({ PENDING: 2, DELIVERED: 1, VIEWED: 3, CONFIRMED: 9 })).toBe(6);
  });

  it("soma contagens preservando cada estado", () => {
    const total = addCounts(
      { PENDING: 1, DELIVERED: 2, VIEWED: 3, CONFIRMED: 4 },
      { PENDING: 10, DELIVERED: 0, VIEWED: 0, CONFIRMED: 1 },
    );
    expect(total).toEqual({ PENDING: 11, DELIVERED: 2, VIEWED: 3, CONFIRMED: 5 });
  });
});
