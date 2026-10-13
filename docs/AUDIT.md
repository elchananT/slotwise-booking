# Slotwise independent audit

Auditor: scope guard (read-only on source). All results below were re-run or probed live on 2026-10-13, not taken from the build agents' notes.
Line references are approximate where noted; paths are relative to the repo root.

## Summary

PASS 43 / FAIL 3 / DEVIATION 13 (counted over the numbered rows in sections 1-4 and 6, plus the 7 re-run commands; section 5 is a list of live requests, all of which passed)

The product is functionally solid and matches the contract. The blockers are public-release hygiene, not behaviour.

## 1. Scope

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1.1 | API routes vs contract: every contract route exists, same method/path | PASS | Swagger JSON at `/api/docs-json` lists 35 operations, all in the contract |
| 1.2 | Extra routes | PASS | Only `GET /staff/:id/time-off` is extra, and it is allowed (`docs/BACKEND_NOTES.md`) |
| 1.3 | Prisma schema vs contract model | PASS | `apps/api/prisma/schema.prisma` matches field for field; index `[staffId, startsAt]` present. Only difference is the enum written multi-line (valid Prisma) |
| 1.4 | Out of scope not built (payments, SMS/SMTP, customer accounts, multi-location, recurring, waitlist, calendar sync, i18n) | PASS | grep of src, prisma and package.json for stripe, twilio, nodemailer, smtp, googleapis, waitlist, recurr, i18n found nothing. The only hit is the landing copy saying these are excluded (`apps/web/src/components/landing/sections.tsx:238`) |
| 1.5 | Web calls only contract endpoints | PASS | All `fetch` is in `apps/web/src/lib/api.ts`; every path is in the contract |
| 1.6 | Required pages exist | PASS | Build route table: `/`, `/login`, `/register`, `/app`, `/app/setup`, `/app/calendar`, `/app/services`, `/app/staff`, `/app/bookings`, `/app/emails`, `/b/[slug]`, `/booking/[manageToken]` |
| 1.7 | Response shapes and status codes | DEVIATION | `GET /emails` returns a paginated `{items,page,pageSize,total}`; the contract says only "EmailLog, newest first". `GET /services` and `GET /staff` are plain arrays (documented). Reschedule and cancel return 200, not specified. Details view adds `canChange` (documented). All additive |
| 1.8 | Customer reschedule limited by the 2h window | DEVIATION | The contract names the window only for cancel (`apps/api/src/bookings/public-bookings.service.ts`). Documented as a conservative reading |
| 1.9 | Invalid `startsAt` (past or off-grid) on public create | DEVIATION | Returns 409 "That time is no longer available" instead of 400. Safe, but the message is misleading |

## 2. Core correctness

