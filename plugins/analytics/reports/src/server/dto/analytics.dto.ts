import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";
import {
  REPORT_DRILLDOWN_DEFAULT_LIMIT,
  REPORT_DRILLDOWN_MAX_LIMIT,
  REPORT_GRANULARITIES,
  REPORT_METRICS,
} from "@eops/shared/reports";
import { ReportQueryDto, parseBoolean } from "./report-query.dto";

/** Série temporal (SPEC 2.2). from/to obrigatórios; métrica do vocabulário. */
export class TimeseriesQueryDto {
  @IsString() @IsIn(REPORT_METRICS) metric!: string;
  @IsString() @IsIn(REPORT_GRANULARITIES) @IsOptional() granularity?: string;
  @IsDateString() from!: string;
  @IsDateString() to!: string;
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @Transform(({ value }) => parseBoolean(value)) @IsBoolean() @IsOptional() includeSimulated?: boolean;
}

/** SLA Analytics (SPEC 2.4). Janela opcional; padrão = últimos 30 dias. */
export class SlaQueryDto {
  @IsDateString() @IsOptional() from?: string;
  @IsDateString() @IsOptional() to?: string;
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @Transform(({ value }) => parseBoolean(value)) @IsBoolean() @IsOptional() includeSimulated?: boolean;
}

/** Comparação de zonas (SPEC 2.5). metrics = lista separada por vírgula. */
export class ZonesQueryDto {
  @IsString() @IsOptional() electionId?: string;
  @IsDateString() @IsOptional() from?: string;
  @IsDateString() @IsOptional() to?: string;
  @IsString() @IsOptional() metrics?: string;
  @Transform(({ value }) => parseBoolean(value)) @IsBoolean() @IsOptional() includeSimulated?: boolean;
}

/** Drill-down das entidades do bucket (SPEC 2.6). */
export class DrilldownQueryDto {
  @IsString() @IsIn(REPORT_METRICS) metric!: string;
  @IsDateString() from!: string;
  @IsDateString() to!: string;
  @IsDateString() bucketStart!: string;
  @IsDateString() bucketEnd!: string;
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() zoneId?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(REPORT_DRILLDOWN_MAX_LIMIT) @IsOptional()
  limit: number = REPORT_DRILLDOWN_DEFAULT_LIMIT;
  @Transform(({ value }) => parseBoolean(value)) @IsBoolean() @IsOptional() includeSimulated?: boolean;
}

/** Export JSON estruturado (SPEC 2.8). */
export class ExportJsonQueryDto extends ReportQueryDto {
  @IsString() @IsOptional() metrics?: string;
}

/** Saved analytics views (SPEC 2.7). */
export class CreateReportViewDto {
  @IsString() @Length(2, 80) name!: string;
  @IsString() @Length(0, 500) @IsOptional() description?: string;
  @IsObject() @IsOptional() filters?: Record<string, unknown>;
  @IsArray() @IsIn(REPORT_METRICS, { each: true }) @IsOptional() metricsJson?: string[];
  @IsString() @IsIn(REPORT_GRANULARITIES) @IsOptional() granularity?: string;
  @Transform(({ value }) => parseBoolean(value)) @IsBoolean() @IsOptional() isDefault?: boolean;
  @Transform(({ value }) => parseBoolean(value)) @IsBoolean() @IsOptional() shared?: boolean;
}

export class UpdateReportViewDto {
  @IsString() @Length(2, 80) @IsOptional() name?: string;
  @IsString() @Length(0, 500) @IsOptional() description?: string;
  @IsObject() @IsOptional() filters?: Record<string, unknown>;
  @IsArray() @IsIn(REPORT_METRICS, { each: true }) @IsOptional() metricsJson?: string[];
  @IsString() @IsIn(REPORT_GRANULARITIES) @IsOptional() granularity?: string;
  @Transform(({ value }) => parseBoolean(value)) @IsBoolean() @IsOptional() isDefault?: boolean;
  @Transform(({ value }) => parseBoolean(value)) @IsBoolean() @IsOptional() shared?: boolean;
}
