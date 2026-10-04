import { Injectable } from "@nestjs/common";
import { CommunicationEventType, Prisma } from "@prisma/client";
import { PrismaService } from "@eops/database";

export interface TimelineEntry {
  type: CommunicationEventType;
  message: string;
  actorId?: string;
  actorName?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Construtor da timeline de um comunicado.
 *
 * Concentra a gravação de eventos para que os demais serviços não precisem
 * conhecer o formato de `CommunicationEvent`.
 */
@Injectable()
export class CommunicationTimelineService {
  constructor(private readonly prisma: PrismaService) {}

  /** Registra um evento fora de transação existente. */
  record(communicationId: string, entry: TimelineEntry) {
    return this.prisma.communicationEvent.create({
      data: this.toData(communicationId, entry),
    });
  }

  /**
   * Versão para uso dentro de `$transaction`: o serviço de origem passa o
   * cliente transacional para preservar atomicidade com o efeito principal.
   */
  dataFor(communicationId: string, entry: TimelineEntry) {
    return this.toData(communicationId, entry);
  }

  async list(communicationId: string, limit = 100) {
    return this.prisma.communicationEvent.findMany({
      where: { communicationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async count(communicationId: string) {
    return this.prisma.communicationEvent.count({ where: { communicationId } });
  }

  /**
   * Últimos eventos de vários comunicados, usados pelos cartões do painel sem
   * disparar uma consulta por comunicado.
   */
  async latestFor(communicationIds: string[], limitPerCommunication = 1) {
    if (communicationIds.length === 0) return new Map<string, Awaited<ReturnType<typeof this.list>>>();
    const events = await this.prisma.communicationEvent.findMany({
      where: { communicationId: { in: communicationIds } },
      orderBy: { createdAt: "desc" },
    });
    const grouped = new Map<string, typeof events>();
    for (const event of events) {
      const bucket = grouped.get(event.communicationId) ?? [];
      if (bucket.length >= limitPerCommunication) continue;
      bucket.push(event);
      grouped.set(event.communicationId, bucket);
    }
    return grouped;
  }

  private toData(communicationId: string, entry: TimelineEntry) {
    return {
      communicationId,
      type: entry.type,
      message: entry.message,
      actorId: entry.actorId,
      actorName: entry.actorName,
      metadata: entry.metadata,
    };
  }
}
