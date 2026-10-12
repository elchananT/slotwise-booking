import { BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';

/** Parses a business-local calendar date (YYYY-MM-DD) into midnight of that day. */
export function parseLocalDate(value: string, zone: string): DateTime {
  const day = DateTime.fromFormat(value, 'yyyy-MM-dd', { zone });
  if (!day.isValid) {
    throw new BadRequestException(
      'date must be a valid calendar date (YYYY-MM-DD)',
    );
  }
  return day;
}

/** Parses a business-local month (YYYY-MM) into midnight of its first day. */
export function parseLocalMonth(value: string, zone: string): DateTime {
  const month = DateTime.fromFormat(value, 'yyyy-MM', { zone });
  if (!month.isValid) {
    throw new BadRequestException('month must be a valid month (YYYY-MM)');
  }
  return month.startOf('month');
}
