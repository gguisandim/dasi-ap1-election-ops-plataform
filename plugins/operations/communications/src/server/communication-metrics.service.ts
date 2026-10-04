import { Injectable } from "@nestjs/common";
import {
  CommunicationDeliveryStatus,
  CommunicationPriority,
  CommunicationStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "@eops/database";
import type {
  CommunicationDashboard,
  CommunicationMetrics,
} from "@eops/shared/communications";
import {
  buildMetrics,
  DeliveryCounts,
  emptyCounts,
  outstandingConfirmations,
  rate,
} from "./helpers/communication-metrics";

/** Comunicados que já alcançaram destinatários participam das taxas. */
const DISPATCHED_STATUSES: CommunicationStatus[] = [
  CommunicationStatus.PUBLISHED,
  CommunicationStatus.EXPIRED,
];

const URGENT_PRIORITIES: CommunicationPriority[] = [
  CommunicationPriority.HIGH,
  CommunicationPriority.CRITICAL,
];

type StatusGroup = {
  deliveryStatus: CommunicationDeliveryStatus;
  _count: { _all: number };
};

/**
 * Indicadores de leitura e de painel.
 *
 * Todas as contagens usam `count`/`groupBy` no banco — nenhuma tabela é
 * carregada para contagem em JavaScript.
 */
@Injectable()
export class CommunicationMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Indicadores de um comunicado. */
  async forCommunication(communicationId: string): Promise<CommunicationMetrics> {
    const rows = await this.prisma.communicationRecipient.groupBy({
      by: ["deliveryStatus"],
      where: { communicationId },
      _count: { _all: true },
    });
    return buildMetrics(this.toCounts(rows));
  }

  /**
   * Indicadores de vários comunicados em uma única consulta agregada.
   * Usado pela listagem para não disparar uma consulta por linha.
   */
  async forCommunications(communicationIds: string[]): Promise<Map<string, CommunicationMetrics>> {
    if (communicationIds.length === 0) return new Map();
    const rows = await this.prisma.communicationRecipient.groupBy({
      by: ["communicationId", "deliveryStatus"],
      where: { communicationId: { in: communicationIds } },
      _count: { _all: true },
    });
    const perCommunication = new Map<string, DeliveryCounts>();
    for (const row of rows) {
      const counts = perCommunication.get(row.communicationId) ?? emptyCounts();
      counts[row.deliveryStatus] += row._count._all;
      perCommunication.set(row.communicationId, counts);
    }
    const result = new Map<string, CommunicationMetrics>();
    for (const id of communicationIds) {
      result.set(id, buildMetrics(perCommunication.get(id) ?? emptyCounts()));
    }
    return result;
  }

  /** Indicadores globais do painel de comunicações. */
  async dashboard(electionId?: string): Promise<CommunicationDashboard> {
    const scoped: Prisma.CommunicationWhereInput = electionId ? { electionId } : {};

    const [
      published,
      scheduled,
      drafts,
      urgent,
      critical,
      expired,
      recipientGroups,
      categoryGroups,
    ] = await Promise.all([
      this.prisma.communication.count({
        where: { ...scoped, status: CommunicationStatus.PUBLISHED },
      }),
      this.prisma.communication.count({
        where: { ...scoped, status: CommunicationStatus.SCHEDULED },
      }),
      this.prisma.communication.count({
        where: { ...scoped, status: CommunicationStatus.DRAFT },
      }),
      this.prisma.communication.count({
        where: {
          ...scoped,
          status: CommunicationStatus.PUBLISHED,
          priority: { in: URGENT_PRIORITIES },
        },
      }),
      this.prisma.communication.count({
        where: {
          ...scoped,
          status: CommunicationStatus.PUBLISHED,
          priority: CommunicationPriority.CRITICAL,
        },
      }),
      this.prisma.communication.count({
        where: { ...scoped, status: CommunicationStatus.EXPIRED },
      }),
      this.prisma.communicationRecipient.groupBy({
        by: ["deliveryStatus"],
        where: { communication: { status: { in: DISPATCHED_STATUSES }, ...scoped } },
        _count: { _all: true },
      }),
      this.prisma.communication.groupBy({
        by: ["categoryId"],
        where: { ...scoped, status: { in: DISPATCHED_STATUSES } },
        _count: { _all: true },
        orderBy: { _count: { categoryId: "desc" } },
        take: 5,
      }),
    ]);

    const counts = this.toCounts(recipientGroups);
    const total = counts.PENDING + counts.DELIVERED + counts.VIEWED + counts.CONFIRMED;
    const viewed = counts.VIEWED + counts.CONFIRMED;

    const categoryIds = categoryGroups
      .map((group) => group.categoryId)
      .filter((id): id is string => Boolean(id));
    const categories = categoryIds.length
      ? await this.prisma.communicationCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(categories.map((category) => [category.id, category.name]));

    return {
      published,
      scheduled,
      drafts,
      urgent,
      critical,
      expired,
      pendingConfirmations: outstandingConfirmations(counts),
      readRate: rate(viewed, total),
      confirmationRate: rate(counts.CONFIRMED, total),
      topCategories: categoryGroups.map((group) => ({
        categoryId: group.categoryId,
        name: group.categoryId
          ? nameById.get(group.categoryId) ?? "Categoria removida"
          : "Sem categoria",
        total: group._count._all,
      })),
    };
  }

  private toCounts(rows: StatusGroup[]): DeliveryCounts {
    return rows.reduce((accumulator, row) => {
      accumulator[row.deliveryStatus] += row._count._all;
      return accumulator;
    }, emptyCounts());
  }
}
