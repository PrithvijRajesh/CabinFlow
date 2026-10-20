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

## Feature 3 — Crew restroom queue

### What it does
- Crew see the live line **with seat numbers**: who is called now (with the 5-min countdown) and who is waiting, in order, with wait times.
- Crew controls (manual overrides; the line runs on its own without them):
  - **Confirm back**: the called seat is done, next seat is called.
  - **No-show**: skip the called seat, next seat is called.
  - **Call now**: a waiting seat goes next; the currently called seat returns to its place.
  - **Remove**: take a seat out of the line.
  - **Pause / Resume line**: for the seatbelt sign or turbulence. While paused no one is called; a called seat goes back to its place. Resume calls the next seat right away.
- Passengers see a notice when the crew ends their turn, removes them, or pauses the line. They still never see other seats.
- Crew Home shows the live line count (and "paused").

### How it's implemented
- **Migration 0004:**
  - `restroom_line_state` table: one row per flight with `paused`. Readable by the app, realtime enabled.
  - `restroom_crew_action(flight, spot_id, action)` and `restroom_set_paused(flight, paused)`: `security definer` functions using the same per-flight lock as Feature 2, so only one seat is ever called.
  - `restroom_tick` now returns early (calls no one) while paused.
  - `ended_by = 'crew'` marks crew actions, so the passenger sees "the crew ended your turn" instead of "timed out".
- **Frontend:**
  - `src/hooks/useCrewRestroomQueue.ts`: crew-only hook that fetches seats, pause state and exposes `act()` / `setPaused()`.
  - `src/screens/CrewRestroom.tsx`: the console screen.
  - `useRestroomQueue` now also returns `paused` (used by the passenger screen and the crew Home stat).
  - The realtime subscription listens to both tables.

### Why it matters
- PRD Feature 3: crew can double-check and correct whose turn it is.
- Pause line handles the most common real-world interruption (seatbelt sign) without anyone standing in the aisle.
- Designed to be glanced at, not babysat: the line advances automatically, crew only step in when something looks wrong.

### Known limits
- Crew PIN is checked in the browser only, so anyone with the publishable key could call the crew functions. Real crew login fixes this later.
- A fixed 5-minute turn covers both "did they see it" and "how long they're gone".
- **Planned improvement (post-MVP):** two-phase turn: 2 min to tap "I'm going" (else auto-skip), then no visible timer while in use, a passive "long visit" flag for crew at 10 min, and auto-release at 15 min.

## Feature 4 — Crew snack cart setup

### What it does
- Crew set up what's on the cart for this flight. Everything is **complimentary**, so there are no prices.
- **Load standard cart** fills a typical cart in one tap (10 drinks, 4 snacks). Crew then only adjust.
- Items are grouped into **Drinks** and **Snacks**. Each can be toggled **In stock / Out** (out items are struck through) or removed.
- **Add an item:** name + Drink/Snack. Duplicates are blocked ("Coffee" = "coffee").
- **Add any missing standard items** restores anything removed by mistake.
- Changes show up live on every screen watching the cart.

### How it's implemented
- **Migration 0005:**
  - `cart_items` table: one row per item per flight (name, kind, in_stock). Unique on `(flight_id, lower(name))`, plus checks on kind and name length.
  - Browser has read-only access; writes go through `cart_add`, `cart_set_stock`, `cart_remove` and `cart_load_standard` (`security definer`).
  - The standard list lives in the database, so every cart starts the same. `created_at` is staggered per item so the list keeps its order.
- **Frontend:**
  - `src/services/cart.ts`: all cart backend calls (swap-out point for an onboard server).
  - `src/hooks/useCart.ts`: live cart state + actions. Feature 5 reuses it read-only for the passenger menu.
  - `src/screens/CrewCart.tsx`: the crew console screen.

### Why it matters
- PRD Feature 4: crew input the snack cart items.
- It's the source list for Feature 5 (passengers pick) and Feature 6 (crew see picks ahead of time).
- The one-tap standard cart keeps crew setup to seconds, in line with "don't make crew work harder".

### Known limits
- One cart per flight (no per-cabin carts).
- No quantities, just in stock / out.
- Same crew-auth limit as Feature 3: anyone with the publishable key could call the cart functions.

## Feature 5 — Passenger snack and drink picks

### What it does
- Passengers see the crew's live cart and pick **one drink and one snack** (each optional) before service starts.
- **Drink options:**
  - Cold drinks: **Ice / No ice** (ice by default).
  - Hot drinks: **Black / Cream** and **Sugar 0–3**.
- A sticky bar shows the pick in plain words ("Coffee · cream · 1 sugar + Pretzels") with **Save my pick / Update pick** and **Clear**.
- Out-of-stock items can't be picked. If a saved item runs out, the passenger is told to pick another. If crew remove an item, it drops off the pick automatically.
- The Home snacks tile shows the saved pick live.

### How it's implemented
- **Migration 0006:**
  - `cart_items.serve` (`hot` / `cold`, null for snacks) decides which options a drink gets. Existing carts are backfilled (Coffee/Tea hot).
  - `snack_picks`: one row per seat per flight, with `drink_id` / `snack_id` pointing at `cart_items` (`on delete set null`) plus `ice`, `cream`, `sugar`.
  - `snack_pick_save` checks the items are on this flight, the right kind, and in stock; it drops options that don't fit the drink. Saving nothing deletes the row.
- **Frontend:**
  - `src/services/snackPicks.ts` + `src/hooks/useSnackPick.ts`: this seat's pick only, kept live. `describePick()` turns a pick into the readable summary.
  - `src/screens/Snacks.tsx`: the picker keeps a local draft and remounts from the saved pick whenever it changes.
  - `AppShell` owns `useCart` and `useSnackPick` and passes them down, so screens share one realtime channel.

### Why it matters
- PRD Feature 5: passengers choose what they want ahead of time, so the cart stop is a hand-off instead of a conversation.
- Ice/cream/sugar are the questions crew ask at every row; answering them up front saves the most time.
- The picks table is the input for Feature 6 (crew see picks by row) and the "commonly wanted snacks" stats the PRD allows.

### Known limits
- Passengers can only read their own pick in the UI, but the table is readable with the publishable key (crew need it in Feature 6). Same auth limit as before.
- Every hot drink gets cream/sugar options, even ones where they don't fit (e.g. hot chocolate).
