# Slotwise — API & Scope Contract (source of truth)

Slotwise is a booking platform for appointment businesses (clinics, studios, barbers).
A **business owner** configures services, staff and working hours and gets a public booking page.
**Customers** book a slot without needing an account. This file is the **only** spec;
anything not listed is out of scope.

## Repo layout (npm workspaces monorepo)

```
slotwise-booking/
  apps/api      NestJS 11 + TypeScript + Prisma + PostgreSQL
  apps/web      Next.js 16 (App Router) + Tailwind v4 + TypeScript
  docker-compose.yml   postgres:16 on host port 5442
  docs/CONTRACT.md
```

Ports: API `4002`, web `3102`, Postgres `5442`. API base path `/api/v1`.
DB URL: `postgresql://slotwise:slotwise@localhost:5442/slotwise`.

## Conventions

- JSON only. Instants are ISO-8601 UTC. Each business has an IANA `timezone`; all
  working-hour math happens in that zone (use `luxon`). IDs are `cuid`.
- Auth (owners only): Bearer JWT access token (15 min) + rotated refresh token (7 d, hashed in DB).
- Errors: `{ "statusCode", "error", "message" }`. Validation: class-validator whitelist.
- Paginated lists: `?page=1&pageSize=20` → `{ items, page, pageSize, total }`.
- Swagger at `/api/docs`. Throttle public booking routes (30/min/IP).
- Customer-facing actions are authorized by an unguessable `manageToken` on the booking.

## Data model (Prisma)

```prisma
enum BookingStatus { CONFIRMED CANCELLED COMPLETED NO_SHOW }

model Owner {
  id String @id @default(cuid())
  email String @unique
  name String
  passwordHash String
  refreshTokenHash String?
  createdAt DateTime @default(now())
  business Business?
}
model Business {
  id String @id @default(cuid())
  name String
  slug String @unique              // public page: /b/<slug>
  description String?
  timezone String                  // e.g. "Asia/Jerusalem"
  phone String?
  address String?
  minNoticeMinutes Int @default(120)   // cannot book sooner than this
  maxAdvanceDays Int @default(60)
  ownerId String @unique
  owner Owner @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  services Service[]
  staff Staff[]
  bookings Booking[]
}
model Service {
  id String @id @default(cuid())
  name String
  description String?
  durationMinutes Int              // 5..480, multiple of 5
  bufferMinutes Int @default(0)    // blocked after the appointment
  priceCents Int
  currency String @default("USD")
  active Boolean @default(true)
  businessId String
  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  staff StaffService[]
  bookings Booking[]
}
model Staff {
  id String @id @default(cuid())
  name String
  title String?
  active Boolean @default(true)
  businessId String
  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  services StaffService[]
  hours WorkingHours[]
  timeOff TimeOff[]
  bookings Booking[]
}
model StaffService {
  staffId String
  serviceId String
  staff Staff @relation(fields: [staffId], references: [id], onDelete: Cascade)
  service Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  @@id([staffId, serviceId])
}
model WorkingHours {
  id String @id @default(cuid())
  staffId String
  weekday Int                      // 0=Sunday .. 6=Saturday
  startMinute Int                  // minutes from local midnight, e.g. 540 = 09:00
  endMinute Int                    // > startMinute, <= 1440. Multiple rows per weekday allowed (split shifts)
  staff Staff @relation(fields: [staffId], references: [id], onDelete: Cascade)
}
model TimeOff {
  id String @id @default(cuid())
  staffId String
  startsAt DateTime
  endsAt DateTime
  reason String?
  staff Staff @relation(fields: [staffId], references: [id], onDelete: Cascade)
}
model Booking {
  id String @id @default(cuid())
  reference String @unique         // short human code, e.g. "SW-7K3Q9D"
  manageToken String @unique       // long random, used by customer to view/cancel/reschedule
  status BookingStatus @default(CONFIRMED)
  startsAt DateTime
  endsAt DateTime                  // startsAt + service.duration (buffer is NOT included here)
  blockedUntil DateTime            // endsAt + service.buffer; used for overlap checks
  customerName String
  customerEmail String
  customerPhone String?
  notes String?
  businessId String
  serviceId String
  staffId String
  createdAt DateTime @default(now())
  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  service Service @relation(fields: [serviceId], references: [id])
  staff Staff @relation(fields: [staffId], references: [id])
  @@index([staffId, startsAt])
}
model EmailLog {                   // "sent" emails are written here, no real SMTP
  id String @id @default(cuid())
  to String
  subject String
  body String
  businessId String
  createdAt DateTime @default(now())
}
```

Double-booking prevention is a hard requirement: creating/rescheduling a booking runs inside a
serializable transaction (or Postgres advisory lock per staff) and rejects overlap with any
`CONFIRMED` booking of the same staff where `[startsAt, blockedUntil)` intersects → **409**.

## Availability algorithm (the core of the product)

`slots(serviceId, date, staffId?)` for a business-local `date`:
1. For each eligible staff (active, offers the service, or the given one): take that weekday's
   `WorkingHours` windows.
2. Candidate starts every **15 minutes** inside each window such that
   `start + duration` ≤ window end.
