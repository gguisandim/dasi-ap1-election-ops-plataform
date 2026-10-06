import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { AuditAction, AuditEventSeverity } from "@prisma/client";

export class AuditQueryDto {
  @IsDateString() from!: string;
  @IsDateString() to!: string;
  @IsString() @IsOptional() actorId?: string;
  @IsEnum(AuditAction) @IsOptional() action?: AuditAction;
  @IsString() @IsOptional() entityType?: string;
  @IsString() @IsOptional() entityId?: string;
  @IsString() @IsOptional() eventName?: string;
  @IsString() @IsOptional() category?: string;
  @IsEnum(AuditEventSeverity) @IsOptional() severity?: AuditEventSeverity;
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() correlationId?: string;
  @IsString() @IsOptional() search?: string;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() pageSize = 30;
}
