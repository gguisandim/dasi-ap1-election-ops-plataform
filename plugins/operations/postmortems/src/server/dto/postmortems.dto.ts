import {
  PostmortemActionStatus,
  PostmortemCauseCategory,
  PostmortemCauseType,
  PostmortemLessonType,
  PostmortemReviewDecision,
  PostmortemStatus,
  TaskPriority,
} from "@prisma/client";
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
  Min,
} from "class-validator";

export class PostmortemQueryDto {
  @IsEnum(PostmortemStatus) @IsOptional() status?: PostmortemStatus;
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() incidentId?: string;
  @IsString() @IsOptional() ownerId?: string;
  @IsString() @IsOptional() createdById?: string;
  @IsString() @Length(0, 120) @IsOptional() search?: string;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() pageSize = 20;
}

export class EligibleIncidentQueryDto {
  @IsString() @IsOptional() electionId?: string;
}

export class CreatePostmortemDto {
  @IsString() primaryIncidentId!: string;
  @IsString() @Length(4, 200) title!: string;
  @IsString() @IsOptional() ownerId?: string;
}

export class UpdatePostmortemDto {
  @IsString() @Length(4, 200) @IsOptional() title?: string;
  @IsString() @IsOptional() ownerId?: string;
  @IsString() @Length(0, 8000) @IsOptional() executiveSummary?: string;
  @IsString() @Length(0, 8000) @IsOptional() impactSummary?: string;
  @IsString() @Length(0, 8000) @IsOptional() detectionSummary?: string;
  @IsString() @Length(0, 8000) @IsOptional() responseSummary?: string;
  @IsString() @Length(0, 8000) @IsOptional() resolutionSummary?: string;
  @IsString() @Length(0, 8000) @IsOptional() rootCauseSummary?: string;
  @IsString() @Length(0, 8000) @IsOptional() lessonsSummary?: string;
}

export class CreateCauseDto {
  @IsEnum(PostmortemCauseType) type!: PostmortemCauseType;
  @IsEnum(PostmortemCauseCategory) category!: PostmortemCauseCategory;
  @IsString() @Length(3, 2000) statement!: string;
  @IsString() @Length(0, 4000) @IsOptional() evidence?: string;
  @IsString() @IsOptional() parentId?: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(1000) @IsOptional() order?: number;
}

export class UpdateCauseDto {
  @IsEnum(PostmortemCauseType) @IsOptional() type?: PostmortemCauseType;
  @IsEnum(PostmortemCauseCategory) @IsOptional() category?: PostmortemCauseCategory;
  @IsString() @Length(3, 2000) @IsOptional() statement?: string;
  @IsString() @Length(0, 4000) @IsOptional() evidence?: string;
  @IsString() @IsOptional() parentId?: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(1000) @IsOptional() order?: number;
}

export class CreateLessonDto {
  @IsEnum(PostmortemLessonType) type!: PostmortemLessonType;
  @IsString() @Length(3, 200) title!: string;
  @IsString() @Length(3, 4000) description!: string;
  @IsEnum(PostmortemCauseCategory) @IsOptional() category?: PostmortemCauseCategory;
}

export class UpdateLessonDto {
  @IsEnum(PostmortemLessonType) @IsOptional() type?: PostmortemLessonType;
  @IsString() @Length(3, 200) @IsOptional() title?: string;
  @IsString() @Length(3, 4000) @IsOptional() description?: string;
  @IsEnum(PostmortemCauseCategory) @IsOptional() category?: PostmortemCauseCategory;
}

export class CreateActionDto {
  @IsString() @Length(3, 200) title!: string;
  @IsString() @Length(0, 4000) @IsOptional() description?: string;
  @IsEnum(TaskPriority) @IsOptional() priority?: TaskPriority;
  @IsString() @IsOptional() ownerUserId?: string;
  @IsDateString() @IsOptional() dueAt?: string;
  @IsString() @IsOptional() taskId?: string;
}

export class UpdateActionDto {
  @IsString() @Length(3, 200) @IsOptional() title?: string;
  @IsString() @Length(0, 4000) @IsOptional() description?: string;
  @IsEnum(TaskPriority) @IsOptional() priority?: TaskPriority;
  @IsString() @IsOptional() ownerUserId?: string;
  @IsDateString() @IsOptional() dueAt?: string;
  @IsString() @IsOptional() taskId?: string;
  @IsEnum(PostmortemActionStatus) @IsOptional() status?: PostmortemActionStatus;
}

export class RelatedIncidentDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  incidentIds!: string[];
}

export class ReviewerDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  userIds!: string[];
}

export class TimelineEntryDto {
  @IsDateString() occurredAt!: string;
  @IsString() @Length(3, 200) title!: string;
  @IsString() @Length(0, 4000) @IsOptional() description?: string;
}

export class ImportTimelineDto {
  @IsBoolean() @IsOptional() includeIncidentEvents?: boolean;
  @IsBoolean() @IsOptional() includeTasks?: boolean;
}

export class ReviewDecisionDto {
  @IsEnum(PostmortemReviewDecision) decision!: PostmortemReviewDecision;
  @IsString() @Length(0, 4000) @IsOptional() comment?: string;
}

export class PublishDto {
  @IsBoolean() @IsOptional() createKnowledgeArticle?: boolean;
}
