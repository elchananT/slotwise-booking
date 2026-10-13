# Backend notes

Working notes from the backend build. Questions for the supervisor are at the end under **Open questions**.

## Setup decisions

- Scaffold uses `@nestjs/cli@11`. The `@latest` CLI is v12, and the contract fixes NestJS 11. Jest and ESLint are the Nest defaults.
- `@nestjs/jwt` and `@nestjs/passport` are pinned to `^11` (their latest majors target NestJS 12).
- `apps/api` is installed with `npm install --workspaces=false`. The root `package.json` declares `apps/*` as workspaces, so a normal install would hoist dependencies into the repo root and split the module tree.
- Configuration: `src/config/env.ts` loads `apps/api/.env` with `process.loadEnvFile` (already-set variables win). No `@nestjs/config` dependency.
- `DATABASE_URL_TEST` (database `slotwise_test`, same Postgres server) is used only by the e2e suite, so the seeded demo database is never reset by tests.
- `WEB_ORIGIN` (default `http://localhost:3102`) feeds the CORS origin.

## Data model

- `prisma/schema.prisma` is the contract's model block verbatim, plus the generator and datasource. One deviation: the contract's single-line `enum BookingStatus { ... }` is invalid Prisma syntax, so it is written one value per line with the same four values.
- Migration `init` is in `apps/api/prisma/migrations`. The `slotwise_test` database is created on the same Postgres container for e2e runs.

## Auth and throttling

- Owner auth lives in `src/auth`. Access token: JWT (HS256, `JWT_ACCESS_SECRET`, 15 min). Refresh token: JWT with a random `jti` (`JWT_REFRESH_SECRET`, 7 d). Only its SHA-256 is stored in `Owner.refreshTokenHash`.
- Rotation is a conditional `updateMany` on the stored hash, so a refresh token can be spent once. Replaying a spent token, or using one after logout, clears the hash and returns 401, which ends the session (reuse detection).
- `POST /auth/logout` takes no body and requires the bearer access token. The contract does not say which credential it takes; the bearer is the conservative reading.
- Every route is protected by a global guard by default. Only routes marked `@Public()` skip it (`register`, `login`, `refresh`, and later the public booking routes).
- Throttling: 120 requests/min per IP by default, 10/min on register and login, and 30/min on public booking routes (applied in step 5). Limits are skipped when `NODE_ENV=test`; `throttling.e2e-spec.ts` re-enables them for its own run.
- Prisma's agent guard blocks `prisma migrate reset`, so the e2e global setup runs the non-destructive `migrate deploy` and each test truncates tables instead. The guard was not overridden.

## Owner setup (business, services, staff, hours, time off)

Response shapes the frontend should rely on:

- `GET /business` returns 404 `Business not found` until the owner creates one. `POST` returns 201, `PATCH` returns 200, both with the same business view.
- Service view: `{id,name,description,durationMinutes,bufferMinutes,priceCents,currency,active}`. `GET /services` is a plain array sorted by name, not paginated. `DELETE` returns 204 and either hard-deletes the service or sets `active=false` when it has bookings.
- Staff view: `{id,name,title,active,serviceIds,services:[{id,name}],hours:[{weekday,startMinute,endMinute}]}`. `serviceIds` and `services` describe the same assignments. `GET /staff` is a plain array sorted by name.
- `PUT /staff/:id/hours` replaces every window and returns 200 `{hours}`. Windows on one weekday may touch but not overlap; an empty list is allowed.
- `POST /staff/:id/time-off` returns 201 with `{id,staffId,startsAt,endsAt,reason}`.

Interpretations (the contract is silent on these):

- Name, slug, timezone, minNotice and maxAdvance are non-nullable, so PATCH rejects `null` for them. Description, phone and address accept `null` to clear.
- Slug rules: 3-60 characters of lowercase letters, digits and single hyphens. Auto-generated slugs add a random suffix when the base is taken.
- Buffer is 0-240 minutes. Duration is 5-480 in multiples of 5. Currency is a 3-letter code and defaults to USD.
- Staff with bookings is deactivated on delete, not removed. Staff with no bookings is removed, and its hours and time off cascade with it.
- Time-off conflicts use the same window as booking overlap: a confirmed booking blocks `[startsAt, blockedUntil)`. `?force=true` creates the time off and leaves bookings unchanged.
- Owner isolation: every lookup filters by the owner's business id, so another owner's record returns 404 (`Service not found`, `Staff member not found`, `Time off not found`).

## Availability engine

- `src/availability/availability.engine.ts` is pure: it takes hours, time off, confirmed bookings and `now` as arguments and does no I/O. `availability.engine.spec.ts` (13 unit tests) covers simple days, split shifts, buffers after bookings and on the new appointment, time off, minimum notice, max advance, shared starts, and spring-forward days in Asia/Jerusalem (2030-03-29) and America/New_York (2030-03-10).
- `availability.service.ts` loads the schedules from Prisma. `public-availability.e2e-spec.ts` runs the same paths through the HTTP routes.

