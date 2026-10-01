import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CommunicationAudienceType,
  CommunicationDeliveryStatus,
  CommunicationEventType,
  CommunicationStatus,
  FieldAllocationStatus,
  FieldTeamStatus,
  Prisma,
  UserStatus,
} from "@prisma/client";
import { EventBus } from "../../../../../packages/event-bus/src";
import { PrismaService } from "../../../../../packages/database/src";
import { CommunicationEventSummary, CommunicationRecipientSummary } from "@eops/shared/communications";
import { CommunicationRecipientQueryDto } from "./dto/communication.dto";
import { describeAudience, recipientDedupeKey } from "./helpers/audience";
import { isReadableStatus } from "./helpers/communication-status";
import { CommunicationTimelineService } from "./communication-timeline.service";
import type { CommunicationActor, RecipientCandidate } from "./types";

/** Alocações que representam vínculo operacional vigente. */
const ACTIVE_ALLOCATION_STATUSES: FieldAllocationStatus[] = [
  FieldAllocationStatus.SCHEDULED,
  FieldAllocationStatus.ACTIVE,
];

/** Status em que o comunicado já foi distribuído e aceita leitura/confirmação. */
const READABLE_STATUSES: CommunicationStatus[] = [
  CommunicationStatus.PUBLISHED,
  CommunicationStatus.EXPIRED,
];

const recipientInclude = {
  communication: {
    select: {
      id: true,
      code: true,
      title: true,
      priority: true,
      status: true,
      publishedAt: true,
      expiresAt: true,
    },
  },
} satisfies Prisma.CommunicationRecipientInclude;

/**
 * Resolução, materialização e acompanhamento de leitura dos destinatários.
 *
 * A resolução é determinística e explicável — não há IA nem heurística opaca:
 * cada regra de direcionamento mapeia para uma consulta fixa ao banco central.
 */
