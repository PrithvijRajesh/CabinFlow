import { supabase } from '../lib/supabase'

// Calls the flight-weather Edge Function (NOAA Aviation Weather, cached 15 min).
// On real seatback hardware this could come from the airline's own feed instead.

export type Ride = 'none' | 'light' | 'bumpy'

export interface RideLeg {
  name: string // Climb, Early cruise, Mid cruise, Late cruise, Descent
  ride: Ride // none = nothing reported (not a guarantee of smooth air)
  sources: string[] // SIGMET, AIRMET, pilot reports
}

export interface FlightWeather {
  generatedAt: string
  outlook: { legs: RideLeg[]; usOnly: boolean; pirepCount: number } | null
  destination: {
    name: string
    observedAt: string | null
    tempC: number | null
    condition: string
    wind: string
    atArrival: { condition: string; wind: string } | null
  } | null
}

export async function fetchFlightWeather(origin: string, destination: string, arrivalUtc: string | null): Promise<FlightWeather> {
  if (!supabase) throw new Error('Backend not configured.')
  const { data, error } = await supabase.functions.invoke('flight-weather', { body: { origin, destination, arrivalUtc } })
  if (error) {
    // Non-2xx responses carry our { error } message in the response body.
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(body?.error ?? 'Weather is unavailable right now.')
  }
  return data as FlightWeather
}
