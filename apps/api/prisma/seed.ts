import { randomBytes } from 'node:crypto';
import { BookingStatus, Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DateTime } from 'luxon';

const OWNER_EMAIL = 'owner@slotwise.dev';
const OWNER_PASSWORD = 'demo12345';
const OWNER_NAME = 'Maya Ben-David';
const BUSINESS = {
  name: 'Lumen Studio',
  slug: 'lumen-studio',
  timezone: 'Asia/Jerusalem',
  description: 'A calm studio for hair, colour, nails and skin.',
  phone: '+972 3 555 0142',
  address: 'Dizengoff 99, Tel Aviv',
};
const CURRENCY = 'ILS';
const SCHEDULE_SEED = 20_261_012;
const BOOKING_COUNT = 60;
const DAY_RANGE = 21;
const SLOT_STEP = 15;
const CUSTOMERS = [
  'Dana Levy',
  'Tomer Shalev',
  'Shira Katz',
  'Eitan Mizrahi',
  'Lior Peretz',
  'Gal Ohayon',
  'Noa Friedman',
  'Amit Rosen',
  'Hila Dror',
  'Omer Bar',
  'Roni Azulay',
  'Michal Sasson',
  'Yoav Tal',
  'Talia Weiss',
  'Ido Hadad',
  'Sapir Golan',
  'Itay Malka',
  'Mor Biton',
  'Ariel Stern',
  'Keren Oz',
];

/** Small deterministic PRNG (mulberry32) so the demo schedule is identical on every run. */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

function generateReference(random: () => number, taken: Set<string>): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += alphabet[Math.floor(random() * alphabet.length)];
    }
    const reference = `SW-${code}`;
    if (!taken.has(reference)) {
      taken.add(reference);
      return reference;
    }
  }
}

interface ServiceSeed {
  key: string;
  name: string;
  description: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceCents: number;
}

interface StaffSeed {
  key: string;
  name: string;
  title: string;
  serviceKeys: string[];
  /** Weekday 0 = Sunday. */
  hours: { weekday: number; startMinute: number; endMinute: number }[];
}

const SERVICES: ServiceSeed[] = [
  {
    key: 'haircut',
    name: 'Signature Haircut',
    description: 'Consultation, cut and blow-dry.',
    durationMinutes: 45,
    bufferMinutes: 10,
    priceCents: 19_000,
  },
  {
    key: 'color',
    name: 'Balayage Colour',
    description: 'Hand-painted highlights with gloss.',
    durationMinutes: 120,
    bufferMinutes: 15,
    priceCents: 65_000,
  },
  {
    key: 'manicure',
    name: 'Gel Manicure',
    description: 'Shape, cuticle care and gel finish.',
    durationMinutes: 45,
    bufferMinutes: 5,
    priceCents: 14_000,
  },
  {
    key: 'facial',
    name: 'Deep Hydration Facial',
    description: 'Cleanse, exfoliate and hydrate.',
    durationMinutes: 60,
    bufferMinutes: 10,
    priceCents: 32_000,
  },
];

const WORKDAYS = [0, 1, 2, 3, 4];

const STAFF: StaffSeed[] = [
  {
    key: 'noa',
    name: 'Noa Levi',
    title: 'Senior stylist',
    serviceKeys: ['haircut', 'color', 'facial'],
    hours: [
      ...WORKDAYS.flatMap((weekday) => [
        { weekday, startMinute: 540, endMinute: 780 },
        { weekday, startMinute: 900, endMinute: 1140 },
      ]),
      { weekday: 5, startMinute: 540, endMinute: 780 },
    ],
  },
  {
    key: 'yael',
    name: 'Yael Cohen',
    title: 'Colourist',
    serviceKeys: ['color', 'haircut'],
    hours: [
      ...WORKDAYS.map((weekday) => ({
        weekday,
        startMinute: 600,
        endMinute: 1080,
      })),
      { weekday: 5, startMinute: 540, endMinute: 720 },
    ],
  },
  {
    key: 'dan',
    name: 'Dan Avraham',
    title: 'Nail and skin technician',
    serviceKeys: ['manicure', 'facial'],
    hours: WORKDAYS.flatMap((weekday) => [
      { weekday, startMinute: 540, endMinute: 780 },
      { weekday, startMinute: 840, endMinute: 1080 },
    ]),
  },
];

