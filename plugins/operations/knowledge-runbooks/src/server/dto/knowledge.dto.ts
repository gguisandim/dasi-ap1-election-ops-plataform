import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import {
  IncidentSeverity,
  KnowledgeArticleKind,
  KnowledgeArticleStatus,
  RunbookUsageOutcome,
} from "@prisma/client";

export class KnowledgeQueryDto {
  @IsEnum(KnowledgeArticleKind) @IsOptional() kind?: KnowledgeArticleKind;
  @IsEnum(KnowledgeArticleStatus) @IsOptional() status?: KnowledgeArticleStatus;
  @IsString() @IsOptional() categoryId?: string;
  @IsString() @IsOptional() tag?: string;
  @IsString() @IsOptional() incidentCategoryKey?: string;
  @IsEnum(IncidentSeverity) @IsOptional() incidentSeverity?: IncidentSeverity;
  /** Restringe a runbooks desatualizados (sem atualização há mais de 180 dias). */
  @Type(() => Boolean) @IsBoolean() @IsOptional() staleOnly?: boolean;
  /** Restringe a publicados sem nenhum uso registrado. */
  @Type(() => Boolean) @IsBoolean() @IsOptional() unusedOnly?: boolean;
  @IsString() @IsOptional() @MaxLength(120) search?: string;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() pageSize = 20;
}

export class RunbookStepDto {
  @Type(() => Number) @IsInt() @Min(1) order!: number;
  @IsString() @Length(3, 160) title!: string;
  @IsString() @Length(3, 2000) instruction!: string;
  @IsString() @Length(2, 500) @IsOptional() expected?: string;
  @Type(() => Boolean) @IsBoolean() @IsOptional() required?: boolean;
  @IsString() @Length(3, 500) @IsOptional() warning?: string;
  @IsString() @Length(3, 1000) @IsOptional() notes?: string;
}

export class CreateKnowledgeArticleDto {
  @IsEnum(KnowledgeArticleKind) @IsOptional() kind?: KnowledgeArticleKind;
  @IsString() @Length(3, 180) title!: string;
  @IsString() @Length(3, 1000) summary!: string;
  @IsString() @Length(3, 20000) @IsOptional() content?: string;
  @IsString() @IsOptional() categoryId?: string;
  @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) @IsOptional() tags?: string[];
  @IsString() @IsOptional() incidentCategoryKey?: string;
  @IsEnum(IncidentSeverity) @IsOptional() incidentSeverity?: IncidentSeverity;
  @IsString() @IsOptional() assetTypeKey?: string;
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @IsOptional() keywords?: string[];
  @IsString() @Length(3, 4000) @IsOptional() problem?: string;
  @IsString() @Length(3, 4000) @IsOptional() symptoms?: string;
  @IsString() @Length(3, 4000) @IsOptional() diagnosis?: string;
  @IsString() @Length(3, 2000) @IsOptional() prerequisites?: string;
  @IsString() @Length(3, 4000) @IsOptional() validation?: string;
  @IsString() @Length(3, 4000) @IsOptional() rollback?: string;
  @IsString() @Length(3, 2000) @IsOptional() escalation?: string;
  @IsString() @Length(3, 2000) @IsOptional() references?: string;
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RunbookStepDto)
  @IsOptional()
  steps?: RunbookStepDto[];
}

export class UpdateKnowledgeArticleDto {
  @IsString() @Length(3, 180) @IsOptional() title?: string;
  @IsString() @Length(3, 1000) @IsOptional() summary?: string;
  @IsString() @Length(3, 20000) @IsOptional() content?: string;
  @IsString() @IsOptional() categoryId?: string;
  @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) @IsOptional() tags?: string[];
  @IsString() @IsOptional() incidentCategoryKey?: string;
  @IsEnum(IncidentSeverity) @IsOptional() incidentSeverity?: IncidentSeverity;
  @IsString() @IsOptional() assetTypeKey?: string;
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @IsOptional() keywords?: string[];
  @IsString() @Length(3, 4000) @IsOptional() problem?: string;
  @IsString() @Length(3, 4000) @IsOptional() symptoms?: string;
  @IsString() @Length(3, 4000) @IsOptional() diagnosis?: string;
  @IsString() @Length(3, 2000) @IsOptional() prerequisites?: string;
  @IsString() @Length(3, 4000) @IsOptional() validation?: string;
  @IsString() @Length(3, 4000) @IsOptional() rollback?: string;
  @IsString() @Length(3, 2000) @IsOptional() escalation?: string;
  @IsString() @Length(3, 2000) @IsOptional() references?: string;
  /** Nota da alteração; obrigatória quando o artigo já não é rascunho. */
  @IsString() @Length(3, 500) @IsOptional() changeNote?: string;
}

export class ReplaceRunbookStepsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RunbookStepDto)
  steps!: RunbookStepDto[];
}

export class RunbookRecommendationQueryDto {
  /** Incidente existente; quando informado, o contexto vem dele. */
  @IsString() @IsOptional() incidentId?: string;
  @IsString() @IsOptional() categoryKey?: string;
  @IsEnum(IncidentSeverity) @IsOptional() severity?: IncidentSeverity;
  @IsString() @IsOptional() assetTypeKey?: string;
  @IsString() @Length(3, 500) @IsOptional() text?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(20) @IsOptional() limit = 5;
}

export class CreateRunbookUsageDto {
  @IsString() @IsOptional() incidentId?: string;
  @IsString() @IsOptional() incidentCode?: string;
  @IsEnum(RunbookUsageOutcome) outcome!: RunbookUsageOutcome;
  @Type(() => Number) @IsInt() @Min(0) @Max(100) @IsOptional() stepsCompleted?: number;
  @IsString() @Length(3, 1000) @IsOptional() notes?: string;
  @IsOptional() @IsString() finishedAt?: string;
}

export class KnowledgeUsageQueryDto {
  @IsString() @IsOptional() articleId?: string;
  @IsString() @IsOptional() incidentId?: string;
  @IsEnum(RunbookUsageOutcome) @IsOptional() outcome?: RunbookUsageOutcome;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() pageSize = 25;
}

export class CreateKnowledgeCategoryDto {
  @IsString() @Length(2, 60) key!: string;
  @IsString() @Length(2, 120) name!: string;
  @IsString() @Length(3, 500) @IsOptional() description?: string;
  @IsString() @Length(4, 20) @IsOptional() color?: string;
}

export class UpdateKnowledgeCategoryDto {
  @IsString() @Length(2, 120) @IsOptional() name?: string;
  @IsString() @Length(3, 500) @IsOptional() description?: string;
  @IsString() @Length(4, 20) @IsOptional() color?: string;
  @Type(() => Boolean) @IsBoolean() @IsOptional() active?: boolean;
}

export class CreateKnowledgeTagDto {
  @IsString() @Length(2, 60) label!: string;
}
