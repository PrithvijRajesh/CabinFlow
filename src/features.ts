import type { IconName } from './components/Icon'
import type { FlightPhase, Role } from './types'

export interface Feature {
  id: string
  label: string
  icon: IconName
  description: string
  // Passenger phases it's available in (all phases when omitted), and why it's off otherwise.
  phases?: FlightPhase[]
  offReason?: Partial<Record<FlightPhase, string>>
}

// Each role's sections. Future features plug in here; anything without a
// screen yet shows a "coming soon" placeholder.
export const FEATURES: Record<Role, Feature[]> = {
  passenger: [
    {
      id: 'bathroom', label: 'Restroom', icon: 'restroom', description: 'Save your place in line and stay seated until it is your turn.',
      phases: ['inflight'],
      offReason: { boarding: 'The restroom line opens after takeoff.', landed: 'The restroom line is closed after landing.' },
    },
    {
      id: 'snacks', label: 'Snacks & Drinks', icon: 'cup', description: 'Free drinks and snacks. Pick before the cart reaches your row.',
      phases: ['boarding', 'inflight'],
      offReason: { landed: 'Snack service has ended for this flight.' },
    },
    {
      id: 'assistance', label: 'Assistance', icon: 'bell', description: 'Tell the crew exactly what you need.',
      phases: ['inflight', 'landed'],
      offReason: { boarding: 'Requests open after takeoff. During boarding, ask any crew member in the aisle.' },
    },
    { id: 'flight', label: 'Flight Info', icon: 'compass', description: 'Turbulence outlook and your arrival airport.' },
  ],
  crew: [
    { id: 'bathroom', label: 'Restroom Queue', icon: 'restroom', description: 'Live queue per lavatory. Confirm whose turn it is.' },
    { id: 'snacks', label: 'Cart & Orders', icon: 'cart', description: 'Load cart items and see what passengers picked.' },
    { id: 'assistance', label: 'Requests', icon: 'bell', description: 'Incoming passenger requests by row.' },
  ],
}

export const isAvailable = (f: Feature, phase: FlightPhase) => !f.phases || f.phases.includes(phase)
