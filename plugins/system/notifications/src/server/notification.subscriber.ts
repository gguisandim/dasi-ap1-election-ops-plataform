import { Injectable, OnModuleInit } from "@nestjs/common";
import { NotificationType, UserStatus } from "@prisma/client";
import { EventBus, type DomainEvent, type DomainEventName } from "../../../../../packages/event-bus/src";
import { PrismaService } from "../../../../../packages/database/src";

const names = ["incident.created", "incident.assigned", "incident.resolved", "asset.created", "asset.moved", "asset.status_changed", "user.created", "election.created", "route.created", "route.started", "route.completed", "delivery.completed", "delivery.failed", "transmission.completed", "transmission.failed", "transmission.connectivity_changed", "transmission.alert_created", "field_team.allocated", "field_member.checked_in", "field_member.checked_out", "communication.published", "communication.cancelled", "communication.expired"] as const satisfies readonly DomainEventName[];
type SubscribedEventName = (typeof names)[number];
function content(event: DomainEvent<SubscribedEventName>): { title: string; message: string; type: NotificationType; entityType: string } {
  const payload = event.payload;
  switch (event.name) {
    case "incident.created": return { title: "Novo incidente", message: `${"code" in payload ? payload.code : "Incidente"}: ${"title" in payload ? payload.title : "criado"}.`, type: "severity" in payload && payload.severity === "CRITICAL" ? NotificationType.CRITICAL : NotificationType.WARNING, entityType: "Incident" };
    case "incident.assigned": return { title: "Incidente atribuído", message: `${"code" in payload ? payload.code : "Incidente"} atribuído a ${"assignedToName" in payload ? payload.assignedToName : "responsável"}.`, type: NotificationType.INFO, entityType: "Incident" };
    case "incident.resolved": return { title: "Incidente resolvido", message: `${"code" in payload ? payload.code : "Incidente"} foi resolvido.`, type: NotificationType.SUCCESS, entityType: "Incident" };
    case "asset.moved": return { title: "Ativo movimentado", message: `${"assetTag" in payload ? payload.assetTag : "Ativo"}: ${"origin" in payload ? payload.origin : "origem"} → ${"destination" in payload ? payload.destination : "destino"}.`, type: NotificationType.INFO, entityType: "Asset" };
    case "asset.status_changed": return { title: "Status de ativo alterado", message: `${"assetTag" in payload ? payload.assetTag : "Ativo"} alterado para ${"to" in payload ? payload.to : "novo status"}.`, type: NotificationType.WARNING, entityType: "Asset" };
    case "asset.created": return { title: "Ativo cadastrado", message: `${"assetTag" in payload ? payload.assetTag : "Ativo"} foi cadastrado.`, type: NotificationType.INFO, entityType: "Asset" };
    case "user.created": return { title: "Usuário criado", message: `${"name" in payload ? payload.name : "Usuário"} foi cadastrado.`, type: NotificationType.INFO, entityType: "User" };
    case "election.created": return { title: "Pleito criado", message: `${"name" in payload ? payload.name : "Pleito"} foi cadastrado.`, type: NotificationType.INFO, entityType: "Election" };
    case "route.created": return { title: "Rota criada", message: `${"code" in payload ? payload.code : "Rota"} foi cadastrada.`, type: NotificationType.INFO, entityType: "DistributionRoute" };
    case "route.started": return { title: "Rota iniciada", message: `${"code" in payload ? payload.code : "Rota"} iniciou a distribuição.`, type: NotificationType.INFO, entityType: "DistributionRoute" };
    case "route.completed": return { title: "Rota concluída", message: `${"code" in payload ? payload.code : "Rota"} chegou ao destino.`, type: NotificationType.SUCCESS, entityType: "DistributionRoute" };
    case "delivery.completed": return { title: "Entrega concluída", message: "Uma entrega de materiais foi recebida.", type: NotificationType.SUCCESS, entityType: "Delivery" };
    case "delivery.failed": return { title: "Falha de entrega", message: `Falha registrada: ${"reason" in payload ? payload.reason : "motivo não informado"}.`, type: NotificationType.WARNING, entityType: "Delivery" };
    case "transmission.completed": return { title: "Transmissão concluída", message: `${"identification" in payload ? payload.identification : "Ponto"} concluiu a transmissão.`, type: NotificationType.SUCCESS, entityType: "TransmissionPoint" };
    case "transmission.failed": return { title: "Falha de transmissão", message: `${"identification" in payload ? payload.identification : "Ponto"}: ${"error" in payload ? payload.error : "falha operacional"}.`, type: NotificationType.CRITICAL, entityType: "TransmissionPoint" };
    case "transmission.connectivity_changed": return { title: "Conectividade alterada", message: `${"identification" in payload ? payload.identification : "Ponto"} mudou para ${"to" in payload ? payload.to : "novo estado"}.`, type: NotificationType.WARNING, entityType: "TransmissionPoint" };
    case "transmission.alert_created": return { title: "Alerta de transmissão", message: "message" in payload ? payload.message : "Novo alerta operacional.", type: NotificationType.WARNING, entityType: "TransmissionAlert" };
    case "field_team.allocated": return { title: "Equipe alocada", message: "Nova alocação de campo registrada.", type: NotificationType.INFO, entityType: "FieldAllocation" };
    case "field_member.checked_in": return { title: "Check-in de campo", message: `${"memberName" in payload ? payload.memberName : "Operador"} iniciou o serviço.`, type: NotificationType.SUCCESS, entityType: "FieldMember" };
    case "field_member.checked_out": return { title: "Check-out de campo", message: `${"memberName" in payload ? payload.memberName : "Operador"} encerrou o serviço.`, type: NotificationType.INFO, entityType: "FieldMember" };
    case "communication.published": return { title: "Novo comunicado operacional", message: `${"code" in payload ? payload.code : "Comunicado"}: ${"title" in payload ? payload.title : "publicado"} (${"recipientCount" in payload ? payload.recipientCount : 0} destinatário(s)).`, type: "priority" in payload && (payload.priority === "CRITICAL" || payload.priority === "HIGH") ? NotificationType.CRITICAL : NotificationType.INFO, entityType: "Communication" };
    case "communication.cancelled": return { title: "Comunicado cancelado", message: `${"code" in payload ? payload.code : "Comunicado"}: ${"title" in payload ? payload.title : "cancelado"}.`, type: NotificationType.WARNING, entityType: "Communication" };
    case "communication.expired": return { title: "Comunicado expirado", message: `${"code" in payload ? payload.code : "Comunicado"}: ${"title" in payload ? payload.title : "expirado"}.`, type: NotificationType.WARNING, entityType: "Communication" };
  }
}
@Injectable()
export class NotificationSubscriber implements OnModuleInit {
  constructor(private readonly eventBus: EventBus, private readonly prisma: PrismaService) {}
  onModuleInit() { for (const name of names) this.eventBus.subscribe(name, (event) => this.handle(event)); }
  private async handle(event: DomainEvent<SubscribedEventName>) {
    const users = await this.prisma.user.findMany({ where: { status: UserStatus.ACTIVE, notificationPreferences: { none: { eventName: event.name, enabled: false } } }, select: { id: true } });
    if (!users.length) return;
    const details = content(event);
    await this.prisma.notification.createMany({ data: users.map((user) => ({ userId: user.id, ...details, eventName: event.name, entityId: event.payload.entityId })) });
  }
}
