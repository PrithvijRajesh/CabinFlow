import { useEffect, useState } from 'react'
import { fetchFlightWeather, type FlightWeather } from '../services/flightWeather'
import type { FlightInfo } from '../types'

const REFRESH_MS = 15 * 60_000 // matches the server cache

export interface FlightWeatherState {
  weather: FlightWeather | null
  loading: boolean
  error: string | null
  missingCodes: boolean // flight saved before ICAO codes were stored
}

// Ride outlook + destination weather for the current flight, refreshed every 15 min.
export function useFlightWeather(flight: FlightInfo): FlightWeatherState {
  const origin = flight.origin.icao ?? null
  const destination = flight.destination.icao ?? null
  const arrival = flight.arrivalUtc
  const [weather, setWeather] = useState<FlightWeather | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!(origin && destination))

  useEffect(() => {
    if (!origin || !destination) return
    let cancelled = false
    const load = async () => {
      try {
        const w = await fetchFlightWeather(origin, destination, arrival)
        if (!cancelled) { setWeather(w); setError(null) }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Weather is unavailable right now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    const timer = setInterval(() => void load(), REFRESH_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [origin, destination, arrival])

  return { weather, loading, error, missingCodes: !origin || !destination }
}
