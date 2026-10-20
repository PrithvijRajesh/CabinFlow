import Icon from '../components/Icon'
import { useFlight } from '../context/useFlight'
import type { Feature } from '../features'

// Shown instead of a passenger feature that's off in the current flight phase.
export default function Unavailable({ feature }: { feature: Feature }) {
  const { phase } = useFlight()
  return (
    <section className="soon">
      <span className="soon-icon"><Icon name={feature.icon} size={40} /></span>
      <p className="eyebrow">Not available right now</p>
      <h1 className="display">{feature.label}</h1>
      <p className="lede">{feature.offReason?.[phase] ?? 'This is not available during this part of the flight.'}</p>
    </section>
  )
}
