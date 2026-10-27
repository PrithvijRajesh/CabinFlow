import { useEffect, useRef, useState } from 'react'
import ErrorNotice from '../components/ErrorNotice'
import Icon from '../components/Icon'
import { useUndo } from '../context/useUndo'
import { AVG_VISIT_MINUTES, TURN_SECONDS, type RestroomQueue } from '../hooks/useRestroomQueue'

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function minutesAgo(iso: string | null) {
  return iso ? (Date.now() - new Date(iso).getTime()) / 60_000 : Infinity
}

export default function Restroom({ queue }: { queue: RestroomQueue }) {
  const { ready, error, waitingCount, mySpot, ahead, isMyTurn, busy } = queue
  const inLine = ahead !== null
  const undo = useUndo()

  // Leaving waits a few seconds so it can be undone. Joining again inside
  // that window just keeps the old spot.
  const leave = (message: string) => undo.defer({ key: 'restroom:leave', message, commit: queue.leave })
  const join = async (saved?: string) => {
    if (undo.isPending('restroom:leave')) return undo.cancel('restroom:leave')
    if ((await queue.join()) && saved) undo.notify(saved)
  }

  // An empty line starts the 5-minute turn at once, so that tap needs a second, clear one.
  const [confirmGo, setConfirmGo] = useState(false)
  const confirming = confirmGo && waitingCount === 0 && !inLine
  useEffect(() => {
    if (!confirming) return
    const t = setTimeout(() => setConfirmGo(false), 10_000)
    return () => clearTimeout(t)
  }, [confirming])

  // Recent outcomes worth telling the passenger about.
  const recent = !inLine && mySpot ? minutesAgo(mySpot.ended_at) : Infinity
  const byCrew = mySpot?.ended_by === 'crew'
  const timedOut = !byCrew && mySpot?.status === 'skipped' && recent < 15
  const crewEnded = byCrew && (mySpot?.status === 'skipped' || mySpot?.status === 'left') && recent < 15
  const justBack = mySpot?.status === 'done' && recent < 2

  return (
    <section className="restroom">
      <div className="hero">
        <p className="eyebrow">Restroom line</p>
        <h1 className="display">Skip the aisle queue.</h1>
        <p className="lede">Save your spot from your seat. We'll tell you when it's your turn.</p>
      </div>

      {error && <ErrorNotice message={error} onRetry={queue.retry} />}
      {timedOut && (
        <p className="notice notice-warn">Your turn timed out after 5 minutes, so the next person was called. You can join again anytime.</p>
      )}
      {crewEnded && (
        <p className="notice notice-warn">
          {mySpot?.status === 'skipped' ? 'The crew ended your turn.' : 'The crew removed you from the line.'} You can join again anytime.
        </p>
      )}
      {justBack && <p className="notice notice-ok">Welcome back. Your spot has been cleared.</p>}
      {queue.paused && (
        <p className="notice notice-warn">The crew has paused the line, usually for the seatbelt sign. {inLine ? 'You keep your place.' : 'You can still save a spot.'}</p>
      )}

      <div className="restroom-grid">
        {!ready ? (
          <div className="queue-card"><p className="eyebrow">Loading line…</p></div>
        ) : isMyTurn ? (
          <TurnCard queue={queue} onGiveUp={() => leave('You gave up your turn')} />
        ) : inLine ? (
          <div className="queue-card">
            <p className="eyebrow">Your place</p>
            <p className="queue-big">{ordinal(ahead + 1)}</p>
            <p className="queue-sub">
              {ahead === 0 ? 'You are next.' : `${ahead} ${ahead === 1 ? 'person' : 'people'} ahead of you`}
              {' · '}about {Math.max(1, ahead) * AVG_VISIT_MINUTES} min
            </p>
            <QueueDots total={waitingCount} mine={ahead} />
            <p className="queue-note">Stay seated. This screen will change when it's your turn.</p>
            <div className="queue-actions">
              <button className="btn btn-ghost" disabled={busy} onClick={() => leave('You left the restroom line')}>Leave the line</button>
            </div>
          </div>
        ) : confirming ? (
          <div className="queue-card">
            <p className="eyebrow">The restroom is free</p>
            <p className="queue-big">Go now?</p>
            <p className="queue-sub">Your <strong>5-minute</strong> turn starts as soon as you tap. Only start when you're ready to stand up.</p>
            <div className="queue-actions">
              <button className="btn btn-primary" disabled={busy || !!error} onClick={() => { setConfirmGo(false); void join() }}>
                {busy ? 'Starting…' : 'Start my turn'} <Icon name="arrow" size={18} />
              </button>
              <button className="btn btn-ghost" onClick={() => setConfirmGo(false)}>Back</button>
            </div>
          </div>
        ) : (
          <div className="queue-card">
            <p className="eyebrow">Right now</p>
            <p className="queue-big">{String(waitingCount).padStart(2, '0')}</p>
            <p className="queue-sub">
              {waitingCount === 0
                ? 'No one is waiting. The restroom is free.'
                : `${waitingCount === 1 ? 'person' : 'people'} in line · about ${waitingCount * AVG_VISIT_MINUTES} min wait`}
            </p>
            <div className="queue-actions">
              <button className="btn btn-primary" disabled={busy || !!error} onClick={() => (waitingCount === 0 ? setConfirmGo(true) : void join("Spot saved. Stay seated, we'll tell you when it's your turn."))}>
                {busy ? 'Saving…' : waitingCount === 0 ? 'Use it now' : 'Save my spot'} <Icon name="arrow" size={18} />
              </button>
            </div>
          </div>
        )}

        <ol className="how">
          <li><span className="how-n">01</span><span>Save your spot and stay in your seat.</span></li>
          <li><span className="how-n">02</span><span>Watch your place move up. No standing in the aisle.</span></li>
          <li><span className="how-n">03</span><span>When it's your turn you have 5 minutes to go.</span></li>
          <li><span className="how-n">04</span><span>Tap <em>I'm back</em> so the next person is called.</span></li>
        </ol>
      </div>
    </section>
  )
}

