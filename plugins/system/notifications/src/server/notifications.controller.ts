import { Body, Controller, Get, HttpCode, Param, Patch, Put, Query, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "@eops/security";
import { NotificationQueryDto, UpdateNotificationPreferencesDto } from "./dto/notification.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: NotificationQueryDto) {
    return this.service.list(request.user.id, query);
  }

  @Get("unread-count")
  unreadCount(@Req() request: AuthenticatedRequest) {
    return this.service.unreadCount(request.user.id);
  }

  @Get("preferences")
  preferences(@Req() request: AuthenticatedRequest) {
    return this.service.preferences(request.user.id);
  }

  @Put("preferences")
  updatePreferences(@Req() request: AuthenticatedRequest, @Body() dto: UpdateNotificationPreferencesDto) {
    return this.service.updatePreferences(request.user.id, dto);
  }

  @Patch("read-all")
  @HttpCode(204)
  readAll(@Req() request: AuthenticatedRequest) {
    return this.service.readAll(request.user.id);
  }

  @Patch(":id/read")
  read(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.service.read(request.user.id, id);
  }

  @Patch(":id/unread")
  unread(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.service.unread(request.user.id, id);
  }
}
