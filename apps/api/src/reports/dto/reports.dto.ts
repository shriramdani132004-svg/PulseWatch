import { IsIn, IsOptional } from 'class-validator';
import { REPORT_RANGES, type ReportRange } from '@pulsewatch/shared';

export class ReportRangeQueryDto {
  @IsOptional()
  @IsIn(REPORT_RANGES)
  range: ReportRange = '24h';
}
