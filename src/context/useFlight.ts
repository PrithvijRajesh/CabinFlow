import { createContext, useContext } from 'react'
import type { FlightInfo } from '../types'

export interface FlightContextValue {
  flight: FlightInfo
  flightId: string
  progress: number
  remaining: string
  isDemo: boolean
  loadFlight: (number: string) => Promise<void>
  resetToDemo: () => void
}

export const FlightContext = createContext<FlightContextValue | null>(null)

export function useFlight() {
  const ctx = useContext(FlightContext)
  if (!ctx) throw new Error('useFlight must be used inside FlightProvider')
  return ctx
}
