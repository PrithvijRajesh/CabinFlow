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

## Feature 4 — Crew snack cart setup

- **2026-10-20** — Database: `cart_items` table + `cart_add` / `cart_set_stock` / `cart_remove` / `cart_load_standard` functions, realtime enabled (`supabase/migrations/0005`).
- **2026-10-20** — Crew Cart & Orders screen: load standard cart, Drinks/Snacks lists, in stock / out toggle, remove, add item with duplicate check, restore missing standard items.
- **2026-10-20** — Fixed standard cart loading in random order (staggered `created_at` via `unnest ... with ordinality`).
- **2026-10-20** — Backend tested on a test flight ID (load twice, trim, case-insensitive duplicates, stock, remove, bad input, direct insert blocked, wrong flight); UI tested manually.
- **2026-10-20** — Feature 4 approved and committed.

## Feature 5 — Passenger snack and drink picks

- **2026-10-20** — Database: `serve` (hot/cold) on `cart_items`, `cart_add` takes serve, standard cart marks Coffee/Tea hot; `snack_picks` table + `snack_pick_save` function, realtime enabled (`supabase/migrations/0006`).
- **2026-10-20** — Passenger Snacks & Drinks screen: one drink + one snack, ice toggle (cold), cream + sugar 0–3 (hot), sticky save bar, clear, "ran out" notice.
- **2026-10-20** — Live pick on the Home snacks tile; crew add form gets Cold drink / Hot drink / Snack.
- **2026-10-20** — `AppShell` now owns the cart and pick hooks (one realtime channel per flight).
- **2026-10-20** — Backend tested on a test flight ID (option cleanup, wrong kind, out of stock, sugar range, item removal, clear, direct insert blocked); UI tested manually.
- **2026-10-20** — Feature 5 approved and committed.

## Fix — Plain drinks (Features 4–5)

- **2026-10-20** — Third drink type `plain` (no ice / cream / sugar), for hot chocolate, milk, etc. Crew add form: Cold / Hot / Plain drink / Snack (`supabase/migrations/0007`).

## Feature 6 — Crew view of snack picks

- **2026-10-20** — Database: `served_at` on `snack_picks`, `snack_pick_served` function; a changed pick resets served (`supabase/migrations/0008`).
- **2026-10-20** — Crew Cart & Orders screen split into **Orders | Cart setup** tabs.
- **2026-10-20** — Orders: load-up totals of what's still to serve (with cream / sugar / no-ice counts), by-seat list front to back with Served toggle; live "Orders to serve" on crew Home.
- **2026-10-20** — Backend tested on a test flight ID (plain drinks, invalid serve, served / unserved, reset on change).
- **2026-10-20** — Feature 6 and plain-drink fix approved and committed.

## Feature 7 — Passenger assistance requests

- **2026-10-20** — Database: `assistance_requests` table (one open request per type per seat, note only and required on "Something else") + `assist_request` / `assist_cancel`, realtime enabled (`supabase/migrations/0009`).
- **2026-10-20** — Passenger Assistance screen: 7 request types, tap → confirm → send, urgent "Feeling unwell" with call-button reminder, required note on "Something else", live status (Sent → Crew is on the way → Done), cancel.
- **2026-10-20** — Live request status on the Home assistance tile.
- **2026-10-20** — Backend tested on a test flight ID; found and fixed "other" accepting an empty note (NULL check passes). Fix for existing DBs ships in 0010.
- **2026-10-20** — Feature 7 approved and committed.

## Feature 8 — Crew assistance requests

- **2026-10-20** — Database: `assist_ack` / `assist_done` crew functions; fixed the Feature 7 note check for existing DBs (`supabase/migrations/0010`).
- **2026-10-20** — Crew Requests screen: New (urgent first, then oldest) with On my way / Done, On the way, Recently closed.
- **2026-10-20** — Passive urgent banner on all crew screens until someone is on the way; live Open requests stat on crew Home.
- **2026-10-20** — Backend tested on a test flight ID (note check, ack, done from open or ack, no-ops on closed / cancelled / wrong flight); UI tested manually.
- **2026-10-20** — Feature 8 approved and committed.

## Feature 9 — Passenger flight info (basic)

- **2026-10-20** — Flight Info screen: route header with progress, flight status card, destination card, ride outlook timeline (5 legs, current leg highlighted). Uses existing flight data; no new service.
- **2026-10-20** — Ride outlook uses clearly labelled **sample** data until a real turbulence source is approved.
- **2026-10-20** — Basic Feature 9 approved and committed. Next: real turbulence + destination weather.

## Feature 9 refinement — Live turbulence and destination weather

- **2026-10-20** — NOAA Aviation Weather Center approved as data source (free, no key, no CORS → server-side).
- **2026-10-20** — Edge Function `flight-weather`: great-circle route in 5 legs checked against SIGMETs, US G-AIRMETs and pilot reports; destination METAR + TAF at arrival; 15-min `weather_cache` (`supabase/migrations/0011`).
- **2026-10-20** — `flight-lookup` now stores ICAO, coordinates and time zone per airport.
- **2026-10-20** — Flight Info uses live data: Nothing reported / Light chop / Bumpy per leg, destination temp, conditions, wind, arrival forecast, local time; sample generator removed.
- **2026-10-20** — Tested on SFO–DFW, JFK–LHR, SFO–SIN, ORD–DEN; UI tested manually. Approved and committed.

