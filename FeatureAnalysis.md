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

## Fix — Plain drinks

- Some hot drinks don't take cream or sugar (hot chocolate). Drinks now have three serve types: **cold** (ice), **hot** (cream + sugar), **plain** (no options).
- Migration 0007 only widens the `serve` check; `snack_pick_save` already stores no options for anything not hot or cold.

## Feature 6 — Crew view of snack picks

### What it does
- The crew **Cart & Orders** screen has two tabs: **Orders** (default) and **Cart setup**.
- **Load the cart:** totals of everything still to serve, one line per item with extras, e.g. "×4 Coffee · 2 cream · 5 sugar", "×3 Cola · 1 no ice". Crew stock the cart from this before going out.
- **By seat, front to back:** "12A · Coffee · cream · 1 sugar + Pretzels", the list they work down the aisle with.
- **Served:** one tap per seat dims the row and removes it from the totals. Tap again to undo. If interrupted, crew can see where they left off.
- Crew Home shows a live "Orders to serve" count.

### How it's implemented
- **Migration 0008:** `snack_picks.served_at` + `snack_pick_served(flight, seat, served)`. `snack_pick_save` now clears `served_at`, so a changed pick shows up as a new order.
- **Frontend:**
  - `src/hooks/useCrewPicks.ts`: every seat's pick, live, sorted by row then letter. Only enabled for crew; passengers never load other seats.
  - `src/screens/CrewOrders.tsx`: totals (`loadUp()`) and the by-seat list, reusing `describePick()` from Feature 5.
  - `AppShell` owns the hook and passes it to the crew Cart screen and crew Home.

### Why it matters
- PRD Feature 6: crew know what passengers want ahead of time.
- Totals turn many individual picks into one loading list. The by-seat list makes the cart run a hand-off instead of a conversation at every row.
- Served is optional; the view is still useful if crew never tap it.

### Known limits
- One service round per flight. A second round would need a "start new service" reset.
- Same auth limit as before: picks are readable with the publishable key.

## Feature 7 — Passenger assistance requests

### What it does
- Passengers pick what they need from seven types: **Feeling unwell** (urgent), **Blanket or pillow**, **Water or a drink**, **Help with a bag**, **Spill or cleanup**, **Seat or screen problem**, **Something else**.
- Tap → confirm → **Send to crew**, so a stray tap doesn't send anything.
- **Feeling unwell** reminds the passenger to press the call button for emergencies, and is marked urgent for crew.
- **Something else** asks for a short note (required, 100 chars). The other types need no typing.
- Several requests per seat, but **one open request per type**.
- **Your requests** shows live status (**Sent → Crew is on the way → Done / Cancelled**) and lets the passenger cancel. Closed requests stay visible for 15 minutes.
- The Home tile shows live status.

### How it's implemented
- **Migration 0009:**
  - `assistance_requests`: seat, type, note, status (`open → ack → done | cancelled`), and created / ack / closed timestamps.
  - A partial unique index enforces one open request per type per seat.
  - A check makes the note required on `other` and not allowed elsewhere. `note is not null` is needed explicitly: a check that evaluates to NULL passes.
  - `assist_request` (repeat sends do nothing) and `assist_cancel` (own seat only).
- **Frontend:**
  - `src/services/assistance.ts` holds the calls and `ASSIST_TYPES` (labels, hints, urgent flag), shared with the crew screen.
  - `src/hooks/useAssistance.ts`: this seat's requests, live, re-checked each minute so old ones drop off.
  - `src/screens/Assistance.tsx`: tiles, confirm card, and request list.

### Why it matters
- PRD Feature 7: passengers say exactly what they need, so crew bring the right thing on the first trip instead of walking over to ask.
- Fewer call-button round trips means less cabin movement.
- Type + timestamps give the "how often and what type of assistance" stats the PRD allows, without storing anything about the person.

### Known limits
- Same auth limit as before: anyone with the publishable key could read requests or send them for any seat.
- It doesn't replace the physical call button, and says so.

## Feature 8 — Crew assistance requests

### What it does
- Crew see every request on the flight in three columns:
  - **New:** urgent first, then oldest. Seat, type, note, "waiting 4 min", with **On my way** and **Done**.
  - **On the way:** with **Done**.
  - **Recently closed:** done or cancelled by the passenger (15 minutes).
