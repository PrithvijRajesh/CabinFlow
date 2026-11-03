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
- **Two-phase turn (done 2026-11-02):** see "Restroom: two-phase turn" under MVP demo polish.

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

## Refinement — Undo for destructive actions (Heuristics #3 and #5)

### What it does
- Actions that throw something away show a toast like **"Removed 14C from the line · Undo"** for 5 seconds, with a bar that runs down.
  - Crew: remove from the line, No-show, Confirm back, remove a cart item, mark a request Done.
  - Passenger: Leave the line, Give up my turn, Clear pick, Cancel a request.
- The item disappears straight away. Tapping Undo brings it back as if nothing happened.
- **Sign out** needs a second tap ("Tap again to sign out"), which resets after 4 seconds.
- The crew row buttons (Call now, 🗑, Done, etc.) are at least 44px and spaced further apart, so a slip doesn't hit the neighbouring button.

### How it's implemented
- **Deferred commit, not a reverse action.** `src/context/useUndo.ts` (`useUndoQueue`) holds the action for `UNDO_SECONDS` and only then calls the hook's existing method (`act`, `remove`, `done`, `leave`, `save`, `cancel`). Undo just drops it. No backend change was needed.
- Each action has a `key` (e.g. `spot:<id>`, `item:<id>`, `req:<id>`, `restroom:leave`, `pick:clear`). Screens call `isPending(key)` to show the result early. The key stays hidden until the hook has refreshed, so the item doesn't flash back.
- `AppShell` owns the queue (`UndoContext`) and renders `UndoToast`. It also builds passenger "views" of the shared hooks (`restroomView`, `picksView`, `assistView`, `crewAssistView`), so Home tiles and banners agree with the screen.
- There's one pending action at a time; a new one sends the previous one right away. Signing out (AppShell unmount) sends whatever is pending.
- Edge cases: tapping Save my spot during a pending leave cancels the leave (you keep your old spot). Saving a new pick during a pending Clear cancels the Clear.

### Why it matters
- Nielsen #3 (user control) and #5 (error prevention): on a touch seatback or a tablet in a moving cabin, mis-taps are common. A wrong "Remove 14C" or "Give up my turn" costs a passenger their place.
- An undo toast is the standard pattern (Gmail, iOS Mail). Unlike "Are you sure?" pop-ups, it doesn't slow down crew who meant it, which fits the "glance and fix" crew principle.

### Known limits
- During the 5 seconds, other screens (other seatbacks, other crew tablets) still see the old state.
- If the tablet loses power within those 5 seconds, the action is never sent. That's the safe failure, but crew may need to tap again.

## Refinement — Confirm before starting a restroom turn (Heuristic #5)

### What it does
- When nobody is in line, the button reads **Use it now**. Tapping it opens a confirm step in the same card: "Go now? Your 5-minute turn starts as soon as you tap." with **Start my turn** and **Not yet**.
- The confirm closes itself after 10 seconds. If someone joins in the meantime, the card switches back to **Save my spot**, because there's no immediate turn to confirm any more.

### How it's implemented
- `confirmGo` state in `src/screens/Restroom.tsx`. `confirming` is only true while the line is still empty and you aren't in it, so live updates can't leave a stale confirm on screen.
- It's a confirm and not an undo because starting a turn calls this seat right away and holds the restroom for everyone else. Saving a spot in a non-empty line stays one tap (it can be undone via Leave → Undo).

### Why it matters
- Before, one stray tap started a 5-minute countdown that blocked the restroom for others. Nielsen #5: when an action is costly and immediate, check before committing.

## Refinement — Plain-language errors with Try again (Heuristic #9)

### What it does
- Errors no longer show raw database or network text. People see what failed in plain words, like "We couldn't load the restroom line.", and a **Try again** button (it shows "Trying…" while it runs).
- If the device is offline: "No connection to the cabin system. It usually comes back on its own, so try again in a minute."
- Messages we wrote on purpose still come through as they are: "That snack is not available.", "Wrong email or password.", "No flight found for UA 1234."
- An expired crew session reads "Your crew sign-in has ended. Sign out, then sign in again."
- Error banners have a warning icon, a red left edge and bold red text, so they stand out from the orange warnings.

