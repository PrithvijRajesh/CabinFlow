import { useCallback, useEffect, useState } from 'react'
import {
  crewAction, fetchCrewQueue, fetchPaused, setPaused as savePaused, subscribeQueue,
  type CrewAction, type CrewSpot,
} from '../services/restroomQueue'
import { supabase } from '../lib/supabase'
import { errorText } from './useRestroomQueue'

export interface CrewRestroomQueue {
  ready: boolean
  error: string | null
  spots: CrewSpot[] // in line order; the called seat (if any) is the one with status 'called'
  paused: boolean
  busy: boolean
  act: (spotId: string, action: CrewAction) => Promise<void>
  setPaused: (paused: boolean) => Promise<void>
}

// Live restroom line with seat numbers, plus crew controls. Crew screens only.
// Timeouts are still driven by useRestroomQueue's 30s tick in the app shell.
export function useCrewRestroomQueue(flightId: string): CrewRestroomQueue {
  const [spots, setSpots] = useState<CrewSpot[]>([])
  const [paused, setPausedState] = useState(false)
  const [ready, setReady] = useState(!supabase)
  const [error, setError] = useState<string | null>(supabase ? null : 'Backend not configured.')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [queue, isPaused] = await Promise.all([fetchCrewQueue(flightId), fetchPaused(flightId)])
      setSpots(queue)
      setPausedState(isPaused)
      setError(null)
    } catch (e) {
      setError(errorText(e, 'Could not load the restroom line.'))
    } finally {
      setReady(true)
    }
  }, [flightId])

  useEffect(() => {
    if (!supabase) return
    // State updates in refresh() happen after an await, not synchronously.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
    return subscribeQueue(flightId, () => void refresh(), 'restroom-crew')
  }, [flightId, refresh])

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
      await refresh()
    } catch (e) {
      setError(errorText(e, 'Something went wrong.'))
    } finally {
      setBusy(false)
    }
  }, [refresh])

  return {
    ready,
    error,
    spots,
    paused,
    busy,
    act: (spotId, action) => run(() => crewAction(flightId, spotId, action)),
    setPaused: (next) => run(() => savePaused(flightId, next)),
  }
}
