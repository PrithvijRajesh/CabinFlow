import type { FlightInfo, FlightPhase } from '../types'

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

// A time on that airport's clock, in the passenger's own format ("2:50 PM"
// or "14:50"). Falls back to the stored HH:MM when the zone is unknown,
// since formatting without it would show the seatback's zone instead.
function clockAt(utc: string | null | undefined, timeZone: string | null | undefined, fallback: string, at?: number) {
  if (!timeZone || (!utc && at === undefined)) return fallback
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone }).format(at ?? new Date(utc!))
  } catch {
    return fallback
  }
}
export const departClock = (f: FlightInfo) => clockAt(f.departureUtc, f.origin.timeZone, f.departureTime)
export const arriveClock = (f: FlightInfo) => clockAt(f.arrivalUtc, f.destination.timeZone, f.arrivalTime)
// Current time at the destination, or null when its zone is unknown.
export const destinationNow = (f: FlightInfo, now = Date.now()) => clockAt(null, f.destination.timeZone, '', now) || null

// UTC offset in minutes for a zone, e.g. -300 for New York in winter.
function offsetMinutes(timeZone: string, now: number) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(now).find((p) => p.type === 'timeZoneName')?.value ?? ''
  const m = name.match(/GMT([+-])(\d{2}):(\d{2})/)
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0
}

// "2 h ahead", "3 h behind", "same time", or null when a zone is unknown.
export function timeDifference(f: FlightInfo, now = Date.now()) {
  const from = f.origin.timeZone
  const to = f.destination.timeZone
  if (!from || !to) return null
  try {
    const diff = offsetMinutes(to, now) - offsetMinutes(from, now)
    if (diff === 0) return 'same time'
    const h = Math.abs(diff) / 60
    return `${Number.isInteger(h) ? h : h.toFixed(1)} h ${diff > 0 ? 'ahead' : 'behind'}`
  } catch {
    return null
  }
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

// Phase from flight data. AeroDataBox status can lag (still "Expected" after
// takeoff), so scheduled times win once they've passed. Crew can override.
export function autoPhase(flight: FlightInfo, now = Date.now()): FlightPhase {
  if (flight.status === 'Arrived') return 'landed'
  if (['EnRoute', 'Departed', 'Approaching'].includes(flight.status)) return 'inflight'
  if (flight.arrivalUtc && now >= new Date(flight.arrivalUtc).getTime()) return 'landed'
  if (flight.departureUtc && now >= new Date(flight.departureUtc).getTime()) return 'inflight'
  return 'boarding'
}

export const PHASE_LABEL: Record<FlightPhase, string> = {
  boarding: 'Boarding',
  inflight: 'In flight',
  landed: 'Landed',
}
