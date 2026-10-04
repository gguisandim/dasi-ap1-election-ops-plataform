import { Injectable } from "@nestjs/common";
import { Prisma, RiskEventType } from "@prisma/client";
import { PrismaService } from "@eops/database";

export interface RiskTimelineEntry {
  type: RiskEventType;
  message: string;
  actorId?: string;
  actorName?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Histórico do risco.
 *
 * Registra criação, alteração de score, troca de proprietário, mitigação,
 * materialização e encerramento — é o que permite reconstruir por que um risco
 * mudou de patamar.
 */
@Injectable()
export class RiskTimelineService {
  constructor(private readonly prisma: PrismaService) {}

  record(riskId: string, entry: RiskTimelineEntry) {
    return this.prisma.riskEvent.create({ data: this.dataFor(riskId, entry) });
  }

  dataFor(riskId: string, entry: RiskTimelineEntry) {
    return {
      riskId,
      type: entry.type,
      message: entry.message,
      actorId: entry.actorId,
      actorName: entry.actorName,
      metadata: entry.metadata,
    };
  }

  list(riskId: string, limit = 100) {
    return this.prisma.riskEvent.findMany({
      where: { riskId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
