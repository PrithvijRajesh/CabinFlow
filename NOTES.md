# Project Notes

Short orientation for the next session. Details live in `prd.md`, `WorkLog.md` and `FeatureAnalysis.md`.

## Where things stand
- **Done:** Feature 1 (role select, seat entry, app shell), Feature 2 (passenger restroom line), Feature 3 (crew restroom queue + pause line), Feature 4 (crew snack cart, complimentary, one-tap standard cart), Feature 5 (passenger drink + snack pick with ice / cream / sugar), Feature 6 (crew orders: load-up totals, by seat, served), Feature 7 (passenger assistance requests), Feature 8 (crew requests + urgent banner), Feature 9 (flight info with live NOAA turbulence + destination weather via Edge Function `flight-weather`). Flight lookup uses AeroDataBox via Edge Function `flight-lookup`; crew set the flight on crew Home.
- **Phase:** all 9 PRD features exist. Now refining features so they work properly.
- **Done (refinement):** crew login (Supabase Auth + `crew_members`) and aircraft flight setup on crew Home (`aircraft_flights`, aircraft `DEMO-1`).
- **Done (refinement):** flight-phase rules (before takeoff: Restroom + Assistance off, Snacks on; after landing: Restroom + Snacks off). Crew override on crew Home. UI-only enforcement.
- **Next:** the user has noticed other issues to raise. Ask for them.
- **Drink serve types:** cold (ice), hot (cream + sugar), plain (no options).
- **Post-MVP idea (user agreed, deferred):** two-phase restroom turn (2 min to acknowledge, 10 min crew flag, 15 min auto-release). See FeatureAnalysis, Feature 3.
- **Crew UX principle:** crew screens should be glance-and-fix, not babysat. Automate the routine; crew act only on exceptions.

## Key decisions
- **Customer:** sold to seatback IFE makers (Panasonic, Thales, Collins). It runs on seatback screens, so:
  - Seat entry is a demo stand-in. A real seatback already knows its seat.
  - Crew would use crew panels or tablets, not seatbacks.
  - In the air, a real install may use an onboard server instead of the cloud. That's why each backend lives behind one file in `src/services/`.
- **Stack:** React 19 + TypeScript + Vite, with Supabase for shared real-time data.
- **Design:** passengers get a "boarding pass" theme (ivory, ink, orange). Crew get a dark "ops console" theme (amber). The user rejected a generic AI-looking UI, so keep this style.
- **Privacy rule:** store preferences and usage, not people. Never show passengers other seats' info.

## How it works (quick map)
- **Shared hooks live in `AppShell`** (restroom, cart, picks, crew orders, assistance, crew assistance) and are passed down as props. Don't open a second realtime channel with the same name.
- **Features list:** `src/features.ts`. Each role's nav and home tiles come from it. A new feature = one entry + one screen.
- **Crew login:** demo crew account is `crew@email.com` (password set by the user, not stored here). Public sign-ups must stay off.
- **Flight data:** `src/context/FlightContext.tsx` holds the current flight (`useFlight()` gives `flight`, `flightId`, `progress`, `remaining`). `src/data/flight.ts` has `DEMO_FLIGHT`, `AIRCRAFT_ID` and helpers. The flight itself is set by crew in `aircraft_flights`.
- **Edge Functions:** in `supabase/functions/`. Deploy with `supabase functions deploy <name>` (CLI is logged in and linked). Secrets are set in the dashboard.
- **Backend pattern** (copy it for new features):
  - SQL migration in `supabase/migrations/`. The user runs it in the Supabase SQL Editor.
  - The browser gets read-only grants; all writes go through `security definer` functions.
  - Calls go in `src/services/*`, and a hook in `src/hooks/*` turns them into UI state.

## Setup gotchas
- **`.env.local`** (gitignored) needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never put the secret key in it.
- **Restart `npm run dev`** after changing `.env.local`.
- **`.env.local` uses `KEY = value` with spaces.** Vite accepts it but shell `source` doesn't. `VITE_SUPABASE_URL` ends in `/rest/v1/`; the client keeps only the origin.
- **SQL check constraints pass on NULL.** Write `x is not null and ...` explicitly.
- **SQL `with ordinality` only works on set-returning functions** (e.g. `unnest`), not on a `VALUES` list. There's no local Postgres, so the SQL Editor is the first real syntax check.
- **`supabase login` needs a real terminal.** It fails through the `!` prefix (non-TTY).
- **New tables need explicit `grant select ... to anon`** (see migration 0002). Otherwise you get "permission denied".

## Workflow rules (from the user)
- One feature at a time. Ask before editing `CLAUDE.md` or `prd.md`.
- Commit only after the user approves a feature. Update WorkLog and FeatureAnalysis for each feature.
- Flag risky ideas or missing features as suggestions for the user to approve.
