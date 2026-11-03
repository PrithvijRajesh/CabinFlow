import { useEffect, useState } from 'react'
import { FEATURES, isAvailable } from '../features'
import type { Session } from '../types'
import Home from '../screens/Home'
import ComingSoon from '../screens/ComingSoon'
import Unavailable from '../screens/Unavailable'
import Restroom from '../screens/Restroom'
import CrewRestroom from '../screens/CrewRestroom'
import CrewCart from '../screens/CrewCart'
import Snacks from '../screens/Snacks'
import Assistance from '../screens/Assistance'
import CrewRequests from '../screens/CrewRequests'
import FlightInfo from '../screens/FlightInfo'
import { useFlight } from '../context/useFlight'
import { useRestroomQueue, type RestroomQueue } from '../hooks/useRestroomQueue'
import { useCart } from '../hooks/useCart'
import { useSnackPick, type SnackPickState } from '../hooks/useSnackPick'
import { useCrewPicks } from '../hooks/useCrewPicks'
import { useAssistance, type Assistance as AssistanceState } from '../hooks/useAssistance'
import { useCrewAssistance, type CrewAssistance } from '../hooks/useCrewAssistance'
import { UndoContext, useUndoQueue, type UndoValue } from '../context/useUndo'
import UndoToast from './UndoToast'
import FlightStrip from './FlightStrip'
import Icon from './Icon'
import { passengerLabel } from '../services/assistance'

interface Props {
  session: Session
  onSignOut: () => void
}

