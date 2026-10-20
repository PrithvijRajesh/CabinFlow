import { useEffect, useState, type ReactNode } from 'react'
import { isUrgent, type CrewAssistance } from '../hooks/useCrewAssistance'
import { ASSIST_TYPES, type CrewAssistRequest } from '../services/assistance'

const labelOf = (r: CrewAssistRequest) => ASSIST_TYPES.find((a) => a.type === r.type)?.label ?? r.type

// Re-renders every 15s so "waiting" times stay current.
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])
  return now
}

const mins = (iso: string | null, now: number) => (iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000)) : 0)

export default function CrewRequests({ assist }: { assist: CrewAssistance }) {
  const now = useNow()
  const total = assist.open.length + assist.onTheWay.length

  return (
    <section className="crew-requests">
      <div className="hero">
        <p className="eyebrow">Passenger requests</p>
        <h1 className="display">
          {String(total).padStart(2, '0')} <span className="dim">open{assist.urgentOpen.length > 0 && ` · ${assist.urgentOpen.length} urgent`}</span>
        </h1>
        <p className="lede">Urgent first, then oldest. Tap On my way so the passenger knows help is coming.</p>
      </div>

      {assist.error && <p className="notice notice-error">{assist.error}</p>}

      {!assist.ready ? (
        <p className="crew-empty">Loading requests…</p>
      ) : (
        <div className="cart-grid">
          <div className="crew-list">
            <p className="eyebrow section-label">New · {assist.open.length}</p>
            {assist.open.length === 0 ? (
              <p className="crew-empty">No new requests.</p>
            ) : (
              <ul className="crew-rows">
                {assist.open.map((r) => (
                  <RequestRow key={r.id} r={r} meta={`waiting ${mins(r.created_at, now)} min`}>
                    <button className="btn-mini btn-mini-go" disabled={assist.busy} onClick={() => assist.ack(r.id)}>On my way</button>
                    <button className="btn-mini" disabled={assist.busy} onClick={() => assist.done(r.id)}>Done</button>
                  </RequestRow>
                ))}
              </ul>
            )}
          </div>

          <div className="crew-list">
            <p className="eyebrow section-label">On the way · {assist.onTheWay.length}</p>
            {assist.onTheWay.length === 0 ? (
              <p className="crew-empty">Nobody is on the way to a request.</p>
            ) : (
              <ul className="crew-rows">
                {assist.onTheWay.map((r) => (
                  <RequestRow key={r.id} r={r} meta={`on the way ${mins(r.ack_at, now)} min`}>
                    <button className="btn-mini btn-mini-done" disabled={assist.busy} onClick={() => assist.done(r.id)}>Done</button>
                  </RequestRow>
                ))}
              </ul>
            )}

            {assist.recent.length > 0 && (
              <>
                <p className="eyebrow section-label recent-label">Recently closed</p>
                <ul className="crew-rows">
                  {assist.recent.map((r) => (
                    <RequestRow key={r.id} r={r} meta={r.status === 'cancelled' ? 'cancelled by passenger' : `done ${mins(r.closed_at, now)} min ago`} closed />
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function RequestRow({ r, meta, closed = false, children }: { r: CrewAssistRequest; meta: string; closed?: boolean; children?: ReactNode }) {
  const urgent = isUrgent(r) && !closed
  return (
    <li className={`req-row${urgent ? ' is-urgent' : ''}${closed ? ' is-closed' : ''}`}>
      <span className="crew-seat">{r.seat}</span>
      <span className="req-text">
        <span className="req-label">
          {labelOf(r)}
          {urgent && <span className="cart-tag tag-urgent">urgent</span>}
        </span>
        {r.note && <span className="req-note">“{r.note}”</span>}
        <span className="crew-wait">{meta}</span>
      </span>
      {children && <span className="crew-actions">{children}</span>}
    </li>
  )
}
