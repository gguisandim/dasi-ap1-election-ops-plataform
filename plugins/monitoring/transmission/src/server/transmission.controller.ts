import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "@eops/security";
import { PERMISSIONS, Permissions } from "@eops/security";
import { AlertsQueryDto, BulkRetryDto, CreateTransmissionPointDto, RegisterAttemptDto, RetryPointDto, TransmissionQueryDto, UpdateAlertDto, UpdateConnectivityDto, UpdateTransmissionPointDto } from "./dto/transmission.dto";
import { TransmissionService } from "./transmission.service";

@Permissions(PERMISSIONS.transmission.read)
@Controller("transmission")
export class TransmissionController {
  constructor(private readonly service: TransmissionService) {}
  @Get() findAll(@Query() query: TransmissionQueryDto) { return this.service.findAll(query); }
  @Get("dashboard") dashboard(@Query() query: TransmissionQueryDto) { return this.service.dashboard(query); }
  @Get("queue") queue(@Query() query: TransmissionQueryDto) { return this.service.queue(query); }
  @Get("noc") noc(@Query() query: TransmissionQueryDto) { return this.service.noc(query); }
  @Get("alerts") alerts(@Query() query: AlertsQueryDto) { return this.service.alerts(query); }
  @Permissions(PERMISSIONS.transmission.manage) @Patch("alerts/:id") updateAlert(@Param("id") id: string, @Body() dto: UpdateAlertDto, @Req() request: AuthenticatedRequest) { return this.service.updateAlert(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.transmission.manage) @Post("retry") retryBulk(@Body() dto: BulkRetryDto, @Req() request: AuthenticatedRequest) { return this.service.retryBulk(dto, request.user.id); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @Get(":id/connectivity-history") connectivityHistory(@Param("id") id: string) { return this.service.connectivityHistory(id); }
  @Permissions(PERMISSIONS.transmission.manage) @Post() create(@Body() dto: CreateTransmissionPointDto) { return this.service.create(dto); }
  @Permissions(PERMISSIONS.transmission.manage) @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateTransmissionPointDto) { return this.service.update(id, dto); }
  @Permissions(PERMISSIONS.transmission.manage) @Patch(":id/connectivity") connectivity(@Param("id") id: string, @Body() dto: UpdateConnectivityDto, @Req() request: AuthenticatedRequest) { return this.service.updateConnectivity(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.transmission.manage) @Post(":id/retry") retry(@Param("id") id: string, @Body() dto: RetryPointDto, @Req() request: AuthenticatedRequest) { return this.service.retry(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.transmission.manage) @Post(":id/attempts") attempt(@Param("id") id: string, @Body() dto: RegisterAttemptDto, @Req() request: AuthenticatedRequest) { return this.service.registerAttempt(id, dto, request.user.id); }
}
