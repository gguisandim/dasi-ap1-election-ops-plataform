import {
  ResourceRequestItemKind,
  ResourceRequestPriority,
  ResourceRequestStatus,
} from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
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

export class RequestItemDto {
  @IsEnum(ResourceRequestItemKind) kind!: ResourceRequestItemKind;
  @IsString() @Length(2, 160) label!: string;
  @IsString() @Length(0, 2000) @IsOptional() description?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) quantity = 1;
  @IsString() @Length(0, 2000) @IsOptional() notes?: string;
  @IsString() @IsOptional() assetTypeId?: string;
  @IsString() @IsOptional() fieldTeamId?: string;
  @IsString() @IsOptional() vehicleId?: string;
}

export class RequestQueryDto {
  @IsString() @Length(0, 120) @IsOptional() search?: string;
  @IsEnum(ResourceRequestStatus) @IsOptional() status?: ResourceRequestStatus;
  @IsEnum(ResourceRequestPriority) @IsOptional() priority?: ResourceRequestPriority;
  @IsEnum(ResourceRequestItemKind) @IsOptional() itemKind?: ResourceRequestItemKind;
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() @IsOptional() ownerId?: string;
  @IsString() @IsOptional() requestedById?: string;
  @IsString() @IsOptional() incidentId?: string;
  @IsDateString() @IsOptional() from?: string;
  @IsDateString() @IsOptional() to?: string;
  @Type(() => Boolean) @IsOptional() overdue?: boolean;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() pageSize = 20;
}

export class ReferencesQueryDto {
  @IsString() @IsOptional() electionId?: string;
}

export class CreateRequestDto {
  @IsString() electionId!: string;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() @IsOptional() incidentId?: string;
  @IsString() @IsOptional() taskId?: string;
  @IsString() @Length(3, 200) title!: string;
  @IsString() @Length(3, 8000) description!: string;
  @IsEnum(ResourceRequestPriority) @IsOptional() priority?: ResourceRequestPriority;
  @IsDateString() @IsOptional() neededAt?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RequestItemDto)
  items!: RequestItemDto[];
}

export class UpdateRequestDto {
  @IsString() @Length(3, 200) @IsOptional() title?: string;
  @IsString() @Length(3, 8000) @IsOptional() description?: string;
  @IsEnum(ResourceRequestPriority) @IsOptional() priority?: ResourceRequestPriority;
  @IsDateString() @IsOptional() neededAt?: string;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() @IsOptional() taskId?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RequestItemDto)
  @IsOptional()
  items?: RequestItemDto[];
}

export class TriageRequestDto {
  @IsString() @IsOptional() ownerId?: string;
  @IsEnum(ResourceRequestPriority) @IsOptional() priority?: ResourceRequestPriority;
  @IsString() @Length(0, 4000) @IsOptional() notes?: string;
}

export class RejectRequestDto {
  @IsString() @Length(3, 2000) reason!: string;
}

export class CancelRequestDto {
  @IsString() @Length(0, 2000) @IsOptional() reason?: string;
}

export class AddFulfillmentDto {
  @IsString() requestItemId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) quantity!: number;
  @IsString() @IsOptional() assetId?: string;
  @IsString() @IsOptional() assetReservationId?: string;
  @IsString() @IsOptional() fieldTeamId?: string;
  @IsString() @IsOptional() vehicleId?: string;
  @IsString() @IsOptional() routeId?: string;
  @IsString() @IsOptional() taskId?: string;
  @IsString() @Length(0, 2000) @IsOptional() notes?: string;
}

export class AddCommentDto {
  @IsString() @Length(1, 4000) body!: string;
}
