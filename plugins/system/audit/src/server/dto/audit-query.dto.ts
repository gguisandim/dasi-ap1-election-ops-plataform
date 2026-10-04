import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { AuditAction } from "@prisma/client";
export class AuditQueryDto {
  @IsString() @IsOptional() actorId?: string;
  @IsEnum(AuditAction) @IsOptional() action?: AuditAction;
  @IsString() @IsOptional() entityType?: string;
  @IsString() @IsOptional() entityId?: string;
  @IsString() @IsOptional() eventName?: string;
  @IsString() @IsOptional() search?: string;
  @IsDateString() @IsOptional() from?: string;
  @IsDateString() @IsOptional() to?: string;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() pageSize = 30;
}