function TurnCard({ queue, onGiveUp }: { queue: RestroomQueue; onGiveUp: () => void }) {
  const calledAt = queue.mySpot?.called_at
  const [now, setNow] = useState(() => Date.now())
  const expired = useRef(false)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const elapsed = calledAt ? Math.floor((now - new Date(calledAt).getTime()) / 1000) : 0
  const left = Math.max(0, TURN_SECONDS - elapsed)

  // Hand the turn on as soon as the timer runs out.
  useEffect(() => {
    if (left === 0 && !expired.current) {
      expired.current = true
      void queue.expire()
    }
  }, [left, queue])

  const mm = String(Math.floor(left / 60)).padStart(1, '0')
  const ss = String(left % 60).padStart(2, '0')

  return (
    <div className="queue-card queue-turn" role="alert">
      <p className="eyebrow">It's your turn</p>
      <p className="queue-big">Go now</p>
      <p className="queue-sub">The restroom is held for you for <strong>{mm}:{ss}</strong></p>
      <div className="turn-bar"><span style={{ width: `${(left / TURN_SECONDS) * 100}%` }} /></div>
      <div className="queue-actions">
        <button className="btn btn-light" disabled={queue.busy} onClick={queue.finish}>I'm back</button>
        <button className="btn btn-ghost" disabled={queue.busy} onClick={onGiveUp}>Give up my turn</button>
      </div>
    </div>
  )
}

// Anonymous dots: shows how long the line is and where you are, never who else is in it.
function QueueDots({ total, mine }: { total: number; mine: number }) {
  const shown = Math.min(total, Math.max(12, mine + 1))
  return (
    <div className="dots" aria-hidden>
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className={i === mine ? 'qdot me' : i < mine ? 'qdot ahead' : 'qdot'} />
      ))}
      {total > shown && <span className="dots-more">+{total - shown}</span>}
    </div>
  )
}
