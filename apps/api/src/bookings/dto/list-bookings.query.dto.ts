import { BookingStatus } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';
import { IsDayOrInstant } from '../../common/validators/is-instant';

export class ListBookingsQueryDto extends PaginationQueryDto {
  /** Business-local day (YYYY-MM-DD) or an instant; both bounds are inclusive. */
  @IsOptional()
  @IsDayOrInstant()
  from?: string;

  @IsOptional()
  @IsDayOrInstant()
  to?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  staffId?: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  /** Matches customer name, email or booking reference. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
