import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimLowercase } from '../../common/transforms';
import { IsIanaTimezone } from '../../common/validators/is-iana-timezone';
import { SLUG_PATTERN } from '../slug';

export class CreateBusinessDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @Transform(trimLowercase)
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  @Matches(SLUG_PATTERN, {
    message:
      'slug may contain only lowercase letters, digits and single hyphens',
  })
  slug?: string;

  @IsIanaTimezone()
  timezone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;
}
