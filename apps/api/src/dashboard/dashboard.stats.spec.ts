import { BookingStatus } from '@prisma/client';
import {
  bookingsByDay,
  completedRevenueCents,
  DashboardBooking,
  topServices,
  trailingDates,
  utilizationPercent,
} from './dashboard.stats';

const ZONE = 'Asia/Jerusalem';

function booking(overrides: Partial<DashboardBooking>): DashboardBooking {
  return {
    status: BookingStatus.CONFIRMED,
    startsAt: new Date('2030-01-07T07:00:00Z'),
    endsAt: new Date('2030-01-07T08:00:00Z'),
    staffId: 'ana',
    serviceName: 'Cut',
    priceCents: 9000,
    ...overrides,
  };
}

describe('dashboard stats', () => {
  it('lists trailing business-local dates oldest first, ending today', () => {
    const dates = trailingDates(new Date('2030-01-07T10:00:00Z'), ZONE, 3);
    expect(dates).toEqual(['2030-01-05', '2030-01-06', '2030-01-07']);
  });

  it('counts non-cancelled bookings per local day and keeps empty days at zero', () => {
    const dates = ['2030-01-06', '2030-01-07'];
    const counts = bookingsByDay(
      [
        booking({ startsAt: new Date('2030-01-07T07:00:00Z') }),
        booking({ startsAt: new Date('2030-01-07T09:00:00Z') }),
        booking({ status: BookingStatus.CANCELLED }),
      ],
      dates,
      ZONE,
    );
    expect(counts).toEqual([
      { date: '2030-01-06', count: 0 },
      { date: '2030-01-07', count: 2 },
    ]);
  });

  it('ranks services by non-cancelled bookings and sums completed revenue only', () => {
    const rows = [
      booking({
        serviceName: 'Cut',
        status: BookingStatus.COMPLETED,
        priceCents: 9000,
      }),
      booking({ serviceName: 'Cut' }),
      booking({ serviceName: 'Color', priceCents: 15000 }),
      booking({ serviceName: 'Color', status: BookingStatus.CANCELLED }),
    ];
    expect(topServices(rows, 5)).toEqual([
      { name: 'Cut', count: 2 },
      { name: 'Color', count: 1 },
    ]);
    expect(completedRevenueCents(rows)).toBe(9000);
  });

  it('measures booked minutes against working minutes on the same dates', () => {
    // Monday 09:00-13:00 is 240 working minutes; one 60-minute booking is 25%.
    const percent = utilizationPercent(
      [booking({})],
      [{ weekday: 1, startMinute: 540, endMinute: 780 }],
      ['2030-01-07'],
      ZONE,
    );
    expect(percent).toBe(25);
    expect(utilizationPercent([], [], ['2030-01-07'], ZONE)).toBe(0);
  });
});
