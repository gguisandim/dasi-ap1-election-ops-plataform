import {
  PreparationChecklistItemStatus,
  PreparationChecklistStatus,
  PreparationLocationType,
} from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class PreparationChecklistsQueryDto {
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() @IsOptional() assigneeId?: string;
  @IsEnum(PreparationChecklistStatus) @IsOptional() status?: PreparationChecklistStatus;
}

export class TemplatesQueryDto {
  @Transform(({ value }) => value === "true" ? true : value === "false" ? false : value)
  @IsBoolean() @IsOptional() active?: boolean;
}

export class CreateTemplateItemDto {
  @IsString() @Length(2, 180) title!: string;
  @IsString() @MaxLength(1000) @IsOptional() description?: string;
  @IsInt() @Min(1) @IsOptional() order?: number;
  @IsBoolean() @IsOptional() required?: boolean;
  @IsBoolean() @IsOptional() evidenceRequired?: boolean;
}

export class CreateTemplateDto {
  @IsString() @Length(2, 160) name!: string;
  @IsString() @MaxLength(1000) @IsOptional() description?: string;
  @IsEnum(PreparationLocationType) @IsOptional() locationType?: PreparationLocationType;
  @IsBoolean() @IsOptional() active?: boolean;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateTemplateItemDto) @IsOptional() items?: CreateTemplateItemDto[];
}

export class UpdateTemplateDto {
  @IsString() @Length(2, 160) @IsOptional() name?: string;
  @IsString() @MaxLength(1000) @IsOptional() description?: string;
  @IsBoolean() @IsOptional() active?: boolean;
}

export class CreateChecklistDto {
  @IsString() electionId!: string;
  @IsString() electoralZoneId!: string;
  @IsString() pollingPlaceId!: string;
  @IsString() templateId!: string;
  @IsString() @IsOptional() assigneeId?: string;
}

export class UpdateChecklistAssigneeDto {
  @IsString() @IsOptional() assigneeId?: string | null;
}

export class UpdateChecklistItemDto {
  @IsEnum(PreparationChecklistItemStatus) @IsOptional() status?: PreparationChecklistItemStatus;
  @IsString() @IsOptional() assigneeId?: string;
  @IsString() @MaxLength(2000) @IsOptional() observation?: string;
}

export class CreateChecklistEvidenceDto {
  @IsString() @Length(2, 500) description!: string;
  @IsUrl({ require_protocol: true }) @MaxLength(2048) url!: string;
}

export class AddTemplateItemDto extends CreateTemplateItemDto {
  @IsInt() @Min(1) order!: number;
}