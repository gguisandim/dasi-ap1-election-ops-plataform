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
  CommunicationDeliveryStatus,
  CommunicationPriority,
  CommunicationStatus,
} from "@prisma/client";
import { CommunicationAudienceDto } from "./communication-audience.dto";

export class CommunicationQueryDto {
  @IsEnum(CommunicationStatus) @IsOptional() status?: CommunicationStatus;
  @IsEnum(CommunicationPriority) @IsOptional() priority?: CommunicationPriority;
  @IsString() @IsOptional() categoryId?: string;
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() tag?: string;
  @IsString() @IsOptional() authorId?: string;
  @IsDateString() @IsOptional() from?: string;
  @IsDateString() @IsOptional() to?: string;
  /** Restringe a comunicados com prioridade HIGH ou CRITICAL. */
  @Type(() => Boolean) @IsBoolean() @IsOptional() urgentOnly?: boolean;
  @IsString() @IsOptional() @MaxLength(120) search?: string;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() pageSize = 20;
}

export class CreateCommunicationDto {
  @IsString() @Length(3, 180) title!: string;
  @IsString() @Length(3, 8000) content!: string;
  @IsEnum(CommunicationPriority) @IsOptional() priority?: CommunicationPriority;
  @IsString() electionId!: string;
  @IsString() @IsOptional() categoryId?: string;
  @IsString() @Length(3, 2000) @IsOptional() observations?: string;
  @IsDateString() @IsOptional() expiresAt?: string;
  @IsDateString() @IsOptional() scheduledAt?: string;
  @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) @IsOptional() tags?: string[];
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CommunicationAudienceDto)
  @IsOptional()
  audiences?: CommunicationAudienceDto[];
  /** Publica imediatamente após criar. Requer `communications.publish`. */
  @Type(() => Boolean) @IsBoolean() @IsOptional() publish?: boolean;
}

export class UpdateCommunicationDto {
  @IsString() @Length(3, 180) @IsOptional() title?: string;
  @IsString() @Length(3, 8000) @IsOptional() content?: string;
  @IsEnum(CommunicationPriority) @IsOptional() priority?: CommunicationPriority;
  @IsString() @IsOptional() categoryId?: string;
  @IsString() @Length(3, 2000) @IsOptional() observations?: string;
  @IsDateString() @IsOptional() expiresAt?: string;
  @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) @IsOptional() tags?: string[];
}

export class ScheduleCommunicationDto {
  @IsDateString() scheduledAt!: string;
  @IsString() @Length(3, 500) @IsOptional() reason?: string;
}

export class CancelCommunicationDto {
  @IsString() @Length(3, 500) @IsOptional() reason?: string;
}

export class PublishCommunicationDto {
  @IsString() @Length(3, 500) @IsOptional() note?: string;
}

export class CommunicationRecipientQueryDto {
  @IsEnum(CommunicationDeliveryStatus) @IsOptional() deliveryStatus?: CommunicationDeliveryStatus;
  @IsString() @IsOptional() audienceId?: string;
  @IsString() @IsOptional() @MaxLength(120) search?: string;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() pageSize = 25;
}

export class ConfirmRecipientDto {
  @IsString() @Length(3, 500) @IsOptional() note?: string;
}
