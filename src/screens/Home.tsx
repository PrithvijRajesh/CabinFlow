import { useFlight } from '../context/useFlight'
import FlightStrip from '../components/FlightStrip'
import FlightSetup from '../components/FlightSetup'
import Icon from '../components/Icon'
import type { Feature } from '../features'
import type { Session } from '../types'
import type { RestroomQueue } from '../hooks/useRestroomQueue'
import type { Cart } from '../hooks/useCart'
import { describePick, type SnackPickState } from '../hooks/useSnackPick'
import type { CrewPicks } from '../hooks/useCrewPicks'
import type { Assistance } from '../hooks/useAssistance'
import type { CrewAssistance } from '../hooks/useCrewAssistance'
import { ASSIST_TYPES } from '../services/assistance'

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
    ? <CrewHome features={features} restroom={restroom} orders={orders} requests={crewAssist} onOpen={onOpen} />
    : <PassengerHome seat={session.seat} features={features} restroom={restroom} snacks={snackStatus(cart, picks)} help={assistStatus(assist)} onOpen={onOpen} />
}

// Live one-line status for the restroom tile.
function restroomStatus(q: RestroomQueue) {
  if (!q.ready || q.error) return null
  if (q.isMyTurn) return "It's your turn"
  if (q.ahead !== null) return q.ahead === 0 ? "You're next" : `You're ${q.ahead + 1} in line`
  return q.waitingCount === 0 ? 'No line right now' : `${q.waitingCount} waiting`
}

// Live one-line status for the snacks tile.
function snackStatus(cart: Cart, picks: SnackPickState) {
  if (!cart.ready || !picks.ready || cart.error) return null
  if (cart.items.length === 0) return 'Cart not set up yet'
  return describePick(picks.pick, cart.items) ?? 'Pick before the cart comes'
}

// Live one-line status for the assistance tile.
function assistStatus(a: Assistance) {
  if (!a.ready || a.error || a.active.length === 0) return null
  if (a.active.length > 1) {
    const coming = a.active.filter((r) => r.status === 'ack').length
    return `${a.active.length} requests${coming ? ` · ${coming} on the way` : ''}`
  }
  const r = a.active[0]
  const label = ASSIST_TYPES.find((t) => t.type === r.type)?.label ?? 'Request'
  return `${label}: ${r.status === 'ack' ? 'crew on the way' : 'sent'}`
}

function PassengerHome({ seat, features, restroom, snacks, help, onOpen }: { seat: string; features: Feature[]; restroom: RestroomQueue; snacks: string | null; help: string | null; onOpen: (id: string) => void }) {
  const live = restroomStatus(restroom)
  const { flight, remaining } = useFlight()

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
        {features.map((f, i) => (
          <button key={f.id} className={`tile tile-${f.id}`} onClick={() => onOpen(f.id)}>
            <span className="tile-top">
              <span className="tile-icon"><Icon name={f.icon} size={26} /></span>
              <span className="tile-index">0{i + 1}</span>
            </span>
            <span className="tile-label">{f.label}</span>
            <span className="tile-desc">{f.description}</span>
            {f.id === 'bathroom' && live && <span className="tile-live"><span className="led" /> {live}</span>}
            {f.id === 'snacks' && snacks && <span className="tile-live"><span className="led" /> {snacks}</span>}
            {f.id === 'assistance' && help && <span className="tile-live"><span className="led" /> {help}</span>}
            <span className="tile-foot">Open <Icon name="arrow" size={16} /></span>
          </button>
        ))}
      </div>

      <p className="footnote">Need help right away? Your call button works as usual.</p>
    </section>
  )
}

function CrewHome({ features, restroom, orders, requests, onOpen }: { features: Feature[]; restroom: RestroomQueue; orders: CrewPicks; requests: CrewAssistance; onOpen: (id: string) => void }) {
  const openRequests = requests.open.length + requests.onTheWay.length
  const toServe = orders.picks.filter((p) => (p.drink_id || p.snack_id) && !p.served_at).length
  const { flight, remaining } = useFlight()
  // Counters stay blank until the features feeding them exist.
  const stats = [
    { label: requests.urgentOpen.length ? `Open requests · ${requests.urgentOpen.length} urgent` : 'Open requests', value: requests.ready && !requests.error ? String(openRequests) : '—' },
    { label: restroom.paused ? 'Restroom queue · paused' : 'Restroom queue', value: restroom.ready && !restroom.error ? String(restroom.waitingCount) : '—' },
    { label: 'Orders to serve', value: orders.ready && !orders.error ? String(toServe) : '—' },
  ]

  return (
    <section className="home">
      <div className="hero">
        <p className="eyebrow">Cabin overview</p>
        <h1 className="display">{flight.flightNumber} <span className="dim">{flight.origin.code} → {flight.destination.code}</span></h1>
        <p className="lede">{remaining === 'Landed' ? 'Landed' : `${remaining} remaining`} · arriving {flight.arrivalTime}</p>
      </div>

      <FlightSetup />

      <div className="stats">
        {stats.map((s) => (
          <div key={s.label} className="stat">
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      <p className="eyebrow section-label">Modules</p>
      <div className="modules">
        {features.map((f, i) => (
          <button key={f.id} className="module" onClick={() => onOpen(f.id)}>
            <span className="module-index">0{i + 1}</span>
            <Icon name={f.icon} size={22} />
            <span className="module-text">
              <span className="module-label">{f.label}</span>
              <span className="module-desc">{f.description}</span>
            </span>
            <span className="module-status"><span className="led" /> Standby</span>
          </button>
        ))}
      </div>
    </section>
  )
}
