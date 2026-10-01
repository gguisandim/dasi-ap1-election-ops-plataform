import { Type } from "class-transformer";
import { DeliveryStatus, RouteStatus, RouteStopStatus, VehicleStatus } from "@prisma/client";
import { IsArray, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min, ValidateNested } from "class-validator";

export class RouteQueryDto {
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() zoneId?: string;
  @IsEnum(RouteStatus) @IsOptional() status?: RouteStatus;
  @IsString() @IsOptional() responsible?: string;
  @IsDateString() @IsOptional() from?: string;
  @IsDateString() @IsOptional() to?: string;
}

export class RouteStopInputDto {
  @Type(() => Number) @IsInt() @Min(1) order!: number;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() @Length(2, 240) description!: string;
  @Type(() => Number) @IsNumber() @IsOptional() latitude?: number;
  @Type(() => Number) @IsNumber() @IsOptional() longitude?: number;
  @IsDateString() eta!: string;
  @IsString() @IsOptional() notes?: string;
}

export class CreateRouteDto {
  @IsString() @Length(2, 40) code!: string;
  @IsString() @Length(2, 160) name!: string;
  @IsString() electionId!: string;
  @IsString() electoralZoneId!: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @Length(2, 200) originName!: string;
  @Type(() => Number) @IsNumber() @IsOptional() originLatitude?: number;
  @Type(() => Number) @IsNumber() @IsOptional() originLongitude?: number;
  @IsString() @Length(2, 200) destinationName!: string;
  @Type(() => Number) @IsNumber() @IsOptional() destinationLatitude?: number;
  @Type(() => Number) @IsNumber() @IsOptional() destinationLongitude?: number;
  @IsDateString() plannedDeparture!: string;
  @IsDateString() plannedArrival!: string;
  @IsString() @Length(2, 160) responsibleName!: string;
  @IsString() @IsOptional() driverName?: string;
  @IsString() @IsOptional() vehicleId?: string;
  @IsString() @IsOptional() notes?: string;
  @IsEnum(RouteStatus) @IsOptional() status?: RouteStatus;
  @IsArray() @ValidateNested({ each: true }) @Type(() => RouteStopInputDto) @IsOptional() stops?: RouteStopInputDto[];
}

export class UpdateRouteDto {
  @IsString() @Length(2, 160) @IsOptional() name?: string;
  @IsString() @IsOptional() description?: string;
  @IsDateString() @IsOptional() plannedDeparture?: string;
  @IsDateString() @IsOptional() plannedArrival?: string;
  @IsString() @IsOptional() responsibleName?: string;
  @IsString() @IsOptional() driverName?: string;
  @IsString() @IsOptional() vehicleId?: string;
  @IsString() @IsOptional() notes?: string;
  @IsEnum(RouteStatus) @IsOptional() status?: RouteStatus;
  @IsDateString() @IsOptional() actualDeparture?: string;
  @IsDateString() @IsOptional() actualArrival?: string;
}

export class UpdateStopDto {
  @IsEnum(RouteStopStatus) status!: RouteStopStatus;
  @IsDateString() @IsOptional() actualAt?: string;
  @IsString() @IsOptional() notes?: string;
}

export class CreateVehicleDto {
  @IsString() @Length(2, 60) identification!: string;
  @IsString() @Length(7, 10) plate!: string;
  @IsString() @Length(2, 120) model!: string;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() capacity?: number;
  @IsEnum(VehicleStatus) @IsOptional() status?: VehicleStatus;
  @IsString() @IsOptional() driverName?: string;
  @IsString() @IsOptional() responsibleName?: string;
}

export class DeliveryItemInputDto {
  @IsString() @IsOptional() assetId?: string;
  @IsString() @Length(2, 200) description!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) quantity = 1;
  @IsString() @IsOptional() lotCode?: string;
}

export class CreateDeliveryDto {
  @IsString() routeId!: string;
  @IsString() @IsOptional() batchId?: string;
  @IsString() pollingPlaceId!: string;
  @IsString() @IsOptional() receiverName?: string;
  @IsString() @IsOptional() notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => DeliveryItemInputDto) items!: DeliveryItemInputDto[];
}

export class UpdateDeliveryDto {
  @IsEnum(DeliveryStatus) status!: DeliveryStatus;
  @IsString() @IsOptional() receiverName?: string;
  @IsDateString() @IsOptional() deliveredAt?: string;
  @IsString() @IsOptional() notes?: string;
  @IsString() @IsOptional() proofUrl?: string;
  @IsString() @IsOptional() failureReason?: string;
}

export class CreateBatchDto {
  @IsString() routeId!: string;
  @IsString() @Length(2, 60) code!: string;
  @IsString() @IsOptional() description?: string;
}
