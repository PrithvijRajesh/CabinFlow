import { supabase } from '../lib/supabase'
import type { FlightInfo } from '../types'

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

// Calls onChange when crew set or clear this aircraft's flight. Returns unsubscribe.
export function subscribeAircraftFlight(aircraftId: string, onChange: () => void): () => void {
  const channel = client()
    .channel(`aircraft:${aircraftId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'aircraft_flights', filter: `aircraft_id=eq.${aircraftId}` }, onChange)
    .subscribe()
  return () => { void client().removeChannel(channel) }
}
