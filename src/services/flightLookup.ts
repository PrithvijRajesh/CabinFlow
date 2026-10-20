import { supabase } from '../lib/supabase'
import type { FlightInfo } from '../types'

// Calls the flight-lookup Edge Function (which holds the AeroDataBox key).
// On real seatback hardware this would read the aircraft's own flight data instead.
export async function lookupFlight(number: string): Promise<FlightInfo> {
  if (!supabase) throw new Error('Backend not configured.')
  const { data, error } = await supabase.functions.invoke('flight-lookup', { body: { number } })
  if (error) {
    // Non-2xx responses carry our { error } message in the response body.
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(body?.error ?? 'Flight lookup is unavailable right now.')
  }
  return data as FlightInfo
}
