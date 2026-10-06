import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { PERMISSIONS, Permissions, type AuthenticatedRequest } from "@eops/security";
import {
  CreateSavedViewDto,
  CreateSnapshotDto,
  SnapshotQueryDto,
  SummaryQueryDto,
  UpdateSavedViewDto,
} from "./dto/command-center.dto";
import { CommandCenterService } from "./command-center.service";
import { CommandCenterSnapshotsService } from "./command-center-snapshots.service";
import { CommandCenterViewsService } from "./command-center-views.service";

@Permissions(PERMISSIONS.commandCenter.read)
@Controller("command-center")
export class CommandCenterController {
  constructor(
    private readonly service: CommandCenterService,
    private readonly views: CommandCenterViewsService,
    private readonly snapshots: CommandCenterSnapshotsService,
  ) {}

  @Get("summary") summary(
    @Query() query: SummaryQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.summary(request.user.permissions, query);
  }

  @Get("attention") attention(
    @Query() query: SummaryQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.attention(request.user.permissions, query);
  }

  @Get("zones") zones(
    @Query() query: SummaryQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.zones(request.user.permissions, query);
  }

  @Get("workforce") workforce(
    @Query() query: SummaryQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.workforce(request.user.permissions, query);
  }

  @Get("logistics") logistics(
    @Query() query: SummaryQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.logistics(request.user.permissions, query);
  }

  @Get("continuity") continuity(
    @Query() query: SummaryQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.continuity(request.user.permissions, query);
  }

  @Get("views") listViews(@Req() request: AuthenticatedRequest) {
    return this.views.list(request.user.id, request.user.permissions);
  }

  @Post("views") createView(
    @Body() dto: CreateSavedViewDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.views.create(dto, request.user.id, request.user.permissions);
  }

  @Patch("views/:id") updateView(
    @Param("id") id: string,
    @Body() dto: UpdateSavedViewDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.views.update(id, dto, request.user.id, request.user.permissions);
  }

  @Delete("views/:id") removeView(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.views.remove(id, request.user.id, request.user.permissions);
  }

  @Get("snapshots") listSnapshots(@Query() query: SnapshotQueryDto) {
    return this.snapshots.list(query);
  }

  @Get("snapshots/:id/compare") compareSnapshot(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.snapshots.compare(id, request.user.permissions);
  }

  @Get("snapshots/:id") snapshot(@Param("id") id: string) {
    return this.snapshots.findOne(id);
  }

  @Permissions(PERMISSIONS.commandCenter.manage)
  @Post("snapshots") createSnapshot(
    @Body() dto: CreateSnapshotDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.snapshots.create(dto, request.user.id, request.user.permissions);
  }
}
