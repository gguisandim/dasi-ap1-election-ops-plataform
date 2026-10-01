import { Module } from "@nestjs/common";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";
import { AuditSubscriber } from "./audit.subscriber";
@Module({ controllers: [AuditController], providers: [AuditService, AuditSubscriber], exports: [AuditService] }) export class AuditModule {}
