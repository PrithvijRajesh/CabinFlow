import { useState } from 'react'
import Icon from '../components/Icon'
import type { Assistance as AssistanceState } from '../hooks/useAssistance'
import { ASSIST_TYPES, NOTE_MAX, type AssistRequest, type AssistType } from '../services/assistance'

const labelOf = (t: AssistType) => ASSIST_TYPES.find((a) => a.type === t)?.label ?? t

function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  return m < 1 ? 'just now' : `${m} min ago`
}

const STATUS: Record<AssistRequest['status'], { label: string; tone: string }> = {
  open: { label: 'Sent', tone: 'sent' },
  ack: { label: 'Crew is on the way', tone: 'ack' },
  done: { label: 'Done', tone: 'done' },
  cancelled: { label: 'Cancelled', tone: 'cancelled' },
}

export default function Assistance({ assist }: { assist: AssistanceState }) {
  const [picked, setPicked] = useState<AssistType | null>(null)
  const openTypes = new Set(assist.active.map((r) => r.type))

  return (
    <section className="assist">
      <div className="hero">
        <p className="eyebrow">Assistance</p>
        <h1 className="display">How can we <em>help</em>?</h1>
        <p className="lede">Tell the crew what you need. You'll see when someone is on the way.</p>
      </div>

      {assist.error && <p className="notice notice-error">{assist.error}</p>}

      {assist.requests.length > 0 && (
        <div className="assist-mine">
          <p className="eyebrow section-label">Your requests</p>
          <ul className="assist-list">
            {assist.requests.map((r) => {
              const s = STATUS[r.status]
              const live = r.status === 'open' || r.status === 'ack'
              return (
                <li key={r.id} className={`assist-item is-${s.tone}`}>
                  <span className="assist-item-text">
                    <span className="assist-item-label">{labelOf(r.type)}</span>
                    {r.note && <span className="assist-item-note">“{r.note}”</span>}
                    <span className="assist-item-meta">Sent {ago(r.created_at)}</span>
                  </span>
                  <span className={`pill pill-${s.tone}`}>{s.label}</span>
                  {live && (
                    <button className="btn-quiet" disabled={assist.busy} onClick={() => assist.cancel(r.id)}>Cancel</button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {!assist.ready ? (
        <div className="queue-card"><p className="eyebrow">Loading…</p></div>
      ) : picked ? (
        <Confirm type={picked} assist={assist} onDone={() => setPicked(null)} />
      ) : (
        <>
          <p className="eyebrow section-label">What do you need?</p>
          <div className="assist-grid">
            {ASSIST_TYPES.map((a) => {
              const open = openTypes.has(a.type)
              return (
                <button
                  key={a.type}
                  className={a.urgent ? 'assist-tile is-urgent' : 'assist-tile'}
                  disabled={open || !!assist.error}
                  onClick={() => setPicked(a.type)}
                >
                  <span className="assist-tile-label">{a.label}</span>
                  <span className="assist-tile-hint">{open ? 'Already requested' : a.hint}</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      <p className="footnote">Your call button still works as usual.</p>
    </section>
  )
}

function Confirm({ type, assist, onDone }: { type: AssistType; assist: AssistanceState; onDone: () => void }) {
  const [note, setNote] = useState('')
  const info = ASSIST_TYPES.find((a) => a.type === type)!
  const needsNote = type === 'other'
  const canSend = !assist.busy && (!needsNote || note.trim().length > 0)

  async function send() {
    if (await assist.send(type, needsNote ? note.trim() : null)) onDone()
  }

  return (
    <div className={info.urgent ? 'queue-card queue-turn' : 'queue-card'}>
      <p className="eyebrow">Send request</p>
      <p className="assist-confirm-title">{info.label}</p>

      {info.urgent && (
        <p className="queue-sub"><strong>For an emergency, press your call button too.</strong> This request is marked urgent for the crew.</p>
      )}

      {needsNote && (
        <label className="assist-note">
          <span className="queue-sub">What do you need?</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
            placeholder="e.g. My child's seat belt is stuck"
            rows={2}
            autoFocus
          />
          <span className="assist-count">{note.length}/{NOTE_MAX}</span>
        </label>
      )}

      <div className="queue-actions">
        <button className={info.urgent ? 'btn btn-light' : 'btn btn-primary'} disabled={!canSend} onClick={send}>
          Send to crew <Icon name="arrow" size={18} />
        </button>
        <button className="btn btn-ghost" disabled={assist.busy} onClick={onDone}>Back</button>
      </div>
    </div>
  )
}
