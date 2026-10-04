import { Injectable } from "@nestjs/common";
import { EvidenceEventType, Prisma } from "@prisma/client";
import { PrismaService } from "@eops/database";

export interface TimelineEntry {
  type: EvidenceEventType;
  message: string;
  actorId?: string;
  actorName?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Construtor da timeline de uma evidência.
 *
 * Concentra o formato de `EvidenceEvent` para que os demais serviços não
 * precisem conhecê-lo. `dataFor` existe para uso dentro de `$transaction`,
 * preservando a atomicidade com o efeito principal.
 */
@Injectable()
export class EvidenceTimelineService {
  constructor(private readonly prisma: PrismaService) {}

  record(evidenceId: string, entry: TimelineEntry) {
    return this.prisma.evidenceEvent.create({ data: this.dataFor(evidenceId, entry) });
  }

  dataFor(evidenceId: string, entry: TimelineEntry) {
    return {
      evidenceId,
      type: entry.type,
      message: entry.message,
      actorId: entry.actorId,
      actorName: entry.actorName,
      metadata: entry.metadata,
    };
  }

  list(evidenceId: string, limit = 100) {
    return this.prisma.evidenceEvent.findMany({
      where: { evidenceId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
