import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "@eops/security";
import { PERMISSIONS, Permissions } from "@eops/security";
import {
  AlertsQueryDto,
  BulkRetryDto,
  CancelFailoverDto,
  ConnectivityRecoveryDto,
  CorrelationQueryDto,
  CreateCircuitDto,
  CreateProviderDto,
  CreateTransmissionPointDto,
  ProvidersQueryDto,
  RecoverFailoverDto,
  RegisterAttemptDto,
  RetryPointDto,
  SlaQueryDto,
  StartFailoverDto,
  StateHistoryQueryDto,
  TransmissionQueryDto,
  UpdateAlertDto,
  UpdateCircuitDto,
  UpdateConnectivityDto,
  UpdateProviderDto,
  UpdateTransmissionPointDto,
} from "./dto/transmission.dto";
import { TransmissionService } from "./transmission.service";

// Rotas estaticas de um unico segmento (sla, analytics, providers, correlation)
// sao declaradas antes de `GET :id` para nao serem capturadas pelo parametro.
@Permissions(PERMISSIONS.transmission.read)
@Controller("transmission")
export class TransmissionController {
  constructor(private readonly service: TransmissionService) {}

  @Get() findAll(@Query() query: TransmissionQueryDto) { return this.service.findAll(query); }
  @Get("dashboard") dashboard(@Query() query: TransmissionQueryDto) { return this.service.dashboard(query); }
  @Get("queue") queue(@Query() query: TransmissionQueryDto) { return this.service.queue(query); }
  @Get("noc") noc(@Query() query: TransmissionQueryDto) { return this.service.noc(query); }
  @Get("alerts") alerts(@Query() query: AlertsQueryDto) { return this.service.alerts(query); }
  @Get("sla") sla(@Query() query: SlaQueryDto) { return this.service.slaOverview(query); }
  @Get("analytics") analytics(@Query() query: SlaQueryDto) { return this.service.analytics(query); }
  @Get("providers") providers(@Query() query: ProvidersQueryDto) { return this.service.listProviders(query); }
  @Get("correlation") correlation(@Query() query: CorrelationQueryDto, @Req() request: AuthenticatedRequest) { return this.service.correlation(query, request.user.permissions); }

  @Permissions(PERMISSIONS.transmission.manage) @Patch("alerts/:id") updateAlert(@Param("id") id: string, @Body() dto: UpdateAlertDto, @Req() request: AuthenticatedRequest) { return this.service.updateAlert(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.transmission.manage) @Post("retry") retryBulk(@Body() dto: BulkRetryDto, @Req() request: AuthenticatedRequest) { return this.service.retryBulk(dto, request.user.id); }
  @Permissions(PERMISSIONS.transmission.manage) @Post("providers") createProvider(@Body() dto: CreateProviderDto, @Req() request: AuthenticatedRequest) { return this.service.createProvider(dto, request.user.id); }
  @Permissions(PERMISSIONS.transmission.manage) @Patch("providers/:id") updateProvider(@Param("id") id: string, @Body() dto: UpdateProviderDto, @Req() request: AuthenticatedRequest) { return this.service.updateProvider(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.transmission.manage) @Patch("circuits/:circuitId") updateCircuit(@Param("circuitId") circuitId: string, @Body() dto: UpdateCircuitDto, @Req() request: AuthenticatedRequest) { return this.service.updateCircuit(circuitId, dto, request.user.id); }

  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @Get(":id/connectivity-history") connectivityHistory(@Param("id") id: string) { return this.service.connectivityHistory(id); }
  @Get(":id/state-history") stateHistory(@Param("id") id: string, @Query() query: StateHistoryQueryDto) { return this.service.stateHistory(id, query); }
  @Get(":id/sla") pointSla(@Param("id") id: string, @Query() query: SlaQueryDto) { return this.service.pointSla(id, query); }
  @Get(":id/circuits") circuits(@Param("id") id: string) { return this.service.listCircuits(id); }
  @Get(":id/failovers") failovers(@Param("id") id: string) { return this.service.listFailovers(id); }

  @Permissions(PERMISSIONS.transmission.manage) @Post() create(@Body() dto: CreateTransmissionPointDto) { return this.service.create(dto); }
  @Permissions(PERMISSIONS.transmission.manage) @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateTransmissionPointDto) { return this.service.update(id, dto); }
  @Permissions(PERMISSIONS.transmission.manage) @Patch(":id/connectivity") connectivity(@Param("id") id: string, @Body() dto: UpdateConnectivityDto, @Req() request: AuthenticatedRequest) { return this.service.updateConnectivity(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.transmission.manage) @Post(":id/recovery") recovery(@Param("id") id: string, @Body() dto: ConnectivityRecoveryDto, @Req() request: AuthenticatedRequest) { return this.service.recovery(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.transmission.manage) @Post(":id/circuits") createCircuit(@Param("id") id: string, @Body() dto: CreateCircuitDto, @Req() request: AuthenticatedRequest) { return this.service.createCircuit(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.transmission.manage) @Post(":id/failover") startFailover(@Param("id") id: string, @Body() dto: StartFailoverDto, @Req() request: AuthenticatedRequest) { return this.service.startFailover(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.transmission.manage) @Post(":id/failover/:failoverId/recover") recoverFailover(@Param("id") id: string, @Param("failoverId") failoverId: string, @Body() dto: RecoverFailoverDto, @Req() request: AuthenticatedRequest) { return this.service.recoverFailover(id, failoverId, dto, request.user.id); }
  @Permissions(PERMISSIONS.transmission.manage) @Post(":id/failover/:failoverId/cancel") cancelFailover(@Param("id") id: string, @Param("failoverId") failoverId: string, @Body() dto: CancelFailoverDto) { return this.service.cancelFailover(id, failoverId, dto); }
  @Permissions(PERMISSIONS.transmission.manage) @Post(":id/retry") retry(@Param("id") id: string, @Body() dto: RetryPointDto, @Req() request: AuthenticatedRequest) { return this.service.retry(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.transmission.manage) @Post(":id/attempts") attempt(@Param("id") id: string, @Body() dto: RegisterAttemptDto, @Req() request: AuthenticatedRequest) { return this.service.registerAttempt(id, dto, request.user.id); }
}
