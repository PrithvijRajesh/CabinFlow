# Feature Analysis

## Feature 1 — Role selection, welcome screen, app layout

### What it does
- The first screen asks who is using the device: **Passenger** or **Flight Attendant**.
- **Passengers** enter their seat (row 1–60, letter A–K). Every later feature needs the seat so crew know where to go.
- **Flight attendants** enter a crew PIN, so passengers can't open the crew view.
- After entry, both roles land in the same **app shell**:
  - A top bar shows the flight, the seat or "Crew" badge, and Sign out.
  - A tab bar lists that role's features.
  - A home dashboard shows feature cards.
  - Features not built yet show a "Coming soon" placeholder.

### How it's implemented
- **Entry flow (`src/App.tsx`):** a small state machine. With no session and no role picked, it shows `RoleSelect`. Picking a role shows `SeatEntry` or `CrewPin`. Confirming creates a `Session` and shows `AppShell`.
- **Session (`src/types.ts`):** typed as `{ role: 'passenger', seat }` or `{ role: 'crew' }`. Only a passenger session carries a seat.
- **Persistence:** the session is saved in `sessionStorage`, so a refresh keeps you signed in. It only lasts for that browser tab, and it's wrapped in try/catch in case storage is blocked.
- **Feature registry (`src/features.ts`):** one list of sections per role. Adding a feature later means adding one entry there plus its screen. Nav and home cards come from that list automatically.
- **Mock data (`src/data/flight.ts`):** flight details, the seat-format regex, and the demo PIN `1234`.
- **Keypad (`src/components/Keypad.tsx`):** on-screen keypad for seat and PIN entry, because seatback screens are touch-only. Physical keyboards also work (digits, letters, Backspace, Enter, Esc). Seat input uses functional state updates so fast taps never get dropped.
- **Design (`src/index.css`):** two themes picked by role.
  - Passengers get a "boarding pass" look: ivory paper, ink, safety-orange accent, perforated ticket edge, bento tiles.
  - Crew get a dark "ops console": amber accent, mono status board.
  - Crew can tell at a glance which view they're on.
  - Fonts are self-hosted via `@fontsource`, so there's no external font service: Fraunces (display), IBM Plex Sans (body) and IBM Plex Mono (flight data).
  - Icons are custom inline SVG (`src/components/Icon.tsx`).
  - Layout: a side rail on tablets and desktops, a bottom bar on phones.
- **Flight strip (`src/components/FlightStrip.tsx`):** shows the route with the plane placed at the current (mock) flight progress.

### Why it matters
- Every PRD feature is split by role, so this is the base the other eight features plug into.
- The seat number links bathroom, snack and assistance requests to a location without storing anything personal. That fits the PRD's "Data We Store" rule.

### Known limits (intentional for MVP)
- The crew PIN is checked in the browser, so it's not real security. Real auth would need a backend.
- The flight data is hardcoded.
- There's no shared state between devices yet. Bathroom queue and requests will need a backend or a real-time service, and I'll ask before adding one.

## Feature 2 — Passenger restroom line

### What it does
- Passengers save a spot in the restroom line from their seat instead of standing in the aisle.
- The screen shows how many are waiting and an estimated wait (4 min per person).
- Once in line, the passenger sees their place ("2nd") and anonymous dots for the line, never other seat numbers (PRD out-of-scope #3).
- When it's their turn, the card turns orange with a **5-minute countdown**:
  - **I'm back** marks the turn done.
  - **Give up my turn** leaves the line.
  - If the timer runs out, the next person is called and they see a "timed out" notice.
- A banner appears on any screen when it's your turn. The Home tile shows live status ("You're 2nd in line").

### How it's implemented
- **Backend: Supabase** (hosted Postgres + realtime).
  - The table `restroom_queue` stores one row per spot: flight, seat, status (`waiting → called → done | skipped | left`) and timestamps.
  - A unique index allows only one active spot per seat.
- **Writes only through database functions.** The browser can read the table but can't write to it directly.
  - `restroom_join` and `restroom_finish` add or close a spot, then call `restroom_tick`.
  - `restroom_tick` times out a turn after 5 minutes and calls the next waiting seat.
  - A per-flight lock (`pg_advisory_xact_lock`) stops two seats from being called at once.
- **Live updates:** the app subscribes to row changes for its flight and refetches. Every 30s it also calls `restroom_tick`, so timeouts happen even if the called passenger walks away.
- **Data layer:**
  - All backend calls are in `src/services/restroomQueue.ts`, so Supabase can later be swapped for an aircraft onboard server.
  - `src/hooks/useRestroomQueue.ts` turns them into simple UI state: position, isMyTurn, join, leave, finish.
  - The list query fetches only id, status and time, so other seats' numbers never reach the screen.
- **Flight ID:** `FLIGHT_ID` = flight number + UTC date (e.g. `CF482-2026-10-20`). It keeps each flight's line separate.

### Why it matters
- It's the core passenger promise from the proposal: no standing in the aisle, and you know when to go.
- Fewer people standing in the aisle means fewer blocked carts and less crew walking. That's the cabin-movement problem in the PRD.
- It's the first shared, real-time data in the app. The same pattern (table + functions + realtime) will power snacks, assistance and the crew views.

### Known limits (intentional for MVP)
- One lavatory per flight. Per-lavatory queues can come later.
- No real login: anyone with the publishable key could read the queue table directly (seat + times), even though the UI never shows it.
- Crew controls (seeing the line, overriding whose turn it is) are Feature 3.
- ⚠️ Patent risk: Collins/B/E holds US11958606B2 (seatback restroom queue). Review before selling.

## Flight lookup (real flight data)

### What it does
- On the welcome (boarding pass) screen, enter a flight number like `UA 1` and tap **Load flight**.
- The pass, top bar, Home and flight strip switch to that real flight: route, airline, aircraft, times and status.
- Progress and "time to go" are calculated live from the real departure and arrival times.
- The flight is remembered on the device. **Use demo** switches back to the mock flight `CF 482`.
- Clear errors for unknown flights and bad formats.

### How it's implemented
- **Edge Function (`supabase/functions/flight-lookup`):** runs on Supabase's servers and calls AeroDataBox with the secret key `AERODATABOX_RAPIDAPI_KEY`. The browser never sees the key.
  - Validates the number, picks the flight closest to now (AeroDataBox can return yesterday's and today's), and reduces it to our `FlightInfo` shape.
  - `verify_jwt = false` in `supabase/config.toml`, because publishable keys aren't JWTs.
- **Cache (`flight_cache`, migration 0003):** results are reused for 10 minutes so repeated lookups don't burn API quota. Only the function (service role) can read it; the browser has no grants.
- **Frontend:**
  - `src/services/flightLookup.ts` calls the function (same swap-out pattern as the restroom service).
  - `src/context/FlightContext.tsx` holds the current flight for the whole app, saves it to `localStorage`, and ticks progress every minute.
  - `src/data/flight.ts` now has `DEMO_FLIGHT`, `flightId()`, `flightProgress()` and `statusLabel()`.
- **Flight ID** now uses the real departure date, so each flight's restroom line stays separate.

### Why it matters
- Makes the demo feel real: it shows the actual flight instead of hardcoded data.
- Lays the groundwork for Feature 9 (flight info: destination, status).
- On a real seatback the aircraft supplies the flight, so this lookup is a demo stand-in. Because it sits behind one service file, it's easy to replace.

### Known limits
- AeroDataBox free tier has a monthly request cap; the cache helps but doesn't remove it.
- No turbulence data (PRD out-of-scope #4: no cockpit readings).
- The function is public (no login), protected only by input validation and the cache.
