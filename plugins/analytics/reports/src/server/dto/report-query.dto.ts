import { Transform } from "class-transformer";
import { IsBoolean, IsDateString, IsOptional, IsString } from "class-validator";

/** Query string "true"/"1" vira booleano; qualquer outro valor, false. */
export function parseBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
}

export class ReportQueryDto {
  @IsDateString() @IsOptional() from?: string;
  @IsDateString() @IsOptional() to?: string;
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() zoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() @IsOptional() categoryId?: string;
  @IsString() @IsOptional() status?: string;
  @Transform(({ value }) => parseBoolean(value)) @IsBoolean() @IsOptional() includeSimulated?: boolean;
}
