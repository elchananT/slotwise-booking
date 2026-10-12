import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class ForceQueryDto {
  /** Creates time off even when it overlaps confirmed bookings. */
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  force?: boolean;
}
