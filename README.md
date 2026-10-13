# Slotwise

A booking platform for appointment businesses (clinics, studios, barbers). A business owner sets up
services, staff and weekly hours and gets a public booking page; customers book a slot without an account
and manage it later through a private link.

**Stack:** NestJS 11 · Prisma 6 · PostgreSQL · Luxon · Next.js 16 (App Router) · Tailwind v4 · TypeScript

<!-- screenshots: add docs/screenshots/booking.png once captured -->

## Quick start

Requires Node 20+ and Docker.

```bash
npm run install:all
npm run db:up                           # Postgres 16 on localhost:5442

cp apps/api/.env.example apps/api/.env  # set the JWT secrets (openssl rand -hex 32)
cp apps/web/.env.example apps/web/.env.local

cd apps/api && npx prisma migrate deploy && npm run seed && cd ../..

npm run dev:api                         # http://localhost:4002  (Swagger: /api/docs)
npm run dev:web                         # http://localhost:3102
```

Owner login after seeding: `owner@slotwise.dev` / `demo12345`. The seeded business has a public page at
`/b/lumen-studio`.

## What's inside

- **Availability engine:** a pure, unit-tested module. 15-minute grid inside working-hour windows (split shifts supported), buffers after appointments, time off, minimum notice, maximum advance, and correct behaviour across daylight-saving changes (tested for Asia/Jerusalem and America/New_York). "Any professional" merges staff and assigns the least busy one.
- **No double bookings:** creating or rescheduling takes a per-staff advisory lock and re-checks availability inside the transaction. Six parallel requests for one slot give one `201` and five `409`s.
- **Customer flow:** service → professional → date and time → details → confirmation, then a private manage link to view, reschedule, cancel, or download an `.ics` file. Cancel and reschedule are allowed until 2 hours before the start.
- **Owner app:** setup wizard, dashboard, week calendar with staff lanes, services, staff with a drag-to-paint hours editor, bookings table with filters, and an outbox of the emails that would have been sent.
- **Auth:** JWT access tokens with rotating refresh tokens; owners can only ever see their own business (`404` otherwise).
- **API:** described by [`docs/CONTRACT.md`](docs/CONTRACT.md) and the Swagger UI.

## Tests

```bash
npm test               # API unit tests (availability engine, ICS, stats)
npm run test:e2e       # API end-to-end tests against real Postgres (uses the slotwise_test database)
```

An independent audit of the code against the contract is in [`docs/AUDIT.md`](docs/AUDIT.md). The frontend has no automated tests yet.

## Known limits

- Emails are written to an outbox table; nothing is actually sent. There are no payments.
- One refresh token per owner: signing in somewhere else ends the other session.
- The slot grid is anchored to each working window's start rather than to the clock.
- Throttling is per IP and does not read `X-Forwarded-For` yet, so put a trusted proxy setting in place before deploying behind one.

## License

MIT
