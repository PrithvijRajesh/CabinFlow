import type { IconName } from './components/Icon'
import type { Role } from './types'

export interface Feature {
  id: string
  label: string
  icon: IconName
  description: string
}

// Each role's sections. Future features plug in here; anything without a
// screen yet shows a "coming soon" placeholder.
export const FEATURES: Record<Role, Feature[]> = {
  passenger: [
    { id: 'bathroom', label: 'Restroom', icon: 'restroom', description: 'Save your place in line and stay seated until it is your turn.' },
    { id: 'snacks', label: 'Snacks & Drinks', icon: 'cup', description: 'Pick what you would like before the cart reaches your row.' },
    { id: 'assistance', label: 'Assistance', icon: 'bell', description: 'Tell the crew exactly what you need.' },
    { id: 'flight', label: 'Flight Info', icon: 'compass', description: 'Ride outlook and your arrival airport.' },
  ],
  crew: [
    { id: 'bathroom', label: 'Restroom Queue', icon: 'restroom', description: 'Live queue per lavatory. Confirm whose turn it is.' },
    { id: 'snacks', label: 'Cart & Orders', icon: 'cart', description: 'Load cart items and see what passengers picked.' },
    { id: 'assistance', label: 'Requests', icon: 'bell', description: 'Incoming passenger requests by row.' },
  ],
}
