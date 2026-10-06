import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min } from "class-validator";
import { AssetCondition, AssetMaintenanceStatus, AssetMaintenanceType, AssetReservationStatus, AssetStatus } from "@prisma/client";

export class AssetQueryDto {
  @IsString() @IsOptional() search?: string;
  @IsString() @IsOptional() typeId?: string;
  @IsEnum(AssetStatus) @IsOptional() status?: AssetStatus;
  @IsEnum(AssetCondition) @IsOptional() condition?: AssetCondition;
  @IsString() @IsOptional() zoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() pageSize = 20;
}

export class CreateAssetDto {
  @IsString() @Length(2, 60) assetTag!: string;
  @IsString() @Length(2, 160) name!: string;
  @IsString() typeId!: string;
  @IsString() @Length(2, 120) @IsOptional() serialNumber?: string;
  @IsString() @Length(2, 120) @IsOptional() manufacturer?: string;
  @IsString() @Length(2, 120) @IsOptional() model?: string;
  @IsEnum(AssetStatus) @IsOptional() status?: AssetStatus;
  @IsEnum(AssetCondition) @IsOptional() condition?: AssetCondition;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
}

export class UpdateAssetDto {
  @IsString() @Length(2, 160) @IsOptional() name?: string;
  @IsString() @IsOptional() typeId?: string;
  @IsString() @Length(2, 120) @IsOptional() serialNumber?: string;
  @IsString() @Length(2, 120) @IsOptional() manufacturer?: string;
  @IsString() @Length(2, 120) @IsOptional() model?: string;
  @IsEnum(AssetStatus) @IsOptional() status?: AssetStatus;
  @IsEnum(AssetCondition) @IsOptional() condition?: AssetCondition;
}

export class MoveAssetDto {
  @IsString() @IsOptional() toZoneId?: string;
  @IsString() @IsOptional() toPollingPlaceId?: string;
  @IsString() @IsOptional() responsibleId?: string;
  @IsString() @Length(2, 160) responsibleName!: string;
  @IsString() @Length(3, 500) reason!: string;
  @IsEnum(AssetStatus) @IsOptional() statusAfter?: AssetStatus;
  @IsDateString() @IsOptional() movedAt?: string;
}

export class CreateAssetTypeDto {
  @IsString() @Length(2, 60) key!: string;
  @IsString() @Length(2, 120) name!: string;
  @IsString() @Length(3, 500) @IsOptional() description?: string;
}

export class UpdateAssetTypeDto {
  @IsString() @Length(2, 120) @IsOptional() name?: string;
  @IsString() @Length(3, 500) @IsOptional() description?: string;
  @IsBoolean() @IsOptional() active?: boolean;
}

export class ReservationQueryDto {
  @IsString() @IsOptional() assetId?: string;
  @IsEnum(AssetReservationStatus) @IsOptional() status?: AssetReservationStatus;
  @IsDateString() @IsOptional() from?: string;
  @IsDateString() @IsOptional() to?: string;
}

export class CreateReservationDto {
  @IsString() assetId!: string;
  @IsString() @IsOptional() requesterId?: string;
  @IsString() @Length(2, 160) requesterName!: string;
  @IsString() @Length(3, 500) purpose!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsString() @IsOptional() notes?: string;
}

export class ReservationActionDto {
  @IsString() @Length(3, 500) @IsOptional() notes?: string;
}

export class CheckOutAssetDto {
  @IsString() @IsOptional() reservationId?: string;
  @IsString() @IsOptional() responsibleId?: string;
  @IsString() @Length(2, 160) responsibleName!: string;
  @IsString() @Length(3, 500) purpose!: string;
  @IsString() @Length(2, 200) origin!: string;
  @IsString() @Length(2, 200) destination!: string;
  @IsDateString() @IsOptional() expectedReturnAt?: string;
  @IsEnum(AssetCondition) conditionOut!: AssetCondition;
  @IsString() @IsOptional() notes?: string;
}

export class CheckInAssetDto {
  @IsEnum(AssetCondition) conditionIn!: AssetCondition;
  @IsString() @Length(2, 200) returnedTo!: string;
  @IsString() @IsOptional() receivedById?: string;
  @IsString() @Length(2, 160) receivedByName!: string;
  @IsBoolean() @IsOptional() problemDetected = false;
  @IsString() @IsOptional() notes?: string;
}

export class MaintenanceQueryDto {
  @IsString() @IsOptional() assetId?: string;
  @IsEnum(AssetMaintenanceStatus) @IsOptional() status?: AssetMaintenanceStatus;
  @IsEnum(AssetMaintenanceType) @IsOptional() type?: AssetMaintenanceType;
}

export class CreateMaintenanceDto {
  @IsString() assetId!: string;
  @IsEnum(AssetMaintenanceType) type!: AssetMaintenanceType;
  @IsString() @Length(3, 1000) description!: string;
  @IsString() @Length(2, 160) responsible!: string;
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() cost?: number;
  @IsString() @IsOptional() notes?: string;
}

export class CompleteMaintenanceDto {
  @IsBoolean() returnToService!: boolean;
  @IsString() @Length(3, 1000) result!: string;
  @IsString() @IsOptional() notes?: string;
}

export class MaintenanceActionDto {
  @IsString() @Length(3, 500) @IsOptional() notes?: string;
}
