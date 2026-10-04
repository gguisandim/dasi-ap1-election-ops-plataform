import { Controller, Get, Param, Query } from "@nestjs/common";
import { PERMISSIONS, Permissions } from "@eops/security";
import { AuditService } from "./audit.service";
import { AuditQueryDto } from "./dto/audit-query.dto";
@Permissions(PERMISSIONS.audit.read) @Controller("audit")
export class AuditController {
  constructor(private readonly service: AuditService) {}
  @Get() findAll(@Query() query: AuditQueryDto) { return this.service.findAll(query); }
  @Get("summary") summary(@Query() query: AuditQueryDto) { return this.service.summary(query); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
}
