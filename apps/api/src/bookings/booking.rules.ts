import { BookingStatus } from '@prisma/client';

/** Customers may cancel or reschedule until this long before the appointment. */
export const CANCELLATION_WINDOW_HOURS = 2;
const CANCELLATION_WINDOW_MS = CANCELLATION_WINDOW_HOURS * 60 * 60_000;

export function isWithinChangeWindow(
  status: BookingStatus,
  startsAt: Date,
  now: Date,
): boolean {
  return (
    status === BookingStatus.CONFIRMED &&
    now.getTime() < startsAt.getTime() - CANCELLATION_WINDOW_MS
  );
}
