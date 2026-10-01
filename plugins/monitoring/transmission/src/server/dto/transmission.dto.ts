import { Type } from "class-transformer";
import { ConnectivityStatus, TransmissionAlertStatus, TransmissionAttemptResult, TransmissionStatus } from "@prisma/client";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";

export class TransmissionQueryDto {
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() zoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsEnum(TransmissionStatus) @IsOptional() status?: TransmissionStatus;
}

export class CreateTransmissionPointDto {
  @IsString() electionId!: string;
  @IsString() electoralZoneId!: string;
  @IsString() pollingPlaceId!: string;
  @IsString() @Length(2, 80) identification!: string;
  @IsEnum(TransmissionStatus) @IsOptional() status?: TransmissionStatus;
  @IsEnum(ConnectivityStatus) @IsOptional() connectivity?: ConnectivityStatus;
  @IsString() @IsOptional() observations?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(5) priority = 3;
  @IsDateString() @IsOptional() queuedAt?: string;
  @IsDateString() @IsOptional() operationalDeadline?: string;
  @IsString() @IsOptional() connectionMethod?: string;
}

export class UpdateTransmissionPointDto {
  @IsEnum(TransmissionStatus) @IsOptional() status?: TransmissionStatus;
  @IsString() @IsOptional() observations?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(5) @IsOptional() priority?: number;
  @IsDateString() @IsOptional() queuedAt?: string;
  @IsDateString() @IsOptional() operationalDeadline?: string;
}

export class UpdateConnectivityDto {
  @IsEnum(ConnectivityStatus) connectivity!: ConnectivityStatus;
  @Type(() => Number) @IsInt() @Min(0) @IsOptional() latencyMs?: number;
  @IsDateString() @IsOptional() checkedAt?: string;
  @IsString() @IsOptional() connectionMethod?: string;
}

export class RegisterAttemptDto {
  @IsDateString() startedAt!: string;
  @IsDateString() endedAt!: string;
  @IsEnum(TransmissionAttemptResult) result!: TransmissionAttemptResult;
  @IsString() @IsOptional() error?: string;
}

export class UpdateAlertDto {
  @IsEnum(TransmissionAlertStatus) status!: TransmissionAlertStatus;
}
