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
  MinLength,
} from 'class-validator';
import { trimLowercase } from '../../common/transforms';
import { IfPresent } from '../../common/validators/if-present';
import { IsIanaTimezone } from '../../common/validators/is-iana-timezone';
import { SLUG_PATTERN } from '../slug';

export class UpdateBusinessDto {
  @IfPresent()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IfPresent()
  @Transform(trimLowercase)
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  @Matches(SLUG_PATTERN, {
    message:
      'slug may contain only lowercase letters, digits and single hyphens',
  })
  slug?: string;

  @IfPresent()
  @IsIanaTimezone()
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string | null;

  @IfPresent()
  @IsInt()
  @Min(0)
  @Max(10_080)
  minNoticeMinutes?: number;

  @IfPresent()
  @IsInt()
  @Min(1)
  @Max(365)
  maxAdvanceDays?: number;
}
