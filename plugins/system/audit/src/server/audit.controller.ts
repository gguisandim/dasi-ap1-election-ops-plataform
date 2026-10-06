import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import { PERMISSIONS, Permissions, type AuthenticatedRequest } from "@eops/security";
import { AuditService } from "./audit.service";
import { AuditQueryDto } from "./dto/audit-query.dto";
@Permissions(PERMISSIONS.audit.read) @Controller("audit")
export class AuditController {
  constructor(private readonly service: AuditService) {}
  @Get() findAll(@Query() query: AuditQueryDto, @Req() request: AuthenticatedRequest) {
    return this.service.findAll(query, request.user.permissions);
  }
  @Get("summary") summary(@Query() query: AuditQueryDto, @Req() request: AuthenticatedRequest) {
    return this.service.summary(query, request.user.permissions);
  }
  @Get("explorer") explorer(@Query() query: AuditQueryDto, @Req() request: AuthenticatedRequest) {
    return this.service.explorer(query, request.user.permissions);
  }
  @Get("categories") categories(@Query() query: AuditQueryDto, @Req() request: AuthenticatedRequest) {
    return this.service.categories(query, request.user.permissions);
  }
  @Get("actors") actors(@Query() query: AuditQueryDto, @Req() request: AuthenticatedRequest) {
    return this.service.actors(query, request.user.permissions);
  }
  @Get("entities/:entityType/:entityId") entityTimeline(
    @Param("entityType") entityType: string,
    @Param("entityId") entityId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.entityTimeline(entityType, entityId, request.user.permissions);
  }
  @Get("correlation/:correlationId") correlation(
    @Param("correlationId") correlationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.correlation(correlationId, request.user.permissions);
  }
  @Get(":id/diff") diff(@Param("id") id: string) {
    return this.service.diff(id);
  }
  @Get(":id") findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }
}
