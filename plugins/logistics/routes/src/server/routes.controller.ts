import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "@eops/security";
import { PERMISSIONS, Permissions } from "@eops/security";
import {
  CreateBatchDto,
  CreateDeliveryDto,
  CreateRouteDto,
  CreateRouteExceptionDto,
  CreateVehicleDto,
  ReorderStopsDto,
  ResolveRouteExceptionDto,
  RouteQueryDto,
  StopActionDto,
  TransitionRouteDto,
  UpdateDeliveryDto,
  UpdateRouteDto,
} from "./dto/routes.dto";
import { RoutesService } from "./routes.service";

@Permissions(PERMISSIONS.routes.read)
@Controller("routes")
export class RoutesController {
  constructor(private readonly service: RoutesService) {}

  @Get() findAll(@Query() query: RouteQueryDto) { return this.service.findAll(query); }
  @Get("dashboard") dashboard(@Query() query: RouteQueryDto) { return this.service.dashboard(query); }
  @Get("vehicles") vehicles() { return this.service.listVehicles(); }
  @Permissions(PERMISSIONS.routes.manage) @Post("vehicles") createVehicle(@Body() dto: CreateVehicleDto) { return this.service.createVehicle(dto); }
  @Permissions(PERMISSIONS.routes.manage) @Post("batches") createBatch(@Body() dto: CreateBatchDto) { return this.service.createBatch(dto); }
  @Permissions(PERMISSIONS.routes.manage) @Post("deliveries") createDelivery(@Body() dto: CreateDeliveryDto) { return this.service.createDelivery(dto); }
  @Permissions(PERMISSIONS.routes.manage) @Patch("deliveries/:id") updateDelivery(@Param("id") id: string, @Body() dto: UpdateDeliveryDto, @Req() request: AuthenticatedRequest) { return this.service.updateDelivery(id, dto, request.user.id); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @Permissions(PERMISSIONS.routes.manage) @Post() create(@Body() dto: CreateRouteDto, @Req() request: AuthenticatedRequest) { return this.service.create(dto, request.user.id); }
  @Permissions(PERMISSIONS.routes.manage) @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateRouteDto, @Req() request: AuthenticatedRequest) { return this.service.update(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.routes.manage) @Post(":id/transition") transition(@Param("id") id: string, @Body() dto: TransitionRouteDto, @Req() request: AuthenticatedRequest) { return this.service.transition(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.routes.manage) @Post(":routeId/stops/:stopId/action") stopAction(@Param("routeId") routeId: string, @Param("stopId") stopId: string, @Body() dto: StopActionDto, @Req() request: AuthenticatedRequest) { return this.service.stopAction(routeId, stopId, dto, request.user.id); }
  @Permissions(PERMISSIONS.routes.manage) @Post(":routeId/stops/reorder") reorderStops(@Param("routeId") routeId: string, @Body() dto: ReorderStopsDto, @Req() request: AuthenticatedRequest) { return this.service.reorderStops(routeId, dto, request.user.id); }
  @Permissions(PERMISSIONS.routes.manage) @Post(":routeId/exceptions") createException(@Param("routeId") routeId: string, @Body() dto: CreateRouteExceptionDto, @Req() request: AuthenticatedRequest) { return this.service.createException(routeId, dto, request.user.id); }
  @Permissions(PERMISSIONS.routes.manage) @Post(":routeId/exceptions/:exceptionId/resolve") resolveException(@Param("routeId") routeId: string, @Param("exceptionId") exceptionId: string, @Body() dto: ResolveRouteExceptionDto, @Req() request: AuthenticatedRequest) { return this.service.resolveException(routeId, exceptionId, dto, request.user.id); }
}
