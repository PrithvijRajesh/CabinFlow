import { useCallback, useEffect, useState } from 'react'
import type { CartItem } from '../services/cart'
import { fetchMyPick, savePick, subscribeMyPick, type SnackPick } from '../services/snackPicks'
import { supabase } from '../lib/supabase'
import { NO_BACKEND, friendlyError } from '../lib/errors'

export interface SnackPickState {
  ready: boolean
  error: string | null
  pick: SnackPick | null // what's saved for this seat
  busy: boolean
  save: (pick: SnackPick) => Promise<boolean> // true when saved
  retry: () => Promise<void> // reload after an error
}

// This seat's saved drink and snack picks, kept live. `seat` is null for crew.
export function useSnackPick(flightId: string, seat: string | null): SnackPickState {
  const [pick, setPick] = useState<SnackPick | null>(null)
  const [ready, setReady] = useState(!supabase || !seat)
  const [error, setError] = useState<string | null>(supabase ? null : NO_BACKEND)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!seat) return
    try {
      setPick(await fetchMyPick(flightId, seat))
      setError(null)
    } catch (e) {
      setError(friendlyError(e, "We couldn't load your pick."))
    } finally {
      setReady(true)
    }
  }, [flightId, seat])

  useEffect(() => {
    if (!supabase || !seat) return
    // State updates in refresh() happen after an await, not synchronously.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
    return subscribeMyPick(flightId, seat, () => void refresh())
  }, [flightId, seat, refresh])

  const save = useCallback(async (next: SnackPick) => {
    if (!seat) return false
    setBusy(true)
    try {
      await savePick(flightId, seat, next)
      await refresh()
      return true
    } catch (e) {
      setError(friendlyError(e, "We couldn't save your pick. Please try again."))
      return false
    } finally {
      setBusy(false)
    }
  }, [flightId, seat, refresh])

  return { ready, error, pick, busy, save, retry: refresh }
}

// "Coffee · cream · 1 sugar + Pretzels", or null when nothing is picked.
export function describePick(pick: SnackPick | null, items: CartItem[]): string | null {
  if (!pick) return null
  const drink = items.find((i) => i.id === pick.drink_id)
  const snack = items.find((i) => i.id === pick.snack_id)
  const parts: string[] = []
  if (drink) {
    const opts = drink.serve === 'hot'
      ? [pick.cream ? 'cream' : 'black', pick.sugar ? `${pick.sugar} sugar` : null]
      : drink.serve === 'plain' ? [] : [pick.ice === false ? 'no ice' : 'ice']
    parts.push([drink.name, ...opts.filter(Boolean)].join(' · '))
  }
  if (snack) parts.push(snack.name)
  return parts.length ? parts.join(' + ') : null
}
