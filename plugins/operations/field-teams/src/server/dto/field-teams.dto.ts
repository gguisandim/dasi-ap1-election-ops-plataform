import {
  FieldAllocationStatus,
  FieldCheckType,
  FieldDispatchStatus,
  FieldTeamStatus,
  MemberAvailability,
  TaskPriority,
} from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from "class-validator";

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
export class AvailabilityQueryDto {
  @IsString() @IsOptional() teamId?: string;
  @IsDateString() @IsOptional() startsAt?: string;
  @IsDateString() @IsOptional() endsAt?: string;
}
export class CreateUnavailabilityDto {
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsString() @Length(2, 160) reason!: string;
  @IsString() @IsOptional() notes?: string;
}
export class UpdateUnavailabilityDto {
  @IsDateString() @IsOptional() startsAt?: string;
  @IsDateString() @IsOptional() endsAt?: string;
  @IsString() @Length(2, 160) @IsOptional() reason?: string;
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
export class DispatchQueryDto {
  @IsEnum(FieldDispatchStatus) @IsOptional() status?: FieldDispatchStatus;
  @IsString() @IsOptional() teamId?: string;
  @IsString() @IsOptional() memberId?: string;
  @IsString() @IsOptional() taskId?: string;
  @IsString() @IsOptional() incidentId?: string;
  @IsEnum(TaskPriority) @IsOptional() priority?: TaskPriority;
  @Transform(({ value }) =>
    value === "true" ? true : value === "false" ? false : value,
  )
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
export class CreateDispatchDto {
  @IsString() teamId!: string;
  @IsString() @IsOptional() memberId?: string;
  @IsString() @IsOptional() taskId?: string;
  @IsString() @IsOptional() incidentId?: string;
  @IsString() @Length(2, 180) @IsOptional() title?: string;
  @IsString() @MaxLength(4000) @IsOptional() notes?: string;
  @IsString() @MaxLength(180) @IsOptional() locationLabel?: string;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsEnum(TaskPriority) @IsOptional() priority?: TaskPriority;
  @IsArray() @IsString({ each: true }) @IsOptional() requiredSpecialtyIds?: string[];
  @IsInt() @Min(1) @IsOptional() requiredTeamSize?: number;
  @IsString() @MaxLength(1000) @IsOptional() capabilityOverrideReason?: string;
}
export class UpdateDispatchStatusDto {
  @IsEnum(FieldDispatchStatus) status!: FieldDispatchStatus;
  @IsString() @Length(3, 1000) @IsOptional() reason?: string;
  @IsString() @Length(3, 2000) @IsOptional() summary?: string;
  @IsString() @MaxLength(1000) @IsOptional() result?: string;
  @IsString() @IsOptional() memberId?: string;
  @IsString() @MaxLength(1000) @IsOptional() notes?: string;
}
