import { useState, type FormEvent } from 'react'
import { useFlight } from '../context/useFlight'
import { AIRCRAFT_ID } from '../data/flight'

// Crew set this aircraft's flight once per flight. Every seatback on the
// aircraft picks it up live. On real hardware the aircraft would supply it.
export default function FlightSetup() {
  const { flight, isDemo, loadFlight, resetToDemo } = useFlight()
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
      setValue('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (value.trim()) void run(() => loadFlight(value))
  }

  return (
    <div className={isDemo ? 'setup-card needs-setup' : 'setup-card'}>
      <div className="setup-head">
        <p className="eyebrow">This aircraft · {AIRCRAFT_ID}</p>
        <p className="setup-flight">
          {isDemo ? 'No flight set' : <>{flight.flightNumber} <span className="dim">{flight.origin.code} → {flight.destination.code}</span></>}
        </p>
        <p className="lookup-meta">
          {isDemo ? 'Seatbacks show the demo flight until you set the real one.' : [flight.airline, flight.aircraft].filter(Boolean).join(' · ')}
        </p>
      </div>

      <form className="lookup" onSubmit={submit}>
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
          <button className="lookup-btn" disabled={busy || !value.trim()}>
            {busy ? 'Working…' : isDemo ? 'Set flight' : 'Change flight'}
          </button>
          {!isDemo && (
            <button type="button" className="lookup-reset" disabled={busy} onClick={() => void run(resetToDemo)}>Use demo flight</button>
          )}
        </div>
        {error && <p className="hint hint-error">{error}</p>}
      </form>
    </div>
  )
}
