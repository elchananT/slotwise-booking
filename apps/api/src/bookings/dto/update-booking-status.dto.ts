import { BookingStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

export class UpdateBookingStatusDto {
  /** Only the outcomes of a confirmed booking can be set here. */
  @IsIn([
    BookingStatus.COMPLETED,
    BookingStatus.NO_SHOW,
    BookingStatus.CANCELLED,
  ])
  status!: BookingStatus;
}
