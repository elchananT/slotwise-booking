import { DateTime } from 'luxon';
import { computeDaySlots } from './availability.engine';
import { EngineInput, HoursWindow, StaffSchedule } from './availability.types';

const JERUSALEM = 'Asia/Jerusalem';
const NEW_YORK = 'America/New_York';

/** Local clock time on a business day, as a UTC ISO string. */
function localIso(zone: string, date: string, hhmm: string): string {
  return DateTime.fromISO(`${date}T${hhmm}`, { zone })
    .toUTC()
    .toISO({ suppressMilliseconds: false });
}

function window(
  weekday: number,
  startMinute: number,
  endMinute: number,
): HoursWindow {
  return { weekday, startMinute, endMinute };
}

function staff(
  overrides: Partial<StaffSchedule> & { staffId: string },
): StaffSchedule {
  return { hours: [], timeOff: [], bookings: [], ...overrides };
}

function input(overrides: Partial<EngineInput>): EngineInput {
  return {
    timezone: JERUSALEM,
    date: '2030-01-07',
    now: new Date('2029-12-01T00:00:00Z'),
    durationMinutes: 60,
    bufferMinutes: 0,
    minNoticeMinutes: 0,
    maxAdvanceDays: 365,
    staff: [],
    ...overrides,
  };
}

function starts(result: ReturnType<typeof computeDaySlots>): string[] {
  return result.map((slot) => slot.start.toISOString());
}

