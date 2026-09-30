import { ResourceStatus } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreatePollingSectionDto {
  @IsString() pollingPlaceId!: string;
  @IsInt() @Min(1) @Max(999999) number!: number;
  @IsInt() @Min(0) @Max(1000) registeredVoters!: number;
  @IsEnum(ResourceStatus) @IsOptional() status?: ResourceStatus;
}

export class UpdatePollingSectionDto {
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsInt() @Min(1) @Max(999999) @IsOptional() number?: number;
  @IsInt() @Min(0) @Max(1000) @IsOptional() registeredVoters?: number;
  @IsEnum(ResourceStatus) @IsOptional() status?: ResourceStatus;
}
