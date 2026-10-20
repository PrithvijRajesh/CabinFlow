import { useState } from 'react'
import { FEATURES } from '../features'
import type { Session } from '../types'
import Home from '../screens/Home'
import ComingSoon from '../screens/ComingSoon'
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

        <main className="content">
          {current ? (
            <ComingSoon feature={current} role={session.role} />
          ) : (
            <Home session={session} features={features} onOpen={setActive} />
          )}
        </main>
      </div>
    </div>
  )
}
