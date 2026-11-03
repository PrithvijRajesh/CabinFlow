# CabinFlow design system

The dos and don'ts for how CabinFlow looks, reads and feels. Read this before changing any UI. Tokens live in `src/index.css` (`:root` for passengers, `.theme-crew` for crew).

## People and problem

- **Passenger:** on a seatback screen, often in a dark cabin, often tired, sometimes older or not a native English speaker, and using CabinFlow for the first time.
- **Crew:** glancing at a panel or tablet between tasks. They need to act on exceptions, not babysit a dashboard.
- **Problem:** passengers stand in the aisle and press the call button for things the crew could handle in one trip. CabinFlow lets them ask from their seat and know what's happening.

## Feeling

- **Vibe words:** calm, reassuring, effortless.
- **In the first 5 minutes a passenger should feel:** oriented, at ease, in control, informed, looked after, unhurried.
- **Mood board:** a dim cabin at night with soft blue LED strips; a calm departure-board readout; a galley with drinks ready before anyone pressed a button; an empty aisle.

## Color

Passenger theme "Night Cabin". Dark on purpose: seatbacks are viewed in dark cabins, and a bright screen bothers neighbors.

| Token | Value | Role |
|---|---|---|
| `--bg` | `#0F1B2D` | Page background (navy, a tinted black, not `#000`) |
| `--paper` / `--paper-2` | `#16263D` / `#1D3049` | Cards and raised surfaces |
| `--ink` | `#E8EEF5` | Main text (a tinted white, not `#FFF`) |
| `--ink-2` | `#A3B1C4` | Secondary text |
| `--line` | `#2B3E58` | Borders and dividers |
| `--accent` | `#F2A541` | **Primary action and "your move"**: main buttons, your turn, attention |
| `--accent-ink` | `#0F1B2D` | Text on amber |
| `--sky` | `#2F6CC0` | Info panels: queue card, selected choices, "Seen by crew" |
| `--on-sky` | `#F8F4EC` | Text and marks on blue or amber panels |
| `--ok` | `#2BB3A3` | Success: saved, served, done, all clear |
| `--danger` | `#FF7A66` | Errors, urgent, destructive |
| `--caution` | `#F5D06F` | Light bumps, mild warnings |

**Rules**
- **Semantic colors mean the same thing everywhere.** Teal = done or OK. Coral = error or urgent. Amber = needs your attention. Blue = information. Don't use a color for decoration if it already has a meaning.
- **Amber is the one call to action.** It marks the main button on a screen and "it's your turn". Amber doubles as attention, because in this app "your move" and "look here" are the same moment. Don't add a second accent color.
- **60-30-10:** about 60% navy background, 30% card surfaces, 10% amber. If a screen looks orange, there's too much accent.
- **Contrast:** every text pair passes WCAG AA (4.5:1). The tightest is `--on-sky` on `--sky` at 4.75:1. Cabin blue was darkened from `#3A7BD5` and the grey text lightened from `#5B6B80` to pass. Recheck if you change a token.
- **Crew theme** (`.theme-crew`) is a separate dark "ops console" with amber accent, so crew screens never get mistaken for a passenger's.

## Typography

| Use | Font | Why |
|---|---|---|
| Headings (`--heading`) | **Lexend** | Open, rounded shapes designed for easy reading. Calm without being childish. |
| Body (`--sans`) | **Atkinson Hyperlegible Next** | Built for low-vision readers. Every character is distinct (1 / l / I, 0 / O), which matters for seat numbers like "14I" on a low-res screen. |
| Numbers and labels (`--mono`) | **IBM Plex Mono** | Seat numbers, times and counts line up and read like a departure board. |

- Inter and Roboto were ruled out on purpose: they're what every AI-generated app defaults to.
- All three are open-licensed (SIL OFL) and self-hosted through Fontsource npm packages, so nothing loads from a third-party CDN in flight.
- Body text is 15–16px (1rem base). Nothing is smaller than 12px (0.75rem), and that size is only for short tags like "Out" or "urgent".

## Components (reuse before adding)

| Need | Use |
|---|---|
| Main action | `.btn .btn-primary` (amber). One per card. |
| Secondary or back | `.btn .btn-ghost`, or `.btn-quiet` for low-key text actions like "Clear pick" |
| Small row actions (crew) | `.btn-mini`, with `-go` / `-danger` / `-done` variants |
| Big status card | `.queue-card` (blue). Add `.queue-turn` for "it's your turn" (amber). |
| Inline message | `.notice`, with `-warn` / `-ok` / `-error`. The left border carries the meaning. |
| Cross-screen alert | `.turn-banner`, rendered in `AppShell` |
| Status tag | `.pill`, with `-sent` / `-seen` / `-ack` / `-done` |
| Pick one of many | `.choice` buttons in a `.choices` grid; `.seg` for small toggles |
| Undoable action | `useUndo().defer(...)` (5-second Undo toast); confirmations use `notify(...)` |

## Do

- Use tokens. **Never hardcode a hex or rgba value** outside the token blocks. For a tint, use `color-mix(in srgb, var(--token) N%, transparent)`.
- Write plain, calm copy: say what happens next ("We'll show a banner when it's your turn"), not what the system did.
- Be honest about estimates and limits: "about 3–5 min", "estimated", "labels are a guide".
- Keep sensitive things discreet: neighbors can see the screen. Show "Urgent help", not "Feeling unwell"; show "Your turn is ready", not "restroom".
- Make touch targets at least 44px.
- Respect `prefers-reduced-motion`. Motion is only for feedback (rise, fade, a gentle pulse), never decoration.

## Don't

- Don't add purple gradients, glassmorphism, emoji-heavy UI or stock "SaaS hero" layouts. That's the AI-average look this design avoids.
- Don't flash or pulse large areas in amber or red. A dark cabin makes it harsh, and it raises anxiety.
- Don't add a timer the passenger has to race.
- Don't show another seat's information to a passenger.
- Don't introduce a new button, card or color style when one above already fits.

## What makes it ours (not the AI average)

- A dark, cabin-lit palette instead of the default white page with a blue button.
- A legibility-first font instead of Inter.
- Monospace seat numbers and times, so it reads like a departure board.
- Crew get a distinct ops-console theme.
- Copy written for a tired traveler in a dark cabin: short, calm, honest about waits.
