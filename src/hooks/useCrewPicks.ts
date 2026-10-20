import { useCallback, useEffect, useState } from 'react'
import { fetchAllPicks, setServed, subscribeAllPicks, type CrewPick } from '../services/snackPicks'
import { supabase } from '../lib/supabase'
import { errorText } from './useRestroomQueue'

export interface CrewPicks {
  ready: boolean
  error: string | null
  picks: CrewPick[] // front to back (12A before 12C before 14A)
  busy: boolean
  markServed: (seat: string, served: boolean) => Promise<void>
}

const seatOrder = (seat: string) => parseInt(seat, 10) * 100 + seat.charCodeAt(seat.length - 1)

// Every seat's snack pick, kept live. `enabled` is false for passengers,
// who never load other seats' picks.
export function useCrewPicks(flightId: string, enabled: boolean): CrewPicks {
  const [picks, setPicks] = useState<CrewPick[]>([])
  const [ready, setReady] = useState(!supabase || !enabled)
  const [error, setError] = useState<string | null>(supabase ? null : 'Backend not configured.')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!enabled) return
    try {
      const rows = await fetchAllPicks(flightId)
      setPicks(rows.sort((a, b) => seatOrder(a.seat) - seatOrder(b.seat)))
      setError(null)
    } catch (e) {
      setError(errorText(e, 'Could not load orders.'))
    } finally {
      setReady(true)
    }
  }, [flightId, enabled])

  useEffect(() => {
    if (!supabase || !enabled) return
    // State updates in refresh() happen after an await, not synchronously.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
    return subscribeAllPicks(flightId, () => void refresh())
  }, [flightId, enabled, refresh])

  const markServed = useCallback(async (seat: string, served: boolean) => {
    setBusy(true)
    try {
      await setServed(flightId, seat, served)
      await refresh()
    } catch (e) {
      setError(errorText(e, 'Something went wrong.'))
    } finally {
      setBusy(false)
    }
  }, [flightId, refresh])

  return { ready, error, picks, busy, markServed }
}
