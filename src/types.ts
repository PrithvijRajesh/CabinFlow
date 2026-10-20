export type Role = 'passenger' | 'crew'

export type Session =
  | { role: 'passenger'; seat: string }
  | { role: 'crew' }

export interface FlightInfo {
  flightNumber: string
  airline: string
  aircraft: string
  status: string // AeroDataBox status, e.g. EnRoute, Departed, Arrived, Delayed
  origin: { code: string; city: string }
  destination: { code: string; city: string }
  departureTime: string // local HH:MM at origin
  arrivalTime: string // local HH:MM at destination
  departureUtc: string | null
  arrivalUtc: string | null
}
