import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  bodyOf,
  createTestApp,
  HttpClient,
  resetDatabase,
} from './support/test-app';
import { asOwner, OwnerSession, registerOwner } from './support/owners';

interface BusinessBody {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  description: string | null;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
}

interface ServiceBody {
  id: string;
  name: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceCents: number;
  currency: string;
  active: boolean;
}

interface StaffBody {
  id: string;
  name: string;
  serviceIds: string[];
  services: { id: string; name: string }[];
  hours: { weekday: number; startMinute: number; endMinute: number }[];
}

interface HoursBody {
  hours: { weekday: number; startMinute: number; endMinute: number }[];
}

describe('Business setup (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: () => HttpClient;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    http = ctx.http;
  });

  beforeEach(() => resetDatabase(prisma));

  afterAll(() => app.close());

  async function createBusiness(
    session: OwnerSession,
    overrides: Record<string, unknown> = {},
  ): Promise<BusinessBody> {
    const res = await asOwner(http().post('/api/v1/business'), session)
      .send({
        name: 'Lumen Studio',
        timezone: 'Asia/Jerusalem',
        ...overrides,
      })
      .expect(201);
    return bodyOf<BusinessBody>(res);
  }

  async function createService(
    session: OwnerSession,
    name: string,
    durationMinutes = 60,
  ): Promise<ServiceBody> {
    const res = await asOwner(http().post('/api/v1/services'), session)
      .send({ name, durationMinutes, priceCents: 15000 })
      .expect(201);
    return bodyOf<ServiceBody>(res);
  }

  async function createStaff(
    session: OwnerSession,
    name: string,
    serviceIds: string[],
  ): Promise<StaffBody> {
    const res = await asOwner(http().post('/api/v1/staff'), session)
      .send({ name, serviceIds })
      .expect(201);
    return bodyOf<StaffBody>(res);
  }

  describe('business', () => {
    it('creates one business per owner with an auto-generated slug', async () => {
      const owner = await registerOwner(http, 'a@example.com');
      const business = await createBusiness(owner);

      expect(business.slug).toBe('lumen-studio');
      expect(business.timezone).toBe('Asia/Jerusalem');
      expect(business.minNoticeMinutes).toBe(120);
      expect(business.maxAdvanceDays).toBe(60);

      await asOwner(http().post('/api/v1/business'), owner)
        .send({ name: 'Second', timezone: 'Asia/Jerusalem' })
        .expect(409);
    });

    it('returns 404 until the owner has a business', async () => {
      const owner = await registerOwner(http, 'b@example.com');
      await asOwner(http().get('/api/v1/business'), owner).expect(404);
      await createBusiness(owner);
      await asOwner(http().get('/api/v1/business'), owner).expect(200);
    });

    it('rejects an invalid timezone and a slug that is already taken', async () => {
      const first = await registerOwner(http, 'c@example.com');
      await asOwner(http().post('/api/v1/business'), first)
        .send({ name: 'Bad Zone', timezone: 'Mars/Olympus' })
        .expect(400);
      await createBusiness(first, { slug: 'studio-one' });

      const second = await registerOwner(http, 'd@example.com');
      const res = await asOwner(http().post('/api/v1/business'), second)
        .send({ name: 'Other', timezone: 'Asia/Jerusalem', slug: 'studio-one' })
        .expect(409);
      expect(bodyOf<{ message: string }>(res).message).toBe(
        'That URL slug is already taken',
      );
    });

    it('updates settings including notice and advance windows, and rejects null on required fields', async () => {
      const owner = await registerOwner(http, 'e@example.com');
      await createBusiness(owner);

      const res = await asOwner(http().patch('/api/v1/business'), owner)
        .send({ minNoticeMinutes: 60, maxAdvanceDays: 14, description: null })
        .expect(200);
      expect(bodyOf<BusinessBody>(res)).toMatchObject({
        minNoticeMinutes: 60,
        maxAdvanceDays: 14,
        description: null,
      });

      await asOwner(http().patch('/api/v1/business'), owner)
        .send({ name: null })
        .expect(400);
    });
  });

  describe('services', () => {
    it('validates duration in 5-minute steps and soft-disables a service only when it has bookings', async () => {
      const owner = await registerOwner(http, 'f@example.com');
      await createBusiness(owner);

      await asOwner(http().post('/api/v1/services'), owner)
        .send({ name: 'Odd', durationMinutes: 47, priceCents: 1000 })
        .expect(400);

      const service = await createService(owner, 'Haircut', 45);
      const listed = await asOwner(
        http().get('/api/v1/services'),
        owner,
      ).expect(200);
      expect(bodyOf<ServiceBody[]>(listed)).toEqual([
        expect.objectContaining({ id: service.id, currency: 'USD' }),
      ]);

      await asOwner(
        http().delete(`/api/v1/services/${service.id}`),
        owner,
      ).expect(204);
      const after = await asOwner(http().get('/api/v1/services'), owner);
      expect(bodyOf<ServiceBody[]>(after)).toEqual([]);
    });
  });

  describe('staff and weekly hours', () => {
    it('assigns services, replaces them on update, and returns services with hours', async () => {
      const owner = await registerOwner(http, 'g@example.com');
      await createBusiness(owner);
      const cut = await createService(owner, 'Cut');
      const color = await createService(owner, 'Color');

      const staff = await createStaff(owner, 'Noa', [cut.id]);
      expect(staff.serviceIds).toEqual([cut.id]);

      const updated = await asOwner(
        http().patch(`/api/v1/staff/${staff.id}`),
        owner,
      )
        .send({ serviceIds: [color.id], title: 'Senior stylist' })
        .expect(200);
      expect(bodyOf<StaffBody>(updated).serviceIds).toEqual([color.id]);
      expect(bodyOf<StaffBody>(updated).services).toEqual([
        { id: color.id, name: 'Color' },
      ]);
    });

    it('replaces all weekly hours and rejects overlapping windows', async () => {
      const owner = await registerOwner(http, 'h@example.com');
      await createBusiness(owner);
      const cut = await createService(owner, 'Cut');
      const staff = await createStaff(owner, 'Dan', [cut.id]);

      const res = await asOwner(
        http().put(`/api/v1/staff/${staff.id}/hours`),
        owner,
      )
        .send({
          hours: [
            { weekday: 0, startMinute: 540, endMinute: 720 },
            { weekday: 0, startMinute: 720, endMinute: 1020 },
            { weekday: 3, startMinute: 600, endMinute: 900 },
          ],
        })
        .expect(200);
      expect(bodyOf<HoursBody>(res).hours).toHaveLength(3);

      await asOwner(http().put(`/api/v1/staff/${staff.id}/hours`), owner)
        .send({
          hours: [
            { weekday: 1, startMinute: 540, endMinute: 900 },
            { weekday: 1, startMinute: 800, endMinute: 1000 },
          ],
        })
        .expect(400);

      const replaced = await asOwner(
        http().put(`/api/v1/staff/${staff.id}/hours`),
        owner,
      )
        .send({ hours: [] })
        .expect(200);
      expect(bodyOf<HoursBody>(replaced).hours).toEqual([]);
    });

    it('rejects time off that ends before it starts and deletes time off', async () => {
      const owner = await registerOwner(http, 'i@example.com');
      await createBusiness(owner);
      const cut = await createService(owner, 'Cut');
      const staff = await createStaff(owner, 'Eli', [cut.id]);

      await asOwner(http().post(`/api/v1/staff/${staff.id}/time-off`), owner)
        .send({
          startsAt: '2030-01-02T10:00:00Z',
          endsAt: '2030-01-02T09:00:00Z',
        })
        .expect(400);

      const created = await asOwner(
        http().post(`/api/v1/staff/${staff.id}/time-off`),
        owner,
      )
        .send({
          startsAt: '2030-01-02T09:00:00Z',
          endsAt: '2030-01-02T12:00:00Z',
          reason: 'Conference',
        })
        .expect(201);
      const timeOffId = bodyOf<{ id: string }>(created).id;

      await asOwner(
        http().delete(`/api/v1/time-off/${timeOffId}`),
        owner,
      ).expect(204);
      await asOwner(
        http().delete(`/api/v1/time-off/${timeOffId}`),
        owner,
      ).expect(404);
    });
  });

  describe('owner isolation', () => {
    it("answers 404 for another owner's services, staff, hours and time off", async () => {
      const alice = await registerOwner(http, 'alice@example.com');
      const bob = await registerOwner(http, 'bob@example.com');
      await createBusiness(alice, { name: 'Alice Studio' });
      await createBusiness(bob, { name: 'Bob Studio' });

      const aliceService = await createService(alice, 'Alice cut');
      const aliceStaff = await createStaff(alice, 'Alice staff', [
        aliceService.id,
      ]);
      const timeOffRes = await asOwner(
        http().post(`/api/v1/staff/${aliceStaff.id}/time-off`),
        alice,
      )
        .send({
          startsAt: '2030-01-02T09:00:00Z',
          endsAt: '2030-01-02T10:00:00Z',
        })
        .expect(201);
      const aliceTimeOff = bodyOf<{ id: string }>(timeOffRes).id;

      const bobsServices = await asOwner(
        http().get('/api/v1/services'),
        bob,
      ).expect(200);
      expect(bodyOf<ServiceBody[]>(bobsServices)).toEqual([]);

      await asOwner(http().patch(`/api/v1/services/${aliceService.id}`), bob)
        .send({ name: 'Hijacked' })
        .expect(404);
      await asOwner(
        http().delete(`/api/v1/services/${aliceService.id}`),
        bob,
      ).expect(404);
      await asOwner(http().patch(`/api/v1/staff/${aliceStaff.id}`), bob)
        .send({ name: 'Hijacked' })
        .expect(404);
      await asOwner(
        http().delete(`/api/v1/staff/${aliceStaff.id}`),
        bob,
      ).expect(404);
      await asOwner(http().put(`/api/v1/staff/${aliceStaff.id}/hours`), bob)
        .send({ hours: [] })
        .expect(404);
      await asOwner(http().post(`/api/v1/staff/${aliceStaff.id}/time-off`), bob)
        .send({
          startsAt: '2030-01-02T09:00:00Z',
          endsAt: '2030-01-02T10:00:00Z',
        })
        .expect(404);
      await asOwner(
        http().delete(`/api/v1/time-off/${aliceTimeOff}`),
        bob,
      ).expect(404);
      await asOwner(http().post('/api/v1/staff'), bob)
        .send({ name: 'Sneaky', serviceIds: [aliceService.id] })
        .expect(404);

      const stillAlice = await asOwner(
        http().get('/api/v1/services'),
        alice,
      ).expect(200);
      expect(bodyOf<ServiceBody[]>(stillAlice)[0].name).toBe('Alice cut');
    });
  });
});
