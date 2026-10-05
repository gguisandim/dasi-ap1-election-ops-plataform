import { TaskExecutionMode, TaskPriority, TaskStatus } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
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
  @IsString() @IsOptional() labelId?: string;
  @IsString() @IsOptional() milestoneId?: string;
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
  @IsString() @IsOptional() parentId?: string;
  @IsEnum(TaskPriority) @IsOptional() priority?: TaskPriority;
  @IsEnum(TaskExecutionMode) @IsOptional() executionMode?: TaskExecutionMode;
  @IsInt() @Min(1) @IsOptional() requiredTeamSize?: number | null;
  @IsArray() @IsString({ each: true }) @IsOptional() requiredSpecialtyIds?: string[];
  @IsDateString() @IsOptional() dueAt?: string;
}

/** Subtarefa herda pleito do pai; zona/local são opcionais e herdados quando omitidos. */
export class CreateSubtaskDto {
  @IsString() @Length(2, 180) title!: string;
  @IsString() @MaxLength(5000) @IsOptional() description?: string;
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
  @IsArray() @IsString({ each: true }) @IsOptional() labelIds?: string[];
  @IsString() @IsOptional() milestoneId?: string | null;
}

export class CreateTaskCommentDto {
  @IsString() @Length(1, 4000) content!: string;
}

export class CreateTaskDependencyDto {
  @IsString() dependsOnId!: string;
}

export class CreateChecklistItemDto {
  @IsString() @Length(1, 240) title!: string;
  @IsInt() @Min(0) @IsOptional() order?: number;
}

export class UpdateChecklistItemDto {
  @IsString() @Length(1, 240) @IsOptional() title?: string;
  @IsBoolean() @IsOptional() done?: boolean;
  @IsInt() @Min(0) @IsOptional() order?: number;
}

export class CreateTaskLabelDto {
  @IsString() @Length(1, 60) name!: string;
}

export class CreateMilestoneDto {
  @IsString() electionId!: string;
  @IsString() @Length(2, 140) name!: string;
  @IsString() @MaxLength(1000) @IsOptional() description?: string;
  @IsDateString() @IsOptional() dueAt?: string;
}

export class UpdateMilestoneDto {
  @IsString() @Length(2, 140) @IsOptional() name?: string;
  @IsString() @MaxLength(1000) @IsOptional() description?: string | null;
  @IsDateString() @IsOptional() dueAt?: string | null;
}

export class CreateSavedFilterDto {
  @IsString() @Length(1, 80) name!: string;
  @IsObject() filters!: Record<string, unknown>;
}

export class BulkUpdateTasksDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsString({ each: true }) ids!: string[];
  @IsEnum(TaskStatus) @IsOptional() status?: TaskStatus;
  @IsEnum(TaskPriority) @IsOptional() priority?: TaskPriority;
  @IsString() @IsOptional() assigneeId?: string | null;
  @IsArray() @IsString({ each: true }) @IsOptional() addLabelIds?: string[];
  @IsArray() @IsString({ each: true }) @IsOptional() removeLabelIds?: string[];
}
