import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
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
  RiskImpact,
  RiskLevel,
  RiskMitigationStatus,
  RiskProbability,
  RiskStatus,
} from "@prisma/client";

export class RiskQueryDto {
  @IsEnum(RiskStatus) @IsOptional() status?: RiskStatus;
  @IsEnum(RiskLevel) @IsOptional() level?: RiskLevel;
  @IsEnum(RiskProbability) @IsOptional() probability?: RiskProbability;
  @IsEnum(RiskImpact) @IsOptional() impact?: RiskImpact;
  @IsString() @IsOptional() categoryId?: string;
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() @IsOptional() ownerId?: string;
  @IsString() @IsOptional() responsibleId?: string;
  @IsDateString() @IsOptional() from?: string;
  @IsDateString() @IsOptional() to?: string;
  /** Riscos sem nenhuma ação de mitigação cadastrada. */
  @Type(() => Boolean) @IsBoolean() @IsOptional() withoutMitigation?: boolean;
  /** Riscos com ao menos uma mitigação de prazo vencido. */
  @Type(() => Boolean) @IsBoolean() @IsOptional() withOverdueMitigation?: boolean;
  /** Filtra pela célula da matriz. */
  @IsEnum(RiskProbability) @IsOptional() matrixProbability?: RiskProbability;
  @IsEnum(RiskImpact) @IsOptional() matrixImpact?: RiskImpact;
  @IsString() @IsOptional() @MaxLength(120) search?: string;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() pageSize = 20;
}

/** Campos de identificação e avaliação, presentes em criação e atualização. */
class RiskCoreFields {
  @IsString() @Length(3, 180) title!: string;
  @IsString() @Length(3, 4000) description!: string;
  @IsString() electionId!: string;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() categoryId!: string;
  @IsString() @Length(2, 160) ownerName!: string;
  @IsString() @Length(2, 160) responsibleName!: string;
  @IsEnum(RiskProbability) probability!: RiskProbability;
  @IsEnum(RiskImpact) impact!: RiskImpact;
}

export class CreateRiskDto extends RiskCoreFields {
  @IsEnum(RiskStatus) @IsOptional() status?: RiskStatus;
  @IsDateString() @IsOptional() identifiedAt?: string;
  @IsDateString() @IsOptional() dueDate?: string;
  @IsString() @Length(3, 2000) @IsOptional() observations?: string;
  /** Mitigações iniciais, criadas junto com o risco. */
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RiskMitigationDto)
  @IsOptional()
  mitigations?: RiskMitigationDto[];
}

export class UpdateRiskDto {
  @IsString() @Length(3, 180) @IsOptional() title?: string;
  @IsString() @Length(3, 4000) @IsOptional() description?: string;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() @IsOptional() categoryId?: string;
  @IsString() @Length(2, 160) @IsOptional() ownerName?: string;
  @IsString() @Length(2, 160) @IsOptional() responsibleName?: string;
  @IsEnum(RiskProbability) @IsOptional() probability?: RiskProbability;
  @IsEnum(RiskImpact) @IsOptional() impact?: RiskImpact;
  @IsEnum(RiskStatus) @IsOptional() status?: RiskStatus;
  @IsDateString() @IsOptional() dueDate?: string;
  @IsString() @Length(3, 2000) @IsOptional() observations?: string;
}

export class RiskMitigationDto {
  @IsString() @Length(3, 2000) description!: string;
  @IsString() @Length(2, 160) responsibleName!: string;
  @IsDateString() @IsOptional() dueDate?: string;
  @IsEnum(RiskMitigationStatus) @IsOptional() status?: RiskMitigationStatus;
  @Type(() => Number) @IsInt() @Min(0) @Max(100) @IsOptional() progress?: number;
  @IsString() @IsOptional() evidenceId?: string;
  @IsString() @Length(2, 200) @IsOptional() evidenceLabel?: string;
  @IsString() @Length(3, 1000) @IsOptional() notes?: string;
}

export class ReplaceRiskMitigationsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RiskMitigationDto)
  mitigations!: RiskMitigationDto[];
}

export class MaterializeRiskDto {
  @IsString() @Length(3, 2000) actualImpact!: string;
  @IsString() @Length(3, 2000) @IsOptional() notes?: string;
  /** Incidente real associado, referenciado por ID. */
  @IsString() @IsOptional() incidentId?: string;
  @IsDateString() @IsOptional() materializedAt?: string;
}

export class CreateRiskCategoryDto {
  @IsString() @Length(2, 60) key!: string;
  @IsString() @Length(2, 120) name!: string;
  @IsString() @Length(3, 500) @IsOptional() description?: string;
  @IsString() @Length(4, 20) @IsOptional() color?: string;
}

export class UpdateRiskCategoryDto {
  @IsString() @Length(2, 120) @IsOptional() name?: string;
  @IsString() @Length(3, 500) @IsOptional() description?: string;
  @IsString() @Length(4, 20) @IsOptional() color?: string;
  @Type(() => Boolean) @IsBoolean() @IsOptional() active?: boolean;
}
