import { CommandCenterLayoutMode } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";

export class SummaryQueryDto {
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() electoralZoneId?: string;
}

export class SnapshotQueryDto extends SummaryQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() pageSize = 20;
}

export class CreateSnapshotDto extends SummaryQueryDto {
  @IsString() @Length(2, 120) name!: string;
  @IsString() @Length(0, 1000) @IsOptional() description?: string;
}

export class CreateSavedViewDto {
  @IsString() @Length(2, 80) name!: string;
  @IsString() @Length(0, 500) @IsOptional() description?: string;
  @IsObject() @IsOptional() filters?: Record<string, unknown>;
  @IsEnum(CommandCenterLayoutMode) @IsOptional() layoutMode?: CommandCenterLayoutMode;
  @Type(() => Number) @IsInt() @Min(15) @Max(300) @IsOptional() refreshSeconds?: number;
  @IsBoolean() @IsOptional() isDefault?: boolean;
  @IsBoolean() @IsOptional() shared?: boolean;
}

export class UpdateSavedViewDto {
  @IsString() @Length(2, 80) @IsOptional() name?: string;
  @IsString() @Length(0, 500) @IsOptional() description?: string;
  @IsObject() @IsOptional() filters?: Record<string, unknown>;
  @IsEnum(CommandCenterLayoutMode) @IsOptional() layoutMode?: CommandCenterLayoutMode;
  @Type(() => Number) @IsInt() @Min(15) @Max(300) @IsOptional() refreshSeconds?: number;
  @IsBoolean() @IsOptional() isDefault?: boolean;
  @IsBoolean() @IsOptional() shared?: boolean;
}
