import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AIRCRAFT_ID, DEMO_FLIGHT, autoPhase, flightId, flightProgress } from '../data/flight'
import { lookupFlight } from '../services/flightLookup'
import {
  clearAircraftFlight, fetchAircraftFlight, fetchPhaseOverride, setAircraftFlight, setPhaseOverride, subscribeAircraft,
} from '../services/aircraft'
import { supabase } from '../lib/supabase'
import type { FlightInfo, FlightPhase } from '../types'
import { FlightContext, type FlightContextValue } from './useFlight'

// The flight comes from the aircraft (set once by crew), so every seatback on
// this aircraft shows the same flight and updates live when crew change it.
export function FlightProvider({ children }: { children: ReactNode }) {
  const [aircraftFlight, setFlight] = useState<FlightInfo | null>(null)
  const [phaseOverride, setOverride] = useState<FlightPhase | null>(null)
  const [ready, setReady] = useState(!supabase)
  const [now, setNow] = useState(() => Date.now())
  const flight = aircraftFlight ?? DEMO_FLIGHT

  const refresh = useCallback(async () => {
    try {
      // A failed phase read falls back to auto rather than hiding the flight.
      const [f, p] = await Promise.all([fetchAircraftFlight(AIRCRAFT_ID), fetchPhaseOverride(AIRCRAFT_ID).catch(() => null)])
      setFlight(f)
      setOverride(p)
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
    return subscribeAircraft(AIRCRAFT_ID, () => void refresh())
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
    phase: phaseOverride ?? autoPhase(flight, now),
    phaseOverride,
    // A new flight (or the demo flight) starts on auto; the database clears the override too.
    loadFlight: async (number) => {
      const found = await lookupFlight(number)
      await setAircraftFlight(AIRCRAFT_ID, found)
      setFlight(found)
      setOverride(null)
    },
    resetToDemo: async () => {
      await clearAircraftFlight(AIRCRAFT_ID)
      setFlight(null)
      setOverride(null)
    },
    setPhase: async (phase) => {
      await setPhaseOverride(AIRCRAFT_ID, phase)
      setOverride(phase)
    },
  }

  return <FlightContext.Provider value={value}>{children}</FlightContext.Provider>
}
