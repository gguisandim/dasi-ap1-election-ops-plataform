import { FailureProbability, IncidentSeverity, SimulationDecisionKind, SimulationScenarioEventType, SimulationTargetType } from "@prisma/client";
import { SIMULATION_SPEEDS } from "@eops/shared/simulation";
import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, Length, Max, Min, ValidateNested } from "class-validator";

const SPEED_MESSAGE = `A velocidade deve ser uma das opções: ${SIMULATION_SPEEDS.join(", ")}.`;

export class CreateSimulationDto {
  @IsString() @Length(3, 160) name!: string;
  @IsString() electionId!: string;
  @IsString() @IsOptional() scenarioId?: string;
  @IsIn(SIMULATION_SPEEDS, { message: SPEED_MESSAGE }) speed!: number;
  @IsEnum(FailureProbability) probability!: FailureProbability;
  @IsBoolean() connectivity!: boolean; @IsBoolean() equipment!: boolean; @IsBoolean() transmission!: boolean; @IsBoolean() logistics!: boolean;
  @IsBoolean() @IsOptional() applyToOperations?: boolean;
}
export class SimulationSpeedDto { @IsInt() @IsIn(SIMULATION_SPEEDS, { message: SPEED_MESSAGE }) speed!: number; }

export class FailSimulationDto {
  @IsString({ message: "Informe o motivo da falha." }) @Length(3, 600) reason!: string;
}

export class RecordDecisionDto {
  @IsEnum(SimulationDecisionKind, { message: "Tipo de decisão inválido." }) kind!: SimulationDecisionKind;
  @IsString({ message: "A justificativa é obrigatória." }) @Length(3, 2000, { message: "A justificativa é obrigatória." }) rationale!: string;
  @IsOptional() @IsInt() @Min(0) offsetSeconds?: number;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
}

export class CompareSimulationsDto {
  @IsArray() @ArrayMinSize(2, { message: "Compare entre 2 e 6 execuções." }) @ArrayMaxSize(6, { message: "Compare entre 2 e 6 execuções." }) @IsString({ each: true }) simulationIds!: string[];
}

export class SimulationScenarioEventInputDto {
  @IsInt({ message: "O deslocamento (offsetSeconds) deve ser um número inteiro." }) @Min(0, { message: "O deslocamento (offsetSeconds) deve ser maior ou igual a zero." }) offsetSeconds!: number;
  @IsEnum(SimulationScenarioEventType, { message: "Tipo de evento de cenário inválido." }) type!: SimulationScenarioEventType;
  @IsOptional() @IsEnum(IncidentSeverity) severity?: IncidentSeverity;
  @IsOptional() @IsEnum(SimulationTargetType) targetType?: SimulationTargetType;
  @IsOptional() @IsString() targetId?: string;
  @IsInt({ message: "A probabilidade deve ser um número inteiro." }) @Min(0, { message: "A probabilidade deve estar entre 0 e 100." }) @Max(100, { message: "A probabilidade deve estar entre 0 e 100." }) probability!: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() @Length(0, 300) impact?: string;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
}

export class UpdateScenarioEventDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() @Length(0, 300) impact?: string;
}

export class CreateSimulationScenarioDto {
  @IsString() @Length(3, 160, { message: "O nome do cenário deve ter entre 3 e 160 caracteres." }) name!: string;
  @IsOptional() @IsString() @Length(0, 600) description?: string;
  @IsOptional() @IsString() electionId?: string;
  @IsOptional() @IsBoolean() isTemplate?: boolean;
  @IsOptional() @IsInt() @Min(0) seed?: number;
  @IsOptional() @IsInt() @Min(0) durationSeconds?: number;
  @IsOptional() @IsIn(SIMULATION_SPEEDS, { message: SPEED_MESSAGE }) speed?: number;
  @IsOptional() @IsArray() objectives?: unknown[];
  @IsOptional() @IsArray() successCriteria?: unknown[];
  @IsOptional() @IsArray() failureCriteria?: unknown[];
  @IsOptional() @IsObject() scoreWeights?: Record<string, unknown>;
  @IsOptional() @IsObject() initialConditions?: Record<string, unknown>;
  @IsOptional() @IsObject() configuration?: Record<string, unknown>;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SimulationScenarioEventInputDto) events?: SimulationScenarioEventInputDto[];
}

export class UpdateSimulationScenarioDto {
  @IsOptional() @IsString() @Length(3, 160, { message: "O nome do cenário deve ter entre 3 e 160 caracteres." }) name?: string;
  @IsOptional() @IsString() @Length(0, 600) description?: string;
  @IsOptional() @IsString() electionId?: string;
  @IsOptional() @IsBoolean() isTemplate?: boolean;
  @IsOptional() @IsInt() @Min(0) seed?: number;
  @IsOptional() @IsInt() @Min(0) durationSeconds?: number;
  @IsOptional() @IsIn(SIMULATION_SPEEDS, { message: SPEED_MESSAGE }) speed?: number;
  @IsOptional() @IsArray() objectives?: unknown[];
  @IsOptional() @IsArray() successCriteria?: unknown[];
  @IsOptional() @IsArray() failureCriteria?: unknown[];
  @IsOptional() @IsObject() scoreWeights?: Record<string, unknown>;
  @IsOptional() @IsObject() initialConditions?: Record<string, unknown>;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CloneSimulationScenarioDto {
  @IsOptional() @IsString() @Length(3, 160) name?: string;
  @IsOptional() @IsString() electionId?: string;
  @IsOptional() @IsBoolean() isTemplate?: boolean;
}
