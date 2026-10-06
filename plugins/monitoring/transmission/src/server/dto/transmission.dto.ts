import { Transform, Type } from "class-transformer";
import { ConnectivityStatus, TransmissionAlertStatus, TransmissionAttemptResult, TransmissionStatus } from "@prisma/client";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min } from "class-validator";

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
  @IsString() @IsOptional() @Length(1, 500) reason?: string;
}

export class RegisterAttemptDto {
  @IsDateString() startedAt!: string;
  @IsDateString() endedAt!: string;
  @IsEnum(TransmissionAttemptResult) result!: TransmissionAttemptResult;
  @IsString() @IsOptional() error?: string;
}

export class UpdateAlertDto {
  @IsEnum(TransmissionAlertStatus) status!: TransmissionAlertStatus;
  @IsString() @IsOptional() @Length(1, 500) notes?: string;
}

export class AlertsQueryDto {
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() zoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsEnum(TransmissionAlertStatus) @IsOptional() status?: TransmissionAlertStatus;
  @Transform(({ value }) => value === true || value === "true" || value === "1") @IsBoolean() @IsOptional() includeResolved?: boolean;
}

export class RetryPointDto {
  @IsString() @IsOptional() @Length(1, 500) reason?: string;
}

export class BulkRetryDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsString({ each: true }) ids!: string[];
  @IsString() @Length(1, 500) reason!: string;
}

export class CreateProviderDto {
  @IsString() @Length(2, 40) code!: string;
  @IsString() @Length(2, 120) name!: string;
  @IsString() @IsOptional() @Length(1, 200) contact?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) @IsOptional() slaTargetUptimePercent?: number;
  @IsString() @IsOptional() @Length(1, 1000) notes?: string;
  @IsBoolean() @IsOptional() active?: boolean;
}

export class UpdateProviderDto {
  @IsString() @IsOptional() @Length(2, 120) name?: string;
  @IsString() @IsOptional() @Length(1, 200) contact?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) @IsOptional() slaTargetUptimePercent?: number;
  @IsString() @IsOptional() @Length(1, 1000) notes?: string;
  @IsBoolean() @IsOptional() active?: boolean;
}

export class ProvidersQueryDto {
  @Transform(({ value }) => value === true || value === "true" || value === "1" ? true : value === false || value === "false" || value === "0" ? false : value)
  @IsBoolean() @IsOptional() active?: boolean;
}

export class CreateCircuitDto {
  @IsString() @Length(2, 60) code!: string;
  @IsString() @Length(2, 120) name!: string;
  @IsString() @IsOptional() @Length(1, 60) technology?: string;
  @Type(() => Number) @IsInt() @Min(0) @IsOptional() bandwidthMbps?: number;
  @IsBoolean() @IsOptional() isPrimary?: boolean;
  @IsEnum(ConnectivityStatus) @IsOptional() status?: ConnectivityStatus;
  @IsString() @IsOptional() providerId?: string;
  @IsString() @IsOptional() @Length(1, 1000) notes?: string;
}

export class UpdateCircuitDto {
  @IsString() @IsOptional() @Length(2, 120) name?: string;
  @IsString() @IsOptional() @Length(1, 60) technology?: string;
  @Type(() => Number) @IsInt() @Min(0) @IsOptional() bandwidthMbps?: number;
  @IsBoolean() @IsOptional() isPrimary?: boolean;
  @IsEnum(ConnectivityStatus) @IsOptional() status?: ConnectivityStatus;
  @IsString() @IsOptional() providerId?: string;
  @IsString() @IsOptional() @Length(1, 1000) notes?: string;
}

export class StartFailoverDto {
  @IsString() @IsOptional() fromCircuitId?: string;
  @IsString() toCircuitId!: string;
  @IsString() @Length(3, 500) reason!: string;
  @IsString() @IsOptional() @Length(1, 1000) notes?: string;
}

export class RecoverFailoverDto {
  @IsEnum(ConnectivityStatus) @IsOptional() connectivity?: ConnectivityStatus;
  @IsString() @IsOptional() @Length(1, 1000) notes?: string;
}

export class CancelFailoverDto {
  @IsString() @IsOptional() @Length(1, 500) reason?: string;
}

export class ConnectivityRecoveryDto {
  @IsEnum(ConnectivityStatus) @IsOptional() connectivity?: ConnectivityStatus;
  @IsString() @IsOptional() @Length(1, 500) reason?: string;
  @IsString() @IsOptional() connectionMethod?: string;
  @Type(() => Number) @IsInt() @Min(0) @IsOptional() latencyMs?: number;
}

export class SlaQueryDto {
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() zoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsDateString() @IsOptional() from?: string;
  @IsDateString() @IsOptional() to?: string;
}

export class StateHistoryQueryDto {
  @IsString() @IsOptional() circuitId?: string;
  @IsDateString() @IsOptional() from?: string;
  @IsDateString() @IsOptional() to?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(200) @IsOptional() limit?: number;
}

export class CorrelationQueryDto {
  @IsString() pointId!: string;
  @IsString() @IsOptional() electionId?: string;
  @IsDateString() @IsOptional() from?: string;
  @IsDateString() @IsOptional() to?: string;
}
