import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
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
import { EvidenceLinkType, EvidenceStatus, EvidenceType } from "@prisma/client";

/** `"a, b"` ou `["a","b"]` → `["a","b"]`; usado tanto em JSON quanto em multipart. */
const toArray = ({ value }: { value: unknown }): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim() !== "") {
    return value.split(",").map((item) => item.trim());
  }
  return [];
};

export class EvidenceQueryDto {
  @IsEnum(EvidenceType) @IsOptional() type?: EvidenceType;
  @IsEnum(EvidenceStatus) @IsOptional() status?: EvidenceStatus;
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() authorId?: string;
  @IsString() @IsOptional() tag?: string;
  @IsEnum(EvidenceLinkType) @IsOptional() linkType?: EvidenceLinkType;
  @IsString() @IsOptional() linkTargetId?: string;
  @IsDateString() @IsOptional() from?: string;
  @IsDateString() @IsOptional() to?: string;
  /** Restringe a evidências sem nenhum vínculo operacional. */
  @Transform(({ value }) => value === true || value === "true")
  @IsOptional() withoutLinks?: boolean;
  @IsString() @IsOptional() @MaxLength(120) search?: string;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() pageSize = 20;
}

/** Campos comuns de texto, presentes em criação e atualização. */
class EvidenceMetadataFields {
  @IsString() @Length(3, 180) title!: string;
  @IsString() @Length(3, 4000) @IsOptional() description?: string;
  @IsEnum(EvidenceType) type!: EvidenceType;
  @IsString() @IsOptional() electionId?: string;
  @IsString() @Length(2, 160) @IsOptional() origin?: string;
  @IsString() @Length(3, 2000) @IsOptional() observations?: string;
  @IsDateString() @IsOptional() capturedAt?: string;
}

/**
 * Criação via multipart/form-data: os campos chegam como texto, então os arrays
 * são parseados por `Transform`. O arquivo vem pelo `FileInterceptor`.
 */
export class CreateEvidenceDto extends EvidenceMetadataFields {
  @Transform(toArray) @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) @IsOptional() tags?: string[];

  /** IDs de `Relationship` enviados como `linkType:targetId` separados por vírgula. */
  @Transform(toArray) @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @IsOptional() links?: string[];
}

export class UpdateEvidenceDto {
  @IsString() @Length(3, 180) @IsOptional() title?: string;
  @IsString() @Length(3, 4000) @IsOptional() description?: string;
  @IsEnum(EvidenceType) @IsOptional() type?: EvidenceType;
  @IsString() @IsOptional() electionId?: string;
  @IsString() @Length(2, 160) @IsOptional() origin?: string;
  @IsString() @Length(3, 2000) @IsOptional() observations?: string;
  @IsDateString() @IsOptional() capturedAt?: string;
  @Transform(toArray) @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) @IsOptional() tags?: string[];
}

export class AddEvidenceVersionDto {
  @IsString() @Length(3, 500) reason!: string;
  @IsString() @Length(3, 1000) @IsOptional() description?: string;
}

/** Corpo JSON aceito por `PUT /evidence/:id/links`. */
export class EvidenceLinkDto {
  @IsEnum(EvidenceLinkType) type!: EvidenceLinkType;
  @IsString() @Length(1, 120) targetId!: string;
  @IsString() @Length(3, 400) @IsOptional() notes?: string;
}

export class ReplaceEvidenceLinksDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => EvidenceLinkDto)
  links!: EvidenceLinkDto[];
}

export class CreateEvidenceTagDto {
  @IsString() @Length(2, 60) label!: string;
}
