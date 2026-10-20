import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AIRCRAFT_ID, DEMO_FLIGHT, flightId, flightProgress } from '../data/flight'
import { lookupFlight } from '../services/flightLookup'
import { clearAircraftFlight, fetchAircraftFlight, setAircraftFlight, subscribeAircraftFlight } from '../services/aircraft'
import { supabase } from '../lib/supabase'
import type { FlightInfo } from '../types'
import { FlightContext, type FlightContextValue } from './useFlight'

// The flight comes from the aircraft (set once by crew), so every seatback on
// this aircraft shows the same flight and updates live when crew change it.
export function FlightProvider({ children }: { children: ReactNode }) {
  const [aircraftFlight, setFlight] = useState<FlightInfo | null>(null)
  const [ready, setReady] = useState(!supabase)
  const [now, setNow] = useState(() => Date.now())
  const flight = aircraftFlight ?? DEMO_FLIGHT

  const refresh = useCallback(async () => {
    try {
      setFlight(await fetchAircraftFlight(AIRCRAFT_ID))
    } catch {
      // Backend unreachable: keep showing whatever we had (or the demo flight).
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    // State updates in refresh() happen after an await, not synchronously.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
    return subscribeAircraftFlight(AIRCRAFT_ID, () => void refresh())
  }, [refresh])

  // Keep progress and time remaining moving.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const { progress, remaining } = flightProgress(flight, now)

  const value: FlightContextValue = {
    flight,
    flightId: flightId(flight),
    progress,
    remaining,
    isDemo: !aircraftFlight,
    ready,
    loadFlight: async (number) => {
      const found = await lookupFlight(number)
      await setAircraftFlight(AIRCRAFT_ID, found)
      setFlight(found)
    },
    resetToDemo: async () => {
      await clearAircraftFlight(AIRCRAFT_ID)
      setFlight(null)
    },
  }

  return <FlightContext.Provider value={value}>{children}</FlightContext.Provider>
}
