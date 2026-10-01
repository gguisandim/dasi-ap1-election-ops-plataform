import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";
import { AssetCondition, AssetStatus } from "@prisma/client";

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