/** Time off for one professional, placed a fixed number of days ahead of today. */
const TIME_OFF = {
  staffKey: 'yael',
  daysAhead: 12,
  startMinute: 780,
  endMinute: 1020,
  reason: 'Training day',
};

async function resetDemoData(
  tx: Prisma.TransactionClient,
  ownerId: string,
): Promise<void> {
  const existing = await tx.business.findUnique({
    where: { ownerId },
    select: { id: true },
  });
  if (!existing) {
    return;
  }
  // Bookings reference services and staff without cascading, so they go first.
  await tx.emailLog.deleteMany({ where: { businessId: existing.id } });
  await tx.booking.deleteMany({ where: { businessId: existing.id } });
  await tx.business.delete({ where: { id: existing.id } });
}

async function seedDemo(prisma: PrismaClient): Promise<void> {
  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 12);
  const owner = await prisma.owner.upsert({
    where: { email: OWNER_EMAIL },
    update: { name: OWNER_NAME, passwordHash, refreshTokenHash: null },
    create: { email: OWNER_EMAIL, name: OWNER_NAME, passwordHash },
  });

  await prisma.$transaction(
    async (tx) => {
      await resetDemoData(tx, owner.id);
      await buildBusiness(tx, owner.id);
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
}

async function buildBusiness(
  tx: Prisma.TransactionClient,
  ownerId: string,
): Promise<void> {
  const business = await tx.business.create({
    data: { ...BUSINESS, ownerId, minNoticeMinutes: 120, maxAdvanceDays: 60 },
  });

  const serviceIds = new Map<string, string>();
  const services = new Map<string, ServiceSeed>();
  for (const seed of SERVICES) {
    const service = await tx.service.create({
      data: {
        businessId: business.id,
        name: seed.name,
        description: seed.description,
        durationMinutes: seed.durationMinutes,
        bufferMinutes: seed.bufferMinutes,
        priceCents: seed.priceCents,
        currency: CURRENCY,
      },
    });
    serviceIds.set(seed.key, service.id);
    services.set(seed.key, seed);
  }

  const staffIds = new Map<string, string>();
  for (const seed of STAFF) {
    const staff = await tx.staff.create({
      data: {
        businessId: business.id,
        name: seed.name,
        title: seed.title,
        services: {
          create: seed.serviceKeys.map((key) => ({
            serviceId: serviceIds.get(key)!,
          })),
        },
        hours: { create: seed.hours },
      },
    });
    staffIds.set(seed.key, staff.id);
  }

  const timeOffStart = DateTime.now()
    .setZone(BUSINESS.timezone)
    .startOf('day')
    .plus({ days: TIME_OFF.daysAhead })
    .plus({ minutes: TIME_OFF.startMinute });
  const timeOffEnd = DateTime.now()
    .setZone(BUSINESS.timezone)
    .startOf('day')
    .plus({ days: TIME_OFF.daysAhead })
    .plus({ minutes: TIME_OFF.endMinute });
  await tx.timeOff.create({
    data: {
      staffId: staffIds.get(TIME_OFF.staffKey)!,
      startsAt: timeOffStart.toJSDate(),
      endsAt: timeOffEnd.toJSDate(),
      reason: TIME_OFF.reason,
    },
  });

  await seedBookings(tx, {
    businessId: business.id,
    serviceIds,
    services,
    staffIds,
    staff: STAFF,
  });
}

interface BookingPlan {
  businessId: string;
  serviceIds: Map<string, string>;
  services: Map<string, ServiceSeed>;
  staffIds: Map<string, string>;
  staff: StaffSeed[];
}

async function seedBookings(
  tx: Prisma.TransactionClient,
  plan: BookingPlan,
): Promise<void> {
  const random = createRandom(SCHEDULE_SEED);
  const zone = BUSINESS.timezone;
  const now = DateTime.now().setZone(zone);
  const taken = new Set<string>();
  // Blocked intervals per staff member, so generated bookings never overlap.
  const blocked = new Map<string, { start: number; end: number }[]>();
  for (const staffId of plan.staffIds.values()) {
    blocked.set(staffId, []);
  }
  const timeOff = await tx.timeOff.findMany({
    where: { staff: { businessId: plan.businessId } },
  });
  for (const off of timeOff) {
    blocked
      .get(off.staffId)
      ?.push({ start: off.startsAt.getTime(), end: off.endsAt.getTime() });
  }

  const rows: Prisma.BookingCreateManyInput[] = [];
  const emails: Prisma.EmailLogCreateManyInput[] = [];
  let attempts = 0;
  while (rows.length < BOOKING_COUNT && attempts < 5000) {
    attempts++;
    const serviceKey = pick(random, [...plan.services.keys()]);
    const service = plan.services.get(serviceKey)!;
    const eligible = plan.staff.filter((member) =>
      member.serviceKeys.includes(serviceKey),
    );
    const member = pick(random, eligible);
    const staffId = plan.staffIds.get(member.key)!;

    const dayOffset = Math.floor(random() * (2 * DAY_RANGE + 1)) - DAY_RANGE;
    const day = now.startOf('day').plus({ days: dayOffset });
    const windows = member.hours.filter(
      (window) => window.weekday === day.weekday % 7,
    );
    if (windows.length === 0) {
      continue;
    }
    const window = pick(random, windows);
    const slotCount = Math.floor(
      (window.endMinute - window.startMinute - service.durationMinutes) /
        SLOT_STEP,
    );
    if (slotCount < 0) {
      continue;
    }
    const startMinute =
      window.startMinute + Math.floor(random() * (slotCount + 1)) * SLOT_STEP;
    const startsAt = day.plus({ minutes: startMinute });
    const endsAt = startsAt.plus({ minutes: service.durationMinutes });
    const blockedEnd = endsAt.plus({ minutes: service.bufferMinutes });

    const staffBlocks = blocked.get(staffId) ?? [];
    const overlaps = staffBlocks.some(
      (range) =>
        startsAt.toMillis() < range.end && range.start < blockedEnd.toMillis(),
    );
    if (overlaps) {
      continue;
    }

    const past = startsAt < now;
    const roll = random();
    let status: BookingStatus;
    if (past) {
      status =
        roll < 0.8
          ? BookingStatus.COMPLETED
          : roll < 0.9
            ? BookingStatus.NO_SHOW
            : BookingStatus.CANCELLED;
    } else {
      status = roll < 0.9 ? BookingStatus.CONFIRMED : BookingStatus.CANCELLED;
    }
    if (status !== BookingStatus.CANCELLED) {
      staffBlocks.push({
        start: startsAt.toMillis(),
        end: blockedEnd.toMillis(),
      });
    }

    const customerName = pick(random, CUSTOMERS);
    const reference = generateReference(random, taken);
    const customerEmail = `${customerName.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`;
    rows.push({
      reference,
      manageToken: randomBytes(32).toString('base64url'),
      status,
      startsAt: startsAt.toJSDate(),
      endsAt: endsAt.toJSDate(),
      blockedUntil: blockedEnd.toJSDate(),
      customerName,
      customerEmail,
      customerPhone: '+972 50 555 0100',
      businessId: plan.businessId,
      serviceId: plan.serviceIds.get(serviceKey)!,
      staffId,
    });
    emails.push({
      businessId: plan.businessId,
      to: customerEmail,
      subject: `Your booking ${reference} is confirmed`,
      body: `Hi ${customerName}, your ${service.name} with ${member.name} is confirmed. Reference: ${reference}.`,
      createdAt: startsAt.toJSDate(),
    });
  }

  if (rows.length !== BOOKING_COUNT) {
    throw new Error(
      `Seed generated ${rows.length} bookings, expected ${BOOKING_COUNT}`,
    );
  }
  await tx.booking.createMany({ data: rows });
  await tx.emailLog.createMany({ data: emails });
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await seedDemo(prisma);
    const business = await prisma.business.findUniqueOrThrow({
      where: { slug: BUSINESS.slug },
    });
    const counts = {
      services: await prisma.service.count({
        where: { businessId: business.id },
      }),
      staff: await prisma.staff.count({ where: { businessId: business.id } }),
      bookings: await prisma.booking.count({
        where: { businessId: business.id },
      }),
      emails: await prisma.emailLog.count({
        where: { businessId: business.id },
      }),
    };
    console.log(
      `Seeded ${BUSINESS.name} (${OWNER_EMAIL}): ${JSON.stringify(counts)}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
