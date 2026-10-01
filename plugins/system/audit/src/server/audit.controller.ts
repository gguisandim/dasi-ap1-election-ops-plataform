import { Controller, Get, Query } from "@nestjs/common";
import { PERMISSIONS, Permissions } from "@eops/security";
import { AuditService } from "./audit.service";
import { AuditQueryDto } from "./dto/audit-query.dto";
@Permissions(PERMISSIONS.audit.read) @Controller("audit")
export class AuditController { constructor(private readonly service: AuditService) {} @Get() findAll(@Query() query: AuditQueryDto) { return this.service.findAll(query); } }
