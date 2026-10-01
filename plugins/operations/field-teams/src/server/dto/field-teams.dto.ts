import { FieldAllocationStatus, FieldCheckType, FieldTeamStatus, MemberAvailability } from "@prisma/client";
import { IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsOptional, IsString, Length } from "class-validator";

export class FieldTeamsQueryDto {
  @IsString() @IsOptional() electionId?: string;
  @IsEnum(FieldTeamStatus) @IsOptional() status?: FieldTeamStatus;
  @IsString() @IsOptional() zoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
}
export class CreateTeamDto {
  @IsString() @Length(2, 160) name!: string;
  @IsString() @Length(2, 40) code!: string;
  @IsString() electionId!: string;
  @IsString() @Length(2, 160) responsibleName!: string;
  @IsEnum(FieldTeamStatus) @IsOptional() status?: FieldTeamStatus;
  @IsString() @IsOptional() notes?: string;
}
export class UpdateTeamDto {
  @IsString() @Length(2, 160) @IsOptional() name?: string;
  @IsString() @Length(2, 160) @IsOptional() responsibleName?: string;
  @IsEnum(FieldTeamStatus) @IsOptional() status?: FieldTeamStatus;
  @IsString() @IsOptional() notes?: string;
}
export class CreateRoleDto {
  @IsString() @Length(2, 60) key!: string;
  @IsString() @Length(2, 120) name!: string;
  @IsString() @IsOptional() description?: string;
}
export class CreateSpecialtyDto extends CreateRoleDto {}
export class UpdateCatalogDto {
  @IsString() @Length(2, 120) @IsOptional() name?: string;
  @IsString() @IsOptional() description?: string;
  @IsBoolean() @IsOptional() active?: boolean;
}
export class CreateMemberDto {
  @IsString() teamId!: string;
  @IsString() roleId!: string;
  @IsString() @Length(2, 160) name!: string;
  @IsString() @IsOptional() phone?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsEnum(MemberAvailability) @IsOptional() status?: MemberAvailability;
  @IsArray() @IsString({ each: true }) @IsOptional() specialtyIds?: string[];
}
export class UpdateMemberDto {
  @IsString() @IsOptional() teamId?: string;
  @IsString() @IsOptional() roleId?: string;
  @IsString() @Length(2, 160) @IsOptional() name?: string;
  @IsString() @IsOptional() phone?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsEnum(MemberAvailability) @IsOptional() status?: MemberAvailability;
  @IsArray() @IsString({ each: true }) @IsOptional() specialtyIds?: string[];
}
export class CreateShiftDto {
  @IsString() teamId!: string;
  @IsString() @IsOptional() memberId?: string;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsString() @IsOptional() notes?: string;
}
export class CreateAllocationDto {
  @IsString() electionId!: string;
  @IsString() @IsOptional() teamId?: string;
  @IsString() @IsOptional() memberId?: string;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() @IsOptional() routeId?: string;
  @IsString() @IsOptional() activity?: string;
  @IsDateString() startsAt!: string;
  @IsDateString() @IsOptional() endsAt?: string;
  @IsEnum(FieldAllocationStatus) @IsOptional() status?: FieldAllocationStatus;
  @IsString() @IsOptional() notes?: string;
}
export class CreateCheckDto {
  @IsString() memberId!: string;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsEnum(FieldCheckType) type!: FieldCheckType;
  @IsDateString() @IsOptional() occurredAt?: string;
  @IsString() @IsOptional() notes?: string;
}