Engine probes were run from a scratch dir against the compiled `apps/api/dist/availability/availability.engine.js`.

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 2.1 | 15-minute grid | PASS | Starts every 15 minutes, last start `end - duration` |
| 2.2 | Grid anchoring | DEVIATION | The grid is anchored to the window start, not the clock. A 09:10 window yields 09:10, 09:25, 09:40. Contract is ambiguous; seed hours are aligned. P2 |
| 2.3 | Split shifts | PASS | No slots in the gap; unit test plus probe |
| 2.4 | Window ending at 24:00 | PASS | `localInstant` maps 1440 to next midnight; 23:00 slot offered on a normal day and on the NY fall-back day |
| 2.5 | Buffer after booking | PASS | A booking blocked to 10:15 yields the first free start at 10:15 |
| 2.6 | Buffer spilling past working hours | PASS | A 60 min service with a 30 min buffer in a 9-10 window is offered at 09:00. Spill is allowed, which matches the contract (the check is `start + duration <= window end`) |
| 2.7 | Booking spilling over midnight from the previous day | PASS | Blocks 00:00-00:30 correctly; the service loads a one-day margin |
| 2.8 | Time off | PASS | Overlap removes slots, touching ends are kept. Note: time off is also tested against the new appointment's buffer |
| 2.9 | Min notice at the exact cutoff | PASS | Inclusive: now 08:00 with 120 min notice gives a first slot at 10:00 |
| 2.10 | Max advance at the exact cutoff | PASS | Inclusive, measured in local calendar time |
| 2.11 | DST spring-forward (Asia/Jerusalem 2030-03-29, America/New_York 2030-03-10) | PASS | Unit tests present. A probe window 01:00-04:00 on the NY day gives 01:00-01:45 and 03:00 (2 real hours). A window inside the gap shifts forward |
| 2.12 | DST fall-back (NY 2030-11-03, Jerusalem 2030-10-27) | PASS | No unit test exists, but probes are correct: NY 00:00-04:00 gives 17 starts (5 real hours); Jerusalem 00:00-03:00 gives 13 starts (4 real hours) |
| 2.13 | "Any professional" merge | PASS | Each start is reported once with all `staffIds`. Probe: 09:00 lists both staff, later starts one |
| 2.14 | Least-busy assignment | PASS | 5 parallel any-pro requests at one slot gave exactly 2 x 201 (Noa Levi and Yael Cohen) and 3 x 409. Code is in `booking-placement.ts` (`leastBusyStaff`) |
| 2.15 | Double booking, same staff | PASS | 6 parallel POSTs gave one 201 and five 409. Overlap shifted by +15 minutes gives 409 |
| 2.16 | Lock mechanism | DEVIATION | It is a READ COMMITTED transaction plus `pg_advisory_xact_lock` per staff, with availability re-read under the lock. The contract allows this ("or Postgres advisory lock"), but it is not Serializable. Sound. The lock is taken only on `eligible` staff, so a reschedule to another staff locks both (correct) |
| 2.17 | Reschedule conflict | PASS | Two parallel reschedules into one slot gave one 200 and one 409; the booking's own slot is excluded from its check |
| 2.18 | Cancelled bookings free the slot | PASS | The slot reappears in availability and a rebook gives 201 |
| 2.19 | Time off over a confirmed booking | PASS | 409 unless `?force=true`; an inverted range gives 400 |
| 2.20 | Tests | PASS | Engine suite has 13 tests (simple day, split, buffers, time off, notice, advance, merge, 2 DST zones) plus a concurrency e2e |

## 3. Security

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 3.1 | Password hashing | PASS | bcryptjs with a cost constant; dummy-hash compare on unknown email (timing); password capped at 72 bytes (`auth.service.ts`, `register.dto.ts`) |
| 3.2 | Refresh rotation and reuse detection | PASS | Live: rotate gives new tokens; replaying the old token gives 401 and revokes the session, so the newer token also gives 401. Only the SHA-256 is stored |
| 3.3 | Access token | PASS | 15 min JWT. Logout returns 204 and clears the refresh hash (the access token stays valid until expiry, normal for stateless JWT) |
| 3.4 | Owner isolation | PASS | Second owner got 404 on 11 attempts at owner A's resources: booking read, status, reschedule, service patch and delete, hours, time-off create and list, staff create with A's `serviceId`; lists were empty |
| 3.5 | `manageToken` entropy | PASS | `randomBytes(32).toString('base64url')`, 256 bits, with a unique index; the bad-token response is an indistinguishable 404 |
| 3.6 | Public endpoints leak | PASS | Details view has no booking id, `businessId` or `blockedUntil`; staff summary is id, name, title. Public business shows active items only. Owner-only fields are absent |
| 3.7 | Throttling | PASS | Public routes 30/min: 40 GETs gave 26 x 200 and 14 x 429. Auth routes 10/min |
| 3.8 | Throttle scope and message | DEVIATION | The limit is per route, not shared across the public routes. The 429 body is `ThrottlerException: Too Many Requests`. No `trust proxy` setting, so behind a reverse proxy every client shares one IP. P2 |
| 3.9 | Validation whitelist | PASS | `whitelist` + `forbidNonWhitelisted`: extra property gives 400; bad email, empty name and notes over 500 characters all give 400. Bad date or month gives 400. Duration of 7 minutes, hours over 1440 and overlapping hours give 400. `pageSize=100000` gives 400 |
| 3.10 | Headers and CORS | PASS | helmet plus CORS pinned to `WEB_ORIGIN` |
| 3.11 | Secrets in git history | PASS | `.env` was never committed. `git ls-files` shows only `.env.example` files. Real secrets exist only in untracked `apps/api/.env` |
| 3.12 | Secrets handling | FAIL (P1) | Root `.gitignore` ignores only `.env`. `apps/api` has no `.gitignore` of its own, so `.env.local`, `.env.production` and the like would be tracked. `apps/web/.gitignore` covers `.env*` |