- **On my way** tells the passenger help is coming (their status changes live).
- **Done** works straight from New, for things handled in passing.
- An urgent ("Feeling unwell") request shows a **passive banner** on every crew screen until someone taps On my way. No pop-ups or sounds.
- Crew Home shows live **Open requests** (and how many are urgent).

### How it's implemented
- **Migration 0010:** `assist_ack` (open → ack) and `assist_done` (open/ack → done), both no-ops on anything already closed. Also patches the Feature 7 note check (`note is not null`).
- **Frontend:**
  - `src/hooks/useCrewAssistance.ts`: all requests on the flight, live, split into open / on the way / recent, with `urgentOpen` for the banner. Only enabled for crew.
  - `src/screens/CrewRequests.tsx`: the console screen.
  - `AppShell` owns the hook and shows the urgent banner.

### Why it matters
- PRD Feature 8: crew see and manage requests.
- Crew know *what* is needed before walking over, so one trip instead of two.
- Glance-and-fix: urgent requests surface on their own; everything else waits in a sorted list.

### Known limits
- No assignment of a request to a specific crew member.
- Same auth limit as before.

## Feature 9 — Passenger flight info (basic)

### What it does
- **Header:** route, time to go, destination city and local arrival time, progress strip.
- **Your flight:** status, departure / arrival times, time left, airline and aircraft.
- **Destination:** airport code, city, scheduled local arrival.
- **Ride outlook:** five legs (Climb → Descent) shown as Smooth / Light chop / Bumpy, the current leg highlighted from flight progress, with a plain-language tip ("A good time to stretch or use the restroom").

### How it's implemented
- `src/screens/FlightInfo.tsx` reads everything from `useFlight()` (AeroDataBox or demo flight). No backend changes.
- The ride outlook is **sample data**: `sampleOutlook()` derives it from the flight ID so it stays stable during the flight. It is labelled "Sample · live data coming" on screen.

### Why it matters
- PRD Feature 9: passengers see expected turbulence and destination info from their seat.
- Knowing when it's smooth helps passengers time restroom trips, which ties back to cabin movement.

