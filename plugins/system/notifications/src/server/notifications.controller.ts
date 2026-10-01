import { Controller, Get, HttpCode, Param, Patch, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../../../access-control/src/server/auth.types";
import { NotificationsService } from "./notifications.service";
@Controller("notifications")
export class NotificationsController { constructor(private readonly service: NotificationsService) {} @Get() list(@Req() request: AuthenticatedRequest) { return this.service.list(request.user.id); } @Patch("read-all") @HttpCode(204) readAll(@Req() request: AuthenticatedRequest) { return this.service.readAll(request.user.id); } @Patch(":id/read") read(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return this.service.read(request.user.id, id); } }
