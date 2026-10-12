import { DateTime } from 'luxon';
import { rangesOverlap } from '../common/time-range';
import {
  AvailableSlot,
  EngineInput,
  Interval,
  StaffSchedule,
} from './availability.types';

const MINUTE_MS = 60_000;
const SLOT_STEP_MS = 15 * MINUTE_MS;
const MINUTES_PER_DAY = 1440;

/**
 * Computes the bookable starts for one business-local day. Pure: all data is
 * passed in, so DST and rule behaviour can be unit tested without a database.
 *
 * A start is offered when it lies inside a working window with room for the
 * service, is not earlier than now + min notice nor later than now + max
 * advance days (calendar days in the business zone), and its blocked range
 * [start, start + duration + buffer) overlaps neither time off nor a
 * confirmed booking. Starts are reported once, with every staff member who
 * can take them.
 */
export function computeDaySlots(input: EngineInput): AvailableSlot[] {
  const zone = input.timezone;
  const day = DateTime.fromFormat(input.date, 'yyyy-MM-dd', { zone });
  if (!day.isValid) {
    throw new RangeError(`Invalid date ${input.date} for zone ${zone}`);
  }

  const nowMs = input.now.getTime();
  const earliestStart = nowMs + input.minNoticeMinutes * MINUTE_MS;
  const latestStart = DateTime.fromMillis(nowMs, { zone })
    .plus({ days: input.maxAdvanceDays })
    .toMillis();
  const durationMs = input.durationMinutes * MINUTE_MS;
  const bufferMs = input.bufferMinutes * MINUTE_MS;
  const weekday = day.weekday % 7;

  const staffBySlot = new Map<number, string[]>();
  for (const staff of input.staff) {
    for (const window of staff.hours) {
      if (window.weekday !== weekday) {
        continue;
      }
      const windowStart = localInstant(day, window.startMinute).toMillis();
      const windowEnd = localInstant(day, window.endMinute).toMillis();
      for (
        let start = windowStart;
        start + durationMs <= windowEnd;
        start += SLOT_STEP_MS
      ) {
        if (start < earliestStart || start > latestStart) {
          continue;
        }
        if (isBlocked(staff, start, start + durationMs + bufferMs)) {
          continue;
        }
        const staffIds = staffBySlot.get(start) ?? [];
        if (!staffIds.includes(staff.staffId)) {
          staffIds.push(staff.staffId);
        }
        staffBySlot.set(start, staffIds);
      }
    }
  }

  return [...staffBySlot.entries()]
    .sort(([a], [b]) => a - b)
    .map(([start, staffIds]) => ({ start: new Date(start), staffIds }));
}

/** Local wall-clock minute of the day. Minute 1440 is midnight at the end of the day. */
function localInstant(day: DateTime, minute: number): DateTime {
  if (minute >= MINUTES_PER_DAY) {
    return day.plus({ days: 1 });
  }
  return DateTime.fromObject(
    {
      year: day.year,
      month: day.month,
      day: day.day,
      hour: Math.floor(minute / 60),
      minute: minute % 60,
    },
    { zone: day.zone },
  );
}

function isBlocked(staff: StaffSchedule, start: number, end: number): boolean {
  return (
    staff.timeOff.some((interval) => overlaps(interval, start, end)) ||
    staff.bookings.some((interval) => overlaps(interval, start, end))
  );
}

function overlaps(interval: Interval, start: number, end: number): boolean {
  return rangesOverlap(start, end, interval.start, interval.end);
}
