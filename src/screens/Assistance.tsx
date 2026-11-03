import { useState } from 'react'
import ErrorNotice from '../components/ErrorNotice'
import Icon from '../components/Icon'
import { useUndo } from '../context/useUndo'
import type { Assistance as AssistanceState } from '../hooks/useAssistance'
import { ASSIST_TYPES, NOTE_MAX, passengerLabel as labelOf, type AssistRequest, type AssistType } from '../services/assistance'

function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  return m < 1 ? 'just now' : `${m} min ago`
}

const STATUS: Record<AssistRequest['status'] | 'seen', { label: string; tone: string; hint?: string }> = {
  open: { label: 'Sent', tone: 'sent', hint: 'Crew usually respond within a few minutes.' },
  seen: { label: 'Seen by crew', tone: 'seen', hint: "Crew will come as soon as they're free. It can take longer while the seatbelt sign is on." },
  ack: { label: 'Crew are on the way', tone: 'ack' },
  done: { label: 'Done', tone: 'done' },
  cancelled: { label: 'Cancelled', tone: 'cancelled' },
}
const statusOf = (r: AssistRequest) => STATUS[r.status === 'open' && r.seen_at ? 'seen' : r.status]

export default function Assistance({ assist }: { assist: AssistanceState }) {
  const [picked, setPicked] = useState<AssistType | null>(null)
  const openTypes = new Set(assist.active.map((r) => r.type))
  const undo = useUndo()

  return (
    <section className="assist">
      <div className="hero">
        <p className="eyebrow">Assistance</p>
        <h1 className="display">How can we <em>help</em>?</h1>
        <p className="lede">For everyday needs, like a blanket or a drink. You'll see when crew are on the way.</p>
      </div>

      <p className="notice notice-row assist-call">
        <span><strong>Emergency?</strong> Press your call button. It reaches the crew straight away.</span>
      </p>

      {assist.error && <ErrorNotice message={assist.error} onRetry={assist.retry} />}

      {assist.requests.length > 0 && (
        <div className="assist-mine">
          <p className="eyebrow section-label">Your requests</p>
          <ul className="assist-list">
            {assist.requests.map((r) => {
              const s = statusOf(r)
              // Neighbors can see the screen, so discreet requests hide the note.
              const discreet = !!ASSIST_TYPES.find((a) => a.type === r.type)?.discreet
              const live = r.status === 'open' || r.status === 'ack'
              return (
                <li key={r.id} className={`assist-item is-${s.tone}`}>
                  <span className="assist-item-text">
                    <span className="assist-item-label">{labelOf(r.type)}</span>
                    {r.note && !discreet && <span className="assist-item-note">“{r.note}”</span>}
                    <span className="assist-item-meta">Sent {ago(r.created_at)}</span>
                    {s.hint && <span className="assist-item-note">{s.hint}</span>}
                  </span>
                  <span className={`pill pill-${s.tone}`}>{s.label}</span>
                  {live && (
                    <button className="btn btn-quiet" disabled={assist.busy} onClick={() => undo.defer({ key: `req:${r.id}`, message: `${labelOf(r.type)} request cancelled`, commit: () => assist.cancel(r.id) })}>Cancel request</button>
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
    </section>
  )
}

function Confirm({ type, assist, onDone }: { type: AssistType; assist: AssistanceState; onDone: () => void }) {
  const undo = useUndo()
  const [note, setNote] = useState('')
  const info = ASSIST_TYPES.find((a) => a.type === type)!
  const needsNote = type === 'other'
  const canSend = !assist.busy && (!needsNote || note.trim().length > 0)

  async function send() {
    if (await assist.send(type, note.trim() || null)) {
      undo.notify("Request sent. We'll let you know when crew are on the way.")
      onDone()
    }
  }

  return (
    <div className="queue-card">
      <p className="eyebrow">{info.urgent ? 'Send urgent request' : 'Send request'}</p>
      <p className="assist-confirm-title">{info.label}</p>

      {!info.urgent && (
        <p className="queue-sub">Crew usually respond within a few minutes. You'll see when they've seen it and when they're on the way.</p>
      )}

      {info.urgent && (
        <p className="queue-sub">Crew will see this as <strong>urgent</strong> and come to you first. If you need help right now, press your call button.</p>
      )}

      <label className="assist-note">
        <span className="queue-sub">{needsNote ? 'What do you need?' : 'Anything to add? (optional)'}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
          placeholder={info.example}
          rows={2}
          autoFocus={needsNote}
        />
        <span className="assist-count">{note.length}/{NOTE_MAX}</span>
      </label>

      <div className="queue-actions">
        <button className="btn btn-primary" disabled={!canSend} onClick={send}>
          {assist.busy ? 'Sending…' : 'Send to crew'} <Icon name="arrow" size={18} />
        </button>
        <button className="btn btn-ghost" disabled={assist.busy} onClick={onDone}>Back</button>
      </div>
    </div>
  )
}
