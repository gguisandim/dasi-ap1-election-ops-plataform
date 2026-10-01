import { IsDateString, IsOptional, IsString } from "class-validator";

export class ReportQueryDto {
  @IsDateString() @IsOptional() from?: string;
  @IsDateString() @IsOptional() to?: string;
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() zoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() @IsOptional() categoryId?: string;
  @IsString() @IsOptional() status?: string;
}
