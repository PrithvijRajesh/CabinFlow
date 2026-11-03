import FlightStrip from '../components/FlightStrip'
import ErrorNotice from '../components/ErrorNotice'
import { useFlight } from '../context/useFlight'
import { arriveClock, departClock, destinationNow, statusLabel, timeDifference } from '../data/flight'
import { useFlightWeather } from '../hooks/useFlightWeather'
import type { Ride, RideLeg } from '../services/flightWeather'

// Passenger wording. "none" means nothing was reported, not a promise of smooth air.
const RIDE: Record<Ride, { label: string; tip: string }> = {
  none: { label: 'No turbulence reported', tip: 'So far, a good time to stretch or use the restroom. Conditions can change.' },
  light: { label: 'Light bumps', tip: 'Some light bumps reported. This is normal. Keep your seat belt fastened while seated.' },
  bumpy: { label: 'Bumpy', tip: "Bumps reported on this part of the route. They can feel uncomfortable, but they're normal. Keep your seat belt fastened. The crew may pause the restroom line." },
}

const LEG_NAMES = ['Climb', 'Early cruise', 'Mid cruise', 'Late cruise', 'Descent']

const fahrenheit = (c: number) => Math.round(c * 9 / 5 + 32)

// The US (and a couple of others) read °F first.
const FAHRENHEIT_FIRST = (() => {
  try {
    return ['US', 'LR', 'MM'].includes(new Intl.Locale(navigator.language).maximize().region ?? '')
  } catch {
    return false
  }
})()