Interpretations:

- A candidate is blocked over `[start, start + duration + buffer)`. Time off and confirmed bookings are tested against that whole range, so buffers apply to time off as well as to bookings.
- Candidate starts are every 15 minutes from each window's start, and the service must end by the window end.
- Minimum notice is inclusive: a start exactly `minNoticeMinutes` after now is offered.
- Max advance is measured in business-local calendar days from now, inclusive.
- Windows are converted through local wall-clock minutes. A nonexistent local time (the spring-forward gap) shifts forward, as Luxon does.
- `staffIds` are ordered by staff name. The contract does not specify an order.
- Public responses: `GET /public/:slug` is `{business, services, staff}` with active items only; `staff[].serviceIds` lists active services only. Availability is `{date, timezone, slots:[{start, staffIds}]}`, and the month route is `{days:[{date, available}]}`, both as in the contract.
- An unknown or inactive service, an unknown business, or a staff member who is inactive or does not offer the service returns 404.
- Public routes are throttled at 30 requests/min per IP (`PUBLIC_THROTTLE`).

## Bookings

Public (`src/bookings/public-bookings.controller.ts`, throttled 30/min/IP):

- `POST /public/:slug/bookings` returns 201 with the booking view plus `manageToken` (43 random characters). References look like `SW-7K3Q9D` (no 0/O/1/I).
- The create runs in a transaction. It takes a Postgres advisory lock on every eligible staff member (sorted), re-reads availability under the lock, then inserts. Two parallel requests for one slot and one staff member give exactly one 201 and one 409 (tested). Random reference collisions are retried.
- With no `staffId`, the booking goes to the least busy eligible professional that day (fewest confirmed bookings; ties keep name order).
- Customer routes: `GET bookings/:token`, `POST bookings/:token/cancel` and `POST bookings/:token/reschedule` return 200 with the details view. `GET bookings/:token/ics` returns `text/calendar` with an attachment filename.
- Details view: `{reference,status,startsAt,endsAt,customerName,customerEmail,customerPhone,notes,service,staff,business,canChange}`. `canChange` is true while the booking is CONFIRMED and more than 2 hours away. It is an addition to the contract, used for the UI's button state.
- Cancel and reschedule are refused within 2 hours of the start (409, constant `CANCELLATION_WINDOW_HOURS`). The contract only names cancel, so applying the same window to reschedule is a conservative reading.
- A customer reschedule without `staffId` keeps the current professional. It goes through the same engine rules as creation, and the booking's own old slot is excluded from the conflict check.
- Cancel is a conditional `updateMany` on `status=CONFIRMED`, so two simultaneous cancels produce one state change and one email.

Owner (`src/bookings/owner-bookings.controller.ts`):

- `GET /bookings` is paginated, sorted by `startsAt` ascending. Filters: `from`/`to` (YYYY-MM-DD in the business zone, both inclusive, or an instant), `staffId`, `status`, `q` (customer name, email or reference, case-insensitive).
- `PATCH /bookings/:id/status` moves only CONFIRMED to COMPLETED, NO_SHOW or CANCELLED. Anything else is 409. Owner-set cancellation sends no email.
- `POST /bookings/:id/reschedule` may ignore working hours and notice, but it rejects past starts, overlaps with confirmed bookings and time off (409).
- Owner views omit `manageToken`.

Emails: confirmation on create and cancellation on customer cancel, both recorded in `EmailLog` (`src/emails`). Reschedule sends no email, because the contract lists only those two.

ICS: CRLF lines, folded at 75 characters, escaped text, `STATUS:CANCELLED` for cancelled bookings. `ics.spec.ts` covers it.

Open questions for the supervisor:

- Should a customer reschedule also write an EmailLog entry? The contract lists only confirmation and cancellation, so none is written.
- Should the 2-hour window also apply to customer reschedules? It does here, as a conservative reading.

## Dashboard and outbox

`GET /dashboard` (`src/dashboard`), with the math in `dashboard.stats.ts` (unit tested):

- `todayCount`: CONFIRMED bookings starting on the business-local day. `upcomingCount`: CONFIRMED bookings starting after now.
- `revenueCentsLast30`: sum of the current price of COMPLETED bookings in the trailing 30 local days. Bookings do not store a price snapshot, so a later price change shifts history. This is a known limitation.
- `bookingsByDay`: 30 entries, oldest first, ending today, counting non-cancelled bookings. Days with none show 0.
- `topServices`: up to 5 services by non-cancelled bookings in the trailing 30 days, ties by name.
- `utilizationByStaff`: for each active staff member, booked minutes over the same 30 days divided by working minutes from the weekly hours. Time off is not subtracted. Capped at 100 and reported as 0 when there are no working minutes.

`GET /emails` (`src/emails`) is the owner's outbox: paginated, newest first, `{id,to,subject,body,createdAt}`.