3. Remove candidates that (a) start before `now + minNoticeMinutes`, (b) are beyond
   `maxAdvanceDays`, (c) overlap `TimeOff`, or (d) overlap an existing `CONFIRMED` booking
   when considering `[start, start + duration + buffer)`.
4. Return slots as UTC instants plus the staff who can take them. With no `staffId`
   ("any professional"), return each start once with `staffIds: string[]` and assign the
   least-busy staff on booking.
DST days must be correct (use luxon zones; add a unit test for a spring-forward day).

## Endpoints

### Owner auth
| POST | /auth/register | `{email,name,password(min 8)}` → `{owner, accessToken, refreshToken}` |
| POST | /auth/login | → same |
| POST | /auth/refresh | rotating refresh |
| POST | /auth/logout | 204 |
| GET | /auth/me | owner + business (or null) |

### Owner — business setup (all authenticated)
| POST | /business | `{name,slug?,timezone,description?,phone?,address?}` one per owner; slug auto if missing |
| GET | /business | |
| PATCH | /business | incl. `minNoticeMinutes`, `maxAdvanceDays` |
| GET/POST | /services | list / create |
| PATCH/DELETE | /services/:id | DELETE soft-disables (`active=false`) if it has bookings |
| GET/POST | /staff | list (with services & hours) / create `{name,title?,serviceIds[]}` |
| PATCH/DELETE | /staff/:id | `serviceIds` replaces assignments; DELETE disables if bookings exist |
| PUT | /staff/:id/hours | `{hours:[{weekday,startMinute,endMinute}]}` replaces all; validate no overlaps |
| POST | /staff/:id/time-off | `{startsAt,endsAt,reason?}` ; 409 if it overlaps confirmed bookings unless `?force=true` |
| DELETE | /time-off/:id | |

### Owner — operations
| GET | /bookings | `?from=&to=&staffId=&status=&q=` paginated, sorted by startsAt |
| GET | /bookings/:id | |
| PATCH | /bookings/:id/status | `{status}` CONFIRMED→COMPLETED / NO_SHOW / CANCELLED |
| POST | /bookings/:id/reschedule | `{startsAt, staffId?}` same conflict rules |
| GET | /dashboard | `{todayCount, upcomingCount, revenueCentsLast30, bookingsByDay:[{date,count}] (30d), topServices:[{name,count}], utilizationByStaff:[{staffId,name,percent}]}` |
| GET | /emails | EmailLog, newest first (acts as outbox viewer) |

### Public (no auth) — customer facing
| GET | /public/:slug | business, active services, active staff (id,name,title,serviceIds) |
| GET | /public/:slug/availability | `?serviceId=&date=YYYY-MM-DD&staffId?` → `{date,timezone,slots:[{start,staffIds[]}]}` |
| GET | /public/:slug/availability/month | `?serviceId=&month=YYYY-MM&staffId?` → `{days:[{date,available:boolean}]}` |
| POST | /public/:slug/bookings | `{serviceId,staffId?,startsAt,customerName,customerEmail,customerPhone?,notes?}` → booking + `manageToken`; writes a confirmation EmailLog |
| GET | /public/bookings/:manageToken | booking summary (service, staff, business, status) |
| POST | /public/bookings/:manageToken/cancel | allowed until 2h before start (configurable constant) ; writes EmailLog |
| POST | /public/bookings/:manageToken/reschedule | `{startsAt, staffId?}` |
| GET | /public/bookings/:manageToken/ics | `text/calendar` file |

## Backend acceptance bar (Haiku owns this)

- `build`, `lint`, `test`, `test:e2e` green. Must test: availability (working windows, buffer,
  time off, min notice, DST day, split shifts), concurrent double-booking attempts (two
  parallel POSTs for one slot → exactly one 201, one 409), cancel window, reschedule,
  owner isolation (owner A cannot read owner B's data → 404).
- Prisma migrations + `prisma/seed.ts`: business "Lumen Studio" (Asia/Jerusalem), 4 services,
  3 staff with realistic hours, ~60 bookings across past and next 3 weeks, owner
  `owner@slotwise.dev` / `demo12345`. Seed must be idempotent.
- `.env.example`, helmet, CORS for `http://localhost:3102`, structured error filter.

## Frontend acceptance bar (Sonnet owns this)

Pages: `/` marketing landing, `/login`, `/register`, onboarding wizard (`/app/setup`: business →
services → staff & hours), `/app` dashboard (charts), `/app/calendar` (week view of bookings by
staff, click for detail), `/app/services`, `/app/staff` (weekly-hours editor), `/app/bookings`
(table with filters), `/app/emails`, public `/b/[slug]` (service → professional → date/time →
details → confirmation, month calendar with availability dots, timezone label),
`/booking/[manageToken]` (view, cancel, reschedule, add-to-calendar).
Typed API client, loading/empty/error states, responsive to 390 px, keyboard accessible, dark+light.
Design quality bar: premium and hand-made; warm tokens, big radii, restrained motion via `motion`.

## Out of scope (do not build)

Payments, real email/SMS delivery, customer accounts, multi-location, recurring bookings,
waitlists, Google Calendar sync, i18n, mobile apps.
