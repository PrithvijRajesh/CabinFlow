import { useEffect, useState } from 'react'
import ErrorNotice from '../components/ErrorNotice'
import Icon from '../components/Icon'
import { useFlight } from '../context/useFlight'
import { useUndo } from '../context/useUndo'
import { useCrewRestroomQueue } from '../hooks/useCrewRestroomQueue'
import { TURN_SECONDS } from '../hooks/useRestroomQueue'
import type { CrewAction, CrewSpot } from '../services/restroomQueue'

// Re-renders every second so wait times and the turn countdown stay current.
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

function mmss(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const since = (iso: string | null, now: number) => (iso ? (now - new Date(iso).getTime()) / 1000 : 0)

// `onChangePhase` jumps to the phase control on crew Home.
export default function CrewRestroom({ onChangePhase }: { onChangePhase: () => void }) {
  const { flightId, phase } = useFlight()
  const q = useCrewRestroomQueue(flightId)
  const now = useNow()
  const undo = useUndo()

  // Ending a turn or removing a seat waits a few seconds so it can be undone.
  const spots = q.spots.filter((s) => !undo.isPending(`spot:${s.id}`))
  const called = spots.find((s) => s.status === 'called') ?? null
  const waiting = spots.filter((s) => s.status === 'waiting')
  const endSpot = (s: CrewSpot, action: CrewAction, message: string) =>
    undo.defer({ key: `spot:${s.id}`, message, commit: () => q.act(s.id, action) })

  return (
    <section className="crew-restroom">
      <div className="hero">
        <p className="eyebrow">Restroom queue · Lavatory 1</p>
        <h1 className="display">
          {String(spots.length).padStart(2, '0')} <span className="dim">in line</span>
        </h1>
        <p className="lede">Confirm turns, mark no-shows, or call a seat out of order.</p>
      </div>

      {q.error && <ErrorNotice message={q.error} onRetry={q.retry} />}
      {phase !== 'inflight' && (
        <div className="notice notice-warn notice-row">
          <span>Passengers can't join the line {phase === 'boarding' ? 'until takeoff' : 'after landing'}.</span>
          <button className="btn-mini" onClick={onChangePhase}>Change phase</button>
        </div>
      )}

      <div className={q.paused ? 'line-control paused' : 'line-control'}>
        <span className="line-state">
          <span className="led" /> {q.paused ? 'Line paused · no one is being called' : 'Line running'}
        </span>
        <button className="btn btn-outline" disabled={q.busy || !q.ready} onClick={() => q.setPaused(!q.paused)}>
          {q.paused ? 'Resume line' : 'Pause line'}
        </button>
      </div>

      <div className="crew-grid">
        <NowServing spot={called} paused={q.paused} now={now} busy={q.busy} onEnd={endSpot} />

        <div className="crew-list">
          <p className="eyebrow section-label">Waiting · {waiting.length}</p>
          {!q.ready ? (
            <p className="crew-empty">Loading line…</p>
          ) : waiting.length === 0 ? (
            <p className="crew-empty">No one waiting.</p>
          ) : (
            <ol className="crew-rows">
              {waiting.map((s, i) => (
                <li key={s.id} className="crew-row">
                  <span className="crew-pos">{String(i + 1).padStart(2, '0')}</span>
                  <span className="crew-seat">{s.seat}</span>
                  <span className="crew-wait">waiting {mmss(since(s.joined_at, now))}</span>
                  <span className="crew-actions">
                    <button className="btn-mini" disabled={q.busy} onClick={() => q.act(s.id, 'call_now')}>Call now</button>
                    <button className="btn-mini btn-mini-danger" disabled={q.busy} onClick={() => endSpot(s, 'remove', `Removed ${s.seat} from the line`)} aria-label={`Remove ${s.seat}`}>
                      <Icon name="trash" size={18} />
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  )
}

interface NowProps {
  spot: CrewSpot | null
  paused: boolean
  now: number
  busy: boolean
  onEnd: (spot: CrewSpot, action: CrewAction, message: string) => void
}

function NowServing({ spot, paused, now, busy, onEnd }: NowProps) {
  if (!spot) {
    return (
      <div className="now-card">
        <p className="eyebrow">Now</p>
        <p className="now-seat dim">—</p>
        <p className="now-sub">{paused ? 'Paused. The next seat is called when you resume.' : 'Lavatory free. No seat is called.'}</p>
      </div>
    )
  }

  const left = TURN_SECONDS - since(spot.called_at, now)

  return (
    <div className="now-card now-active">
      <p className="eyebrow">Now · called</p>
      <p className="now-seat">{spot.seat}</p>
      <p className="now-sub">Turn ends in <strong>{mmss(left)}</strong>, then the next seat is called.</p>
      <div className="turn-bar"><span style={{ width: `${Math.max(0, left / TURN_SECONDS) * 100}%` }} /></div>
      <div className="queue-actions">
        <button className="btn btn-primary" disabled={busy} onClick={() => onEnd(spot, 'done', `${spot.seat} is back`)}>Confirm back</button>
        <button className="btn btn-outline" disabled={busy} onClick={() => onEnd(spot, 'skip', `${spot.seat} marked as no-show`)}>No-show</button>
      </div>
    </div>
  )
}
