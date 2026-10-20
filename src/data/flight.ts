import type { FlightInfo } from '../types'

// Mock flight for the MVP. Real flight data would come from the airline later.
export const FLIGHT: FlightInfo = {
  flightNumber: 'CF 482',
  origin: { code: 'SFO', city: 'San Francisco' },
  destination: { code: 'DFW', city: 'Dallas/Fort Worth' },
  departureTime: '09:15',
  arrivalTime: '14:50',
  progress: 0.46,
  timeRemaining: '2h 08m',
}

// Demo-only crew PIN. Checked client-side, so it is not real security.
export const CREW_PIN = '1234'

// Rows 1–60. Seat letters A–K, skipping I (airlines don't use it).
export const SEAT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K']
export const SEAT_PATTERN = /^([1-9]|[1-5][0-9]|60)[A-HJK]$/
