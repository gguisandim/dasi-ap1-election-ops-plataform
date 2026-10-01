import { CommunicationDeliveryStatus } from "@prisma/client";
import type { CommunicationMetrics } from "@eops/shared/communications";

export type DeliveryCounts = Record<CommunicationDeliveryStatus, number>;

export const EMPTY_DELIVERY_COUNTS: DeliveryCounts = {
  PENDING: 0,
  DELIVERED: 0,
  VIEWED: 0,
  CONFIRMED: 0,
};

/** Arredonda para uma casa decimal, evitando `NaN` quando não há destinatários. */
export function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * Consolidado de acompanhamento de leitura.
 *
 * - `deliveryRate`: percentual que saiu de `PENDING`;
 * - `readRate`: percentual que chegou a `VIEWED` ou `CONFIRMED`;
 * - `confirmationRate`: percentual confirmado.
 */
export function buildMetrics(counts: DeliveryCounts): CommunicationMetrics {
  const total =
    counts.PENDING + counts.DELIVERED + counts.VIEWED + counts.CONFIRMED;
  const viewed = counts.VIEWED + counts.CONFIRMED;
  return {
    total,
    delivered: counts.DELIVERED + viewed,
    viewed,
    confirmed: counts.CONFIRMED,
    pending: counts.PENDING,
    deliveryRate: rate(counts.DELIVERED + viewed, total),
    readRate: rate(viewed, total),
    confirmationRate: rate(counts.CONFIRMED, total),
  };
}

export function addCounts(left: DeliveryCounts, right: DeliveryCounts): DeliveryCounts {
  return {
    PENDING: left.PENDING + right.PENDING,
    DELIVERED: left.DELIVERED + right.DELIVERED,
    VIEWED: left.VIEWED + right.VIEWED,
    CONFIRMED: left.CONFIRMED + right.CONFIRMED,
  };
}

export function emptyCounts(): DeliveryCounts {
  return { ...EMPTY_DELIVERY_COUNTS };
}

/** Quantos destinatários ainda não confirmaram — base do indicador do painel. */
export function outstandingConfirmations(counts: DeliveryCounts): number {
  return counts.PENDING + counts.DELIVERED + counts.VIEWED;
}
