import { ShiftHandoverStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";

export class HandoverQueryDto {
  @IsString() @IsOptional() shiftId?: string;
  @IsEnum(ShiftHandoverStatus) @IsOptional() status?: ShiftHandoverStatus;
  @IsString() @IsOptional() senderUserId?: string;
  @IsString() @IsOptional() recipientUserId?: string;
  @IsString() @IsOptional() electionId?: string;
  @IsDateString() @IsOptional() from?: string;
  @IsDateString() @IsOptional() to?: string;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() pageSize = 20;
}

export class HandoverContextQueryDto {
  @IsString() shiftId!: string;
}

export class CreateHandoverDto {
  @IsString() shiftId!: string;
  @IsString() recipientUserId!: string;
  @IsString() @Length(0, 8000) summary = "";
  @IsString() @IsOptional() pendingNotes?: string;
  @IsString() @IsOptional() observations?: string;
  @IsArray() @IsString({ each: true }) @IsOptional() incidentIds?: string[];
  @IsArray() @IsString({ each: true }) @IsOptional() taskIds?: string[];
  @IsArray() @IsString({ each: true }) @IsOptional() assetIds?: string[];
}

export class UpdateHandoverDto {
  @IsString() @IsOptional() recipientUserId?: string;
  @IsString() @Length(0, 8000) @IsOptional() summary?: string;
  @IsString() @IsOptional() pendingNotes?: string;
  @IsString() @IsOptional() observations?: string;
  @IsArray() @IsString({ each: true }) @IsOptional() incidentIds?: string[];
  @IsArray() @IsString({ each: true }) @IsOptional() taskIds?: string[];
  @IsArray() @IsString({ each: true }) @IsOptional() assetIds?: string[];
}

export class CancelHandoverDto {
  @IsString() @IsOptional() reason?: string;
}
