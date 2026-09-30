import { ResourceStatus } from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";

export class CreateElectoralZoneDto {
  @IsString() electionId!: string;
  @IsInt() @Min(1) @Max(9999) number!: number;
  @IsString() @Length(3, 160) name!: string;
  @IsString() @Length(2, 120) municipality!: string;
  @IsString() @Length(2, 2) state!: string;
  @IsEnum(ResourceStatus) @IsOptional() status?: ResourceStatus;
}

export class UpdateElectoralZoneDto {
  @IsString() @IsOptional() electionId?: string;
  @IsInt() @Min(1) @Max(9999) @IsOptional() number?: number;
  @IsString() @Length(3, 160) @IsOptional() name?: string;
  @IsString() @Length(2, 120) @IsOptional() municipality?: string;
  @IsString() @Length(2, 2) @IsOptional() state?: string;
  @IsEnum(ResourceStatus) @IsOptional() status?: ResourceStatus;
}
