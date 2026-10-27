import { useFlight } from '../context/useFlight'
import { statusLabel } from '../data/flight'
import Icon from '../components/Icon'
import type { Role } from '../types'

interface Props {
  onSelect: (role: Role) => void
}

export default function RoleSelect({ onSelect }: Props) {
  const { flight, isDemo, ready, progress } = useFlight()
  const status = statusLabel(flight.status)
  const departed = progress > 0

  return (
    <main className="entry">
      <div className="pass">
        <section className="pass-main">
          <header className="pass-head">
            <span className="wordmark">CabinFlow</span>
            <span className="eyebrow">Boarding pass · {flight.flightNumber}</span>
          </header>

          <div className="route">
            <div>
              <span className="route-code">{flight.origin.code}</span>
              <span className="route-city">{flight.origin.city}</span>
            </div>
            <div className="route-line" aria-hidden>
              <Icon name="plane" size={22} />
            </div>
            <div className="route-right">
              <span className="route-code">{flight.destination.code}</span>
              <span className="route-city">{flight.destination.city}</span>
            </div>
          </div>

          <dl className="pass-fields">
            <div><dt>Flight</dt><dd>{flight.flightNumber}</dd></div>
            <div><dt>{departed ? 'Departed' : 'Departs'}</dt><dd>{flight.departureTime || '—'}</dd></div>
            <div><dt>Arrives</dt><dd>{flight.arrivalTime || '—'}</dd></div>
            <div><dt>Status</dt><dd className={`status status-${status.tone}`}>{status.label}</dd></div>
          </dl>

          <p className="lookup-meta pass-meta">
            {!ready ? 'Loading flight…' : isDemo ? 'Demo flight · crew set the real flight on board' : [flight.airline, flight.aircraft].filter(Boolean).join(' · ')}
          </p>
        </section>

        <div className="pass-perf" aria-hidden />

        <section className="pass-stub">
          <h1 className="stub-title">Who's using this screen?</h1>
          <button className="stub-option" onClick={() => onSelect('passenger')}>
            <Icon name="seat" size={28} className="stub-icon" />
            <span className="stub-text">
              <span className="stub-label">Passenger</span>
              <span className="stub-sub">Enter your seat to begin</span>
            </span>
            <Icon name="arrow" size={20} className="stub-arrow" />
          </button>
          <button className="stub-option" onClick={() => onSelect('crew')}>
            <Icon name="badge" size={28} className="stub-icon" />
            <span className="stub-text">
              <span className="stub-label">Cabin crew</span>
              <span className="stub-sub">Crew sign-in required</span>
            </span>
            <Icon name="arrow" size={20} className="stub-arrow" />
          </button>
        </section>
      </div>
    </main>
  )
}
