import { FailureProbability, IncidentSeverity, SimulationScenarioEventType, SimulationTargetType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, Length, Max, Min, ValidateNested } from "class-validator";

export const SIMULATION_SPEEDS = [1, 2, 5, 10, 20, 100];
const SPEED_MESSAGE = "A velocidade deve ser uma das opções: 1, 2, 5, 10, 20 ou 100.";

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

export class SimulationScenarioEventInputDto {
  @IsInt({ message: "O deslocamento (offsetSeconds) deve ser um número inteiro." }) @Min(0, { message: "O deslocamento (offsetSeconds) deve ser maior ou igual a zero." }) offsetSeconds!: number;
  @IsEnum(SimulationScenarioEventType, { message: "Tipo de evento de cenário inválido." }) type!: SimulationScenarioEventType;
  @IsOptional() @IsEnum(IncidentSeverity) severity?: IncidentSeverity;
  @IsOptional() @IsEnum(SimulationTargetType) targetType?: SimulationTargetType;
  @IsOptional() @IsString() targetId?: string;
  @IsInt({ message: "A probabilidade deve ser um número inteiro." }) @Min(0, { message: "A probabilidade deve estar entre 0 e 100." }) @Max(100, { message: "A probabilidade deve estar entre 0 e 100." }) probability!: number;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
}

export class CreateSimulationScenarioDto {
  @IsString() @Length(3, 160, { message: "O nome do cenário deve ter entre 3 e 160 caracteres." }) name!: string;
  @IsOptional() @IsString() @Length(0, 600) description?: string;
  @IsOptional() @IsInt() @Min(0) seed?: number;
  @IsOptional() @IsInt() @Min(0) durationSeconds?: number;
  @IsOptional() @IsObject() configuration?: Record<string, unknown>;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SimulationScenarioEventInputDto) events?: SimulationScenarioEventInputDto[];
}

export class UpdateSimulationScenarioDto {
  @IsOptional() @IsString() @Length(3, 160, { message: "O nome do cenário deve ter entre 3 e 160 caracteres." }) name?: string;
  @IsOptional() @IsString() @Length(0, 600) description?: string;
  @IsOptional() @IsInt() @Min(0) seed?: number;
  @IsOptional() @IsInt() @Min(0) durationSeconds?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
