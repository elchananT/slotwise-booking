import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IfPresent } from '../../common/validators/if-present';

export class UpdateStaffDto {
  @IfPresent()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string | null;

  @IfPresent()
  @IsBoolean()
  active?: boolean;

  /** Replaces the staff member's service assignments when present. */
  @IfPresent()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  serviceIds?: string[];
}
