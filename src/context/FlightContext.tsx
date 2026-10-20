import { useEffect, useState, type ReactNode } from 'react'
import { DEMO_FLIGHT, flightId, flightProgress } from '../data/flight'
import { lookupFlight } from '../services/flightLookup'
import type { FlightInfo } from '../types'
import { FlightContext, type FlightContextValue } from './useFlight'

const STORAGE_KEY = 'cabinflow.flight'

// The screen is configured for one flight, so remember it on this device.
function loadSaved(): FlightInfo | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as FlightInfo) : null
  } catch {
    return null
  }
}

function save(flight: FlightInfo | null) {
  try {
    if (flight) localStorage.setItem(STORAGE_KEY, JSON.stringify(flight))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage blocked: the flight just won't survive a reload.
  }
}

export function FlightProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<FlightInfo | null>(loadSaved)
  const [now, setNow] = useState(() => Date.now())
  const flight = saved ?? DEMO_FLIGHT

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
    isDemo: !saved,
    loadFlight: async (number) => {
      const found = await lookupFlight(number)
      save(found)
      setSaved(found)
    },
    resetToDemo: () => {
      save(null)
      setSaved(null)
    },
  }

  return <FlightContext.Provider value={value}>{children}</FlightContext.Provider>
}
