import { IsArray, IsEmail, IsEnum, IsOptional, IsString, Length } from "class-validator";
import { UserStatus } from "@prisma/client";
export class LoginDto { @IsEmail() email!: string; @IsString() @Length(8, 200) password!: string; }
export class CreateUserDto { @IsString() @Length(2, 160) name!: string; @IsEmail() email!: string; @IsString() @Length(10, 200) password!: string; @IsArray() @IsString({ each: true }) roleIds!: string[]; }
export class UpdateUserDto { @IsString() @Length(2, 160) @IsOptional() name?: string; @IsEnum(UserStatus) @IsOptional() status?: UserStatus; @IsArray() @IsString({ each: true }) @IsOptional() roleIds?: string[]; }
export class AssignUserRolesDto { @IsArray() @IsString({ each: true }) roleIds!: string[]; }
export class UpdateUserStatusDto { @IsEnum(UserStatus) status!: UserStatus; }
