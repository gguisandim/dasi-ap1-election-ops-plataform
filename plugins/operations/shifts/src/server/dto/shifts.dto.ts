import { FieldShiftAssignmentStatus, FieldShiftStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
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
  ValidateNested,
} from "class-validator";

export class SpecialtyRequirementDto {
  @IsString() specialtyId!: string;
  @IsInt() @Min(1) requiredCount!: number;
}

export class ShiftsQueryDto {
  @IsString() @IsOptional() electionId?: string;
  @IsDateString() @IsOptional() startsFrom?: string;
  @IsDateString() @IsOptional() startsTo?: string;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() @IsOptional() teamId?: string;
  @IsString() @IsOptional() memberId?: string;
  @IsEnum(FieldShiftStatus) @IsOptional() status?: FieldShiftStatus;
  @IsEnum(FieldShiftAssignmentStatus)
  @IsOptional()
  assignmentStatus?: FieldShiftAssignmentStatus;
}

export class CreateShiftDto {
  @IsString() electionId!: string;
  @IsString() teamId!: string;
  @IsString() @Length(2, 160) name!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsInt() @Min(1) requiredOperators!: number;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() @IsOptional() notes?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecialtyRequirementDto)
  @IsOptional()
  specialtyRequirements?: SpecialtyRequirementDto[];
}

export class UpdateShiftDto {
  @IsString() @Length(2, 160) @IsOptional() name?: string;
  @IsDateString() @IsOptional() startsAt?: string;
  @IsDateString() @IsOptional() endsAt?: string;
  @IsInt() @Min(1) @IsOptional() requiredOperators?: number;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() @IsOptional() notes?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecialtyRequirementDto)
  @IsOptional()
  specialtyRequirements?: SpecialtyRequirementDto[];
}

export class CreateShiftAssignmentDto {
  @IsString() memberId!: string;
  @IsString() @IsOptional() roleId?: string;
  @IsEnum(FieldShiftAssignmentStatus)
  @IsOptional()
  status?: FieldShiftAssignmentStatus;
  @IsDateString() @IsOptional() startsAt?: string;
  @IsDateString() @IsOptional() endsAt?: string;
  @IsString() @IsOptional() notes?: string;
}

export class RegisterAbsenceDto {
  @IsString() @IsOptional() reason?: string;
  @IsString() @IsOptional() notes?: string;
}

export class ReplaceAssignmentDto {
  @IsString() substituteMemberId!: string;
  @IsString() @IsOptional() roleId?: string;
  @IsString() @IsOptional() reason?: string;
}

export class CreateShiftTemplateDto {
  @IsString() teamId!: string;
  @IsString() @Length(2, 160) name!: string;
  @IsInt() @Min(0) @Max(1439) startMinute!: number;
  @IsInt() @Min(1) durationMinutes!: number;
  @IsInt() @Min(1) requiredOperators!: number;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() @IsOptional() notes?: string;
  @IsBoolean() @IsOptional() active?: boolean;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecialtyRequirementDto)
  @IsOptional()
  specialtyRequirements?: SpecialtyRequirementDto[];
}

export class UpdateShiftTemplateDto {
  @IsString() @Length(2, 160) @IsOptional() name?: string;
  @IsInt() @Min(0) @Max(1439) @IsOptional() startMinute?: number;
  @IsInt() @Min(1) @IsOptional() durationMinutes?: number;
  @IsInt() @Min(1) @IsOptional() requiredOperators?: number;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() @IsOptional() notes?: string;
  @IsBoolean() @IsOptional() active?: boolean;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecialtyRequirementDto)
  @IsOptional()
  specialtyRequirements?: SpecialtyRequirementDto[];
}

export class CreateFromTemplateDto {
  @IsString() templateId!: string;
  @IsDateString() date!: string;
}

export class CopyShiftDto {
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsBoolean() @IsOptional() copyAssignments?: boolean;
}