@Injectable()
export class CommunicationRecipientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: CommunicationTimelineService,
    private readonly eventBus?: EventBus,
  ) {}

  /**
   * Converte as regras de direcionamento de um comunicado na lista de pessoas
   * que devem recebê-lo.
   *
   * Regras (documentadas na spec do plugin):
   * - `ALL` → usuários ativos + membros de equipes ativas;
   * - `USER` → o usuário indicado;
   * - `FIELD_TEAM` → membros da equipe;
   * - `OPERATIONAL_ROLE` → membros cuja função operacional é a indicada;
   * - `ELECTORAL_ZONE` → membros com escala ou alocação vigente na zona;
   * - `POLLING_PLACE` → membros com escala ou alocação vigente no local.
   */
  async resolve(communicationId: string): Promise<RecipientCandidate[]> {
    const audiences = await this.prisma.communicationAudience.findMany({
      where: { communicationId },
      include: {
        electoralZone: { select: { number: true, name: true } },
        pollingPlace: { select: { name: true, city: true } },
        fieldTeam: { select: { name: true } },
        fieldRole: { select: { name: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const candidates: RecipientCandidate[] = [];
    for (const audience of audiences) {
      const sourceLabel = describeAudience(audience, {
        electoralZone: audience.electoralZone
          ? `${audience.electoralZone.number} · ${audience.electoralZone.name}`
          : null,
        pollingPlace: audience.pollingPlace
          ? `${audience.pollingPlace.name} (${audience.pollingPlace.city})`
          : null,
        fieldTeam: audience.fieldTeam?.name ?? null,
        fieldRole: audience.fieldRole?.name ?? null,
        user: audience.user?.name ?? null,
      });
      candidates.push(
        ...(await this.candidatesFor(audience.type, audience, sourceLabel)),
      );
    }
    return this.dedupe(candidates);
  }

  private dedupe(candidates: RecipientCandidate[]): RecipientCandidate[] {
    const seen = new Map<string, RecipientCandidate>();
    for (const candidate of candidates) {
      if (!seen.has(candidate.dedupeKey)) seen.set(candidate.dedupeKey, candidate);
    }
    return [...seen.values()];
  }

  private async candidatesFor(
    type: CommunicationAudienceType,
    audience: {
      id: string;
      electoralZoneId: string | null;
      pollingPlaceId: string | null;
      fieldTeamId: string | null;
      fieldRoleId: string | null;
      userId: string | null;
    },
    sourceLabel: string,
  ): Promise<RecipientCandidate[]> {
    switch (type) {
      case CommunicationAudienceType.ALL:
        return [
          ...(await this.platformUserCandidates({ status: UserStatus.ACTIVE })),
          ...(await this.memberCandidates(
            { team: { status: FieldTeamStatus.ACTIVE } },
            audience.id,
            sourceLabel,
          )),
        ];
      case CommunicationAudienceType.USER: {
        if (!audience.userId) return [];
        const user = await this.prisma.user.findUnique({
          where: { id: audience.userId },
          select: { id: true, name: true, email: true, roles: { select: { role: { select: { name: true } } } } },
        });
        if (!user) return [];
        return [
          {
            dedupeKey: recipientDedupeKey({ userId: user.id, name: user.name }),
            userId: user.id,
            name: user.name,
            email: user.email,
            roleLabel: user.roles.map((item) => item.role.name).join(", ") || undefined,
            sourceLabel,
            audienceId: audience.id,
          },
        ];
      }
      case CommunicationAudienceType.FIELD_TEAM:
        if (!audience.fieldTeamId) return [];
        return this.memberCandidates(
          { teamId: audience.fieldTeamId },
          audience.id,
          sourceLabel,
        );
      case CommunicationAudienceType.OPERATIONAL_ROLE:
        if (!audience.fieldRoleId) return [];
        return this.memberCandidates(
          { roleId: audience.fieldRoleId },
          audience.id,
          sourceLabel,
        );
      case CommunicationAudienceType.ELECTORAL_ZONE:
        if (!audience.electoralZoneId) return [];
        return this.memberCandidates(
          { OR: await this.memberLinksIn({ electoralZoneId: audience.electoralZoneId }) },
          audience.id,
          sourceLabel,
        );
      case CommunicationAudienceType.POLLING_PLACE:
        if (!audience.pollingPlaceId) return [];
        return this.memberCandidates(
          { OR: await this.memberLinksIn({ pollingPlaceId: audience.pollingPlaceId }) },
          audience.id,
          sourceLabel,
        );
      default:
        return [];
    }
  }

  private async platformUserCandidates(
    where: Prisma.UserWhereInput,
  ): Promise<RecipientCandidate[]> {
    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        roles: { select: { role: { select: { name: true } } } },
      },
      orderBy: { name: "asc" },
    });
    return users.map((user) => ({
      dedupeKey: recipientDedupeKey({ userId: user.id, name: user.name }),
      userId: user.id,
      name: user.name,
      email: user.email,
      roleLabel: user.roles.map((item) => item.role.name).join(", ") || undefined,
      sourceLabel: "Todos os usuários ativos",
    }));
  }

  /**
   * Vínculos que tornam um membro de campo elegível por zona/local:
   * escala registrada ou alocação não encerrada.
   */
  private async memberLinksIn(target: {
    electoralZoneId?: string;
    pollingPlaceId?: string;
  }): Promise<Prisma.FieldMemberWhereInput[]> {
    const [shifts, allocations] = await Promise.all([
      this.prisma.fieldShift.findMany({
        where: target,
        select: { memberId: true },
        distinct: ["memberId"],
      }),
      this.prisma.fieldAllocation.findMany({
        where: { ...target, status: { in: ACTIVE_ALLOCATION_STATUSES } },
        select: { memberId: true },
        distinct: ["memberId"],
      }),
    ]);
    const memberIds = [
      ...new Set(
        [...shifts, ...allocations]
          .map((row) => row.memberId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    return memberIds.length ? [{ id: { in: memberIds } }] : [{ id: { in: [] } }];
  }

  private async memberCandidates(
    where: Prisma.FieldMemberWhereInput,
    audienceId: string,
    sourceLabel: string,
  ): Promise<RecipientCandidate[]> {
    const members = await this.prisma.fieldMember.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { name: true } },
        team: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });
    return members.map((member) => ({
      dedupeKey: recipientDedupeKey({ memberId: member.id, name: member.name }),
      memberId: member.id,
      name: member.name,
      email: member.email ?? undefined,
      roleLabel: member.role.name,
      sourceLabel: `${sourceLabel} · ${member.team.name}`,
      audienceId,
    }));
  }

  /**
   * Materializa os destinatários do comunicado.
   *
   * Destinatários que já saíram de `PENDING` são preservados mesmo quando a
   * regra de direcionamento deixa de alcançá-los: o histórico de leitura é
   * auditável e não deve desaparecer.
   */
  async sync(communicationId: string, actor?: CommunicationActor) {
    const communication = await this.prisma.communication.findUnique({
      where: { id: communicationId },
      select: { id: true },
    });
    if (!communication) throw new NotFoundException("Comunicado não encontrado.");

    const candidates = await this.resolve(communicationId);
    const keys = candidates.map((candidate) => candidate.dedupeKey);

    const result = await this.prisma.$transaction(async (tx) => {
      let created = 0;
      for (const candidate of candidates) {
        const existing = await tx.communicationRecipient.findUnique({
          where: {
            communicationId_dedupeKey: {
              communicationId,
              dedupeKey: candidate.dedupeKey,
            },
          },
          select: { id: true },
        });
        if (existing) {
          await tx.communicationRecipient.update({
            where: { id: existing.id },
            data: {
              name: candidate.name,
              email: candidate.email,
              roleLabel: candidate.roleLabel,
              sourceLabel: candidate.sourceLabel,
            },
          });
          continue;
        }
        await tx.communicationRecipient.create({
          data: {
            communicationId,
            audienceId: candidate.audienceId,
            userId: candidate.userId,
            memberId: candidate.memberId,
            name: candidate.name,
            email: candidate.email,
            roleLabel: candidate.roleLabel,
            sourceLabel: candidate.sourceLabel,
            dedupeKey: candidate.dedupeKey,
          },
        });
        created += 1;
      }

      const removed = keys.length
        ? await tx.communicationRecipient.deleteMany({
            where: {
              communicationId,
              deliveryStatus: CommunicationDeliveryStatus.PENDING,
              dedupeKey: { notIn: keys },
            },
          })
        : await tx.communicationRecipient.deleteMany({
            where: {
              communicationId,
              deliveryStatus: CommunicationDeliveryStatus.PENDING,
            },
          });

      await tx.communication.update({
        where: { id: communicationId },
        data: { recipientCount: candidates.length },
      });

      return { created, removed: removed.count, total: candidates.length };
    });

    await this.timeline.record(communicationId, {
      type: CommunicationEventType.RECIPIENTS_SYNCED,
      message: `Destinatários recalculados: ${result.total} pessoa(s) alcançada(s).`,
      actorId: actor?.id,
      actorName: actor?.name,
      metadata: { created: result.created, removed: result.removed },
    });

    return result;
  }

  /**
   * Marca como entregues todos os destinatários ainda pendentes.
   * Executado na publicação: publicar significa depositar na caixa de cada um.
   */
  async dispatch(communicationId: string) {
    const now = new Date();
    const delivered = await this.prisma.communicationRecipient.updateMany({
      where: {
        communicationId,
        deliveryStatus: CommunicationDeliveryStatus.PENDING,
      },
      data: {
        deliveryStatus: CommunicationDeliveryStatus.DELIVERED,
        deliveredAt: now,
      },
    });
    await this.prisma.communication.update({
      where: { id: communicationId },
      data: { dispatchedAt: now },
    });
    return delivered.count;
  }

  async list(communicationId: string, query: CommunicationRecipientQueryDto) {
    const where: Prisma.CommunicationRecipientWhereInput = {
      communicationId,
      deliveryStatus: query.deliveryStatus,
      audienceId: query.audienceId,
      OR: query.search
        ? [
            { name: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } },
            { roleLabel: { contains: query.search, mode: "insensitive" } },
            { sourceLabel: { contains: query.search, mode: "insensitive" } },
          ]
        : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.communicationRecipient.findMany({
        where,
        orderBy: [{ deliveryStatus: "asc" }, { name: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.communicationRecipient.count({ where }),
    ]);
    return {
      items: items as unknown as CommunicationRecipientSummary[],
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  private async requireRecipient(communicationId: string, recipientId: string) {
    const recipient = await this.prisma.communicationRecipient.findUnique({
      where: { id: recipientId },
      include: {
        communication: {
          select: { id: true, code: true, title: true, status: true, priority: true },
        },
      },
    });
    if (!recipient || recipient.communicationId !== communicationId) {
      throw new NotFoundException("Destinatário não encontrado neste comunicado.");
    }
    if (!isReadableStatus(recipient.communication.status)) {
      throw new BadRequestException(
        "Só é possível registrar leitura de comunicados publicados.",
      );
    }
    return recipient;
  }

  async markRead(communicationId: string, recipientId: string, actor?: CommunicationActor) {
    const recipient = await this.requireRecipient(communicationId, recipientId);
    const now = new Date();
    // Confirmar é o estado mais forte: uma leitura posterior não o rebaixa.
    const nextStatus =
      recipient.deliveryStatus === CommunicationDeliveryStatus.CONFIRMED
        ? CommunicationDeliveryStatus.CONFIRMED
        : CommunicationDeliveryStatus.VIEWED;

    const firstRead = recipient.viewedAt === null;
    const updated = await this.prisma.communicationRecipient.update({
      where: { id: recipient.id },
      data: {
        deliveryStatus: nextStatus,
        deliveredAt: recipient.deliveredAt ?? now,
        viewedAt: recipient.viewedAt ?? now,
      },
    });

    if (firstRead) {
      await this.timeline.record(communicationId, {
        type: CommunicationEventType.VIEWED,
        message: `${recipient.name} leu o comunicado.`,
        actorId: actor?.id ?? recipient.userId ?? undefined,
        actorName: actor?.name ?? recipient.name,
        metadata: { recipientId: recipient.id },
      });
      await this.eventBus?.emit("communication.read", {
        entityId: communicationId,
        actorId: actor?.id ?? recipient.userId ?? undefined,
        communicationId,
        recipientId: recipient.id,
        recipientName: recipient.name,
        code: recipient.communication.code,
      });
    }
    return updated;
  }

  async confirm(
    communicationId: string,
    recipientId: string,
    note?: string,
    actor?: CommunicationActor,
  ) {
    const recipient = await this.requireRecipient(communicationId, recipientId);
    const now = new Date();
    const firstConfirmation = recipient.confirmedAt === null;
    const updated = await this.prisma.communicationRecipient.update({
      where: { id: recipient.id },
      data: {
        deliveryStatus: CommunicationDeliveryStatus.CONFIRMED,
        deliveredAt: recipient.deliveredAt ?? now,
        viewedAt: recipient.viewedAt ?? now,
        confirmedAt: recipient.confirmedAt ?? now,
        confirmationNote: note ?? recipient.confirmationNote,
      },
    });

    if (firstConfirmation) {
      await this.timeline.record(communicationId, {
        type: CommunicationEventType.CONFIRMED,
        message: `${recipient.name} confirmou a leitura.`,
        actorId: actor?.id ?? recipient.userId ?? undefined,
        actorName: actor?.name ?? recipient.name,
        metadata: { recipientId: recipient.id, note },
      });
      await this.eventBus?.emit("communication.acknowledged", {
        entityId: communicationId,
        actorId: actor?.id ?? recipient.userId ?? undefined,
        communicationId,
        recipientId: recipient.id,
        recipientName: recipient.name,
        code: recipient.communication.code,
        title: recipient.communication.title,
      });
    }
    return updated;
  }

  /**
   * Comunicados publicados dirigidos ao usuário autenticado que ainda não foram
   * confirmados — alimenta a caixa de entrada e o indicador de pendências.
   */
  async pendingForUser(userId: string, limit = 50) {
    const rows = await this.prisma.communicationRecipient.findMany({
      where: {
        userId,
        deliveryStatus: { not: CommunicationDeliveryStatus.CONFIRMED },
        communication: { status: { in: READABLE_STATUSES } },
      },
      include: recipientInclude,
      orderBy: [{ communication: { publishedAt: "desc" } }],
      take: limit,
    });
    return rows as unknown as CommunicationRecipientSummary[];
  }

  /** Histórico de leitura do usuário autenticado, incluindo os já confirmados. */
  async inboxForUser(userId: string, limit = 50) {
    const rows = await this.prisma.communicationRecipient.findMany({
      where: { userId, communication: { status: { in: READABLE_STATUSES } } },
      include: recipientInclude,
      orderBy: [{ confirmedAt: "asc" }, { communication: { publishedAt: "desc" } }],
      take: limit,
    });
    return rows as unknown as CommunicationRecipientSummary[];
  }

  /** Verifica se o usuário autenticado é destinatário do comunicado. */
  async findForUser(communicationId: string, userId: string) {
    return this.prisma.communicationRecipient.findFirst({
      where: { communicationId, userId },
    });
  }

  async listTimeline(communicationId: string): Promise<CommunicationEventSummary[]> {
    const events = await this.timeline.list(communicationId);
    return events as unknown as CommunicationEventSummary[];
  }
}
