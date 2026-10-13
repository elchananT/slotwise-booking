import { INestApplication } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  bodyOf,
  createTestApp,
  HttpClient,
  resetDatabase,
} from './support/test-app';
import { asOwner, OwnerSession, registerOwner } from './support/owners';

const ZONE = 'Asia/Jerusalem';
const WEEK = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  startMinute: 540,
  endMinute: 1020,
}));

interface DashboardBody {
  todayCount: number;
  upcomingCount: number;
  revenueCentsLast30: number;
  bookingsByDay: { date: string; count: number }[];
  topServices: { name: string; count: number }[];
  utilizationByStaff: { staffId: string; name: string; percent: number }[];
}

interface EmailsBody {
  items: { subject: string; to: string }[];
  page: number;
  pageSize: number;
  total: number;
}

function localAt(daysFromToday: number, hhmm: string): Date {
  const day = DateTime.now()
    .setZone(ZONE)
    .plus({ days: daysFromToday })
    .toFormat('yyyy-MM-dd');
  return DateTime.fromISO(`${day}T${hhmm}`, { zone: ZONE }).toJSDate();
}

describe('Dashboard and email outbox (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: () => HttpClient;
  let owner: OwnerSession;
  let serviceId: string;
  let staffId: string;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    http = ctx.http;
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    owner = await registerOwner(http, 'stats@example.com');
    await asOwner(http().post('/api/v1/business'), owner)
      .send({ name: 'Lumen Studio', timezone: ZONE })
      .expect(201);
    serviceId = bodyOf<{ id: string }>(
      await asOwner(http().post('/api/v1/services'), owner)
        .send({ name: 'Cut', durationMinutes: 60, priceCents: 9000 })
        .expect(201),
    ).id;
    staffId = bodyOf<{ id: string }>(
      await asOwner(http().post('/api/v1/staff'), owner)
        .send({ name: 'Noa', serviceIds: [serviceId] })
        .expect(201),
    ).id;
    await asOwner(http().put(`/api/v1/staff/${staffId}/hours`), owner)
      .send({ hours: WEEK })
      .expect(200);
  });

  afterAll(() => app.close());

  async function insertBooking(
    startsAt: Date,
    status: BookingStatus,
    reference: string,
  ): Promise<void> {
    const business = await prisma.business.findUniqueOrThrow({
      where: { slug: 'lumen-studio' },
    });
    await prisma.booking.create({
      data: {
        reference,
        manageToken: `token-${reference}-0000000000000000000000000`,
        status,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 60 * 60_000),
        blockedUntil: new Date(startsAt.getTime() + 60 * 60_000),
        customerName: 'Stats Customer',
        customerEmail: 'stats@example.com',
        businessId: business.id,
        serviceId,
        staffId,
      },
    });
  }

  it('reports zeros and a 30-day trend for a new business', async () => {
    const res = await asOwner(http().get('/api/v1/dashboard'), owner).expect(
      200,
    );
    const body = bodyOf<DashboardBody>(res);

    expect(body.todayCount).toBe(0);
    expect(body.upcomingCount).toBe(0);
    expect(body.revenueCentsLast30).toBe(0);
    expect(body.bookingsByDay).toHaveLength(30);
    expect(body.bookingsByDay.every((day) => day.count === 0)).toBe(true);
    expect(body.topServices).toEqual([]);
    expect(body.utilizationByStaff).toEqual([
      { staffId, name: 'Noa', percent: 0 },
    ]);
  });

  it('counts upcoming, completed revenue, service ranking and staff utilisation', async () => {
    await insertBooking(
      localAt(-2, '10:00'),
      BookingStatus.COMPLETED,
      'SW-DONE01',
    );
    await insertBooking(
      localAt(-3, '10:00'),
      BookingStatus.NO_SHOW,
      'SW-NOSH01',
    );
    await insertBooking(
      localAt(-4, '10:00'),
      BookingStatus.CANCELLED,
      'SW-CANC01',
    );
    await insertBooking(
      localAt(3, '10:00'),
      BookingStatus.CONFIRMED,
      'SW-UPCO01',
    );

    const body = bodyOf<DashboardBody>(
      await asOwner(http().get('/api/v1/dashboard'), owner).expect(200),
    );

    expect(body.upcomingCount).toBe(1);
    expect(body.revenueCentsLast30).toBe(9000);
    // Service ranking covers the trailing 30 days only, so the booking three days ahead is excluded.
    expect(body.topServices).toEqual([{ name: 'Cut', count: 2 }]);
    const countOn = (daysFromToday: number) =>
      body.bookingsByDay.find(
        (day) =>
          day.date ===
          DateTime.now()
            .setZone(ZONE)
            .plus({ days: daysFromToday })
            .toFormat('yyyy-MM-dd'),
      )?.count;
    expect(countOn(-2)).toBe(1);
    expect(countOn(-3)).toBe(1);
    expect(countOn(-4)).toBe(0);
    // 3 booked hours out of 30 days of 09:00-17:00 (8h each, weekly) is well under 100%.
    expect(body.utilizationByStaff[0].percent).toBeGreaterThan(0);
    expect(body.utilizationByStaff[0].percent).toBeLessThan(100);
  });

  it('lists the outbox newest first, paginated and scoped to the owner', async () => {
    const created = await http()
      .post('/api/v1/public/lumen-studio/bookings')
      .send({
        serviceId,
        staffId,
        startsAt: localAt(6, '10:00').toISOString(),
        customerName: 'Dana',
        customerEmail: 'dana@example.com',
      })
      .expect(201);
    const token = bodyOf<{ manageToken: string }>(created).manageToken;
    await http().post(`/api/v1/public/bookings/${token}/cancel`).expect(200);

    const res = await asOwner(
      http().get('/api/v1/emails?pageSize=1'),
      owner,
    ).expect(200);
    const page = bodyOf<EmailsBody>(res);
    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(1);
    expect(page.items[0].subject).toMatch(/was cancelled$/);

    const second = bodyOf<EmailsBody>(
      await asOwner(
        http().get('/api/v1/emails?pageSize=1&page=2'),
        owner,
      ).expect(200),
    );
    expect(second.items[0].subject).toMatch(/is confirmed$/);

    const other = await registerOwner(http, 'other-outbox@example.com');
    await asOwner(http().post('/api/v1/business'), other)
      .send({ name: 'Other', timezone: ZONE })
      .expect(201);
    const isolated = bodyOf<EmailsBody>(
      await asOwner(http().get('/api/v1/emails'), other).expect(200),
    );
    expect(isolated.total).toBe(0);
  });
});
