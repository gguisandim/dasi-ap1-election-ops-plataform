import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";
import { IncidentSeverity, IncidentStatus } from "@prisma/client";

export class IncidentQueryDto {
  @IsEnum(IncidentStatus) @IsOptional() status?: IncidentStatus;
  @IsEnum(IncidentSeverity) @IsOptional() severity?: IncidentSeverity;
  @IsString() @IsOptional() categoryId?: string;
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() zoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() @IsOptional() assignedToId?: string;
  @IsDateString() @IsOptional() from?: string;
  @IsDateString() @IsOptional() to?: string;
  @IsString() @IsOptional() search?: string;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() pageSize = 20;
}

export class CreateIncidentDto {
  @IsString() @Length(3, 180) title!: string;
  @IsString() @Length(3, 4000) description!: string;
  @IsEnum(IncidentSeverity) severity!: IncidentSeverity;
  @IsString() electionId!: string;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() categoryId!: string;
  @IsString() @IsOptional() assetId?: string;
  @IsDateString() @IsOptional() slaDeadline?: string;
}

export class UpdateIncidentDto {
  @IsString() @Length(3, 180) @IsOptional() title?: string;
  @IsString() @Length(3, 4000) @IsOptional() description?: string;
  @IsEnum(IncidentSeverity) @IsOptional() severity?: IncidentSeverity;
  @IsString() @IsOptional() categoryId?: string;
  @IsString() @IsOptional() assetId?: string;
  @IsDateString() @IsOptional() slaDeadline?: string;
}

export class ChangeIncidentStatusDto {
  @IsEnum(IncidentStatus) status!: IncidentStatus;
  @IsString() @Length(3, 500) @IsOptional() comment?: string;
}

export class IncidentActionDto {
  @IsString() @Length(3, 500) @IsOptional() reason?: string;
}

export class EscalateIncidentDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(3) level!: number;
  @IsString() @Length(3, 500) reason!: string;
}

export class AssignIncidentDto {
  @IsString() @IsOptional() assignedToId?: string;
  @IsString() @Length(2, 160) assignedToName!: string;
  @IsString() @Length(3, 500) @IsOptional() reason?: string;
}

export class AddIncidentCommentDto {
  @IsString() @Length(1, 2000) message!: string;
}

export class CreateIncidentCategoryDto {
  @IsString() @Length(2, 60) key!: string;
  @IsString() @Length(2, 120) name!: string;
  @IsString() @Length(3, 500) @IsOptional() description?: string;
}

export class UpdateIncidentCategoryDto {
  @IsString() @Length(2, 120) @IsOptional() name?: string;
  @IsString() @Length(3, 500) @IsOptional() description?: string;
  @IsBoolean() @IsOptional() active?: boolean;
}
