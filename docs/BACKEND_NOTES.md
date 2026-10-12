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
