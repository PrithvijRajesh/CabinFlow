import FlightStrip from '../components/FlightStrip'
import ErrorNotice from '../components/ErrorNotice'
import { useFlight } from '../context/useFlight'
import { statusLabel } from '../data/flight'
import { useFlightWeather } from '../hooks/useFlightWeather'
import type { Ride, RideLeg } from '../services/flightWeather'

// Passenger wording. "none" means nothing was reported, not a promise of smooth air.
const RIDE: Record<Ride, { label: string; tip: string }> = {
  none: { label: 'No turbulence reported', tip: 'A good time to stretch or use the restroom.' },
  light: { label: 'Light bumps', tip: 'Some light bumps reported. Keep your seat belt fastened while seated.' },
  bumpy: { label: 'Bumpy', tip: 'Bumps reported on this part of the route. The crew may pause the restroom line.' },
}

const LEG_NAMES = ['Climb', 'Early cruise', 'Mid cruise', 'Late cruise', 'Descent']

const fahrenheit = (c: number) => Math.round(c * 9 / 5 + 32)

// Local time right now at the destination, e.g. "14:05".
function localNow(timeZone?: string | null) {
  if (!timeZone) return null
  try {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date())
  } catch {
    return null
  }
}

export default function FlightInfo() {
  const { flight, progress, remaining, isDemo, phase } = useFlight()
  const { weather, loading, error, missingCodes, retry } = useFlightWeather(flight)
  const status = statusLabel(flight.status)
  const dest = weather?.destination
  const legs = weather?.outlook?.legs
  // Only in flight is there a "current" leg; before takeoff it's the whole route ahead.
  const current = phase === 'inflight' ? Math.min(LEG_NAMES.length - 1, Math.floor(progress * LEG_NAMES.length)) : null
  const destNow = localNow(flight.destination.timeZone)

  return (
    <section className="flight-info">
      <div className="hero">
        <p className="eyebrow">Flight info · {flight.flightNumber}</p>
        <h1 className="display">
          {flight.origin.code} <span className="dim">→</span> <em>{flight.destination.code}</em>
        </h1>
        <p className="lede">
          {remaining === 'Landed' ? 'We have landed.' : remaining ? `${remaining} to go.` : ''} Arriving in {flight.destination.city || flight.destination.code}
          {flight.arrivalTime && ` at ${flight.arrivalTime} local time`}.
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
            <div><dt>{progress > 0 ? 'Departed' : 'Departs'}</dt><dd>{flight.departureTime || '—'}</dd></div>
            <div><dt>Arrives</dt><dd>{flight.arrivalTime || '—'}</dd></div>
            <div><dt>Time left</dt><dd>{remaining || '—'}</dd></div>
          </dl>
          <p className="info-meta">
            {[flight.airline, flight.aircraft].filter(Boolean).join(' · ')}
            {isDemo && ' · demo flight'}
          </p>
        </div>

        <div className="info-card">
          <p className="eyebrow section-label">Destination{destNow && ` · ${destNow} local now`}</p>
          <p className="info-big">{flight.destination.code}</p>
          <p className="info-city">{flight.destination.city}</p>
          {dest ? (
            <>
              <p className="info-weather">
                {dest.tempC !== null && <strong>{Math.round(dest.tempC)}°C <span className="dim">/ {fahrenheit(dest.tempC)}°F</span></strong>}
                {' '}{dest.condition} · {dest.wind}
              </p>
              {dest.atArrival && (
                <p className="info-meta">Around arrival: {dest.atArrival.condition.toLowerCase()}, {dest.atArrival.wind.toLowerCase()}.</p>
              )}
            </>
          ) : (
            <p className="info-meta">{loading ? 'Loading weather…' : `Scheduled arrival ${flight.arrivalTime || '—'} local time`}</p>
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
            <RideOutlook legs={legs} current={current} usOnly={weather!.outlook!.usOnly} />
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

// Before takeoff: the roughest part of the route ahead, in one line.
function expected(legs: RideLeg[]) {
  const bumpy = legs.filter((l) => l.ride === 'bumpy').map((l) => l.name.toLowerCase())
  const light = legs.filter((l) => l.ride === 'light').map((l) => l.name.toLowerCase())
  if (bumpy.length) return <>Some <strong className="ride-bumpy">bumps</strong> reported along the route ({bumpy.join(', ')}). The crew will keep you posted.</>
  if (light.length) return <>Mostly calm, with <strong className="ride-light">light bumps</strong> reported ({light.join(', ')}).</>
  return <><strong className="ride-none">No turbulence reported</strong> along today's route so far.</>
}

function RideOutlook({ legs, current, usOnly }: { legs: RideLeg[]; current: number | null; usOnly: boolean }) {
  const now = current === null ? null : RIDE[legs[current].ride]
  return (
    <>
      {now && current !== null ? (
        <p className="ride-now">Right now: <strong className={`ride-${legs[current].ride}`}>{now.label}</strong>. {now.tip}</p>
      ) : (
        <p className="ride-now">{expected(legs)}</p>
      )}
      <ol className="ride-legs">
        {legs.map((leg, i) => (
          <li key={leg.name} className={`ride-leg ride-${leg.ride}${i === current ? ' is-now' : ''}${current !== null && i < current ? ' is-past' : ''}`}>
            <span className="ride-bar" />
            <span className="ride-leg-name">{leg.name}</span>
            <span className="ride-leg-label">{leg.ride === 'none' ? 'Nothing reported' : RIDE[leg.ride].label}</span>
          </li>
        ))}
      </ol>
      {!usOnly && (
        <p className="info-meta">Outside the US only major turbulence warnings are published, so lighter bumps may not show here.</p>
      )}
    </>
  )
}
