import { createContext, useContext } from 'react'
import type { FlightInfo, FlightPhase } from '../types'

export interface FlightContextValue {
  flight: FlightInfo
  flightId: string
  progress: number
  remaining: string
  isDemo: boolean // no flight set for this aircraft yet
  ready: boolean // aircraft flight loaded (avoids flashing the demo flight)
  phase: FlightPhase // override if crew set one, else from flight data
  phaseOverride: FlightPhase | null
  setPhase: (phase: FlightPhase | null) => Promise<void> // crew only; null = auto
  loadFlight: (number: string) => Promise<void> // crew only
  resetToDemo: () => Promise<void> // crew only
}

export const FlightContext = createContext<FlightContextValue | null>(null)

export function useFlight() {
  const ctx = useContext(FlightContext)
  if (!ctx) throw new Error('useFlight must be used inside FlightProvider')
  return ctx
}
