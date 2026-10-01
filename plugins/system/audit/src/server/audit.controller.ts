import { Controller, Get, Query } from "@nestjs/common";
import { Permissions } from "../../../access-control/src/server/auth.decorators";
import { AuditService } from "./audit.service";
import { AuditQueryDto } from "./dto/audit-query.dto";
@Permissions("audit.read") @Controller("audit")
export class AuditController { constructor(private readonly service: AuditService) {} @Get() findAll(@Query() query: AuditQueryDto) { return this.service.findAll(query); } }
