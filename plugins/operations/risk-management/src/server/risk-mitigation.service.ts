import { Injectable } from "@nestjs/common";
import { Prisma, RiskEventType, RiskMitigationStatus } from "@prisma/client";
import { PrismaService } from "@eops/database";
import type { RiskMitigationSummary } from "@eops/shared/risks";
import { isMitigationOverdue } from "./helpers/risk-scoring";
import { RiskTimelineService } from "./risk-timeline.service";
import type { RiskActor } from "./types";

/**
 * Ações de mitigação de um risco.
 *
 * As mitigações são substituídas em bloco: o formulário envia o plano completo e
 * o serviço diferencia o que foi adicionado, atualizado e concluído para registrar
 * cada movimento no histórico.
 */
@Injectable()
export class RiskMitigationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: RiskTimelineService,
  ) {}

  list(riskId: string) {
    return this.prisma.riskMitigation.findMany({
      where: { riskId },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    });
  }

  /** Apresentação com o indicador de atraso calculado, não persistido. */
  present(mitigations: Array<{ dueDate: Date | null; status: string } & Record<string, unknown>>) {
    return mitigations.map(
      (mitigation) =>
        ({
          ...mitigation,
          overdue: isMitigationOverdue({
            dueDate: mitigation.dueDate,
            status: mitigation.status,
          }),
        }) as unknown as RiskMitigationSummary,
    );
  }

  private toData(mitigation: {
    description: string;
    responsibleName: string;
    dueDate?: string;
    status?: RiskMitigationStatus;
    progress?: number;
    evidenceId?: string;
    evidenceLabel?: string;
    notes?: string;
  }) {
    const status = mitigation.status ?? RiskMitigationStatus.PLANNED;
    // Concluída implica 100%; qualquer outro estado preserva o informado.
    const progress = status === RiskMitigationStatus.COMPLETED ? 100 : (mitigation.progress ?? 0);
    return {
      description: mitigation.description,
      responsibleName: mitigation.responsibleName,
      dueDate: mitigation.dueDate ? new Date(mitigation.dueDate) : undefined,
      status,
      progress,
      evidenceId: mitigation.evidenceId,
      evidenceLabel: mitigation.evidenceLabel,
      notes: mitigation.notes,
      completedAt: status === RiskMitigationStatus.COMPLETED ? new Date() : null,
    };
  }

  /**
   * Substitui o plano de mitigação do risco dentro da transação recebida.
   *
   * A assinatura pede o cliente transacional para que risco, mitigações e
   * histórico sejam gravados atomicamente pelo serviço de riscos.
   */
  async replaceWithin(
    tx: Prisma.TransactionClient,
    riskId: string,
    mitigations: Parameters<typeof this.toData>[0][],
    actor: RiskActor,
  ) {
    const previous = await tx.riskMitigation.findMany({ where: { riskId } });
    const previousByDescription = new Map(
      previous.map((mitigation) => [mitigation.description, mitigation]),
    );
    const nextDescriptions = new Set(mitigations.map((mitigation) => mitigation.description));

    await tx.riskMitigation.deleteMany({ where: { riskId } });
    if (mitigations.length > 0) {
      await tx.riskMitigation.createMany({
        data: mitigations.map((mitigation) => ({ ...this.toData(mitigation), riskId })),
      });
    }
    await tx.risk.update({
      where: { id: riskId },
      data: { mitigationCount: mitigations.length },
    });

    const added = mitigations.filter(
      (mitigation) => !previousByDescription.has(mitigation.description),
    );
    const removed = previous.filter((mitigation) => !nextDescriptions.has(mitigation.description));
    const completed = mitigations.filter(
      (mitigation) =>
        mitigation.status === RiskMitigationStatus.COMPLETED &&
        previousByDescription.get(mitigation.description)?.status !==
          RiskMitigationStatus.COMPLETED,
    );

    for (const mitigation of added) {
      await tx.riskEvent.create({
        data: this.timeline.dataFor(riskId, {
          type: RiskEventType.MITIGATION_ADDED,
          message: `Mitigação adicionada: ${mitigation.description}`,
          actorId: actor.id,
          actorName: actor.name,
          metadata: { responsibleName: mitigation.responsibleName },
        }),
      });
    }
    for (const mitigation of removed) {
      await tx.riskEvent.create({
        data: this.timeline.dataFor(riskId, {
          type: RiskEventType.MITIGATION_UPDATED,
          message: `Mitigação removida do plano: ${mitigation.description}`,
          actorId: actor.id,
          actorName: actor.name,
        }),
      });
    }
    for (const mitigation of completed) {
      await tx.riskEvent.create({
        data: this.timeline.dataFor(riskId, {
          type: RiskEventType.MITIGATION_COMPLETED,
          message: `Mitigação concluída: ${mitigation.description}`,
          actorId: actor.id,
          actorName: actor.name,
        }),
      });
    }

    return { added: added.length, removed: removed.length, completed: completed.length };
  }

  /** Contagem de mitigações atrasadas de um conjunto de riscos. */
  async countOverdue(riskIds: string[]) {
    if (riskIds.length === 0) return new Map<string, number>();
    const rows = await this.prisma.riskMitigation.findMany({
      where: {
        riskId: { in: riskIds },
        dueDate: { lt: new Date() },
        status: { notIn: [RiskMitigationStatus.COMPLETED, RiskMitigationStatus.CANCELLED] },
      },
      select: { riskId: true },
    });
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.riskId, (counts.get(row.riskId) ?? 0) + 1);
    return counts;
  }
}
