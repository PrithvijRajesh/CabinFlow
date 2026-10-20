export type Role = 'passenger' | 'crew'

export type FlightPhase = 'boarding' | 'inflight' | 'landed'

export type Session =
  | { role: 'passenger'; seat: string }
  | { role: 'crew' }

// icao/lat/lon/timeZone come from AeroDataBox; optional because flights saved
// before they were added don't have them.
export interface Airport {
  code: string // IATA, e.g. DFW
  city: string
  icao?: string | null // e.g. KDFW, needed for weather
  lat?: number | null
  lon?: number | null
  timeZone?: string | null // e.g. America/Chicago
}

export interface FlightInfo {
  flightNumber: string
  airline: string
  aircraft: string
  status: string // AeroDataBox status, e.g. EnRoute, Departed, Arrived, Delayed
  origin: Airport
  destination: Airport
  departureTime: string // local HH:MM at origin
  arrivalTime: string // local HH:MM at destination
  departureUtc: string | null
  arrivalUtc: string | null
}
