import { MonitoringStatus, ResourceStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";

export class CreatePollingPlaceDto {
  @IsString() electoralZoneId!: string;
  @IsString() @Length(3, 180) name!: string;
  @IsString() @Length(3, 240) address!: string;
  @IsString() @Length(2, 120) district!: string;
  @IsString() @Length(2, 120) city!: string;
  @IsString() @Length(2, 2) state!: string;
  @IsNumber() @Min(-90) @Max(90) @IsOptional() latitude?: number;
  @IsNumber() @Min(-180) @Max(180) @IsOptional() longitude?: number;
  @IsEnum(ResourceStatus) @IsOptional() status?: ResourceStatus;
  @IsEnum(MonitoringStatus) @IsOptional() monitoringStatus?: MonitoringStatus;
}

export class UpdatePollingPlaceDto {
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @Length(3, 180) @IsOptional() name?: string;
  @IsString() @Length(3, 240) @IsOptional() address?: string;
  @IsString() @Length(2, 120) @IsOptional() district?: string;
  @IsString() @Length(2, 120) @IsOptional() city?: string;
  @IsString() @Length(2, 2) @IsOptional() state?: string;
  @IsNumber() @Min(-90) @Max(90) @IsOptional() latitude?: number;
  @IsNumber() @Min(-180) @Max(180) @IsOptional() longitude?: number;
  @IsEnum(ResourceStatus) @IsOptional() status?: ResourceStatus;
  @IsEnum(MonitoringStatus) @IsOptional() monitoringStatus?: MonitoringStatus;
}

export class PollingPlaceQueryDto {
  @IsString() @IsOptional() search?: string;
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() zoneId?: string;
  @IsString() @IsOptional() municipality?: string;
  @IsEnum(MonitoringStatus) @IsOptional() status?: MonitoringStatus;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() pageSize = 12;
}
