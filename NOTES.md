# Project Notes

Short orientation for the next session. Details live in `prd.md`, `WorkLog.md` and `FeatureAnalysis.md`.

## Where things stand
- **Done:** Feature 1 (role select, seat/PIN entry, app shell), Feature 2 (passenger restroom line), and real flight lookup on the welcome screen (AeroDataBox via Supabase Edge Function `flight-lookup`).
- **Next:** Feature 3, crew view of the restroom line, with the power to confirm or override whose turn it is.

## Key decisions
- **Customer:** sold to seatback IFE makers (Panasonic, Thales, Collins). It runs on seatback screens, so:
  - Seat entry is a demo stand-in. A real seatback already knows its seat.
  - Crew would use crew panels or tablets, not seatbacks.
  - In the air, a real install may use an onboard server instead of the cloud. That's why each backend lives behind one file in `src/services/`.
- **Stack:** React 19 + TypeScript + Vite, with Supabase for shared real-time data.
- **Design:** passengers get a "boarding pass" theme (ivory, ink, orange). Crew get a dark "ops console" theme (amber). The user rejected a generic AI-looking UI, so keep this style.
- **Privacy rule:** store preferences and usage, not people. Never show passengers other seats' info.

## How it works (quick map)
- **Features list:** `src/features.ts`. Each role's nav and home tiles come from it. A new feature = one entry + one screen.
- **Flight data:** `src/context/FlightContext.tsx` holds the current flight (`useFlight()` gives `flight`, `flightId`, `progress`, `remaining`). `src/data/flight.ts` has `DEMO_FLIGHT`, the demo crew PIN (`1234`) and helpers.
- **Edge Functions:** in `supabase/functions/`. Deploy with `supabase functions deploy <name>` (CLI is logged in and linked). Secrets are set in the dashboard.
- **Backend pattern** (copy it for new features):
  - SQL migration in `supabase/migrations/`. The user runs it in the Supabase SQL Editor.
  - The browser gets read-only grants; all writes go through `security definer` functions.
  - Calls go in `src/services/*`, and a hook in `src/hooks/*` turns them into UI state.

## Setup gotchas
- **`.env.local`** (gitignored) needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never put the secret key in it.
- **Restart `npm run dev`** after changing `.env.local`.
- **`.env.local` uses `KEY = value` with spaces.** Vite accepts it but shell `source` doesn't. `VITE_SUPABASE_URL` ends in `/rest/v1/`; the client keeps only the origin.
- **`supabase login` needs a real terminal.** It fails through the `!` prefix (non-TTY).
- **New tables need explicit `grant select ... to anon`** (see migration 0002). Otherwise you get "permission denied".

## Workflow rules (from the user)
- One feature at a time. Ask before editing `CLAUDE.md` or `prd.md`.
- Commit only after the user approves a feature. Update WorkLog and FeatureAnalysis for each feature.
- Flag risky ideas or missing features as suggestions for the user to approve.
