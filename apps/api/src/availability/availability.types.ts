/** Weekly working window in business-local minutes; weekday 0 = Sunday. */
export interface HoursWindow {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

/** Half-open interval in epoch milliseconds: [start, end). */
export interface Interval {
  start: number;
  end: number;
}

export interface StaffSchedule {
  staffId: string;
  hours: HoursWindow[];
  timeOff: Interval[];
  /** Blocked ranges of CONFIRMED bookings, i.e. [startsAt, blockedUntil). */
  bookings: Interval[];
}

export interface EngineInput {
  timezone: string;
  /** Business-local calendar date, YYYY-MM-DD. */
  date: string;
  now: Date;
  durationMinutes: number;
  bufferMinutes: number;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  /** Staff who are active and offer the service, in the order they should be reported. */
  staff: StaffSchedule[];
}

export interface AvailableSlot {
  start: Date;
  staffIds: string[];
}
