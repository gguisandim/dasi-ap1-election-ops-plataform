import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../../../../system/access-control/src/server/auth.types";
import { Permissions } from "../../../../system/access-control/src/server/auth.decorators";
import { AssetQueryDto, CreateAssetDto, CreateAssetTypeDto, MoveAssetDto, UpdateAssetDto, UpdateAssetTypeDto } from "./dto/asset.dto";
import { InventoryService } from "./inventory.service";

@Permissions("inventory.read")
@Controller("inventory")
export class InventoryController {
  constructor(private readonly service: InventoryService) {}
  @Get() findAll(@Query() query: AssetQueryDto) { return this.service.findAll(query); }
  @Get("dashboard") dashboard() { return this.service.dashboard(); }
  @Get("types") types() { return this.service.listTypes(); }
  @Permissions("inventory.create") @Post("types") createType(@Body() dto: CreateAssetTypeDto) { return this.service.createType(dto); }
  @Permissions("inventory.update") @Patch("types/:id") updateType(@Param("id") id: string, @Body() dto: UpdateAssetTypeDto) { return this.service.updateType(id, dto); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @Permissions("inventory.create") @Post() create(@Body() dto: CreateAssetDto, @Req() request: AuthenticatedRequest) { return this.service.create(dto, request.user.id); }
  @Permissions("inventory.update") @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateAssetDto, @Req() request: AuthenticatedRequest) { return this.service.update(id, dto, request.user.id); }
  @Permissions("inventory.move") @Post(":id/movements") move(@Param("id") id: string, @Body() dto: MoveAssetDto, @Req() request: AuthenticatedRequest) { return this.service.move(id, dto, request.user.id); }
  @Permissions("inventory.update") @Delete(":id") @HttpCode(204) remove(@Param("id") id: string) { return this.service.remove(id); }
}
