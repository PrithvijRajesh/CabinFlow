import { FLIGHT } from '../data/flight'
import Icon from './Icon'

// Route line with the plane positioned at the current flight progress.
export default function FlightStrip({ compact = false }: { compact?: boolean }) {
  const pct = Math.round(FLIGHT.progress * 100)

  return (
    <div className={compact ? 'strip strip-compact' : 'strip'}>
      <div className="strip-end">
        <span className="strip-code">{FLIGHT.origin.code}</span>
        {!compact && <span className="strip-time">{FLIGHT.departureTime}</span>}
      </div>
      <div className="strip-track" role="img" aria-label={`Flight ${pct}% complete`}>
        <div className="strip-done" style={{ width: `${pct}%` }} />
        <span className="strip-plane" style={{ left: `${pct}%` }}>
          <Icon name="plane" size={compact ? 16 : 20} />
        </span>
      </div>
      <div className="strip-end strip-end-right">
        <span className="strip-code">{FLIGHT.destination.code}</span>
        {!compact && <span className="strip-time">{FLIGHT.arrivalTime}</span>}
      </div>
    </div>
  )
}
