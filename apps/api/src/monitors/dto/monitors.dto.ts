import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { MONITOR_METHODS, MONITOR_STATUSES, type MonitorMethod, type MonitorStatus } from '@pulsewatch/shared';

export class CustomHeaderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @IsString()
  @MaxLength(2048)
  value!: string;
}

export class CreateMonitorDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @MaxLength(2048)
  @IsUrl({
    require_protocol: true,
    protocols: ['http', 'https'],
    require_tld: false,
    validate_length: false,
  })
  targetUrl!: string;

  @IsIn(MONITOR_METHODS)
  method!: MonitorMethod;

  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(86_400)
  intervalSeconds!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1_000)
  @Max(30_000)
  timeoutMs!: number;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(599)
  expectedStatusMin!: number;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(599)
  expectedStatusMax!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  failureThreshold!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  recoveryThreshold!: number;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(30_000)
  degradedResponseTimeMs!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CustomHeaderDto)
  customHeaders?: CustomHeaderDto[];

  @IsOptional()
  @IsBoolean()
  clearCustomHeaders?: boolean;
}

export class UpdateMonitorDto extends PartialType(CreateMonitorDto) {}

export class MonitorListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(MONITOR_STATUSES)
  status?: MonitorStatus;
}