// "40 min", "1 h 20 min", rounded to 5 minutes: these are rough.
function duration(ms: number) {
  const m = Math.max(5, Math.round(ms / 300_000) * 5)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`
}

// When each leg starts, from the scheduled times. Legs are equal fifths of
// the route (same split as the weather function), so this is an estimate.
function legTimes(depUtc?: string | null, arrUtc?: string | null) {
  if (!depUtc || !arrUtc) return null
  const dep = new Date(depUtc).getTime()
  const span = new Date(arrUtc).getTime() - dep
  return LEG_NAMES.map((_, i) => dep + (span * i) / LEG_NAMES.length)
}

// `onOpen` jumps to another passenger screen (the restroom line).
export default function FlightInfo({ onOpen }: { onOpen: (id: string) => void }) {
  const { flight, progress, remaining, isDemo, phase } = useFlight()
  const { weather, loading, error, missingCodes, retry } = useFlightWeather(flight)
  const status = statusLabel(flight.status)
  const dest = weather?.destination
  const legs = weather?.outlook?.legs
  // Only in flight is there a "current" leg; before takeoff it's the whole route ahead.
  const current = phase === 'inflight' ? Math.min(LEG_NAMES.length - 1, Math.floor(progress * LEG_NAMES.length)) : null
  const destNow = destinationNow(flight)
  const diff = timeDifference(flight)
  const departs = departClock(flight)
  const arrives = arriveClock(flight)
  const starts = legTimes(flight.departureUtc, flight.arrivalUtc)

  return (
    <section className="flight-info">
      <div className="hero">
        <p className="eyebrow">Flight info · {flight.flightNumber}</p>
        <h1 className="display">
          {flight.origin.code} <span className="dim">→</span> <em>{flight.destination.code}</em>
        </h1>
        <p className="lede">
          {remaining === 'Landed' ? 'We have landed.' : remaining ? `About ${remaining} to go.` : ''} Arriving in {flight.destination.city || flight.destination.code}
          {arrives && ` at ${arrives} local time`}.
          {diff && diff !== 'same time' && ` Their clock is ${diff} of ${flight.origin.code}.`}
        </p>
        <div className="hero-strip"><FlightStrip /></div>
      </div>

      {missingCodes && (
        <p className="notice notice-warn">Live weather isn't available for this flight yet. Your flight times are still up to date.</p>
      )}
      {error && <ErrorNotice message={error} onRetry={retry} />}

      <div className="info-grid">
        <div className="info-card">
          <p className="eyebrow section-label">Your flight</p>
          <dl className="pass-fields info-fields">
            <div><dt>Status</dt><dd className={`status status-${status.tone}`}>{status.label}</dd></div>
            <div><dt>{progress > 0 ? 'Departed' : 'Departs'}</dt><dd>{departs || '—'} <span className="tz">{flight.origin.code} time</span></dd></div>
            <div><dt>Arrives</dt><dd>{arrives || '—'} <span className="tz">{flight.destination.code} time</span></dd></div>
            <div><dt>Time left</dt><dd>{remaining || '—'} {remaining && remaining !== 'Landed' && <span className="tz">estimated</span>}</dd></div>
          </dl>
          <p className="info-meta">Times come from the schedule and can shift with delays or air traffic. The crew will announce changes.</p>
          <p className="info-meta">
            {[flight.airline, flight.aircraft].filter(Boolean).join(' · ')}
            {isDemo && ' · demo flight'}
          </p>
        </div>

        <div className="info-card">
          <p className="eyebrow section-label">Destination</p>
          <p className="info-big">{flight.destination.code}</p>
          <p className="info-city">{flight.destination.city}</p>
          {destNow && (
            <p className="info-weather"><strong>{destNow}</strong> local time{diff && ` · ${diff === 'same time' ? `same as ${flight.origin.code}` : `${diff} of ${flight.origin.code}`}`}</p>
          )}
          {dest ? (
            <>
              <p className="info-weather">
                {dest.tempC !== null && (FAHRENHEIT_FIRST
                  ? <strong>{fahrenheit(dest.tempC)}°F <span className="dim">/ {Math.round(dest.tempC)}°C</span></strong>
                  : <strong>{Math.round(dest.tempC)}°C <span className="dim">/ {fahrenheit(dest.tempC)}°F</span></strong>)}
                {' '}{dest.condition} · {dest.wind}
              </p>
              {dest.atArrival && (
                <p className="info-meta">Around arrival: {dest.atArrival.condition.toLowerCase()}, {dest.atArrival.wind.toLowerCase()}.</p>
              )}
            </>
          ) : (
            <p className="info-meta">{loading ? 'Loading weather…' : `Scheduled arrival ${arrives || '—'} local time`}</p>
          )}
        </div>

        <div className="info-card info-wide">
          <div className="ride-head">
            <p className="eyebrow section-label">{phase === 'boarding' ? 'Expected turbulence' : 'Turbulence outlook'}</p>
            {weather && <span className="pill">Updated {new Date(weather.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
          {phase === 'landed' ? (
            <p className="ride-now">We've landed. Welcome to {flight.destination.city || flight.destination.code}.</p>
          ) : legs ? (
            <RideOutlook legs={legs} current={current} starts={starts} usOnly={weather!.outlook!.usOnly} onRestroom={() => onOpen('bathroom')} />
          ) : (
            <p className="info-meta">{loading ? 'Checking the route for turbulence…' : 'The turbulence outlook is unavailable for this flight right now.'}</p>
          )}
          <p className="info-meta">
            Based on NOAA aviation weather advisories and recent pilot reports. The seat belt sign and crew instructions always come first.
          </p>
        </div>
      </div>
    </section>
  )
}

// Rough timing for one leg: "Now", "In about 40 min", or before takeoff "About 1 h in".
function when(i: number, current: number | null, starts: number[] | null) {
  if (current !== null && i === current) return 'Now'
  if (current !== null && i < current) return 'Passed'
  if (!starts) return null
  if (current === null) return i === 0 ? 'At takeoff' : `About ${duration(starts[i] - starts[0])} in`
  return `In about ${duration(starts[i] - Date.now())}`
}

// In flight: the next leg with bumps, so passengers know when, not just where.
function nextBumps(legs: RideLeg[], current: number, starts: number[] | null) {
  const i = legs.findIndex((l, n) => n > current && l.ride !== 'none')
  if (i < 0 || !starts) return null
  return <> Next: <strong className={`ride-${legs[i].ride}`}>{RIDE[legs[i].ride].label.toLowerCase()}</strong> in about {duration(starts[i] - Date.now())}.</>
}

// Before takeoff: the roughest part of the route ahead, in one line.
function expected(legs: RideLeg[]) {
  const bumpy = legs.filter((l) => l.ride === 'bumpy').map((l) => l.name.toLowerCase())
  const light = legs.filter((l) => l.ride === 'light').map((l) => l.name.toLowerCase())
  if (bumpy.length) return <>Some <strong className="ride-bumpy">bumps</strong> reported along the route ({bumpy.join(', ')}). That's normal, and the crew will keep you posted.</>
  if (light.length) return <>Mostly calm, with <strong className="ride-light">light bumps</strong> reported ({light.join(', ')}).</>
  return <><strong className="ride-none">No turbulence reported</strong> along today's route so far. Conditions can change during the flight.</>
}

function RideOutlook({ legs, current, starts, usOnly, onRestroom }: { legs: RideLeg[]; current: number | null; starts: number[] | null; usOnly: boolean; onRestroom: () => void }) {
  const now = current === null ? null : RIDE[legs[current].ride]
  return (
    <>
      {now && current !== null ? (
        <p className="ride-now">
          Right now: <strong className={`ride-${legs[current].ride}`}>{now.label}</strong>.{' '}
          {legs[current].ride === 'none'
            ? <>So far, a good time to stretch or <button className="link-btn link-inline" onClick={onRestroom}>use the restroom</button>. Conditions can change.</>
            : now.tip}
          {nextBumps(legs, current, starts)}
        </p>
      ) : (
        <p className="ride-now">{expected(legs)}</p>
      )}
      <ol className="ride-legs">
        {legs.map((leg, i) => (
          <li key={leg.name} className={`ride-leg ride-${leg.ride}${i === current ? ' is-now' : ''}${current !== null && i < current ? ' is-past' : ''}`}>
            <span className="ride-bar" />
            <span className="ride-leg-name">{leg.name}</span>
            <span className="ride-leg-label">{leg.ride === 'none' ? 'Nothing reported' : RIDE[leg.ride].label}</span>
            {when(i, current, starts) && <span className="ride-leg-when">{when(i, current, starts)}</span>}
          </li>
        ))}
      </ol>
      <p className="notice ride-calm">
        <strong>Turbulence is a normal part of flying.</strong> Aircraft are built to handle far more than you'll feel. Keep your seat belt fastened whenever you're seated.
      </p>
      {!usOnly && (
        <p className="info-meta">Outside the US only major turbulence warnings are published, so lighter bumps may not show here.</p>
      )}
    </>
  )
}
