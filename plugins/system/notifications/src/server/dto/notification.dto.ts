import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { NotificationType } from "@prisma/client";

export enum NotificationReadState {
  ALL = "ALL",
  READ = "READ",
  UNREAD = "UNREAD",
}

export class NotificationQueryDto {
  @IsEnum(NotificationReadState) @IsOptional() readState: NotificationReadState = NotificationReadState.ALL;
  @IsEnum(NotificationType) @IsOptional() type?: NotificationType;
  @IsString() @IsOptional() eventName?: string;
  @IsDateString() @IsOptional() from?: string;
  @IsDateString() @IsOptional() to?: string;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() pageSize = 20;
}

export class NotificationPreferenceItemDto {
  @IsString() eventName!: string;
  @IsBoolean() enabled!: boolean;
}

export class UpdateNotificationPreferencesDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => NotificationPreferenceItemDto)
  preferences!: NotificationPreferenceItemDto[];
}
