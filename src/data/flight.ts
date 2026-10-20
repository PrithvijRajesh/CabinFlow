import type { FlightInfo } from '../types'

const minutesFromNow = (m: number) => new Date(Date.now() + m * 60_000).toISOString()

// Demo flight used until a real flight number is looked up. Times are set
// relative to now so the progress strip always shows mid-flight.
export const DEMO_FLIGHT: FlightInfo = {
  flightNumber: 'CF 482',
  airline: 'CabinFlow Demo',
  aircraft: 'Boeing 737-800',
  status: 'EnRoute',
  origin: { code: 'SFO', city: 'San Francisco', icao: 'KSFO', lat: 37.619, lon: -122.375, timeZone: 'America/Los_Angeles' },
  destination: { code: 'DFW', city: 'Dallas/Fort Worth', icao: 'KDFW', lat: 32.897, lon: -97.038, timeZone: 'America/Chicago' },
  departureTime: '09:15',
  arrivalTime: '14:50',
  departureUtc: minutesFromNow(-107),
  arrivalUtc: minutesFromNow(128),
}

// The aircraft this device is installed on. On real hardware the IFE system
// supplies it; the demo has one aircraft.
export const AIRCRAFT_ID = 'DEMO-1'

// Rows 1–60. Seat letters A–K, skipping I (airlines don't use it).
export const SEAT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K']
export const SEAT_PATTERN = /^([1-9]|[1-5][0-9]|60)[A-HJK]$/

// Groups backend data (queue, requests) per flight and day.
export function flightId(flight: FlightInfo) {
  const day = (flight.departureUtc ?? new Date().toISOString()).slice(0, 10)
  return `${flight.flightNumber.replace(/\s/g, '')}-${day}`
}

// 0–1 progress and "2h 08m" remaining, derived from departure/arrival times.
export function flightProgress(flight: FlightInfo, now = Date.now()) {
  if (flight.status === 'Arrived') return { progress: 1, remaining: 'Landed' }
  if (!flight.departureUtc || !flight.arrivalUtc) return { progress: 0, remaining: '' }
  const dep = new Date(flight.departureUtc).getTime()
  const arr = new Date(flight.arrivalUtc).getTime()
  const progress = Math.min(1, Math.max(0, (now - dep) / (arr - dep)))
  const mins = Math.max(0, Math.round((arr - now) / 60_000))
  const remaining = `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`
  return { progress, remaining }
}

// Display label and tone for AeroDataBox statuses.
export function statusLabel(status: string): { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' } {
  switch (status) {
    case 'EnRoute': case 'Departed': case 'Approaching': return { label: 'In flight', tone: 'ok' }
    case 'Arrived': return { label: 'Landed', tone: 'neutral' }
    case 'Boarding': case 'GateClosed': case 'CheckIn': return { label: status === 'Boarding' ? 'Boarding' : status === 'CheckIn' ? 'Check-in' : 'Gate closed', tone: 'ok' }
    case 'Delayed': return { label: 'Delayed', tone: 'warn' }
    case 'Canceled': case 'CanceledUncertain': return { label: 'Canceled', tone: 'bad' }
    case 'Diverted': return { label: 'Diverted', tone: 'bad' }
    case 'Expected': return { label: 'Scheduled', tone: 'neutral' }
    default: return { label: 'Unknown', tone: 'neutral' }
  }
}
