import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IsInstant } from '../../common/validators/is-instant';

export class RescheduleBookingDto {
  @IsInstant()
  startsAt!: string;

  /** Omit to keep the current professional. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  staffId?: string;
}
