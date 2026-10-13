import { BookingStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import type { HoursWindow } from '../availability/availability.types';

export const TREND_DAYS = 30;
export const TOP_SERVICES_LIMIT = 5;

export interface DashboardBooking {
  status: BookingStatus;
  startsAt: Date;
  endsAt: Date;
  staffId: string;
  serviceName: string;
  priceCents: number;
}

export interface DayCount {
  date: string;
  count: number;
}

export interface ServiceCount {
  name: string;
  count: number;
}

export interface StaffUtilization {
  staffId: string;
  name: string;
  percent: number;
}

/** The last `days` business-local dates, oldest first, ending today. */
export function trailingDates(now: Date, zone: string, days: number): string[] {
  const today = DateTime.fromJSDate(now, { zone }).startOf('day');
  return Array.from({ length: days }, (_, index) =>
    today.minus({ days: days - 1 - index }).toFormat('yyyy-MM-dd'),
  );
}

/** Non-cancelled bookings per business-local day, including days with none. */
export function bookingsByDay(
  bookings: DashboardBooking[],
  dates: string[],
  zone: string,
): DayCount[] {
  const counts = new Map(dates.map((date) => [date, 0]));
  for (const booking of bookings) {
    if (booking.status === BookingStatus.CANCELLED) {
      continue;
    }
    const date = DateTime.fromJSDate(booking.startsAt, { zone }).toFormat(
      'yyyy-MM-dd',
    );
    if (counts.has(date)) {
      counts.set(date, (counts.get(date) ?? 0) + 1);
    }
  }
  return dates.map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

/** Most booked services by non-cancelled bookings; ties sort by name. */
export function topServices(
  bookings: DashboardBooking[],
  limit: number,
): ServiceCount[] {
  const counts = new Map<string, number>();
  for (const booking of bookings) {
    if (booking.status !== BookingStatus.CANCELLED) {
      counts.set(
        booking.serviceName,
        (counts.get(booking.serviceName) ?? 0) + 1,
      );
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Price of completed bookings, at the service's current price. */
export function completedRevenueCents(bookings: DashboardBooking[]): number {
  return bookings
    .filter((booking) => booking.status === BookingStatus.COMPLETED)
    .reduce((sum, booking) => sum + booking.priceCents, 0);
}

/**
 * Booked minutes over working minutes in the same dates. Time off is not
 * subtracted, so the figure is booked time against the weekly hours.
 */
export function utilizationPercent(
  staffBookings: DashboardBooking[],
  hours: HoursWindow[],
  dates: string[],
  zone: string,
): number {
  const availableMinutes = dates.reduce((total, date) => {
    const weekday =
      DateTime.fromFormat(date, 'yyyy-MM-dd', { zone }).weekday % 7;
    return (
      total +
      hours
        .filter((window) => window.weekday === weekday)
        .reduce((sum, window) => sum + window.endMinute - window.startMinute, 0)
    );
  }, 0);

  const bookedMinutes = staffBookings
    .filter((booking) => booking.status !== BookingStatus.CANCELLED)
    .reduce(
      (sum, booking) =>
        sum + (booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000,
      0,
    );

  if (availableMinutes === 0) {
    return 0;
  }
  return Math.min(100, Math.round((bookedMinutes / availableMinutes) * 100));
}