## 4. Re-run results

| Command | Result |
|---------|--------|
| `apps/api: npm run build` | PASS, no errors |
| `apps/api: npm run lint` | PASS, 0 problems |
| `apps/api: npm test` | PASS, 3 suites / 21 tests |
| `apps/api: npm run test:e2e` | PASS, 6 suites / 40 tests |
| `apps/web: tsc --noEmit` | PASS, exit 0 (see note) |
| `apps/web: npm run lint` | PASS, exit 0 |
| `apps/web: npm run build` | PASS, 13 static pages generated |

Note: `npx tsc --noEmit` inside `apps/web` printed "To get access to the TypeScript compiler" and failed to resolve; `./node_modules/.bin/tsc --noEmit` passes. Because the root `package.json` declares workspaces while each app is installed standalone, `npx` resolution is unreliable. Use `npm run typecheck`. P2.

## 5. Frontend / backend cross-check

API run on PORT=4092 against the freshly migrated and seeded dev DB. Seed re-run reported identical counts (4 services, 3 staff, 60 bookings, 60 emails), so it is idempotent.

| Request | Result |
|---------|--------|
| `GET /public/lumen-studio` | 200 `{business, services, staff}` matches `PublicBusiness` |
| `GET /public/lumen-studio/availability/month` | 200 `{days:[{date,available}]}` |
| `GET /public/lumen-studio/availability` | 200 `{date,timezone,slots:[{start,staffIds}]}` |
| `POST /public/lumen-studio/bookings` | 201 with `manageToken`; a duplicate gave 409 |
| `GET /public/bookings/:token` | 200 |
| `GET /public/bookings/:token/ics` | 200 `text/calendar`, attachment filename |
| `POST /public/bookings/:token/cancel` | 200 `CANCELLED`; a second cancel gave 409 |
| `POST /auth/login`, `/auth/refresh`, `/auth/logout` | 200, 200, 204 |
| `GET /auth/me` | 200 `{owner, business}`, handled by `api.auth.me` |
| `GET /dashboard` | 200 with all six contract fields |
| `GET /bookings?status=CONFIRMED&pageSize=2` | 200 paginated; items carry flat `serviceId` and `staffId` |
| `GET /emails?pageSize=100` | 200 `{items,...}` |
| `GET /services`, `/staff`, `/business`, `/staff/:id/time-off` | 200 |

Mismatches:
- `apps/web/src/lib/types.ts` declares `BookingRef.id` as required, but public booking payloads have no `id`. It is harmless at runtime and the type is wrong. P2.
- `apps/web/src/lib/api.ts` carries defensive adapters (`asList`, `normBooking`, a flat-or-nested `me`) because the front end was built before the back end. The API now matches the contract, so these are dead flexibility. P2.
- The web default base URL is port 4002 (contract), while I ran on 4092. This is expected.

