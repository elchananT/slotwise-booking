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
