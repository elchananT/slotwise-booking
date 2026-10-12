import { INestApplication } from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  bodyOf,
  createTestApp,
  HttpClient,
  resetDatabase,
} from './support/test-app';
import { asOwner, OwnerSession, registerOwner } from './support/owners';

interface PublicPage {
  business: { slug: string; timezone: string };
  services: { id: string; name: string }[];
  staff: { id: string; name: string; serviceIds: string[] }[];
}

interface Availability {
  date: string;
  timezone: string;
  slots: { start: string; staffIds: string[] }[];
}

interface MonthAvailability {
  days: { date: string; available: boolean }[];
}

interface IdBody {
  id: string;
}

const WEEK = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  startMinute: 540,
  endMinute: 1020,
}));

/** Day `days` after today in the zone, as YYYY-MM-DD. */
function localDay(zone: string, days: number): string {
  return DateTime.now().setZone(zone).plus({ days }).toFormat('yyyy-MM-dd');
}

/** First day in the next year whose UTC offset changes, i.e. a DST switch day. */
function nextSpringForward(zone: string): string {
  let day = DateTime.now().setZone(zone).startOf('day');
  for (let i = 0; i < 400; i++) {
    const next = day.plus({ days: 1 });
    if (next.offset > day.offset) {
      return day.toFormat('yyyy-MM-dd');
    }
    day = next;
  }
  throw new Error(`No DST switch found in ${zone}`);
}

