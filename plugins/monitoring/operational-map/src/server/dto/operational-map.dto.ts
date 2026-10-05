import { IsOptional, IsString } from "class-validator";

export class OperationalMapQueryDto {
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() zoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  /** Lista separada por vírgula de camadas solicitadas. */
  @IsString() @IsOptional() types?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() severity?: string;
}
