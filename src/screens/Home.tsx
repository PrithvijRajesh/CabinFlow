import { useFlight } from '../context/useFlight'
import FlightStrip from '../components/FlightStrip'
import FlightSetup from '../components/FlightSetup'
import Icon from '../components/Icon'
import { isAvailable, type Feature } from '../features'
import type { Session } from '../types'
import type { RestroomQueue } from '../hooks/useRestroomQueue'
import type { Cart } from '../hooks/useCart'
import { describePick, type SnackPickState } from '../hooks/useSnackPick'
import type { CrewPicks } from '../hooks/useCrewPicks'
import type { Assistance } from '../hooks/useAssistance'
import type { CrewAssistance } from '../hooks/useCrewAssistance'
import { passengerLabel } from '../services/assistance'

interface Props {
  session: Session
  features: Feature[]
  restroom: RestroomQueue
  cart: Cart
  picks: SnackPickState
  orders: CrewPicks
  assist: Assistance
  crewAssist: CrewAssistance
  onOpen: (id: string) => void
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Home({ session, features, restroom, cart, picks, orders, assist, crewAssist, onOpen }: Props) {
  return session.role === 'crew'
    ? <CrewHome features={features} restroom={restroom} cart={cart} orders={orders} requests={crewAssist} onOpen={onOpen} />
    : <PassengerHome seat={session.seat} features={features} restroom={restroom} snacks={snackStatus(cart, picks)} help={assistStatus(assist)} onOpen={onOpen} />
}

// Live one-line status for the restroom tile.
function restroomStatus(q: RestroomQueue) {
  if (!q.ready || q.error) return null
  if (q.isGoing) return 'Held for you'
  if (q.isMyTurn) return "It's your turn"
  const paused = q.paused ? ' · paused' : ''
  if (q.ahead !== null) return (q.ahead === 0 ? "You're next" : `You're ${q.ahead + 1} in line`) + paused
  if (q.paused) return 'Line paused'
  return q.waitingCount === 0 ? 'No line right now' : `${q.waitingCount} waiting`
}

// Live one-line status for the snacks tile.
function snackStatus(cart: Cart, picks: SnackPickState) {
  if (!cart.ready || !picks.ready || cart.error) return null
  if (cart.items.length === 0) return 'Cart not set up yet'
  if (picks.pick?.declined) return 'No thanks'
  const text = describePick(picks.pick, cart.items)
  if (text && picks.pick?.served_at) return 'Served · enjoy'
  return text ?? 'Pick before the cart comes'
}

// Live one-line status for the assistance tile.
function assistStatus(a: Assistance) {
  if (!a.ready || a.error || a.active.length === 0) return null
  if (a.active.length > 1) {
    const coming = a.active.filter((r) => r.status === 'ack').length
    return `${a.active.length} requests${coming ? ` · ${coming} on the way` : ''}`
  }
  const r = a.active[0]
  const label = passengerLabel(r.type)
  return `${label}: ${r.status === 'ack' ? 'crew on the way' : r.seen_at ? 'seen by crew' : 'sent'}`
}

function PassengerHome({ seat, features, restroom, snacks, help, onOpen }: { seat: string; features: Feature[]; restroom: RestroomQueue; snacks: string | null; help: string | null; onOpen: (id: string) => void }) {
  const live = restroomStatus(restroom)
  const { flight, remaining, phase } = useFlight()

  return (
    <section className="home">
      <div className="hero">
        <p className="eyebrow">{flight.flightNumber}{remaining && ` · ${remaining === 'Landed' ? 'landed' : `${remaining} to go`}`}</p>
        <h1 className="display">
          {greeting()}, <em>{seat}</em>.
        </h1>
        <p className="lede">Everything you need from your seat, so the aisle stays clear.</p>
        <div className="hero-strip"><FlightStrip /></div>
      </div>

      <div className="bento">
        {features.map((f) => {
          const off = !isAvailable(f, phase)
          return (
          <button key={f.id} className={`tile tile-${f.id}${off ? ' is-off' : ''}`} onClick={() => onOpen(f.id)}>
            <span className="tile-top">
              <span className="tile-icon"><Icon name={f.icon} size={26} /></span>
            </span>
            <span className="tile-label">{f.label}</span>
            <span className="tile-desc">{f.description}</span>
            {off ? (
              <span className="tile-live tile-off">{f.offReason?.[phase] ?? 'Not available right now'}</span>
            ) : (
              <>
                {f.id === 'bathroom' && live && <span className="tile-live"><span className="led" /> {live}</span>}
                {f.id === 'snacks' && snacks && <span className="tile-live"><span className="led" /> {snacks}</span>}
                {f.id === 'assistance' && help && <span className="tile-live"><span className="led" /> {help}</span>}
              </>
            )}
            <span className="tile-foot">Open <Icon name="arrow" size={16} /></span>
          </button>
          )
        })}
      </div>

      <p className="footnote">Need help right away? Your call button works as usual.</p>
    </section>
  )
}

// One live card per crew module: the number that matters, what it means, tap to open.
function crewStatus(id: string, restroom: RestroomQueue, cart: Cart, orders: CrewPicks, requests: CrewAssistance) {
  if (id === 'bathroom') {
    if (!restroom.ready || restroom.error) return null
    return { value: restroom.waitingCount, label: restroom.paused ? 'waiting · line paused' : 'waiting', tone: restroom.paused ? 'warn' : '' }
  }
  if (id === 'snacks') {
    if (!orders.ready || orders.error || !cart.ready) return null
    const toServe = orders.picks.filter((p) => (p.drink_id || p.snack_id) && !p.served_at).length
    if (cart.items.length === 0) return { value: toServe, label: 'cart not set up yet', tone: 'warn' }
    return { value: toServe, label: 'orders to serve', tone: '' }
  }
  if (id === 'assistance') {
    if (!requests.ready || requests.error) return null
    const urgent = requests.urgentOpen.length
    return { value: requests.open.length + requests.onTheWay.length, label: urgent ? `open · ${urgent} urgent` : 'open requests', tone: urgent ? 'urgent' : '' }
  }
  return null
}

function CrewHome({ features, restroom, cart, orders, requests, onOpen }: { features: Feature[]; restroom: RestroomQueue; cart: Cart; orders: CrewPicks; requests: CrewAssistance; onOpen: (id: string) => void }) {
  const { flight, remaining } = useFlight()

  return (
    <section className="home">
      <div className="hero">
        <p className="eyebrow">Cabin overview</p>
        <h1 className="display">{flight.flightNumber} <span className="dim">{flight.origin.code} → {flight.destination.code}</span></h1>
        <p className="lede">{remaining === 'Landed' ? 'Landed' : `${remaining} remaining`} · arriving {flight.arrivalTime}</p>
      </div>

      <FlightSetup />

      <div className="stats">
        {features.map((f) => {
          const s = crewStatus(f.id, restroom, cart, orders, requests)
          return (
            <button key={f.id} className={`stat${s?.tone ? ` stat-${s.tone}` : ''}`} onClick={() => onOpen(f.id)}>
              <span className="stat-name"><Icon name={f.icon} size={20} /> {f.label}</span>
              <span className="stat-value">{s ? s.value : '—'}</span>
              <span className="stat-label">{s ? s.label : 'Not available'}</span>
              <span className="stat-foot">Open <Icon name="arrow" size={16} /></span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
