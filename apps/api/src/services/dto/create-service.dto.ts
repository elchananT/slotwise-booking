import { Transform } from 'class-transformer';
import {
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
import { IsMultipleOf } from '../../common/validators/is-multiple-of';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @Min(5)
  @Max(480)
  @IsMultipleOf(5, { message: 'durationMinutes must be a multiple of 5' })
  durationMinutes!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  bufferMinutes?: number;

  @IsInt()
  @Min(0)
  @Max(100_000_000)
  priceCents!: number;

  @IsOptional()
  @Transform(trimUppercase)
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO code' })
  currency?: string;
}
