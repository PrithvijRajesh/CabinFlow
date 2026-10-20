import { useState } from 'react'
import { FEATURES } from '../features'
import type { Session } from '../types'
import Home from '../screens/Home'
import ComingSoon from '../screens/ComingSoon'
import Restroom from '../screens/Restroom'
import CrewRestroom from '../screens/CrewRestroom'
import { useFlight } from '../context/useFlight'
import { useRestroomQueue } from '../hooks/useRestroomQueue'
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
  const { flightId } = useFlight()
  const restroom = useRestroomQueue(flightId, session.role === 'passenger' ? session.seat : null)
  const nav = [{ id: 'home', label: 'Home', icon: 'home' as const }, ...features]

  return (
    <div className={`shell theme-${session.role}`}>
      <aside className="rail">
        <span className="wordmark rail-mark">CabinFlow</span>
        <nav className="rail-nav">
          {nav.map((item) => (
            <button
              key={item.id}
              className={active === item.id ? 'rail-item active' : 'rail-item'}
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

        {restroom.isMyTurn && active !== 'bathroom' && (
          <button className="turn-banner" onClick={() => setActive('bathroom')}>
            <Icon name="restroom" size={20} /> It's your turn for the restroom. <strong>Open</strong>
          </button>
        )}

        <main className="content" key={active}>
          {session.role === 'passenger' && active === 'bathroom' ? (
            <Restroom queue={restroom} />
          ) : session.role === 'crew' && active === 'bathroom' ? (
            <CrewRestroom />
          ) : current ? (
            <ComingSoon feature={current} role={session.role} />
          ) : (
            <Home session={session} features={features} restroom={restroom} onOpen={setActive} />
          )}
        </main>
      </div>
    </div>
  )
}