describe('computeDaySlots', () => {
  // 2030-01-07 is a Monday (weekday 1) in both zones used here.
  const mondayHours = (...windows: HoursWindow[]) => ({
    staffId: 'ana',
    hours: windows,
  });

  it('offers 15-minute starts that fit the working window', () => {
    const result = computeDaySlots(
      input({ staff: [staff(mondayHours(window(1, 540, 660)))] }),
    );

    expect(starts(result)).toEqual([
      localIso(JERUSALEM, '2030-01-07', '09:00'),
      localIso(JERUSALEM, '2030-01-07', '09:15'),
      localIso(JERUSALEM, '2030-01-07', '09:30'),
      localIso(JERUSALEM, '2030-01-07', '09:45'),
      localIso(JERUSALEM, '2030-01-07', '10:00'),
    ]);
    expect(result[0].staffIds).toEqual(['ana']);
  });

  it('ignores windows for other weekdays', () => {
    const result = computeDaySlots(
      input({ staff: [staff(mondayHours(window(0, 540, 660)))] }),
    );
    expect(result).toEqual([]);
  });

  it('offers both halves of a split shift and nothing in the gap', () => {
    const result = computeDaySlots(
      input({
        durationMinutes: 30,
        staff: [staff(mondayHours(window(1, 540, 600), window(1, 840, 900)))],
      }),
    );

    expect(starts(result)).toEqual([
      localIso(JERUSALEM, '2030-01-07', '09:00'),
      localIso(JERUSALEM, '2030-01-07', '09:15'),
      localIso(JERUSALEM, '2030-01-07', '09:30'),
      localIso(JERUSALEM, '2030-01-07', '14:00'),
      localIso(JERUSALEM, '2030-01-07', '14:15'),
      localIso(JERUSALEM, '2030-01-07', '14:30'),
    ]);
  });

  it('keeps the buffer after a booking blocked', () => {
    // Booking 09:00-10:00 with a 15-minute buffer blocks until 10:15.
    const result = computeDaySlots(
      input({
        durationMinutes: 30,
        staff: [
          staff({
            ...mondayHours(window(1, 540, 720)),
            bookings: [
              {
                start: Date.parse(localIso(JERUSALEM, '2030-01-07', '09:00')),
                end: Date.parse(localIso(JERUSALEM, '2030-01-07', '10:15')),
              },
            ],
          }),
        ],
      }),
    );

    expect(starts(result)).toEqual([
      localIso(JERUSALEM, '2030-01-07', '10:15'),
      localIso(JERUSALEM, '2030-01-07', '10:30'),
      localIso(JERUSALEM, '2030-01-07', '10:45'),
      localIso(JERUSALEM, '2030-01-07', '11:00'),
      localIso(JERUSALEM, '2030-01-07', '11:15'),
      localIso(JERUSALEM, '2030-01-07', '11:30'),
    ]);
  });

  it('blocks a new appointment whose own buffer runs into a booking', () => {
    // A 30-minute service with a 15-minute buffer needs 45 minutes free.
    const result = computeDaySlots(
      input({
        durationMinutes: 30,
        bufferMinutes: 15,
        staff: [
          staff({
            ...mondayHours(window(1, 540, 660)),
            bookings: [
              {
                start: Date.parse(localIso(JERUSALEM, '2030-01-07', '10:00')),
                end: Date.parse(localIso(JERUSALEM, '2030-01-07', '10:30')),
              },
            ],
          }),
        ],
      }),
    );

    expect(starts(result)).toEqual([
      localIso(JERUSALEM, '2030-01-07', '09:00'),
      localIso(JERUSALEM, '2030-01-07', '09:15'),
      localIso(JERUSALEM, '2030-01-07', '10:30'),
    ]);
  });

  it('removes starts that overlap time off and keeps the touching ones', () => {
    const result = computeDaySlots(
      input({
        durationMinutes: 30,
        staff: [
          staff({
            ...mondayHours(window(1, 540, 720)),
            timeOff: [
              {
                start: Date.parse(localIso(JERUSALEM, '2030-01-07', '10:00')),
                end: Date.parse(localIso(JERUSALEM, '2030-01-07', '11:00')),
              },
            ],
          }),
        ],
      }),
    );

    expect(starts(result)).toEqual([
      localIso(JERUSALEM, '2030-01-07', '09:00'),
      localIso(JERUSALEM, '2030-01-07', '09:15'),
      localIso(JERUSALEM, '2030-01-07', '09:30'),
      localIso(JERUSALEM, '2030-01-07', '11:00'),
      localIso(JERUSALEM, '2030-01-07', '11:15'),
      localIso(JERUSALEM, '2030-01-07', '11:30'),
    ]);
  });

  it('applies the minimum notice as an earliest start, inclusive', () => {
    // Now is 08:00 local; 120 minutes of notice makes 10:00 the first bookable start.
    const result = computeDaySlots(
      input({
        durationMinutes: 30,
        now: new Date(localIso(JERUSALEM, '2030-01-07', '08:00')),
        minNoticeMinutes: 120,
        staff: [staff(mondayHours(window(1, 540, 720)))],
      }),
    );

    expect(starts(result)[0]).toBe(localIso(JERUSALEM, '2030-01-07', '10:00'));
    expect(result).toHaveLength(7);
  });

  it('applies max advance days in business-local calendar days, inclusive', () => {
    // Now is 2030-01-01 12:00 local; three days ahead is 2030-01-04 12:00 local.
    const now = new Date(localIso(JERUSALEM, '2030-01-01', '12:00'));
    const friday = staff({ staffId: 'ana', hours: [window(5, 720, 840)] });

    const limit = computeDaySlots(
      input({
        date: '2030-01-04',
        now,
        maxAdvanceDays: 3,
        durationMinutes: 60,
        staff: [friday],
      }),
    );
    expect(starts(limit)).toEqual([localIso(JERUSALEM, '2030-01-04', '12:00')]);

    const beyond = computeDaySlots(
      input({
        date: '2030-01-05',
        now,
        maxAdvanceDays: 3,
        durationMinutes: 60,
        staff: [friday],
      }),
    );
    expect(beyond).toEqual([]);
  });

  it('reports a shared start once, listing every staff member who can take it', () => {
    // Ana is booked 09:00-10:00; Ben is free all morning.
    const result = computeDaySlots(
      input({
        staff: [
          staff({
            staffId: 'ana',
            hours: [window(1, 540, 660)],
            bookings: [
              {
                start: Date.parse(localIso(JERUSALEM, '2030-01-07', '09:00')),
                end: Date.parse(localIso(JERUSALEM, '2030-01-07', '10:00')),
              },
            ],
          }),
          staff({ staffId: 'ben', hours: [window(1, 540, 660)] }),
        ],
      }),
    );

    const at = (hhmm: string) =>
      result.find(
        (slot) =>
          slot.start.toISOString() === localIso(JERUSALEM, '2030-01-07', hhmm),
      );
    expect(at('09:00')?.staffIds).toEqual(['ben']);
    expect(at('10:00')?.staffIds).toEqual(['ana', 'ben']);
    expect(new Set(starts(result)).size).toBe(result.length);
  });

  it('keeps a spring-forward day correct in Asia/Jerusalem (2030-03-29, 02:00 jumps to 03:00)', () => {
    // 01:00-04:00 local is only two real hours that day, so a one-hour service fits five starts.
    const dstDay = input({
      date: '2030-03-29',
      durationMinutes: 60,
      staff: [staff({ staffId: 'ana', hours: [window(5, 60, 240)] })],
    });
    expect(starts(computeDaySlots(dstDay))).toEqual([
      '2030-03-28T23:00:00.000Z',
      '2030-03-28T23:15:00.000Z',
      '2030-03-28T23:30:00.000Z',
      '2030-03-28T23:45:00.000Z',
      '2030-03-29T00:00:00.000Z',
    ]);
  });

  it('keeps wall-clock hours on the right UTC offset after the Jerusalem jump', () => {
    const morning = (date: string) =>
      input({
        date,
        durationMinutes: 60,
        staff: [
          staff({
            staffId: 'ana',
            hours: [window(5, 540, 600), window(4, 540, 600)],
          }),
        ],
      });

    expect(starts(computeDaySlots(morning('2030-03-28')))).toEqual([
      '2030-03-28T07:00:00.000Z',
    ]);
    expect(starts(computeDaySlots(morning('2030-03-29')))).toEqual([
      '2030-03-29T06:00:00.000Z',
    ]);
  });

  it('keeps a spring-forward day correct in America/New_York (2030-03-10, 02:00 jumps to 03:00)', () => {
    const sunday = input({
      timezone: NEW_YORK,
      date: '2030-03-10',
      durationMinutes: 60,
      staff: [staff({ staffId: 'ana', hours: [window(0, 60, 240)] })],
    });
    expect(starts(computeDaySlots(sunday))).toEqual([
      '2030-03-10T06:00:00.000Z',
      '2030-03-10T06:15:00.000Z',
      '2030-03-10T06:30:00.000Z',
      '2030-03-10T06:45:00.000Z',
      '2030-03-10T07:00:00.000Z',
    ]);

    const nineAm = input({
      timezone: NEW_YORK,
      date: '2030-03-10',
      durationMinutes: 60,
      staff: [staff({ staffId: 'ana', hours: [window(0, 540, 600)] })],
    });
    expect(starts(computeDaySlots(nineAm))).toEqual([
      '2030-03-10T13:00:00.000Z',
    ]);
  });

  it('rejects a date that is not a real calendar day', () => {
    expect(() => computeDaySlots(input({ date: '2030-02-30' }))).toThrow(
      RangeError,
    );
  });
});
