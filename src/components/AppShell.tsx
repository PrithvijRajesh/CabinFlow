import { useState } from 'react'
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
import { useRestroomQueue } from '../hooks/useRestroomQueue'
import { useCart } from '../hooks/useCart'
import { useSnackPick } from '../hooks/useSnackPick'
import { useCrewPicks } from '../hooks/useCrewPicks'
import { useAssistance } from '../hooks/useAssistance'
import { useCrewAssistance } from '../hooks/useCrewAssistance'
import FlightStrip from './FlightStrip'
import Icon from './Icon'

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
  const restroom = useRestroomQueue(flightId, seat)
  const cart = useCart(flightId)
  const picks = useSnackPick(flightId, seat)
  const orders = useCrewPicks(flightId, session.role === 'crew')
  const assist = useAssistance(flightId, seat)
  const crewAssist = useCrewAssistance(flightId, session.role === 'crew')
  const urgent = crewAssist.urgentOpen[0]
  const nav = [{ id: 'home', label: 'Home', icon: 'home' as const }, ...features]
  // Crew screens work in every phase; passenger features follow the phase rules.
  const isOff = (id: string) => {
    const f = features.find((x) => x.id === id)
    return session.role === 'passenger' && !!f && !isAvailable(f, phase)
  }

  return (
    <div className={`shell theme-${session.role}`}>
      <aside className="rail">
        <span className="wordmark rail-mark">CabinFlow</span>
        <nav className="rail-nav">
          {nav.map((item) => (
            <button
              key={item.id}
              className={`rail-item${active === item.id ? ' active' : ''}${isOff(item.id) ? ' is-off' : ''}`}
              onClick={() => setActive(item.id)}
              aria-current={active === item.id ? 'page' : undefined}
            >
              <Icon name={item.icon} size={22} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <button className="rail-item rail-exit" onClick={onSignOut}>
          <Icon name="exit" size={22} />
          <span>Sign out</span>
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

        {restroom.isMyTurn && !isOff('bathroom') && active !== 'bathroom' && (
          <button className="turn-banner" onClick={() => setActive('bathroom')}>
            <Icon name="restroom" size={20} /> It's your turn for the restroom. <strong>Open</strong>
          </button>
        )}

        {urgent && active !== 'assistance' && (
          <button className="turn-banner" onClick={() => setActive('assistance')}>
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
            <FlightInfo />
          ) : session.role === 'crew' && active === 'bathroom' ? (
            <CrewRestroom />
          ) : session.role === 'crew' && active === 'snacks' ? (
            <CrewCart cart={cart} orders={orders} />
          ) : session.role === 'crew' && active === 'assistance' ? (
            <CrewRequests assist={crewAssist} />
          ) : current ? (
            <ComingSoon feature={current} role={session.role} />
          ) : (
            <Home session={session} features={features} restroom={restroom} cart={cart} picks={picks} orders={orders} assist={assist} crewAssist={crewAssist} onOpen={setActive} />
          )}
        </main>
      </div>
    </div>
  )
}