export default function AppShell({ session, onSignOut }: Props) {
  const [active, setActive] = useState('home')
  const features = FEATURES[session.role]
  const current = features.find((f) => f.id === active)
  const { flightId, phase } = useFlight()
  const seat = session.role === 'passenger' ? session.seat : null
  const undo = useUndoQueue()
  // Screens see pending undoable actions as already done.
  const restroom = restroomView(useRestroomQueue(flightId, seat), undo)
  const cart = useCart(flightId)
  const picks = picksView(useSnackPick(flightId, seat), undo)
  const orders = useCrewPicks(flightId, session.role === 'crew')
  const assist = assistView(useAssistance(flightId, seat), undo)
  const crewAssist = crewAssistView(useCrewAssistance(flightId, session.role === 'crew'), undo)
  const [confirmExit, setConfirmExit] = useState(false)
  // Phase notices on crew screens jump straight to the phase control.
  const changePhase = () => {
    setActive('home')
    requestAnimationFrame(() => document.getElementById('flight-phase')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }
  const urgent = crewAssist.urgentOpen[0]
  // Passenger: banner when crew accept a request, until it's been seen on the Assistance screen.
  const [seenAck, setSeenAck] = useState<Set<string>>(new Set())
  const onTheWay = assist.active.find((r) => r.status === 'ack' && !seenAck.has(r.id))
  // Passenger snack banners: the cart is open and nothing is picked yet, or a
  // picked item ran out. Each clears once the Snacks screen has been opened.
  const [seenCart, setSeenCart] = useState(false)
  const [seenOut, setSeenOut] = useState<Set<string>>(new Set())
  const mine = picks.pick && !picks.pick.served_at ? [picks.pick.drink_id, picks.pick.snack_id] : []
  const outItems = cart.items.filter((i) => mine.includes(i.id) && !i.in_stock)
  const ranOut = outItems.find((i) => !seenOut.has(i.id))
  const cartOpen = !!seat && !seenCart && cart.ready && picks.ready && !picks.pick && cart.items.some((i) => i.in_stock)
  const go = (id: string) => {
    if (id === 'assistance' || active === 'assistance') {
      setSeenAck(new Set(assist.active.filter((r) => r.status === 'ack').map((r) => r.id)))
    }
    if (id === 'snacks' || active === 'snacks') {
      setSeenCart(true)
      setSeenOut(new Set(outItems.map((i) => i.id)))
    }
    setActive(id)
  }
  const nav = [{ id: 'home', label: 'Home', icon: 'home' as const }, ...features]
  // Crew screens work in every phase; passenger features follow the phase rules.
  const isOff = (id: string) => {
    const f = features.find((x) => x.id === id)
    return session.role === 'passenger' && !!f && !isAvailable(f, phase)
  }

  // Sign out takes a second tap; the prompt resets after a few seconds.
  useEffect(() => {
    if (!confirmExit) return
    const t = setTimeout(() => setConfirmExit(false), 4000)
    return () => clearTimeout(t)
  }, [confirmExit])

  return (
    <UndoContext.Provider value={undo}>
      <div className={`shell theme-${session.role}`}>
        <aside className="rail">
          <span className="wordmark rail-mark">CabinFlow</span>
          <nav className="rail-nav">
            {nav.map((item) => (
              <button
                key={item.id}
                className={`rail-item${active === item.id ? ' active' : ''}${isOff(item.id) ? ' is-off' : ''}`}
                onClick={() => go(item.id)}
                aria-current={active === item.id ? 'page' : undefined}
              >
                <Icon name={item.icon} size={22} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <button className={`rail-item rail-exit${confirmExit ? ' is-confirm' : ''}`} onClick={() => (confirmExit ? onSignOut() : setConfirmExit(true))}>
            <Icon name="exit" size={22} />
            <span>{confirmExit ? 'Tap again to sign out' : 'Sign out'}</span>
          </button>
        </aside>

        <div className="stage">
          <header className="topbar">
            <FlightStrip compact />
            <span className="who">
              {session.role === 'passenger' ? (
                <><span className="who-label">Seat</span> {session.seat}</>
              ) : (
                <><span className="who-dot" /> Crew</>
              )}
            </span>
          </header>

          {restroom.isMyTurn && !restroom.isGoing && !isOff('bathroom') && active !== 'bathroom' && (
            <button className="turn-banner" onClick={() => go('bathroom')}>
              <Icon name="restroom" size={20} /> Your turn is ready. <strong>Open</strong>
            </button>
          )}

          {ranOut && !isOff('snacks') && active !== 'snacks' && (
            <button className="turn-banner" onClick={() => go('snacks')}>
              <Icon name="cup" size={20} /> {ranOut.name} just ran out. <strong>Pick another</strong>
            </button>
          )}

          {cartOpen && !ranOut && !isOff('snacks') && active !== 'snacks' && (
            <button className="turn-banner" onClick={() => go('snacks')}>
              <Icon name="cup" size={20} /> Free snacks and drinks are open. <strong>Pick yours</strong>
            </button>
          )}

          {onTheWay && active !== 'assistance' && (
            <button className="turn-banner" onClick={() => go('assistance')}>
              <Icon name="bell" size={20} /> Crew are on the way: {passengerLabel(onTheWay.type)}. <strong>View</strong>
            </button>
          )}

          {urgent && active !== 'assistance' && (
            <button className="turn-banner" onClick={() => go('assistance')}>
              <Icon name="bell" size={20} /> Urgent: {urgent.seat} is feeling unwell. <strong>Open</strong>
            </button>
          )}

          <main className="content" key={active}>
            {current && isOff(current.id) ? (
              <Unavailable feature={current} />
            ) : session.role === 'passenger' && active === 'bathroom' ? (
              <Restroom queue={restroom} />
            ) : session.role === 'passenger' && active === 'snacks' ? (
              <Snacks cart={cart} picks={picks} />
            ) : session.role === 'passenger' && active === 'assistance' ? (
              <Assistance assist={assist} />
            ) : session.role === 'passenger' && active === 'flight' ? (
              <FlightInfo onOpen={go} />
            ) : session.role === 'crew' && active === 'bathroom' ? (
              <CrewRestroom onChangePhase={changePhase} />
            ) : session.role === 'crew' && active === 'snacks' ? (
              <CrewCart cart={cart} orders={orders} />
            ) : session.role === 'crew' && active === 'assistance' ? (
              <CrewRequests assist={crewAssist} onChangePhase={changePhase} />
            ) : current ? (
              <ComingSoon feature={current} role={session.role} />
            ) : (
              <Home session={session} features={features} restroom={restroom} cart={cart} picks={picks} orders={orders} assist={assist} crewAssist={crewAssist} onOpen={go} />
            )}
          </main>
          <UndoToast />
        </div>
      </div>
    </UndoContext.Provider>
  )
}

function restroomView(q: RestroomQueue, undo: UndoValue): RestroomQueue {
  if (q.ahead === null || !q.mySpot) return q
  const gone = { ahead: null, isMyTurn: false, isGoing: false, waitingCount: q.waitingCount - 1 }
  if (undo.isPending('restroom:leave')) return { ...q, ...gone, mySpot: null }
  // Shown as already back, so the screen says "Welcome back".
  if (undo.isPending('restroom:back')) return { ...q, ...gone, mySpot: { ...q.mySpot, status: 'done', ended_at: new Date().toISOString(), ended_by: null } }
  return q
}

function picksView(p: SnackPickState, undo: UndoValue): SnackPickState {
  return undo.isPending('pick:clear') ? { ...p, pick: null } : p
}

function assistView(a: AssistanceState, undo: UndoValue): AssistanceState {
  const requests = a.requests.map((r) => (undo.isPending(`req:${r.id}`) ? { ...r, status: 'cancelled' as const } : r))
  return { ...a, requests, active: requests.filter((r) => r.status === 'open' || r.status === 'ack') }
}

function crewAssistView(a: CrewAssistance, undo: UndoValue): CrewAssistance {
  const closing = (r: { id: string }) => undo.isPending(`req:${r.id}`)
  const keep = <T extends { id: string }>(rows: T[]) => rows.filter((r) => !closing(r))
  const done = [...a.open, ...a.onTheWay].filter(closing).map((r) => ({ ...r, status: 'done' as const, closed_at: new Date().toISOString() }))
  return { ...a, open: keep(a.open), onTheWay: keep(a.onTheWay), urgentOpen: keep(a.urgentOpen), recent: [...done, ...a.recent] }
}
