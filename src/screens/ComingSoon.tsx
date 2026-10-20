import Icon from '../components/Icon'
import type { Feature } from '../features'
import type { Role } from '../types'

export default function ComingSoon({ feature, role }: { feature: Feature; role: Role }) {
  return (
    <section className="soon">
      <span className="soon-icon"><Icon name={feature.icon} size={40} /></span>
      <p className="eyebrow">{role === 'crew' ? 'Module on standby' : 'Arriving soon'}</p>
      <h1 className="display">{feature.label}</h1>
      <p className="lede">{feature.description}</p>
    </section>
  )
}
