import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimUppercase } from '../../common/transforms';
import { IfPresent } from '../../common/validators/if-present';
import { IsMultipleOf } from '../../common/validators/is-multiple-of';

export class UpdateServiceDto {
  @IfPresent()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IfPresent()
  @IsInt()
  @Min(5)
  @Max(480)
  @IsMultipleOf(5, { message: 'durationMinutes must be a multiple of 5' })
  durationMinutes?: number;

  @IfPresent()
  @IsInt()
  @Min(0)
  @Max(240)
  bufferMinutes?: number;

  @IfPresent()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  priceCents?: number;

  @IfPresent()
  @Transform(trimUppercase)
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO code' })
  currency?: string;

  @IfPresent()
  @IsBoolean()
  active?: boolean;
}
