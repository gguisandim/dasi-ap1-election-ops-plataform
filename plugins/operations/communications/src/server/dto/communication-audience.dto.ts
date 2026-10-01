import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { CommunicationAudienceType } from "@prisma/client";

/**
 * Uma regra de direcionamento.
 *
 * O campo de alvo correspondente ao `type` é obrigatório; os demais devem ficar
 * vazios. A consistência é validada por `validateAudienceShape`, que produz
 * mensagens específicas em vez do erro genérico do `class-validator`.
 */
export class CommunicationAudienceDto {
  @IsEnum(CommunicationAudienceType) type!: CommunicationAudienceType;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() @IsOptional() fieldTeamId?: string;
  @IsString() @IsOptional() fieldRoleId?: string;
  @IsString() @IsOptional() userId?: string;
}

export class ReplaceAudiencesDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CommunicationAudienceDto)
  audiences!: CommunicationAudienceDto[];
}
