import { FieldShiftAssignmentStatus, FieldShiftStatus } from "@prisma/client";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Length, Min } from "class-validator";

export class ShiftsQueryDto {
  @IsString() @IsOptional() electionId?: string;
  @IsDateString() @IsOptional() startsFrom?: string;
  @IsDateString() @IsOptional() startsTo?: string;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() @IsOptional() teamId?: string;
  @IsString() @IsOptional() memberId?: string;
  @IsEnum(FieldShiftStatus) @IsOptional() status?: FieldShiftStatus;
  @IsEnum(FieldShiftAssignmentStatus) @IsOptional() assignmentStatus?: FieldShiftAssignmentStatus;
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
}

export class UpdateShiftDto {
  @IsString() @Length(2, 160) @IsOptional() name?: string;
  @IsDateString() @IsOptional() startsAt?: string;
  @IsDateString() @IsOptional() endsAt?: string;
  @IsInt() @Min(1) @IsOptional() requiredOperators?: number;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() @IsOptional() notes?: string;
}

export class CreateShiftAssignmentDto {
  @IsString() memberId!: string;
  @IsString() @IsOptional() roleId?: string;
  @IsEnum(FieldShiftAssignmentStatus) @IsOptional() status?: FieldShiftAssignmentStatus;
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
