import FlightStrip from '../components/FlightStrip'
import { useFlight } from '../context/useFlight'
import { statusLabel } from '../data/flight'

type Ride = 'smooth' | 'light' | 'bumpy'

const RIDE: Record<Ride, { label: string; tip: string }> = {
  smooth: { label: 'Smooth', tip: 'A good time to stretch or use the restroom.' },
  light: { label: 'Light chop', tip: 'Some light bumps. Keep your seat belt fastened while seated.' },
  bumpy: { label: 'Bumpy', tip: 'Expect bumps. The crew may pause the restroom line.' },
}

const LEGS = ['Climb', 'Early cruise', 'Mid cruise', 'Late cruise', 'Descent']

// SAMPLE outlook until a real turbulence source is approved: picked from the
// flight ID so it stays the same for the whole flight. Not real data.
function sampleOutlook(id: string): Ride[] {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const rides: Ride[] = ['smooth', 'smooth', 'light', 'smooth', 'bumpy', 'light']
  return LEGS.map((_, i) => (i === 0 || i === LEGS.length - 1 ? 'light' : rides[(h >> (i * 3)) % rides.length]))
}

export default function FlightInfo() {
  const { flight, flightId, progress, remaining, isDemo } = useFlight()
  const status = statusLabel(flight.status)
  const outlook = sampleOutlook(flightId)
  const current = Math.min(LEGS.length - 1, Math.floor(progress * LEGS.length))
  const now = RIDE[outlook[current]]

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
          <p className="eyebrow section-label">Destination</p>
          <p className="info-big">{flight.destination.code}</p>
          <p className="info-city">{flight.destination.city}</p>
          <p className="info-meta">Scheduled arrival {flight.arrivalTime || '—'} local time</p>
        </div>

        <div className="info-card info-wide">
          <div className="ride-head">
            <p className="eyebrow section-label">Ride outlook</p>
            <span className="pill">Sample · live data coming</span>
          </div>
          <p className="ride-now">Right now: <strong className={`ride-${outlook[current]}`}>{now.label}</strong>. {now.tip}</p>
          <ol className="ride-legs">
            {LEGS.map((leg, i) => (
              <li key={leg} className={`ride-leg ride-${outlook[i]}${i === current ? ' is-now' : ''}${i < current ? ' is-past' : ''}`}>
                <span className="ride-bar" />
                <span className="ride-leg-name">{leg}</span>
                <span className="ride-leg-label">{RIDE[outlook[i]].label}</span>
              </li>
            ))}
          </ol>
          <p className="info-meta">Keep your seat belt fastened while seated. Always follow the seat belt sign and crew instructions.</p>
        </div>
      </div>
    </section>
  )
}