## Refinement — Crew login and aircraft flight setup

- **2026-10-20** — Supabase Auth crew accounts approved; demo crew user created in the dashboard, public sign-ups turned off.
- **2026-10-20** — Database: `crew_members`, `is_crew()`, `aircraft_flights` + `aircraft_set_flight` / `aircraft_clear_flight`; all crew-only functions now require signed-in crew and are revoked from anon (`supabase/migrations/0012`).
- **2026-10-20** — Crew sign-in screen (email + password, remembered per tablet) replaces the demo PIN; stale PIN sessions are sent back to sign-in.
- **2026-10-20** — Flight setup moved from the passenger welcome screen to crew Home ("This aircraft · DEMO-1"); seatbacks read the aircraft's flight live.
- **2026-10-20** — Verified crew functions reject the publishable key alone; sign-in and flight setup tested manually. Approved, committed and pushed.

## Refinement — Flight-phase rules

- **2026-10-20** — Agreed rules: before takeoff Restroom and Assistance off (crew are in the aisle), Snacks on; after landing Restroom and Snacks off, Assistance on.
- **2026-10-20** — Auto phase from status + scheduled times (times win when AeroDataBox lags); crew override per aircraft (`aircraft_phase`, `aircraft_set_phase`), reset on new flight (`supabase/migrations/0013`).
- **2026-10-20** — Passenger nav / Home tiles greyed with reasons, Not available screen; Flight Info "Expected ride" before takeoff and "We've landed" after.
- **2026-10-20** — Crew Home phase control (Auto / Boarding / In flight / Landed) with a passenger-availability line; phase notices on crew Restroom and Requests.
- **2026-10-20** — Tested manually across all phases. Approved, committed and pushed.

## Refinement — Usability heuristics (Nielsen's 10)

- **2026-10-27** — Audited every screen against Nielsen's 10 heuristics; 9 issues ranked, fixing one at a time.
- **2026-10-27** — #1 Undo for destructive actions (H3, H5): 5-second Undo toast for crew remove / no-show / confirm back / remove cart item / request done, and passenger leave line / give up turn / clear pick / cancel request. Sign out needs a second tap. Crew row buttons are now 44px touch targets.
- **2026-10-27** — #2 Restroom slip guard (H5): with an empty line, "Use it now" asks "Go now?" before starting the 5-minute turn (Start my turn / Not yet, auto-closes after 10s, falls back to Save my spot if someone joins).
- **2026-10-27** — #3 Plain-language errors with recovery (H9): `friendlyError()` keeps our own messages, logs and replaces raw Supabase / network / HTTP errors, and says when the connection is down. Every error banner has an alert icon, bold red text and a **Try again** button (`retry` on all live hooks and the weather hook).
- **2026-10-27** — #4 Out-of-date and jargon wording (H2): "Crew PIN required" → "Crew sign-in required"; Flight Info no longer sends passengers to a removed welcome-screen lookup (crew Home now says how to turn live weather back on); "Step 2 of 2" → "Passenger"; "Light chop" / "Ride outlook" → "Light bumps" / "Turbulence outlook".
- **2026-10-27** — #5 Real status on crew Home (H1, H8, H7): stat row and the "Modules" list (always "Standby") merged into one live, tappable card per module (waiting / line paused, orders to serve / cart not set up, open / urgent).
- **2026-10-27** — #6 Action feedback (H1): "Saving… / Sending… / Starting…" while busy; confirmation toast after saving a spot, saving a pick and sending a request.
- **2026-10-27** — #7 Readability (H8 + typography): small mono labels raised from ~11px to 12.5–13px; decorative "01–04" tile numbers removed; turned-off items no longer use opacity (failed contrast), they get a dashed card / "Off" tag instead; closed requests no longer faded.
- **2026-10-27** — #8 Consistency (H4): trash icon for removing (backspace icon stays on the keypad only); in-card confirms dismiss with "Back"; specific labels "Cancel request" and "Clear pick"; tertiary buttons are 44px.
- **2026-10-27** — #9 Recognition (H6): crew phase notices have a "Change phase" button that opens crew Home and scrolls to the phase control.
- **2026-10-27** — H10: Snacks lede now says picks can be changed until the cart arrives. All heuristics items done; awaiting user review before one commit + push.
- **2026-10-27** — Heuristics pass approved, committed and pushed (853ab31).

## Refinement — MVP demo polish (first-time passenger pass)

- **2026-11-02** — Passenger theme switched to the "Night Cabin" palette (navy, cabin blue, amber, teal); fonts now Lexend (headings) + Atkinson Hyperlegible Next (body).
- **2026-11-02** — Assistance audited through a first-time passenger's eyes (25 pitfalls). #19 fixed: a "Crew are on the way" banner shows on any screen when crew accept a request.
- **2026-11-02** — #17/#18 fixed: requests now go Sent → Seen by crew → Crew are on the way → Done. "Seen" is set when crew open their Requests screen (migration 0014, `assist_seen`). Passengers see what to expect at each step (usual wait, seatbelt-sign delays). Pill wording fixed to "Crew are on the way".
- **2026-11-02** — #3/#12 fixed: Assistance says up front it's for everyday needs, with an "Emergency? Press your call button" note; the urgent card no longer implies the app isn't enough. Old footnote removed.
