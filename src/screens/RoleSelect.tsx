import { FLIGHT } from '../data/flight'
import Icon from '../components/Icon'
import type { Role } from '../types'

interface Props {
  onSelect: (role: Role) => void
}

export default function RoleSelect({ onSelect }: Props) {
  return (
    <main className="entry">
      <div className="pass">
        <section className="pass-main">
          <header className="pass-head">
            <span className="wordmark">CabinFlow</span>
            <span className="eyebrow">Boarding pass · {FLIGHT.flightNumber}</span>
          </header>

          <div className="route">
            <div>
              <span className="route-code">{FLIGHT.origin.code}</span>
              <span className="route-city">{FLIGHT.origin.city}</span>
            </div>
            <div className="route-line" aria-hidden>
              <Icon name="plane" size={22} />
            </div>
            <div className="route-right">
              <span className="route-code">{FLIGHT.destination.code}</span>
              <span className="route-city">{FLIGHT.destination.city}</span>
            </div>
          </div>

          <dl className="pass-fields">
            <div><dt>Flight</dt><dd>{FLIGHT.flightNumber}</dd></div>
            <div><dt>Departed</dt><dd>{FLIGHT.departureTime}</dd></div>
            <div><dt>Arrives</dt><dd>{FLIGHT.arrivalTime}</dd></div>
            <div><dt>Status</dt><dd className="status-live">In flight</dd></div>
          </dl>
        </section>

        <div className="pass-perf" aria-hidden />

        <section className="pass-stub">
          <h1 className="stub-title">Who's using this screen?</h1>
          <button className="stub-option" onClick={() => onSelect('passenger')}>
            <Icon name="seat" size={28} className="stub-icon" />
            <span className="stub-text">
              <span className="stub-label">Passenger</span>
              <span className="stub-sub">Enter your seat to begin</span>
            </span>
            <Icon name="arrow" size={20} className="stub-arrow" />
          </button>
          <button className="stub-option" onClick={() => onSelect('crew')}>
            <Icon name="badge" size={28} className="stub-icon" />
            <span className="stub-text">
              <span className="stub-label">Cabin crew</span>
              <span className="stub-sub">Crew PIN required</span>
            </span>
            <Icon name="arrow" size={20} className="stub-arrow" />
          </button>
        </section>
      </div>
    </main>
  )
}
