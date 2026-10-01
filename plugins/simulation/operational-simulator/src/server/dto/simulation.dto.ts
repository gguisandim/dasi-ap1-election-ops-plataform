import { FailureProbability } from "@prisma/client";
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Length } from "class-validator";
export class CreateSimulationDto {
  @IsString() @Length(3, 160) name!: string;
  @IsString() electionId!: string;
  @IsString() @IsOptional() scenarioId?: string;
  @IsIn([1, 5, 20, 100]) speed!: number;
  @IsEnum(FailureProbability) probability!: FailureProbability;
  @IsBoolean() connectivity!: boolean; @IsBoolean() equipment!: boolean; @IsBoolean() transmission!: boolean; @IsBoolean() logistics!: boolean;
  @IsBoolean() @IsOptional() applyToOperations?: boolean;
}
export class SimulationSpeedDto { @IsInt() @IsIn([1, 5, 20, 100]) speed!: number; }