### How it's implemented
- `src/lib/errors.ts`: `friendlyError(e, fallback)` lets through an allow-list of our own messages, rewrites a few, and otherwise logs the raw error with `console.error` (for us) and returns the caller's fallback. This replaces the old `errorText`, which showed whatever Supabase returned.
- Every live hook now exposes `retry` (its existing `refresh`). `useFlightWeather` reloads through an `attempt` counter.
- `src/components/ErrorNotice.tsx` is the one error banner, used on all screens with a load error. Screens that read two hooks retry both.
- Form errors (crew sign-in, flight setup, add item) stay inline under the field, but go through `friendlyError` too.

### Why it matters
- Nielsen #9: say what went wrong in the user's language and offer a way out. Before, a passenger could see a Postgres message with nothing to do about it.
- On an aircraft, connection drops are normal, so "it comes back on its own, try again" is the honest next step.

### Known limits
- After a failed *action* (e.g. Save my pick), Try again reloads the data; the passenger then taps the action again. It doesn't replay the action automatically.

## Refinement — Wording that matches the app and the user (Heuristic #2)

### What it does
| Where | Before | After |
|---|---|---|
| Role screen, crew option | Crew PIN required | Crew sign-in required |
| Flight Info, weather notice | "Sign out, then load the flight number on the welcome screen" | "Live weather isn't available for this flight yet. Your flight times are still up to date." |
| Crew Home, flight setup | (nothing) | "Live weather is off for this flight. Set the flight number again to turn it on." |
| Seat entry | Step 2 of 2 | Passenger |
| Flight Info | Light chop · Ride outlook · Expected ride | Light bumps · Turbulence outlook · Expected turbulence |

### How it's implemented
- These are text changes in `RoleSelect.tsx`, `SeatEntry.tsx`, `FlightInfo.tsx` and `features.ts`.
- The new crew hint in `FlightSetup.tsx` shows when the saved flight has no ICAO codes, meaning it was saved before weather existed. Setting the flight again stores them.

### Why it matters
- Nielsen #2: use the user's words, and keep the words true. The PIN and welcome-screen lookup were replaced by crew sign-in and crew flight setup, but the old wording stayed, so people would follow steps that no longer exist.
- The fix for missing weather belongs to crew, not passengers, so the instruction moved to crew.
- "Chop" is pilot slang. Passengers know "bumps" and "turbulence".

## Refinement — Remaining heuristics (#5–#9)

### What it does
- **Crew Home shows real status (H1, H8, H7).** The always-"Standby" Modules list and the separate number row said the same thing twice, and the status light meant nothing. They're now one card per module:
  - Restroom Queue: "3 waiting", or "waiting · line paused" in orange.
  - Cart & Orders: "5 orders to serve", or "cart not set up yet" in orange.
  - Requests: "2 open requests", or "open · 1 urgent" with a red border.
  - Tapping a card opens the module, so it doubles as a shortcut.
- **Feedback after actions (H1).** Buttons say "Saving… / Sending… / Starting…" while they run. Afterwards a short toast confirms: "Spot saved. Stay seated…", "Pick saved. The crew will bring it to your row.", "Request sent…".
- **Readability (H8, typography).** The smallest uppercase mono labels went from ~11px to about 12.5–13px, with tighter letter-spacing so they don't get wider. The decorative "01–04" numbers on tiles and modules are gone.
- **Contrast on turned-off items.** Turned-off features used to be drawn at 45–60% opacity, which pushed their text below the 4.5:1 contrast minimum for readable text. Their text now stays readable:
  - Tiles become a dashed, flat card with the reason in bold.
  - Nav items get a dimmed icon and an "Off" tag.
  - Closed requests use a muted background instead of fading.
- **Consistency (H4).**
  - Removing uses a trash icon. The backspace icon is now only on the keypad, where it means delete a character.
  - Every in-card confirm dismisses with **Back**.
  - Ambiguous labels are now specific: "Cancel request" and "Clear pick".
- **Recognition (H6).** Crew phase notices ("Passengers can't join the line until takeoff") have a **Change phase** button. It opens crew Home and scrolls to the phase control, so crew don't have to remember where it is.
- **Help (H10).** Every screen already has a one-line explanation and the restroom has its 4 steps. Snacks now also says you can change your pick until the cart arrives.

### How it's implemented
- `useUndoQueue` now also has `notify(message)`, a confirmation toast without Undo that lasts 4s. Both kinds share one toast slot.
- `useRestroomQueue.join` and `useSnackPick.save` resolve `true` on success, so screens only confirm what actually worked.
- `crewStatus()` in `Home.tsx` builds each card from the hooks AppShell already owns. Crew Home now also receives `cart`.
- `AppShell.changePhase()` sets Home active and scrolls to `#flight-phase` in `FlightSetup`.
- New icons: `alert`, `check`, `trash`.

