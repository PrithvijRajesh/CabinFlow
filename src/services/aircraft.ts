import { supabase } from '../lib/supabase'
import type { FlightInfo, FlightPhase } from '../types'

// The aircraft's current flight, set once by crew and read by every seatback.

function client() {
  if (!supabase) throw new Error('Backend not configured.')
  return supabase
}

export async function fetchAircraftFlight(aircraftId: string): Promise<FlightInfo | null> {
  const { data, error } = await client()
    .from('aircraft_flights')
    .select('flight')
    .eq('aircraft_id', aircraftId)
    .maybeSingle()
  if (error) throw error
  return (data?.flight as FlightInfo | undefined) ?? null
}

// Crew only (checked in the database).
export async function setAircraftFlight(aircraftId: string, flight: FlightInfo) {
  const { error } = await client().rpc('aircraft_set_flight', { p_aircraft: aircraftId, p_flight: flight })
  if (error) throw new Error(error.message)
}

export async function clearAircraftFlight(aircraftId: string) {
  const { error } = await client().rpc('aircraft_clear_flight', { p_aircraft: aircraftId })
  if (error) throw new Error(error.message)
}

// Crew phase override; null = auto.
export async function fetchPhaseOverride(aircraftId: string): Promise<FlightPhase | null> {
  const { data, error } = await client()
    .from('aircraft_phase')
    .select('phase')
    .eq('aircraft_id', aircraftId)
    .maybeSingle()
  if (error) throw error
  return (data?.phase as FlightPhase | undefined) ?? null
}

// Crew only (checked in the database). null = back to auto.
export async function setPhaseOverride(aircraftId: string, phase: FlightPhase | null) {
  const { error } = await client().rpc('aircraft_set_phase', { p_aircraft: aircraftId, p_phase: phase })
  if (error) throw new Error(error.message)
}

// Calls onChange when crew change this aircraft's flight or phase. Returns unsubscribe.
export function subscribeAircraft(aircraftId: string, onChange: () => void): () => void {
  const filter = `aircraft_id=eq.${aircraftId}`
  const channel = client()
    .channel(`aircraft:${aircraftId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'aircraft_flights', filter }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'aircraft_phase', filter }, onChange)
    .subscribe()
  return () => { void client().removeChannel(channel) }
}
