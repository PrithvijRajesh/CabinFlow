import { useState, type FormEvent } from 'react'
import { useFlight } from '../context/useFlight'
import { statusLabel } from '../data/flight'
import Icon from '../components/Icon'
import type { Role } from '../types'

interface Props {
  onSelect: (role: Role) => void
}

export default function RoleSelect({ onSelect }: Props) {
  const { flight, isDemo, progress } = useFlight()
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

          <FlightLookup key={flight.flightNumber} isDemo={isDemo} />
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
              <span className="stub-sub">Crew PIN required</span>
            </span>
            <Icon name="arrow" size={20} className="stub-arrow" />
          </button>
        </section>
      </div>
    </main>
  )
}

// Demo control: set which real flight this screen is on. On real seatback
// hardware the flight comes from the aircraft, so this goes away.
function FlightLookup({ isDemo }: { isDemo: boolean }) {
  const { flight, loadFlight, resetToDemo } = useFlight()
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!value.trim()) return
    setLoading(true)
    setError('')
    try {
      await loadFlight(value)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="lookup" onSubmit={submit}>
      <span className="lookup-meta">
        {isDemo ? 'Demo flight' : [flight.airline, flight.aircraft].filter(Boolean).join(' · ')}
      </span>
      <div className="lookup-row">
        <input
          className="lookup-input"
          value={value}
          onChange={(e) => { setValue(e.target.value.toUpperCase()); setError('') }}
          placeholder="Flight no. e.g. UA 1234"
          maxLength={8}
          aria-label="Flight number"
          aria-invalid={!!error}
        />
        <button className="lookup-btn" disabled={loading || !value.trim()}>
          {loading ? 'Looking up…' : 'Load flight'}
        </button>
        {!isDemo && (
          <button type="button" className="lookup-reset" onClick={resetToDemo}>Use demo</button>
        )}
      </div>
      {error && <p className="hint hint-error">{error}</p>}
    </form>
  )
}
