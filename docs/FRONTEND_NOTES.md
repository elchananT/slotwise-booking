# Frontend notes (apps/web)

Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, `motion`, `lucide-react`, `luxon`. Dev port 3102, API from `NEXT_PUBLIC_API_URL` (default `http://localhost:4002/api/v1`, see `apps/web/.env.example`).

## What was built
- Design system: warm light-first tokens (3 cream, 2 ink, terracotta `#d9603b`, teal `#0f5c5c`), dark mode (system default + toggle), Erode (display) and Switzer (body) self-hosted from Fontshare, paper grain, ticket motif with perforation, pill buttons, big radii, native `<dialog>` modals, toasts, skeletons, empty and error states.
- `/` landing: interactive booking demo in the hero (autoplays slot selection, stops when the visitor interacts, honest "sample data" label), how it works, double-booking explainer, details, "Not here yet" list. No fake logos, quotes or stats.
- `/login`, `/register`, `/app/setup` (3-step wizard, resumes where the owner left off).
- `/app` dashboard (hand-written SVG/flex charts), `/app/calendar` (week view, one lane per staff, mobile single-day view, now line, click for detail, complete/no-show/cancel/reschedule), `/app/services` CRUD, `/app/staff` (details, services, drag-to-paint weekly-hours editor with keyboard support, time off), `/app/bookings` (filters, search, pagination), `/app/emails` (outbox viewer).
- `/b/[slug]` public booking: service, professional (or any), month calendar with availability dots, slot grid with time-zone label and "use my time zone" toggle, details, stamped confirmation with .ics link and manage link.
- `/booking/[manageToken]`: view, add to calendar, reschedule, cancel.
- `src/lib/api.ts`: typed client for every endpoint used, single-flight token refresh (access token in memory, refresh token in localStorage with try/catch).

## Verified (real evidence, real API with the seed, Playwright at 1440x900 and 390x844)
- Customer flow on `/b/lumen-studio`: service, any professional, date, slot, details, confirmation (reference SW-NPAARR). Then on the manage page: reschedule (new slot saved and shown) and cancel (status Cancelled, stamp shown). No 4xx responses during these flows.
- Second booking made as a customer for the next day appeared in the owner calendar lane; owner marked it Completed from the dialog.
- Owner login with `owner@slotwise.dev`, session restored after a hard reload; dashboard, calendar, services (create, edit, delete), staff (painted Sunday hours, saved, persisted after reload), time off (add, delete), bookings (Past/All presets, status filter), emails all load real data.
- Register a new owner, run the wizard (business, service, staff with hours), land on dashboard; `/b/wizard-barbers` then serves the new page.
- Overflow scan at 390 px on all pages: no element overflows the viewport outside its own scroll container. Dark mode checked on landing and calendar.
- `npx tsc --noEmit`, `eslint src` clean; `next build` passes (13 routes). Dev, API and Postgres servers started by me were stopped (Postgres container left running as found).

## Backend mismatches / observations
- `GET/PATCH/POST /bookings*` and public booking responses return nested `service` and `staff` and no flat `serviceId` / `staffId` (contract model lists them). The client derives them (`normBooking` in `api.ts`).
- `POST /services` rejects `active` (`property active should not exist`); the client only sends it on PATCH.
- Owner has a single refresh token slot: any new login (even from curl) invalidates the browser's stored session, which then lands on /login after reload. Expected from the rotation design; noted.
- `GET /staff` does not return time off, and there is no list-time-off endpoint, so the Time off panel only shows entries added in the current session (they can still be deleted).
- Seeded `EmailLog.createdAt` values are in the future (e.g. Nov 3), so the "newest first" outbox shows future-dated emails first.
- `GET /public/:slug` business has no `id`; not needed by the UI.

## Decisions
- `cacheComponents` / `partialPrefetching` set to `false` in `next.config.ts`: the app is fully client-fetched, and Activity-preserved hidden routes add nothing.
- `apps/web` was installed with `npm install --workspaces=false` (same as the API) to avoid hoisting fights while both apps were being installed concurrently; it has its own `package-lock.json`. Root `npm install` also works.
- Use `./node_modules/.bin/tsc` (plain `npx tsc` resolves to an unrelated package in this environment).

## Known gaps
- No component or e2e test suite for the web app; verification was manual in a real browser plus type/lint/build.
- The hours editor snaps to 30-minute cells (off-grid hours from the API would be rounded outward if re-saved).
- No business settings page (min notice, max advance days): `PATCH /business` is unused because the contract's page list has no settings screen.
- The owner reschedule picker uses the public availability endpoint, so minimum-notice rules apply to the owner too.
- Playwright was not used to exercise the 409 "slot just taken" UI path (backend covers it in e2e; the UI returns to the time step with a toast).
