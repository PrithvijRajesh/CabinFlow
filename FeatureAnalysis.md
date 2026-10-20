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
