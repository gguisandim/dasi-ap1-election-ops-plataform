import { Injectable, OnModuleInit } from "@nestjs/common";
import { NotificationType, UserStatus } from "@prisma/client";

import {
  EventBus,
  requiredPermissionForEvent,
  type DomainEvent,
  type DomainEventName,
} from "@eops/event-bus";
import { PrismaService } from "@eops/database";

const names = [
  "incident.created",
  "incident.updated",
  "incident.acknowledged",
  "incident.assigned",
  "incident.status_changed",
  "incident.severity_changed",
  "incident.escalated",
  "incident.comment_added",
  "incident.resolved",
  "incident.reopened",
  "incident.closed",
  "incident.cancelled",
  "asset.created",
  "asset.moved",
  "asset.status_changed",
  "user.created",
  "election.created",
  "route.created",
  "route.started",
  "route.completed",
  "delivery.completed",
  "delivery.failed",
  "transmission.completed",
  "transmission.failed",
  "transmission.connectivity_changed",
  "transmission.alert_created",
  "field_team.allocated",
  "field_member.checked_in",
  "field_member.checked_out",
  "communication.published",
  "communication.cancelled",
  "communication.expired",
  "evidence.created",
  "evidence.versioned",
  "evidence.archived",
  "runbook.published",
  "runbook.executed",
  "risk.escalated",
  "risk.materialized",
  "preparation_checklist.approved",
  "preparation_checklist.blocked",
  "task.created",
  "task.assigned",
  "task.status_changed",
  "task.completed",
  "task.blocked",
  "shift.created",
  "shift.started",
  "shift.completed",
  "shift.assignment_changed",
  "shift.absence_registered",
  "shift.on_call_activated",
  "shift.replacement_created",
  "shift.replacement_registered",
  "shift.coverage_insufficient",
] as const satisfies readonly DomainEventName[];

type SubscribedEventName = (typeof names)[number];

