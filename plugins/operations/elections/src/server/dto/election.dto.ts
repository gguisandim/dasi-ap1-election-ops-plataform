import { Type } from "class-transformer";
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
  Min,
  ValidateNested,
} from "class-validator";
import { ElectionStatus, ElectionType, RoundStatus } from "@prisma/client";

export class CreateRoundDto {
  @IsInt() @Min(1) @Max(3) roundNumber!: number;
  @IsDateString() date!: string;
  @IsEnum(RoundStatus) @IsOptional() status?: RoundStatus;
}

export class CreateElectionDto {
  @IsString() @Length(3, 160) name!: string;
  @IsString() @Length(3, 1000) @IsOptional() description?: string;
  @IsInt() @Min(2000) @Max(2200) year!: number;
  @IsEnum(ElectionType) type!: ElectionType;
  @IsEnum(ElectionStatus) @IsOptional() status?: ElectionStatus;
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => CreateRoundDto)
  @IsOptional()
  rounds?: CreateRoundDto[];
}

export class UpdateElectionDto {
  @IsString() @Length(3, 160) @IsOptional() name?: string;
  @IsString() @Length(3, 1000) @IsOptional() description?: string;
  @IsInt() @Min(2000) @Max(2200) @IsOptional() year?: number;
  @IsEnum(ElectionType) @IsOptional() type?: ElectionType;
  @IsEnum(ElectionStatus) @IsOptional() status?: ElectionStatus;
}

export class UpdateRoundDto {
  @IsInt() @Min(1) @Max(3) @IsOptional() roundNumber?: number;
  @IsDateString() @IsOptional() date?: string;
  @IsEnum(RoundStatus) @IsOptional() status?: RoundStatus;
}
