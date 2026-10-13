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

const ZONE = 'Asia/Jerusalem';
const WEEK = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  startMinute: 540,
  endMinute: 1020,
}));

interface IdBody {
  id: string;
}

interface StatusBody {
  reference: string;
  status: string;
  manageToken?: string;
  serviceId: string;
  staffId: string;
  canChange: boolean;
  startsAt: string;
  staff: { id: string; name: string };
}

interface OwnerBookingBody {
  id: string;
  status: string;
  staff: { id: string };
  customerName: string;
  serviceId: string;
  staffId: string;
}

interface PageBody {
  items: OwnerBookingBody[];
  page: number;
  pageSize: number;
  total: number;
}

function localDay(days: number): string {
  return DateTime.now().setZone(ZONE).plus({ days }).toFormat('yyyy-MM-dd');
}

function at(date: string, hhmm: string): string {
  return DateTime.fromISO(`${date}T${hhmm}`, { zone: ZONE }).toUTC().toISO()!;
}

describe('Bookings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: () => HttpClient;
  let owner: OwnerSession;
  let cutId: string;
  let benId: string;
  let noaId: string;
  const day = localDay(5);

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    http = ctx.http;
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    owner = await registerOwner(http, 'bookings@example.com');
    await asOwner(http().post('/api/v1/business'), owner)
      .send({ name: 'Lumen Studio', timezone: ZONE })
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
    benId = await createStaff('Ben');
    noaId = await createStaff('Noa');
  });

  afterAll(() => app.close());

  async function createStaff(name: string): Promise<string> {
    const id = bodyOf<IdBody>(
      await asOwner(http().post('/api/v1/staff'), owner)
        .send({ name, serviceIds: [cutId] })
        .expect(201),
    ).id;
    await asOwner(http().put(`/api/v1/staff/${id}/hours`), owner)
      .send({ hours: WEEK })
      .expect(200);
    return id;
  }

  function book(startsAt: string, staffId?: string, name = 'Dana Customer') {
    return http().post('/api/v1/public/lumen-studio/bookings').send({
      serviceId: cutId,
      staffId,
      startsAt,
      customerName: name,
      customerEmail: 'dana@example.com',
    });
  }

  async function bookOk(
    startsAt: string,
    staffId?: string,
  ): Promise<StatusBody> {
    const res = await book(startsAt, staffId);
    return bodyOf<StatusBody>(res);
  }

  async function setNoticeZero(): Promise<void> {
    await asOwner(http().patch('/api/v1/business'), owner)
      .send({ minNoticeMinutes: 0 })
      .expect(200);
  }

  it('creates a booking with a reference, a manage token and a confirmation email', async () => {
    const created = await bookOk(at(day, '10:00'), benId);

    expect(created.reference).toMatch(/^SW-[A-Z2-9]{6}$/);
    expect(created.staffId).toBe(benId);
    expect(created.serviceId).toBe(cutId);
    expect(created.status).toBe('CONFIRMED');
    expect(created.manageToken!.length).toBeGreaterThanOrEqual(32);
    expect(created.canChange).toBe(true);

    const business = await prisma.business.findUniqueOrThrow({
      where: { slug: 'lumen-studio' },
    });
    const emails = await prisma.emailLog.findMany({
      where: { businessId: business.id },
    });
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe('dana@example.com');
    expect(emails[0].subject).toContain(created.reference);
  });

  it('lets exactly one of two parallel requests for the same slot succeed', async () => {
    const slot = at(day, '11:00');
    const [a, b] = await Promise.all([
      book(slot, benId),
      book(slot, benId, 'Other'),
    ]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const bookings = await prisma.booking.count({
      where: { startsAt: new Date(slot) },
    });
    expect(bookings).toBe(1);
  });

  it('assigns the least busy professional when no staff member is named', async () => {
    const first = await bookOk(at(day, '10:00'));
    expect(first.staff.id).toBe(benId);

    const second = await bookOk(at(day, '11:00'));
    expect(second.staff.id).toBe(noaId);
  });

  it('refuses times outside working hours and malformed instants', async () => {
    await book(at(day, '07:00')).expect(409);
    await http()
      .post('/api/v1/public/lumen-studio/bookings')
      .send({
        serviceId: cutId,
        startsAt: `${day}T10:00:00`,
        customerName: 'Dana',
        customerEmail: 'dana@example.com',
      })
      .expect(400);
  });

  it('shows a booking by manage token and cancels it once, emailing the customer', async () => {
    const created = await bookOk(at(day, '12:00'), benId);

    const shown = await http()
      .get(`/api/v1/public/bookings/${created.manageToken!}`)
      .expect(200);
    expect(bodyOf<StatusBody>(shown).reference).toBe(created.reference);
    expect(bodyOf<StatusBody>(shown)).toMatchObject({
      serviceId: cutId,
      staffId: benId,
    });

    await http()
      .post(`/api/v1/public/bookings/${created.manageToken!}/cancel`)
      .expect(200);
    const again = await http()
      .post(`/api/v1/public/bookings/${created.manageToken!}/cancel`)
      .expect(409);
    expect(bodyOf<{ message: string }>(again).message).toBe(
      'Only confirmed bookings can be cancelled',
    );

    const business = await prisma.business.findUniqueOrThrow({
      where: { slug: 'lumen-studio' },
    });
    const emails = await prisma.emailLog.findMany({
      where: { businessId: business.id },
    });
    expect(emails.map((email) => email.subject)).toContain(
      `Your booking ${created.reference} was cancelled`,
    );
  });

  it('refuses to cancel within two hours of the start', async () => {
    await setNoticeZero();
    const business = await prisma.business.findUniqueOrThrow({
      where: { slug: 'lumen-studio' },
    });
    const startsAt = new Date(Date.now() + 90 * 60_000);
    const booking = await prisma.booking.create({
      data: {
        reference: 'SW-NEAR01',
        manageToken: 'near-start-token-0000000000000000000000',
        startsAt,
        endsAt: new Date(startsAt.getTime() + 60 * 60_000),
        blockedUntil: new Date(startsAt.getTime() + 75 * 60_000),
        customerName: 'Late Customer',
        customerEmail: 'late@example.com',
        businessId: business.id,
        serviceId: cutId,
        staffId: benId,
      },
    });

    const res = await http()
      .post(`/api/v1/public/bookings/${booking.manageToken}/cancel`)
      .expect(409);
    expect(bodyOf<{ message: string }>(res).message).toContain('2 hours');
    const shown = await http()
      .get(`/api/v1/public/bookings/${booking.manageToken}`)
      .expect(200);
    expect(bodyOf<StatusBody>(shown).canChange).toBe(false);
  });

  it('reschedules to a free slot and refuses a slot held by another booking', async () => {
    const mine = await bookOk(at(day, '13:00'), benId);
    await bookOk(at(day, '15:00'), benId);

    await http()
      .post(`/api/v1/public/bookings/${mine.manageToken!}/reschedule`)
      .send({ startsAt: at(day, '15:00') })
      .expect(409);

    const moved = await http()
      .post(`/api/v1/public/bookings/${mine.manageToken!}/reschedule`)
      .send({ startsAt: at(day, '09:00') })
      .expect(200);
    expect(bodyOf<StatusBody>(moved).startsAt).toBe(at(day, '09:00'));
  });

  it('serves a calendar file for the booking', async () => {
    const created = await bookOk(at(day, '16:00'), benId);
    const res = await http()
      .get(`/api/v1/public/bookings/${created.manageToken!}/ics`)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/calendar');
    expect(res.headers['content-disposition']).toContain(
      `${created.reference}.ics`,
    );
    expect(res.text).toContain(
      `DTSTART:${at(day, '16:00').replace(/[-:]/g, '').replace('.000', '')}`,
    );
  });

  it("lists the owner's bookings with filters and pagination", async () => {
    await bookOk(at(day, '09:00'), benId);
    await bookOk(at(day, '11:30'), benId);
    const third = await bookOk(at(day, '11:00'), noaId);
    const cancelRes = await http()
      .post(`/api/v1/public/bookings/${third.manageToken!}/cancel`)
      .expect(200);
    expect(bodyOf<StatusBody>(cancelRes).status).toBe('CANCELLED');

    const page1 = await asOwner(
      http().get('/api/v1/bookings?page=1&pageSize=2'),
      owner,
    ).expect(200);
    const body1 = bodyOf<PageBody>(page1);
    expect(body1.total).toBe(3);
    expect(body1.items).toHaveLength(2);
    expect(body1.items[0].customerName).toBe('Dana Customer');
    expect(body1.items[0].serviceId).toBe(cutId);
    expect(typeof body1.items[0].staffId).toBe('string');

    const cancelled = await asOwner(
      http().get('/api/v1/bookings?status=CANCELLED'),
      owner,
    ).expect(200);
    expect(bodyOf<PageBody>(cancelled).total).toBe(1);

    const byStaff = await asOwner(
      http().get(`/api/v1/bookings?staffId=${benId}`),
      owner,
    ).expect(200);
    expect(bodyOf<PageBody>(byStaff).total).toBe(2);

    const byName = await asOwner(
      http().get('/api/v1/bookings?q=dana'),
      owner,
    ).expect(200);
    expect(bodyOf<PageBody>(byName).total).toBe(3);

    const byDay = await asOwner(
      http().get(`/api/v1/bookings?from=${day}&to=${day}`),
      owner,
    ).expect(200);
    expect(bodyOf<PageBody>(byDay).total).toBe(3);
  });

  it('changes status of a confirmed booking only once', async () => {
    const created = await bookOk(at(day, '09:00'), benId);
    const id = (
      await prisma.booking.findUniqueOrThrow({
        where: { reference: created.reference },
      })
    ).id;

    const done = await asOwner(
      http().patch(`/api/v1/bookings/${id}/status`),
      owner,
    )
      .send({ status: 'COMPLETED' })
      .expect(200);
    expect(bodyOf<OwnerBookingBody>(done).status).toBe('COMPLETED');

    await asOwner(http().patch(`/api/v1/bookings/${id}/status`), owner)
      .send({ status: 'NO_SHOW' })
      .expect(409);
    await asOwner(http().patch(`/api/v1/bookings/${id}/status`), owner)
      .send({ status: 'CONFIRMED' })
      .expect(400);
  });

  it('lets the owner reschedule, but not onto another booking', async () => {
    const first = await bookOk(at(day, '09:00'), benId);
    const id = (
      await prisma.booking.findUniqueOrThrow({
        where: { reference: first.reference },
      })
    ).id;
    await bookOk(at(day, '12:00'), benId);

    await asOwner(http().post(`/api/v1/bookings/${id}/reschedule`), owner)
      .send({ startsAt: at(day, '12:00'), staffId: benId })
      .expect(409);
    const moved = await asOwner(
      http().post(`/api/v1/bookings/${id}/reschedule`),
      owner,
    )
      .send({ startsAt: at(day, '17:30') })
      .expect(201);
    expect(bodyOf<{ startsAt: string }>(moved).startsAt).toBe(at(day, '17:30'));
  });

  it('refuses time off over a confirmed booking unless forced', async () => {
    await bookOk(at(day, '14:00'), benId);
    const body = { startsAt: at(day, '13:30'), endsAt: at(day, '15:00') };

    await asOwner(http().post(`/api/v1/staff/${benId}/time-off`), owner)
      .send(body)
      .expect(409);
    await asOwner(
      http().post(`/api/v1/staff/${benId}/time-off?force=true`),
      owner,
    )
      .send(body)
      .expect(201);
  });

  it("answers 404 for another owner's bookings", async () => {
    const created = await bookOk(at(day, '09:30'), benId);
    const id = (
      await prisma.booking.findUniqueOrThrow({
        where: { reference: created.reference },
      })
    ).id;
    const intruder = await registerOwner(http, 'intruder@example.com');
    await asOwner(http().post('/api/v1/business'), intruder)
      .send({ name: 'Other Studio', timezone: ZONE })
      .expect(201);

    await asOwner(http().get(`/api/v1/bookings/${id}`), intruder).expect(404);
    await asOwner(http().patch(`/api/v1/bookings/${id}/status`), intruder)
      .send({ status: 'CANCELLED' })
      .expect(404);
    await asOwner(http().post(`/api/v1/bookings/${id}/reschedule`), intruder)
      .send({ startsAt: at(day, '18:00') })
      .expect(404);
  });
});
