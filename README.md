# CabinFlow

A seatback module that keeps passengers in their seats and crew out of the aisle. Built for seatback in-flight entertainment (IFE) makers like Panasonic Avionics to offer airlines as a module on their platform.

**Live demo:** _add Vercel URL here_

## What it does

**Passengers** (on the seatback screen)
- **Restroom line:** save a spot from your seat and watch your place move up. When it's your turn you get a banner on any screen and tap "I'm heading there". No timer runs while you're away.
- **Snacks & drinks:** pick one free drink and one snack before the cart arrives. Picks save as you tap. Allergen tags are shown, and there's a "No thanks" option so crew can skip your seat.
- **Assistance:** tell the crew exactly what you need, with an optional note. See it go Sent → Seen by crew → Crew are on the way → Done.
- **Flight info:** time left, destination local time and weather, and a turbulence outlook that says roughly when the bumps are.

**Crew** (signed in)
- One live card per module on Home: who's in line, orders to serve, open and urgent requests.
- Restroom queue: confirm turns, mark no-shows, call a seat out of order, pause the line for the seatbelt sign.
- Cart and orders: load a standard cart in one tap, mark items out, see load-up totals and serve by seat.
- Requests: urgent first, "On my way" and "Done".
- Flight setup and flight phase (boarding / in flight / landed), which switches passenger features on and off.

## Design

Full rules in [`DESIGN.md`](DESIGN.md).

- **Palette "Night Cabin":** navy base for low glare in dark cabins, cabin blue panels, amber for "act now", teal for "all good". The crew side uses a dark ops-console theme.
- **Fonts:** Lexend for headings and Atkinson Hyperlegible Next for body text, chosen for legibility on low-resolution screens (seat numbers like "14I"). IBM Plex Mono for numbers.
- **Vibe:** calm, reassuring, effortless.

## Stack

- React 19 + TypeScript, built with Vite
- Supabase: Postgres, real-time updates, Auth (crew sign-in), Edge Functions
- External APIs: AeroDataBox (flight data) and NOAA Aviation Weather (turbulence advisories, pilot reports, airport weather), called from Edge Functions
- Hosted on Vercel

Every backend call sits behind one file in `src/services/`, so the cloud backend could be swapped for an onboard server on a real aircraft.

## Run locally

1. `npm install`
2. Create `.env.local`:
   ```
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
   ```
   Use the publishable key only, never the secret key.
3. `npm run dev`, then open http://localhost:5173

Checks: `npm run build` and `npm run lint` (oxlint).

## Backend setup

- **Database:** run the files in `supabase/migrations/` in order (`0001` → `0018`) in the Supabase SQL Editor. Before `0012`, create the crew user under Authentication → Users.
- **Edge Functions:** `supabase functions deploy flight-lookup` and `supabase functions deploy flight-weather`. Set `AERODATABOX_RAPIDAPI_KEY` or `AERODATABOX_APIMARKET_KEY` as a function secret.
- **Security model:** the browser only has read access. All writes go through `security definer` functions, and crew-only ones check that the signed-in user is listed in `crew_members`.

## Known limits

- Seat entry is a demo stand-in. A real seatback already knows its seat.
- One lavatory per flight.
- Flight progress and turbulence timing are estimated from the schedule, not live aircraft position.
- Outside the US, only major turbulence warnings are published.
- Allergen tags are entered by crew and are a guide, not a guarantee.
- Flight-phase rules are enforced in the UI only.

## Project docs

- `prd.md`: product requirements and scope
- `DESIGN.md`: design system (palette, type, components, dos and don'ts)
- `CLAUDE.md`: working rules and current focus
- `WorkLog.md`: what was done and when
- `FeatureAnalysis.md`: how each feature works and why it matters
