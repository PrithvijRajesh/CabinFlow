export type Role = 'passenger' | 'crew'

export type Session =
  | { role: 'passenger'; seat: string }
  | { role: 'crew' }

export interface FlightInfo {
  flightNumber: string
  origin: { code: string; city: string }
  destination: { code: string; city: string }
  departureTime: string
  arrivalTime: string
  progress: number // 0–1
  timeRemaining: string
}
