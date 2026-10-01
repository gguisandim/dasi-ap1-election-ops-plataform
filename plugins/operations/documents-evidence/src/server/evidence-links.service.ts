import { Injectable, NotFoundException } from "@nestjs/common";
import { EvidenceEventType, EvidenceLinkType } from "@prisma/client";
import { PrismaService } from "../../../../../packages/database/src";
import { describeTarget, dedupeLinks, RESOLVABLE_LINK_TYPES } from "./helpers/evidence-link";
import { EvidenceTimelineService } from "./evidence-timeline.service";
import type { EvidenceActor, ResolvedLink } from "./types";

/**
 * Vínculos entre evidências e registros operacionais.
 *
 * Os alvos são referenciados por **ID opaco**: nenhum plugin é importado. Para os
 * tipos que possuem entidade no banco central a existência é validada e um
 * rótulo legível é derivado; `OTHER` aceita qualquer identificador, servindo de
 * saída para registros ainda sem entidade própria.
 */
@Injectable()
export class EvidenceLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: EvidenceTimelineService,
  ) {}

  /** Valida e descreve um vínculo contra o banco central. */
  async resolve(link: { type: EvidenceLinkType; targetId: string; notes?: string }): Promise<ResolvedLink> {
    const { type, targetId } = link;
    if (!RESOLVABLE_LINK_TYPES.includes(type)) {
      return { type, targetId, targetLabel: "Registro externo", notes: link.notes };
    }

    let label: string | null = null;
    switch (type) {
      case EvidenceLinkType.INCIDENT: {
        const incident = await this.prisma.incident.findUnique({
          where: { id: targetId },
          select: { code: true, title: true },
        });
        label = incident ? describeTarget(type, [incident.code, incident.title]) : null;
        break;
      }
      case EvidenceLinkType.ASSET: {
        const asset = await this.prisma.asset.findUnique({
          where: { id: targetId },
          select: { assetTag: true, name: true },
        });
        label = asset ? describeTarget(type, [asset.assetTag, asset.name]) : null;
        break;
      }
      case EvidenceLinkType.POLLING_PLACE: {
        const place = await this.prisma.pollingPlace.findUnique({
          where: { id: targetId },
          select: { name: true, city: true },
        });
        label = place ? describeTarget(type, [place.name, place.city]) : null;
        break;
      }
      case EvidenceLinkType.ELECTORAL_ZONE: {
        const zone = await this.prisma.electoralZone.findUnique({
          where: { id: targetId },
          select: { number: true, name: true },
        });
        label = zone ? describeTarget(type, [`Zona ${zone.number}`, zone.name]) : null;
        break;
      }
      case EvidenceLinkType.ROUTE: {
        const route = await this.prisma.distributionRoute.findUnique({
          where: { id: targetId },
          select: { code: true, name: true },
        });
        label = route ? describeTarget(type, [route.code, route.name]) : null;
        break;
      }
      case EvidenceLinkType.DELIVERY: {
        const delivery = await this.prisma.delivery.findUnique({
          where: { id: targetId },
          select: { id: true, pollingPlace: { select: { name: true } } },
        });
        label = delivery
          ? describeTarget(type, [delivery.pollingPlace?.name, `Entrega ${delivery.id.slice(-6)}`])
          : null;
        break;
      }
      case EvidenceLinkType.TRANSMISSION: {
        const point = await this.prisma.transmissionPoint.findUnique({
          where: { id: targetId },
          select: { identification: true, pollingPlace: { select: { name: true } } },
        });
        label = point
          ? describeTarget(type, [point.identification, point.pollingPlace?.name])
          : null;
        break;
      }
      case EvidenceLinkType.COMMUNICATION: {
        const communication = await this.prisma.communication.findUnique({
          where: { id: targetId },
          select: { code: true, title: true },
        });
        label = communication
          ? describeTarget(type, [communication.code, communication.title])
          : null;
        break;
      }
      case EvidenceLinkType.FIELD_TEAM: {
        const team = await this.prisma.fieldTeam.findUnique({
          where: { id: targetId },
          select: { code: true, name: true },
        });
        label = team ? describeTarget(type, [team.code, team.name]) : null;
        break;
      }
      default:
        label = null;
    }

    if (!label) {
      throw new NotFoundException(
        `Registro vinculado não encontrado para o tipo ${type} (id ${targetId}).`,
      );
    }
    return { type, targetId, targetLabel: label, notes: link.notes };
  }

  async resolveAll(links: Array<{ type: EvidenceLinkType; targetId: string; notes?: string }>) {
    const unique = dedupeLinks(links);
    const resolved: ResolvedLink[] = [];
    for (const link of unique) resolved.push(await this.resolve(link));
    return resolved;
  }

  list(evidenceId: string) {
    return this.prisma.evidenceLink.findMany({
      where: { evidenceId },
      orderBy: [{ type: "asc" }, { createdAt: "asc" }],
    });
  }

  /**
   * Substitui integralmente os vínculos da evidência.
   * A timeline registra o que entrou e o que saiu.
   */
  async replace(
    evidenceId: string,
    links: Array<{ type: EvidenceLinkType; targetId: string; notes?: string }>,
    actor?: EvidenceActor,
  ) {
    const resolved = await this.resolveAll(links);
    const current = await this.prisma.evidenceLink.findMany({
      where: { evidenceId },
      select: { type: true, targetId: true, targetLabel: true },
    });

    const signature = (link: { type: EvidenceLinkType; targetId: string }) =>
      `${link.type}:${link.targetId}`;
    const nextSignatures = new Set(resolved.map(signature));
    const removed = current.filter((link) => !nextSignatures.has(signature(link)));
    const existingSignatures = new Set(current.map(signature));
    const added = resolved.filter((link) => !existingSignatures.has(signature(link)));

    await this.prisma.$transaction(async (tx) => {
      await tx.evidenceLink.deleteMany({ where: { evidenceId } });
      if (resolved.length > 0) {
        await tx.evidenceLink.createMany({
          data: resolved.map((link) => ({
            evidenceId,
            type: link.type,
            targetId: link.targetId,
            targetLabel: link.targetLabel,
            notes: link.notes,
          })),
          skipDuplicates: true,
        });
      }
      for (const link of added) {
        await tx.evidenceEvent.create({
          data: this.timeline.dataFor(evidenceId, {
            type: EvidenceEventType.LINK_ADDED,
            message: `Vínculo com ${link.targetLabel}.`,
            actorId: actor?.id,
            actorName: actor?.name,
            metadata: { type: link.type, targetId: link.targetId },
          }),
        });
      }
      for (const link of removed) {
        await tx.evidenceEvent.create({
          data: this.timeline.dataFor(evidenceId, {
            type: EvidenceEventType.LINK_REMOVED,
            message: `Vínculo removido: ${link.targetLabel ?? link.targetId}.`,
            actorId: actor?.id,
            actorName: actor?.name,
            metadata: { type: link.type, targetId: link.targetId },
          }),
        });
      }
    });

    return this.list(evidenceId);
  }

  async hasLinks(evidenceId: string): Promise<boolean> {
    return (await this.prisma.evidenceLink.count({ where: { evidenceId } })) > 0;
  }
}