## 6. Code quality and release hygiene

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 6.1 | `any`, `console.*`, TODO, commented-out code in the API | PASS | Only `console.log` and `console.error` in `apps/api/prisma/seed.ts:437,446` (acceptable for a seed script) |
| 6.2 | The same in the web app | DEVIATION | 8 `eslint-disable` lines (`react-hooks/set-state-in-effect`, `exhaustive-deps`) in `booking-demo.tsx`, `hours-editor.tsx`, `setup-wizard.tsx`, `use-query.ts`. No `any`, no console. P2 |
| 6.3 | Large file | DEVIATION | `apps/web/src/components/booking/public-flow.tsx` is 603 lines. P2 |
| 6.4 | Root README | FAIL (P0) | No `README.md` at the repo root |
| 6.5 | LICENSE | FAIL (P0) | No `LICENSE` file. `apps/api/package.json` says `"license": "UNLICENSED"` |
| 6.6 | Untracked root files | DEVIATION (P0) | `git status` shows `.gitignore`, `docker-compose.yml`, `package.json` and `docs/CONTRACT.md` are untracked. A clone of the repo would have no workspace root, no database setup and no spec (`docs/BACKEND_NOTES.md` and `FRONTEND_NOTES.md` are tracked) |
| 6.7 | Scaffold leftovers | DEVIATION | `apps/web/README.md` is the create-next-app boilerplate; `apps/web/AGENTS.md` is the generated "This is NOT the Next.js you know" block. Remove or replace both. P1 |
| 6.8 | Lockfiles | DEVIATION | `apps/api/package-lock.json` and `apps/web/package-lock.json`, none at the root. This is consistent with the standalone installs described in the notes, but the root `package.json` declares workspaces, so `npm install` at the root would create a third, hoisted tree. Pick one model. P1 |
| 6.9 | Tracked build artefacts | PASS | `dist`, `.next` and `*.tsbuildinfo` are ignored and not tracked |
| 6.10 | Agent notes in the public repo | DEVIATION | `docs/BACKEND_NOTES.md` (about 27 KB) and `FRONTEND_NOTES.md` contain "questions for the supervisor". Fine for design notes, but trim before release. P2 |
| 6.11 | Prisma config | DEVIATION | Build prints that `package.json#prisma` is deprecated and removed in Prisma 7. P2 |

## Dev DB state

My probe data (8 bookings, 10 email logs, 1 extra owner and business) was deleted afterwards. The dev DB now has 60 bookings. It also has 2 businesses and 3 owners, which were already there before my probes. They are not from this audit and may be leftovers from the build agents. The API process I started on port 4092 has been stopped.

## Prioritized fix list

**P0 (blocks a public release)**
1. Commit the untracked root files: `.gitignore`, `package.json`, `docker-compose.yml`, `docs/CONTRACT.md`.
2. Add a root `README.md` (what it is, ports, `docker compose up -d`, migrate, seed, demo login `owner@slotwise.dev` / `demo12345`, how to run the tests).
3. Add a `LICENSE` file and make the `package.json` licence fields agree with it.

**P1**
4. Change the root `.gitignore` to `.env*` with `!.env.example`, or add `apps/api/.gitignore`.
5. Replace or delete `apps/web/README.md` and `apps/web/AGENTS.md`.
6. Decide on workspaces versus standalone installs. Either remove `workspaces` from the root `package.json` and make the root scripts use `--prefix`, or install properly from the root with one lockfile.
7. Add a DST fall-back unit test (the probes pass, but nothing guards them) and a 24:00-window test.

**P2**
8. Return 400 for past or off-grid `startsAt` on create, or at least give a clearer message.
9. Set `trust proxy` for deployment; make the 429 message friendly.
10. Remove the defensive adapters in `apps/web/src/lib/api.ts` and fix `BookingRef.id` for public payloads.
11. Resolve the 8 `eslint-disable` lines; split `public-flow.tsx`.
12. Move the Prisma seed config out of `package.json` into `prisma.config.ts`.
13. Add a `typecheck` step to the root scripts, because `npx tsc` does not resolve in `apps/web`.
14. Decide whether grid starts should align to the clock quarter-hours instead of the window start.