### Known limits
- Turbulence is not real yet; destination has no weather yet. Both are the next refinement.
- No cockpit data, by design (PRD out-of-scope #4).

## Feature 9 refinement — Live turbulence and destination weather

### What it does
- **Ride outlook** is now real: each of the five legs shows **Nothing reported**, **Light chop** or **Bumpy**, based on current aviation advisories and recent pilot reports along the actual route.
- "Nothing reported" is worded on purpose: no report is not a promise of smooth air.
- Outside the US, a note explains that only major turbulence warnings are published.
- **Destination** shows current weather (°C / °F, conditions, wind), the forecast around arrival time, and the local time there now.

### How it's implemented
- **Data source:** NOAA Aviation Weather Center (`aviationweather.gov`). Free, no key, but no CORS, so it's called from a Supabase Edge Function.
- **`supabase/functions/flight-weather`:**
  - Gets both airports' coordinates from METAR, draws the great-circle route and samples 8 points per leg.
  - Climb/descent legs check advisories that reach below 25,000 ft; cruise legs check 28,000–43,000 ft.
  - Checks points against **international SIGMET** polygons (worldwide), **US G-AIRMET** turbulence polygons, and **PIREPs** from the last 2 hours within 120 km.
  - Maps intensity to passenger words: light → Light chop, moderate/severe → Bumpy.
  - Destination: METAR now + the TAF forecast line covering the arrival time (skips TEMPO / PROB "maybe" lines), turned into plain words.
  - Cached 15 min in `weather_cache` (migration 0011), keyed by route + arrival hour.
- **`flight-lookup`** now keeps each airport's ICAO code, coordinates and time zone (NOAA only takes ICAO codes).
- **Frontend:** `src/services/flightWeather.ts`, `src/hooks/useFlightWeather.ts` (refresh every 15 min), and the updated `src/screens/FlightInfo.tsx`.

### Why it matters
- PRD Feature 9: real expected turbulence and destination info, without cockpit data (out of scope #4).
- Passengers can time restroom trips for smooth stretches, which supports the cabin-movement goal.

### Known limits
- Coverage is uneven: dense over the US, only significant turbulence elsewhere.
- Advisories are forecasts and reports, not measurements. The screen says so.
- Flights saved before this change need to be loaded again to get ICAO codes.

## Refinement — Crew login and aircraft flight setup

### What it does
- **Crew sign in once per tablet** with an email and password. They stay signed in until they tap Sign out, like a real crew app.
- **Crew set the aircraft's flight** from crew Home ("This aircraft · DEMO-1"): enter a flight number, change it, or go back to the demo flight.
- **Passengers no longer choose the flight.** The welcome screen just shows the aircraft's flight, and every seatback updates live when crew change it.
- **Crew actions are now protected:** restroom override/pause, cart setup, served, request ack/done and flight setup all require a signed-in crew member.

### How it's implemented
- **Supabase Auth** holds crew accounts. Public sign-ups are off, and an account only counts as crew if it is listed in **`crew_members`** (checked by `is_crew()`).
- **Migration 0012:**
  - `aircraft_flights`: one row per aircraft with the current flight (JSON from `flight-lookup`), readable by seatbacks, realtime enabled. Set via `aircraft_set_flight` / `aircraft_clear_flight` (crew only).
  - Every crew-only function re-created with an `is_crew()` check and `execute` revoked from `anon`.
- **Frontend:**
  - `src/services/crewAuth.ts` (sign in / out, crew check) and `src/screens/CrewSignIn.tsx` replace the PIN keypad.
  - `src/services/aircraft.ts` + `src/context/FlightContext.tsx`: the flight now comes from `aircraft_flights` for `AIRCRAFT_ID` (`DEMO-1`), not per-browser storage.
  - `src/components/FlightSetup.tsx` on crew Home.

### Why it matters
- Matches real aircraft: the aircraft knows its flight, and crew sign in once per flight.
- Closes the biggest security gap noted in Features 3–8: crew actions can no longer be called with only the publishable key.

### Known limits
- **Reads are still open:** seat-level data (queue, picks, requests) is readable with the publishable key, because passengers read their own rows without signing in. Fixing it needs a passenger identity (e.g. a per-seat token from the IFE).
- One demo aircraft; on real hardware the IFE supplies the aircraft ID.

## Refinement — Flight-phase rules

### What it does
- Passenger features follow the flight phase:

  | | Before takeoff | In flight | After landing |
  |---|---|---|---|
  | Restroom line | Off | On | Off |
  | Assistance | Off | On | On |
  | Snack picks | On (pre-order) | On | Off |
  | Ride outlook | "Expected ride" | "Right now" + legs | "We've landed" |

- Features that are off stay visible but greyed, with the reason ("The restroom line opens after takeoff"). Before takeoff, Assistance tells passengers to ask any crew member in the aisle.
- Crew can set the phase from crew Home (**Auto / Boarding / In flight / Landed**). Every seatback follows it live.
- Crew screens work in every phase, with a notice when passengers can't use that feature right now.

### How it's implemented
- **Auto phase** (`autoPhase()` in `src/data/flight.ts`): Arrived → landed; EnRoute / Departed / Approaching → in flight; otherwise scheduled times decide, because AeroDataBox can still say "Expected" after takeoff.
- **Crew override** (migration 0013): `aircraft_phase` table + `aircraft_set_phase` (crew only, null = auto). Setting or clearing the flight resets it to auto.
- **Rules live in `src/features.ts`:** each passenger feature lists the `phases` it's open in and an `offReason` per phase. `isAvailable()` is used by the nav, Home tiles and `AppShell` (which shows `src/screens/Unavailable.tsx`).
- `FlightContext` exposes `phase`, `phaseOverride` and `setPhase`. Flight Info, crew Home (`FlightSetup`), crew Restroom and crew Requests read it.

### Why it matters
- During boarding the crew are in the aisle and won't see requests, and a restroom line makes no sense before takeoff. Turning features off avoids promises the crew can't keep.
- Crew override covers what flight data can't know (doors closed, actual takeoff); real aircraft would supply this from their own sensors.

### Known limits
- The rules are enforced in the UI only. The database doesn't block, for example, a restroom join before takeoff, because the auto phase is computed in the app.
