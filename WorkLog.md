# Work Log

## Feature 1 — Role selection, welcome screen, app layout

- **2026-10-19** — Project scaffolded: Vite + React + TypeScript, `.gitignore` excludes `research/` and `Product Proposal.pdf`.
- **2026-10-19** — Role select screen (Passenger / Flight Attendant).
- **2026-10-19** — Passenger seat entry (validated, e.g. `23C`) and crew PIN sign-in (demo PIN).
- **2026-10-19** — App shell: top bar (flight, seat/crew badge, sign out), tab nav, home dashboard, "coming soon" placeholders for future features.
- **2026-10-20** — UI redesign: boarding-pass theme (passenger), ops-console theme (crew), on-screen keypad for seat/PIN, custom SVG icons, self-hosted fonts (Fraunces, IBM Plex Sans/Mono).
- **2026-10-20** — Fixed seat entry dropping fast key presses (stale state).
- **2026-10-20** — Feature 1 approved and committed.

## Feature 2 — Passenger restroom line

- **2026-10-20** — Supabase added as backend (approved). Client in `src/lib/supabase.ts`, config via `.env.local`.
- **2026-10-20** — Database: `restroom_queue` table + `restroom_join` / `restroom_finish` / `restroom_tick` functions, realtime enabled (`supabase/migrations/0001`, `0002`).
- **2026-10-20** — Passenger Restroom screen: join, live position, "your turn" with 5-min countdown, I'm back / give up, timed-out notice.
- **2026-10-20** — App-wide "your turn" banner and live status on the Home restroom tile.
- **2026-10-20** — Tested end-to-end with two passengers (12A, 23C) in separate tabs against the live database.
- **2026-10-20** — Feature 2 approved and committed.

## Flight lookup (real flight data)

- **2026-10-20** — AeroDataBox approved as flight data provider, called through a Supabase Edge Function so the key stays server-side.
- **2026-10-20** — Edge Function `flight-lookup` + `flight_cache` table (10-min cache to save API quota, `supabase/migrations/0003`).
- **2026-10-20** — Welcome screen: flight number lookup, "Use demo" reset, flight saved on the device. Flight strip, Home and restroom queue now use the selected flight.
- **2026-10-20** — Function deployed and tested: valid (UA1, "dl 1"), unknown (ZZ9999 → 404) and invalid (abc → 400) numbers; UI tested manually.
- **2026-10-20** — Flight lookup approved and committed.

## Feature 3 — Crew restroom queue

- **2026-10-20** — Database: `restroom_crew_action` (done / skip / call now / remove), `restroom_line_state` + `restroom_set_paused` (pause line), `ended_by` column; `restroom_tick` respects pause (`supabase/migrations/0004`).
- **2026-10-20** — Crew Restroom Queue screen: now-called card with countdown, waiting list with wait times, Call now / Remove, Confirm back / No-show, Pause / Resume line.
- **2026-10-20** — Passenger notices for crew-ended turns and paused line; live restroom count on crew Home.
- **2026-10-20** — Backend scenario tested on a test flight ID (all actions, pause/resume, invalid action); UI tested manually with crew + two passengers.
- **2026-10-20** — Feature 3 approved and committed. Two-phase turn (acknowledge + in use) logged as a post-MVP improvement.
