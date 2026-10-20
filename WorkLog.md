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