### Why it matters
- Crew glance at Home between tasks. A card that says "1 urgent" in red is a reason to act; "Standby" was noise.
- Seatback screens are read from about an arm's length away. Labels at 11px and text faded to 45% are hard to read there, especially for older passengers.

## Refinement — MVP demo polish

### Assistance: "Crew are on the way" banner
- **What it does.** When crew tap "On my way", the passenger sees a banner at the top of every screen: "Crew are on the way: Blanket or pillow. View". Tapping it opens Assistance.
- **How it's implemented.** `AppShell` finds the first acknowledged request the passenger hasn't seen yet. Navigation goes through `go(id)`; entering or leaving the Assistance screen marks current acknowledged requests as seen, so the banner doesn't come back for them. No backend change, it uses the live `useAssistance` data AppShell already has.
- **Why it matters.** Before, "on the way" only showed on the Assistance screen or the Home tile. A passenger watching a movie never saw it, so they kept wondering if the request went through and often pressed the call button too, creating a duplicate for crew.

### Assistance: "Seen by crew" and wait-time expectations
- **What it does.** A request now moves through four visible steps: **Sent** → **Seen by crew** → **Crew are on the way** → **Done**. Under each open request is a line about what to expect: "Crew usually respond within a few minutes", then once seen, "Crew will come as soon as they're free. It can take longer while the seatbelt sign is on." The send card says the same before sending.
- **How it's implemented.**
  - Migration `0014_assist_seen.sql` adds `seen_at` to `assistance_requests` and a crew-only function `assist_seen(flight)` that stamps every new, unseen request on the flight.
  - `CrewRequests` calls `assist.markSeen()` from an effect whenever there are unseen new requests, so opening the screen (or a request arriving while it's open) marks them seen. `markSeen` is a stable `useCallback`, so the effect doesn't fire every render.
  - The passenger's realtime subscription picks up the update; `statusOf()` in `Assistance.tsx` shows "Seen by crew" for open requests with `seen_at`. The Home tile says "seen by crew" too.
- **Why it matters.** "Sent" alone left passengers wondering whether anyone got it, and the wait felt endless with no explanation. Knowing a person has seen it, and why it might take a while, keeps them calm and in their seat instead of pressing the call button and sending a duplicate.

### Assistance: when to use the call button
- **What it does.** The intro now reads "For everyday needs, like a blanket or a drink", followed by a calm note: "**Emergency?** Press your call button. It reaches the crew straight away." The "Feeling unwell" card says crew will see it as urgent and come first, and to press the call button if help is needed right now.
- **How it's implemented.** Copy changes in `Assistance.tsx`, using the existing `.notice` style plus `.assist-call` (blue left border, not red, so it informs without alarming). The bottom footnote "Your call button still works as usual" is gone.
- **Why it matters.** First-time passengers didn't know which to use, and "press your call button too" made the app sound unreliable. A clear split (app for everyday, call button for emergencies) builds trust and stops crew getting both a request and a call for the same thing.

### Assistance: calmer, discreet urgent requests
- **What it does.** Choosing "Feeling unwell" opens the same calm blue card as other requests, with a "Send urgent request" eyebrow instead of a full-screen glowing amber card. After sending, the passenger's screens call it **Urgent help** (request list, Home tile, on-the-way banner, toasts). Crew still see "Feeling unwell" with the urgent tag.
- **How it's implemented.** `ASSIST_TYPES` entries can have a `discreet` label; `passengerLabel(type)` in `services/assistance.ts` returns it (or the normal label) and is used by `Assistance.tsx`, `Home.tsx` and `AppShell`. The confirm card dropped `queue-turn` / `btn-light`.
- **Why it matters.** Someone feeling sick is already stressed; a flashing amber screen raises anxiety and draws attention in a dark cabin. Seatbacks are visible to neighbors, so a big "Feeling unwell" is a privacy problem. Urgency still reaches the crew, who are the ones who need it.

### Assistance: optional note on every request
- **What it does.** The send card always has a note box. For most types it says "Anything to add? (optional)" with an example that fits the type ("Two blankets, one for my child", "Grey suitcase, bin above row 14"). "Something else" still requires a note. Crew see the note on the request row.
- **How it's implemented.**
  - Migration `0015_assist_note_any_type.sql` replaces the 0009 note check: any type may have a 1–100 character note, and "other" must have one. `assist_request` now stores blank notes as null instead of discarding notes on non-"other" types.
  - `ASSIST_TYPES` gained an `example` per type, used as the placeholder. The box only auto-focuses for "Something else", so an optional note doesn't pop the on-screen keyboard.
  - Discreet requests (Feeling unwell) don't echo the note on the passenger's own list, so neighbors can't read it.
- **Why it matters.** Fixed categories forced passengers to send a vague request, and crew then had to walk over just to ask "what do you need?". One short note saves that extra trip, which is the whole point of CabinFlow: less movement in the aisle.

### Restroom: two-phase turn
- **What it does.**
  - When called, the passenger sees **Ready?** with a 2-minute bar and taps **I'm heading there**. If they don't answer in 2 minutes, the next person is called.
  - Once they've tapped, there's **no clock**. The card says "Take your time", explains that a locked door means someone outside the line is inside, and that the turn is still theirs. They tap **I'm back** when seated.
  - Crew see "Now · called" with the 2-minute countdown, then "Now · in use 3:12". At 10 minutes the card turns red: "Long visit. You may want to check on them." At 15 minutes the turn is released automatically.
  - With an empty line, "Use it now" → "I'm heading there" joins and holds it in one step.
- **How it's implemented.**
  - Migration `0016_restroom_two_phase.sql` adds `going_at` and a passenger function `restroom_going(flight, seat)`. `restroom_tick` now skips called seats with no `going_at` after 2 min and marks gone seats `done` after 15 min (`ended_by` stays null, so it doesn't read as a crew action). `restroom_set_paused` only sends back a seat that hasn't left yet; `call_now` clears `going_at` on the seat it sends back.
  - `useRestroomQueue` exposes `isGoing`, `going()` and `goNow()`, plus `CALL_SECONDS`, `LONG_VISIT_MINUTES`, `RELEASE_MINUTES` (matching the SQL). `TurnCard` in `Restroom.tsx` shows the calm in-use card or `CallCard`. The "your turn" banner only shows before they've answered.
- **Why it matters.** The old 5-minute clock counted getting out of a window seat, walking, and waiting at a door someone else had locked. People were rushed, and could be "timed out" while still inside, sending the next person to a locked door. Now the clock only measures whether someone is responding, which is what the queue actually needs to know.

### Restroom: undo on "I'm back"
- **What it does.** Tapping **I'm back** shows "Welcome back. The next person will be called." with **Undo** for 5 seconds. Undo puts the passenger straight back on their turn.
- **How it's implemented.** Same `useUndo().defer` pattern as leaving the line, with key `restroom:back`. While it's pending, `restroomView` in `AppShell` shows the spot as already done (so the "Welcome back" notice appears and the banner hides). Rejoining inside the 5 seconds ends the old turn first, otherwise the server would ignore the join.
- **Why it matters.** "I'm back" can't be reversed on the server: the next person is called at once. A stray tap before leaving the seat used to send the passenger to the back of the line.

### Restroom: honest wait times
- **What it does.** When crew pause the line, the minutes disappear: "2 people ahead of you · on hold while the line is paused", "3 people in line · line paused", and the Home tile says "· paused". The note explains that she keeps her place and the line moves when crew resume. When running, estimates are a range, e.g. "about 6–10 min".
- **How it's implemented.** `waitText(people, paused)` in `Restroom.tsx` builds the text from `AVG_VISIT_MINUTES` ± 1 per person. `restroomStatus()` in `Home.tsx` adds the paused state.
- **Why it matters.** A ticking "about 8 min" that never moves during turbulence teaches passengers the number is fake, and they stop trusting the line. A range is closer to reality, and saying "paused" explains the wait instead of hiding it.

### Restroom: look away, discreet, plain numbers
- **What it does.**
  - The intro, the in-line note, the "Spot saved" toast and step 02 now say she can keep watching her movie and a banner will appear on any screen when it's her turn.
  - The banner reads "Your turn is ready. Open" instead of naming the restroom, and the amber "Ready?" card no longer pulses.
  - The passenger's line count is a plain "2" instead of "02". Crew screens keep the padded ops-console style.
- **How it's implemented.** Copy changes in `Restroom.tsx` and `AppShell.tsx`; `.queue-call` turns off the glow animation on the call card only.
- **Why it matters.** The line is meant to let people relax. If they think they have to stare at the screen, they don't trust it and drift into the aisle anyway. Neighbors don't need to read "restroom" over a shoulder, a pulsing card is harsh in a dark cabin, and "02" reads like a machine.
