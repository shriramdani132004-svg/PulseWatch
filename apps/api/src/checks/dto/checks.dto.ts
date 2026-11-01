import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class CheckListQueryDto {
  @IsOptional()
  @TypeNumber()
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @TypeNumber()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  successful?: boolean;
}

function TypeNumber() {
  return Transform(({ value }: { value: unknown }) => (value === undefined ? value : Number(value)));
}
