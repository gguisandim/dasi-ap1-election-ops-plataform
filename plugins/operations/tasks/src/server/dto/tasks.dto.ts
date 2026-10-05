import { TaskExecutionMode, TaskPriority, TaskStatus } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from "class-validator";

export class TasksQueryDto {
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() @IsOptional() assigneeId?: string;
  @IsEnum(TaskStatus) @IsOptional() status?: TaskStatus;
  @IsEnum(TaskPriority) @IsOptional() priority?: TaskPriority;
  @IsEnum(TaskExecutionMode) @IsOptional() executionMode?: TaskExecutionMode;
  @Transform(({ value }) => value === "true" ? true : value === "false" ? false : value)
  @IsBoolean() @IsOptional() overdue?: boolean;
  @IsString() @MaxLength(160) @IsOptional() search?: string;
}

export class CreateTaskDto {
  @IsString() @Length(2, 180) title!: string;
  @IsString() @MaxLength(5000) @IsOptional() description?: string;
  @IsString() electionId!: string;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() @IsOptional() assigneeId?: string;
  @IsEnum(TaskPriority) @IsOptional() priority?: TaskPriority;
  @IsEnum(TaskExecutionMode) @IsOptional() executionMode?: TaskExecutionMode;
  @IsInt() @Min(1) @IsOptional() requiredTeamSize?: number | null;
  @IsArray() @IsString({ each: true }) @IsOptional() requiredSpecialtyIds?: string[];
  @IsDateString() @IsOptional() dueAt?: string;
}

export class UpdateTaskDto {
  @IsString() @Length(2, 180) @IsOptional() title?: string;
  @IsString() @MaxLength(5000) @IsOptional() description?: string | null;
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() electoralZoneId?: string | null;
  @IsString() @IsOptional() pollingPlaceId?: string | null;
  @IsString() @IsOptional() assigneeId?: string | null;
  @IsEnum(TaskPriority) @IsOptional() priority?: TaskPriority;
  @IsEnum(TaskStatus) @IsOptional() status?: TaskStatus;
  @IsEnum(TaskExecutionMode) @IsOptional() executionMode?: TaskExecutionMode;
  @IsInt() @Min(1) @IsOptional() requiredTeamSize?: number | null;
  @IsArray() @IsString({ each: true }) @IsOptional() requiredSpecialtyIds?: string[];
  @IsDateString() @IsOptional() dueAt?: string | null;
}

export class CreateTaskCommentDto {
  @IsString() @Length(1, 4000) content!: string;
}

export class CreateTaskDependencyDto {
  @IsString() dependsOnId!: string;
}