import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from "class-validator";
import { CommunicationPriority } from "@prisma/client";

export class CreateCommunicationCategoryDto {
  @IsString() @Length(2, 60) key!: string;
  @IsString() @Length(2, 120) name!: string;
  @IsString() @Length(3, 500) @IsOptional() description?: string;
  @IsString() @Length(4, 20) @IsOptional() color?: string;
}

export class UpdateCommunicationCategoryDto {
  @IsString() @Length(2, 120) @IsOptional() name?: string;
  @IsString() @Length(3, 500) @IsOptional() description?: string;
  @IsString() @Length(4, 20) @IsOptional() color?: string;
  @IsBoolean() @IsOptional() active?: boolean;
}

export class CreateCommunicationTagDto {
  @IsString() @Length(2, 60) label!: string;
}

export class CreateCommunicationTemplateDto {
  @IsString() @Length(3, 120) name!: string;
  @IsString() @Length(3, 500) @IsOptional() description?: string;
  @IsString() @Length(3, 180) defaultTitle!: string;
  @IsString() @Length(3, 8000) body!: string;
  @IsEnum(CommunicationPriority) @IsOptional() priority?: CommunicationPriority;
  @IsString() @IsOptional() categoryId?: string;
}

export class UpdateCommunicationTemplateDto {
  @IsString() @Length(3, 120) @IsOptional() name?: string;
  @IsString() @Length(3, 500) @IsOptional() description?: string;
  @IsString() @Length(3, 180) @IsOptional() defaultTitle?: string;
  @IsString() @Length(3, 8000) @IsOptional() body?: string;
  @IsEnum(CommunicationPriority) @IsOptional() priority?: CommunicationPriority;
  @IsString() @IsOptional() categoryId?: string;
  @IsBoolean() @IsOptional() active?: boolean;
}
