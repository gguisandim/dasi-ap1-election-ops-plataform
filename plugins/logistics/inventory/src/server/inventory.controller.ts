import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "@eops/security";
import { PERMISSIONS, Permissions } from "@eops/security";
import {
  AssetQueryDto,
  CheckInAssetDto,
  CheckOutAssetDto,
  CompleteMaintenanceDto,
  CreateAssetDto,
  CreateAssetTypeDto,
  CreateMaintenanceDto,
  CreateReservationDto,
  MaintenanceActionDto,
  MaintenanceQueryDto,
  MoveAssetDto,
  ReservationActionDto,
  ReservationQueryDto,
  UpdateAssetDto,
  UpdateAssetTypeDto,
} from "./dto/asset.dto";
import { InventoryService } from "./inventory.service";

@Permissions(PERMISSIONS.inventory.read)
@Controller("inventory")
export class InventoryController {
  constructor(private readonly service: InventoryService) {}
  @Get() findAll(@Query() query: AssetQueryDto) { return this.service.findAll(query); }
  @Get("dashboard") dashboard() { return this.service.dashboard(); }
  @Get("types") types() { return this.service.listTypes(); }
  @Permissions(PERMISSIONS.inventory.create) @Post("types") createType(@Body() dto: CreateAssetTypeDto) { return this.service.createType(dto); }
  @Permissions(PERMISSIONS.inventory.update) @Patch("types/:id") updateType(@Param("id") id: string, @Body() dto: UpdateAssetTypeDto) { return this.service.updateType(id, dto); }
  @Get("reservations") reservations(@Query() query: ReservationQueryDto) { return this.service.listReservations(query); }
  @Permissions(PERMISSIONS.inventory.move) @Post("reservations") createReservation(@Body() dto: CreateReservationDto, @Req() request: AuthenticatedRequest) { return this.service.createReservation(dto, request.user.id); }
  @Get("reservations/:id") reservation(@Param("id") id: string) { return this.service.getReservation(id); }
  @Permissions(PERMISSIONS.inventory.update) @Post("reservations/:id/approve") approveReservation(@Param("id") id: string, @Body() dto: ReservationActionDto, @Req() request: AuthenticatedRequest) { return this.service.approveReservation(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.inventory.update) @Post("reservations/:id/cancel") cancelReservation(@Param("id") id: string, @Body() dto: ReservationActionDto, @Req() request: AuthenticatedRequest) { return this.service.cancelReservation(id, dto, request.user.id); }
  @Get("maintenance") maintenance(@Query() query: MaintenanceQueryDto) { return this.service.listMaintenance(query); }
  @Permissions(PERMISSIONS.inventory.update) @Post("maintenance") createMaintenance(@Body() dto: CreateMaintenanceDto, @Req() request: AuthenticatedRequest) { return this.service.createMaintenance(dto, request.user.id); }
  @Permissions(PERMISSIONS.inventory.update) @Post("maintenance/:id/start") startMaintenance(@Param("id") id: string, @Body() dto: MaintenanceActionDto, @Req() request: AuthenticatedRequest) { return this.service.startMaintenance(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.inventory.update) @Post("maintenance/:id/complete") completeMaintenance(@Param("id") id: string, @Body() dto: CompleteMaintenanceDto, @Req() request: AuthenticatedRequest) { return this.service.completeMaintenance(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.inventory.update) @Post("maintenance/:id/cancel") cancelMaintenance(@Param("id") id: string, @Body() dto: MaintenanceActionDto, @Req() request: AuthenticatedRequest) { return this.service.cancelMaintenance(id, dto, request.user.id); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @Permissions(PERMISSIONS.inventory.create) @Post() create(@Body() dto: CreateAssetDto, @Req() request: AuthenticatedRequest) { return this.service.create(dto, request.user.id); }
  @Permissions(PERMISSIONS.inventory.update) @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateAssetDto, @Req() request: AuthenticatedRequest) { return this.service.update(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.inventory.move) @Post(":id/movements") move(@Param("id") id: string, @Body() dto: MoveAssetDto, @Req() request: AuthenticatedRequest) { return this.service.move(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.inventory.move) @Post(":id/check-out") checkOut(@Param("id") id: string, @Body() dto: CheckOutAssetDto, @Req() request: AuthenticatedRequest) { return this.service.checkOut(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.inventory.move) @Post(":id/check-in") checkIn(@Param("id") id: string, @Body() dto: CheckInAssetDto, @Req() request: AuthenticatedRequest) { return this.service.checkIn(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.inventory.update) @Delete(":id") @HttpCode(204) remove(@Param("id") id: string) { return this.service.remove(id); }
}
