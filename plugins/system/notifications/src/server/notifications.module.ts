import { Module } from "@nestjs/common";
import { NotificationSubscriber } from "./notification.subscriber";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
@Module({ controllers: [NotificationsController], providers: [NotificationsService, NotificationSubscriber] }) export class NotificationsModule {}
