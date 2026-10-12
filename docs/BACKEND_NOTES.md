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
