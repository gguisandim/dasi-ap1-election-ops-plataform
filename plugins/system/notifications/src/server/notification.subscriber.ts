import { Injectable, OnModuleInit } from "@nestjs/common";
import { NotificationType, UserStatus } from "@prisma/client";
import { EventBus, type DomainEvent, type DomainEventName } from "../../../../../packages/event-bus/src";
import { PrismaService } from "../../../../../packages/database/src";

const names: DomainEventName[] = ["incident.created", "incident.assigned", "incident.resolved", "asset.created", "asset.moved", "asset.status_changed", "user.created", "election.created"];
function content(event: DomainEvent): { title: string; message: string; type: NotificationType; entityType: string } {
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
  }
}
@Injectable()
export class NotificationSubscriber implements OnModuleInit {
  constructor(private readonly eventBus: EventBus, private readonly prisma: PrismaService) {}
  onModuleInit() { for (const name of names) this.eventBus.subscribe(name, (event) => this.handle(event)); }
  private async handle(event: DomainEvent) {
    const users = await this.prisma.user.findMany({ where: { status: UserStatus.ACTIVE, notificationPreferences: { none: { eventName: event.name, enabled: false } } }, select: { id: true } });
    if (!users.length) return;
    const details = content(event);
    await this.prisma.notification.createMany({ data: users.map((user) => ({ userId: user.id, ...details, eventName: event.name, entityId: event.payload.entityId })) });
  }
}