function content(event: DomainEvent<SubscribedEventName>): {
  title: string;
  message: string;
  type: NotificationType;
  entityType: string;
} {
  const payload = event.payload;

  switch (event.name) {
    case "incident.created":
      return {
        title: "Novo incidente",
        message: `${"code" in payload ? payload.code : "Incidente"}: ${
          "title" in payload ? payload.title : "criado"
        }.`,
        type:
          "severity" in payload && payload.severity === "CRITICAL"
            ? NotificationType.CRITICAL
            : NotificationType.WARNING,
        entityType: "Incident",
      };

    case "incident.assigned":
      return {
        title: "Incidente atribuído",
        message: `${"code" in payload ? payload.code : "Incidente"} atribuído a ${
          "assignedToName" in payload ? payload.assignedToName : "responsável"
        }.`,
        type: NotificationType.INFO,
        entityType: "Incident",
      };

    case "incident.resolved":
      return {
        title: "Incidente resolvido",
        message: `${"code" in payload ? payload.code : "Incidente"} foi resolvido.`,
        type: NotificationType.SUCCESS,
        entityType: "Incident",
      };

    case "incident.updated":
      return {
        title: "Incidente atualizado",
        message: `${"code" in payload ? payload.code : "Incidente"} teve seus dados atualizados.`,
        type: NotificationType.INFO,
        entityType: "Incident",
      };

    case "incident.acknowledged":
      return {
        title: "Incidente reconhecido",
        message: `${"code" in payload ? payload.code : "Incidente"} foi reconhecido por um operador.`,
        type: NotificationType.INFO,
        entityType: "Incident",
      };

    case "incident.status_changed":
      return {
        title: "Status de incidente alterado",
        message: `${"code" in payload ? payload.code : "Incidente"} mudou para ${"to" in payload ? payload.to : "novo status"}.`,
        type: NotificationType.INFO,
        entityType: "Incident",
      };

    case "incident.severity_changed":
      return {
        title: "Severidade de incidente alterada",
        message: `${"code" in payload ? payload.code : "Incidente"} mudou para ${"to" in payload ? payload.to : "nova severidade"}.`,
        type:
          "to" in payload && payload.to === "CRITICAL"
            ? NotificationType.CRITICAL
            : NotificationType.WARNING,
        entityType: "Incident",
      };

    case "incident.escalated":
      return {
        title: "Incidente escalado",
        message: `${"code" in payload ? payload.code : "Incidente"} foi escalado para o nível ${"to" in payload ? payload.to : "superior"}.`,
        type: NotificationType.CRITICAL,
        entityType: "Incident",
      };

    case "incident.comment_added":
      return {
        title: "Novo comentário em incidente",
        message: `${"code" in payload ? payload.code : "Incidente"} recebeu um comentário operacional.`,
        type: NotificationType.INFO,
        entityType: "Incident",
      };

    case "incident.reopened":
      return {
        title: "Incidente reaberto",
        message: `${"code" in payload ? payload.code : "Incidente"} retornou ao atendimento.`,
        type: NotificationType.WARNING,
        entityType: "Incident",
      };

    case "incident.closed":
      return {
        title: "Incidente fechado",
        message: `${"code" in payload ? payload.code : "Incidente"} foi encerrado.`,
        type: NotificationType.SUCCESS,
        entityType: "Incident",
      };

    case "incident.cancelled":
      return {
        title: "Incidente cancelado",
        message: `${"code" in payload ? payload.code : "Incidente"} foi cancelado.`,
        type: NotificationType.WARNING,
        entityType: "Incident",
      };

    case "asset.moved":
      return {
        title: "Ativo movimentado",
        message: `${"assetTag" in payload ? payload.assetTag : "Ativo"}: ${
          "origin" in payload ? payload.origin : "origem"
        } → ${"destination" in payload ? payload.destination : "destino"}.`,
        type: NotificationType.INFO,
        entityType: "Asset",
      };

    case "asset.status_changed":
      return {
        title: "Status de ativo alterado",
        message: `${"assetTag" in payload ? payload.assetTag : "Ativo"} alterado para ${
          "to" in payload ? payload.to : "novo status"
        }.`,
        type: NotificationType.WARNING,
        entityType: "Asset",
      };

    case "asset.created":
      return {
        title: "Ativo cadastrado",
        message: `${"assetTag" in payload ? payload.assetTag : "Ativo"} foi cadastrado.`,
        type: NotificationType.INFO,
        entityType: "Asset",
      };

    case "user.created":
      return {
        title: "Usuário criado",
        message: `${"name" in payload ? payload.name : "Usuário"} foi cadastrado.`,
        type: NotificationType.INFO,
        entityType: "User",
      };

    case "election.created":
      return {
        title: "Pleito criado",
        message: `${"name" in payload ? payload.name : "Pleito"} foi cadastrado.`,
        type: NotificationType.INFO,
        entityType: "Election",
      };

    case "route.created":
      return {
        title: "Rota criada",
        message: `${"code" in payload ? payload.code : "Rota"} foi cadastrada.`,
        type: NotificationType.INFO,
        entityType: "DistributionRoute",
      };

    case "route.started":
      return {
        title: "Rota iniciada",
        message: `${"code" in payload ? payload.code : "Rota"} iniciou a distribuição.`,
        type: NotificationType.INFO,
        entityType: "DistributionRoute",
      };

    case "route.completed":
      return {
        title: "Rota concluída",
        message: `${"code" in payload ? payload.code : "Rota"} chegou ao destino.`,
        type: NotificationType.SUCCESS,
        entityType: "DistributionRoute",
      };

    case "delivery.completed":
      return {
        title: "Entrega concluída",
        message: "Uma entrega de materiais foi recebida.",
        type: NotificationType.SUCCESS,
        entityType: "Delivery",
      };

    case "delivery.failed":
      return {
        title: "Falha de entrega",
        message: `Falha registrada: ${
          "reason" in payload ? payload.reason : "motivo não informado"
        }.`,
        type: NotificationType.WARNING,
        entityType: "Delivery",
      };

    case "transmission.completed":
      return {
        title: "Transmissão concluída",
        message: `${
          "identification" in payload ? payload.identification : "Ponto"
        } concluiu a transmissão.`,
        type: NotificationType.SUCCESS,
        entityType: "TransmissionPoint",
      };

    case "transmission.failed":
      return {
        title: "Falha de transmissão",
        message: `${"identification" in payload ? payload.identification : "Ponto"}: ${
          "error" in payload ? payload.error : "falha operacional"
        }.`,
        type: NotificationType.CRITICAL,
        entityType: "TransmissionPoint",
      };

    case "transmission.connectivity_changed":
      return {
        title: "Conectividade alterada",
        message: `${
          "identification" in payload ? payload.identification : "Ponto"
        } mudou para ${"to" in payload ? payload.to : "novo estado"}.`,
        type: NotificationType.WARNING,
        entityType: "TransmissionPoint",
      };

    case "transmission.alert_created":
      return {
        title: "Alerta de transmissão",
        message:
          "message" in payload ? payload.message : "Novo alerta operacional.",
        type: NotificationType.WARNING,
        entityType: "TransmissionAlert",
      };

    case "field_team.allocated":
      return {
        title: "Equipe alocada",
        message: "Nova alocação de campo registrada.",
        type: NotificationType.INFO,
        entityType: "FieldAllocation",
      };

    case "field_member.checked_in":
      return {
        title: "Check-in de campo",
        message: `${
          "memberName" in payload ? payload.memberName : "Operador"
        } iniciou o serviço.`,
        type: NotificationType.SUCCESS,
        entityType: "FieldMember",
      };

    case "field_member.checked_out":
      return {
        title: "Check-out de campo",
        message: `${
          "memberName" in payload ? payload.memberName : "Operador"
        } encerrou o serviço.`,
        type: NotificationType.INFO,
        entityType: "FieldMember",
      };

    case "communication.published":
      return {
        title: "Novo comunicado operacional",
        message: `${"code" in payload ? payload.code : "Comunicado"}: ${
          "title" in payload ? payload.title : "publicado"
        } (${
          "recipientCount" in payload ? payload.recipientCount : 0
        } destinatário(s)).`,
        type:
          "priority" in payload &&
          (payload.priority === "CRITICAL" || payload.priority === "HIGH")
            ? NotificationType.CRITICAL
            : NotificationType.INFO,
        entityType: "Communication",
      };

    case "communication.cancelled":
      return {
        title: "Comunicado cancelado",
        message: `${"code" in payload ? payload.code : "Comunicado"}: ${
          "title" in payload ? payload.title : "cancelado"
        }.`,
        type: NotificationType.WARNING,
        entityType: "Communication",
      };

    case "communication.expired":
      return {
        title: "Comunicado expirado",
        message: `${"code" in payload ? payload.code : "Comunicado"}: ${
          "title" in payload ? payload.title : "expirado"
        }.`,
        type: NotificationType.WARNING,
        entityType: "Communication",
      };

    case "evidence.created":
      return {
        title: "Nova evidência registrada",
        message: `${"code" in payload ? payload.code : "Evidência"}: ${
          "title" in payload ? payload.title : "registrada"
        }.`,
        type: NotificationType.INFO,
        entityType: "Evidence",
      };

    case "evidence.versioned":
      return {
        title: "Nova versão de evidência",
        message: `${
          "code" in payload ? payload.code : "Evidência"
        } recebeu a versão ${"version" in payload ? payload.version : "?"}.`,
        type: NotificationType.WARNING,
        entityType: "Evidence",
      };

    case "evidence.archived":
      return {
        title: "Evidência arquivada",
        message: `${"code" in payload ? payload.code : "Evidência"}: ${
          "title" in payload ? payload.title : "arquivada"
        }.`,
        type: NotificationType.WARNING,
        entityType: "Evidence",
      };

    case "runbook.published":
      return {
        title: "Runbook publicado",
        message: `${"code" in payload ? payload.code : "Runbook"}: ${
          "title" in payload ? payload.title : "publicado"
        } (${"stepCount" in payload ? payload.stepCount : 0} passo(s)).`,
        type: NotificationType.INFO,
        entityType: "KnowledgeArticle",
      };

    case "runbook.executed":
      return {
        title: "Runbook executado",
        message: `${"code" in payload ? payload.code : "Runbook"}: ${
          "outcome" in payload ? payload.outcome : "resultado registrado"
        }.`,
        type: NotificationType.INFO,
        entityType: "RunbookUsage",
      };

    case "risk.escalated":
      return {
        title: "Risco escalado",
        message: `${"code" in payload ? payload.code : "Risco"} subiu de ${
          "fromLevel" in payload ? payload.fromLevel : "?"
        } para ${"toLevel" in payload ? payload.toLevel : "?"}.`,
        type: NotificationType.CRITICAL,
        entityType: "Risk",
      };

    case "risk.materialized":
      return {
        title: "Risco materializado",
        message: `${"code" in payload ? payload.code : "Risco"}: ${
          "actualImpact" in payload
            ? payload.actualImpact
            : "impacto real registrado"
        }.`,
        type: NotificationType.CRITICAL,
        entityType: "Risk",
      };

    case "preparation_checklist.approved":
      return {
        title: "Local preparado",
        message: "Um local de votação foi aprovado para a operação.",
        type: NotificationType.SUCCESS,
        entityType: "PreparationChecklist",
      };

    case "preparation_checklist.blocked":
      return {
        title: "Checklist bloqueado",
        message: `Pendência crítica: ${
          "reason" in payload
            ? payload.reason
            : "verifique os itens obrigatórios"
        }.`,
        type: NotificationType.CRITICAL,
        entityType: "PreparationChecklist",
      };

    case "task.created":
      return {
        title: "Nova tarefa",
        message: `Tarefa criada: ${
          "title" in payload ? payload.title : "atividade operacional"
        }.`,
        type: NotificationType.INFO,
        entityType: "Task",
      };

    case "task.assigned":
      return {
        title: "Tarefa atribuída",
        message: `Responsável atualizado para a tarefa ${
          "title" in payload ? payload.title : "operacional"
        }.`,
        type: NotificationType.INFO,
        entityType: "Task",
      };

    case "task.status_changed":
      return {
        title: "Status de tarefa alterado",
        message: `${"title" in payload ? payload.title : "Tarefa"}: ${
          "to" in payload ? payload.to : "novo status"
        }.`,
        type: NotificationType.INFO,
        entityType: "Task",
      };

    case "task.completed":
      return {
        title: "Tarefa concluída",
        message: `${"title" in payload ? payload.title : "Tarefa"} foi concluída.`,
        type: NotificationType.SUCCESS,
        entityType: "Task",
      };

    case "task.blocked":
      return {
        title: "Tarefa bloqueada",
        message: `${"title" in payload ? payload.title : "Tarefa"}: ${
          "reason" in payload ? payload.reason : "verifique as dependências"
        }.`,
        type: NotificationType.CRITICAL,
        entityType: "Task",
      };
    case "shift.created":
      return {
        title: "Turno criado",
        message: `${"name" in payload ? payload.name : "Um turno"} foi incluído na escala.`,
        type: NotificationType.INFO,
        entityType: "FieldShift",
      };
    case "shift.started":
      return {
        title: "Turno iniciado",
        message: `${"name" in payload ? payload.name : "Um turno"} está em andamento.`,
        type: NotificationType.INFO,
        entityType: "FieldShift",
      };
    case "shift.completed":
      return {
        title: "Turno concluído",
        message: `${"name" in payload ? payload.name : "Um turno"} foi concluído.`,
        type: NotificationType.SUCCESS,
        entityType: "FieldShift",
      };
    case "shift.assignment_changed":
      return {
        title: "Escala alterada",
        message: `${"memberName" in payload ? payload.memberName : "Operador"}: ${
          "change" in payload ? payload.change : "alocação atualizada"
        }.`,
        type: NotificationType.INFO,
        entityType: "FieldShift",
      };
    case "shift.absence_registered":
      return {
        title: "Falta registrada",
        message: `${"memberName" in payload ? payload.memberName : "Operador"} foi marcado como ausente.`,
        type: NotificationType.WARNING,
        entityType: "FieldShift",
      };
    case "shift.on_call_activated":
      return {
        title: "Sobreaviso acionado",
        message: `${"memberName" in payload ? payload.memberName : "Operador"} foi acionado para o turno.`,
        type: NotificationType.WARNING,
        entityType: "FieldShift",
      };
    case "shift.replacement_created":
      return {
        title: "Substituição registrada",
        message: `${"substituteName" in payload ? payload.substituteName : "Um operador"} assumiu um turno.`,
        type: NotificationType.INFO,
        entityType: "FieldShift",
      };
    case "shift.replacement_registered":
      return {
        title: "Substituição registrada",
        message: `${"substituteName" in payload ? payload.substituteName : "Um operador"} assumiu um turno.`,
        type: NotificationType.INFO,
        entityType: "FieldShift",
      };
    case "shift.coverage_insufficient":
      return {
        title: "Cobertura insuficiente",
        message: `${"name" in payload ? payload.name : "Um turno"}: ${
          "availableOperators" in payload ? payload.availableOperators : 0
        }/${"requiredOperators" in payload ? payload.requiredOperators : 0} operadores disponíveis.`,
        type: NotificationType.CRITICAL,
        entityType: "FieldShift",
      };
  }
}

@Injectable()
export class NotificationSubscriber implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBus,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    for (const name of names) {
      this.eventBus.subscribe(name, (event) => this.handle(event));
    }
  }

  private async handle(event: DomainEvent<SubscribedEventName>) {
    const requiredPermission = requiredPermissionForEvent(event.name);
    if (!requiredPermission) return;
    const users = await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        roles: {
          some: {
            role: {
              permissions: {
                some: { permission: { key: requiredPermission } },
              },
            },
          },
        },
        notificationPreferences: {
          none: { eventName: event.name, enabled: false },
        },
      },
      select: { id: true },
    });

    if (!users.length) return;

    const details = content(event);

    await this.prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        ...details,
        eventName: event.name,
        entityId: event.payload.entityId,
      })),
    });
  }
}
