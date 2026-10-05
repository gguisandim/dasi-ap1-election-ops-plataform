import { IsArray, IsBoolean, IsOptional, IsString, Length, MaxLength } from "class-validator";

export class CreateRoleDto {
  @IsString() @Length(2, 120) name!: string;
  @IsString() @MaxLength(500) @IsOptional() description?: string;
  @IsString() @Length(2, 60) @IsOptional() key?: string;
  @IsArray() @IsString({ each: true }) permissionKeys!: string[];
}

export class UpdateRoleDto {
  @IsString() @Length(2, 120) @IsOptional() name?: string;
  @IsString() @MaxLength(500) @IsOptional() description?: string;
  @IsArray() @IsString({ each: true }) @IsOptional() permissionKeys?: string[];
  @IsBoolean() @IsOptional() active?: boolean;
}