describe('Public business page and availability (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: () => HttpClient;

  let owner: OwnerSession;
  let cutId: string;
  let inactiveServiceId: string;
  let noaId: string;
  let benId: string;
  let talId: string;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    http = ctx.http;
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    owner = await registerOwner(http, 'studio@example.com');
    await asOwner(http().post('/api/v1/business'), owner)
      .send({ name: 'Lumen Studio', timezone: 'Asia/Jerusalem' })
      .expect(201);

    cutId = bodyOf<IdBody>(
      await asOwner(http().post('/api/v1/services'), owner)
        .send({
          name: 'Cut',
          durationMinutes: 60,
          bufferMinutes: 15,
          priceCents: 9000,
        })
        .expect(201),
    ).id;
    inactiveServiceId = bodyOf<IdBody>(
      await asOwner(http().post('/api/v1/services'), owner)
        .send({ name: 'Retired', durationMinutes: 30, priceCents: 3000 })
        .expect(201),
    ).id;
    await asOwner(http().patch(`/api/v1/services/${inactiveServiceId}`), owner)
      .send({ active: false })
      .expect(200);

    noaId = await createStaff('Noa', [cutId]);
    benId = await createStaff('Ben', [cutId]);
    talId = await createStaff('Tal', [inactiveServiceId]);
  });

  afterAll(() => app.close());

  async function createStaff(
    name: string,
    serviceIds: string[],
  ): Promise<string> {
    const created = await asOwner(http().post('/api/v1/staff'), owner)
      .send({ name, serviceIds })
      .expect(201);
    const id = bodyOf<IdBody>(created).id;
    await asOwner(http().put(`/api/v1/staff/${id}/hours`), owner)
      .send({ hours: WEEK })
      .expect(200);
    return id;
  }

  async function availability(date: string, query = ''): Promise<Availability> {
    const res = await http()
      .get(
        `/api/v1/public/lumen-studio/availability?serviceId=${cutId}&date=${date}${query}`,
      )
      .expect(200);
    return bodyOf<Availability>(res);
  }

  function localStart(
    date: string,
    hhmm: string,
    zone = 'Asia/Jerusalem',
  ): string {
    return DateTime.fromISO(`${date}T${hhmm}`, { zone }).toUTC().toISO()!;
  }

  it('publishes only active services and active staff, with inactive services removed from staff', async () => {
    const res = await http().get('/api/v1/public/lumen-studio').expect(200);
    const page = bodyOf<PublicPage>(res);

    expect(page.business).toMatchObject({
      slug: 'lumen-studio',
      timezone: 'Asia/Jerusalem',
    });
    expect(page.services.map((service) => service.name)).toEqual(['Cut']);
    expect(page.staff.map((member) => member.name)).toEqual([
      'Ben',
      'Noa',
      'Tal',
    ]);
    const noa = page.staff.find((member) => member.id === noaId);
    expect(noa?.serviceIds).toEqual([cutId]);
    const tal = page.staff.find((member) => member.id === talId);
    expect(tal?.serviceIds).toEqual([]);
  });

  it('returns every free start once, with all staff who can take it', async () => {
    const date = localDay('Asia/Jerusalem', 10);
    const result = await availability(date);

    // 09:00-17:00 window, 60-minute service: starts 09:00 through 16:00 every 15 minutes.
    expect(result.timezone).toBe('Asia/Jerusalem');
    expect(result.slots).toHaveLength(29);
    expect(result.slots[0]).toEqual({
      start: localStart(date, '09:00'),
      staffIds: [benId, noaId],
    });
    expect(new Set(result.slots.map((slot) => slot.start)).size).toBe(29);
  });

  it('removes starts that a booking or time off blocks for one staff member only', async () => {
    const date = localDay('Asia/Jerusalem', 10);
    const business = await prisma.business.findUniqueOrThrow({
      where: { slug: 'lumen-studio' },
    });
    const cut = await prisma.service.findUniqueOrThrow({
      where: { id: cutId },
    });

    // Ben is booked 09:00-10:00 and blocked until 10:15 by the buffer.
    await prisma.booking.create({
      data: {
        reference: 'SW-TEST01',
        manageToken: 'test-token-ben-0900',
        startsAt: new Date(localStart(date, '09:00')),
        endsAt: new Date(localStart(date, '10:00')),
        blockedUntil: new Date(localStart(date, '10:15')),
        customerName: 'Test Customer',
        customerEmail: 'customer@example.com',
        businessId: business.id,
        serviceId: cut.id,
        staffId: benId,
      },
    });
    // Noa has time off 11:00-12:00; her 60-minute service plus buffer cannot start after 10:00.
    await asOwner(http().post(`/api/v1/staff/${noaId}/time-off`), owner)
      .send({
        startsAt: localStart(date, '11:00'),
        endsAt: localStart(date, '12:00'),
      })
      .expect(201);

    const result = await availability(date);
    const at = (hhmm: string) =>
      result.slots.find((slot) => slot.start === localStart(date, hhmm));

    expect(at('09:00')?.staffIds).toEqual([noaId]);
    // 10:00 is blocked for Ben by his booking buffer and for Noa by her time off after buffer.
    expect(at('10:00')).toBeUndefined();
    expect(at('10:15')?.staffIds).toEqual([benId]);
    expect(at('11:00')?.staffIds).toEqual([benId]);
    expect(at('12:00')?.staffIds).toEqual([benId, noaId]);
  });

  it('filters to one staff member when staffId is given', async () => {
    const date = localDay('Asia/Jerusalem', 10);
    const result = await availability(date, `&staffId=${noaId}`);
    expect(result.slots.every((slot) => slot.staffIds.join() === noaId)).toBe(
      true,
    );
    expect(result.slots).toHaveLength(29);
  });

  it('reports a month with days available, and no days in the past', async () => {
    const tomorrow = localDay('Asia/Jerusalem', 1);
    const month = tomorrow.slice(0, 7);
    const res = await http()
      .get(
        `/api/v1/public/lumen-studio/availability/month?serviceId=${cutId}&month=${month}`,
      )
      .expect(200);
    const days = bodyOf<MonthAvailability>(res).days;

    expect(days.find((day) => day.date === tomorrow)?.available).toBe(true);
    const pastMonth = DateTime.now()
      .setZone('Asia/Jerusalem')
      .minus({ months: 2 })
      .toFormat('yyyy-MM');
    const past = await http()
      .get(
        `/api/v1/public/lumen-studio/availability/month?serviceId=${cutId}&month=${pastMonth}`,
      )
      .expect(200);
    expect(
      bodyOf<MonthAvailability>(past).days.every((day) => !day.available),
    ).toBe(true);
  });

  it('keeps New York spring-forward days correct, so 09:00 local is 13:00 UTC after the switch', async () => {
    await asOwner(http().patch('/api/v1/business'), owner)
      .send({ timezone: 'America/New_York', maxAdvanceDays: 365 })
      .expect(200);
    const switchDay = nextSpringForward('America/New_York');

    const result = await availability(switchDay);
    const first = result.slots[0];
    expect(first.start).toBe(
      localStart(switchDay, '09:00', 'America/New_York'),
    );
    expect(first.start.endsWith('T13:00:00.000Z')).toBe(true);
    expect(result.slots.at(-1)?.start).toBe(
      localStart(switchDay, '16:00', 'America/New_York'),
    );
  });

  it('rejects malformed or impossible dates and unknown or inactive references', async () => {
    const base = '/api/v1/public/lumen-studio/availability';
    await http().get(`${base}?serviceId=${cutId}&date=2030-02-30`).expect(400);
    await http().get(`${base}?serviceId=${cutId}&date=2030/02/01`).expect(400);
    await http()
      .get(
        `/api/v1/public/lumen-studio/availability/month?serviceId=${cutId}&month=2030-13`,
      )
      .expect(400);
    await http().get(`/api/v1/public/no-such-studio`).expect(404);
    await http()
      .get(`${base}?serviceId=${inactiveServiceId}&date=2030-01-07`)
      .expect(404);
    await http()
      .get(`${base}?serviceId=${cutId}&date=2030-01-07&staffId=${talId}`)
      .expect(404);
  });
});
