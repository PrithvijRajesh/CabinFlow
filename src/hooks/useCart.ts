import { useCallback, useEffect, useState } from 'react'
import {
  addItem, fetchCart, loadStandardCart, removeItem, setInStock, subscribeCart,
  type CartItem, type ItemKind,
} from '../services/cart'
import { supabase } from '../lib/supabase'
import { errorText } from './useRestroomQueue'

export interface Cart {
  ready: boolean
  error: string | null
  items: CartItem[]
  busy: boolean
  add: (name: string, kind: ItemKind) => Promise<void>
  setStock: (id: string, inStock: boolean) => Promise<void>
  remove: (id: string) => Promise<void>
  loadStandard: () => Promise<void>
}

// Live snack cart for one flight. Crew use the write actions; passengers
// (Feature 5) will only read `items`.
export function useCart(flightId: string): Cart {
  const [items, setItems] = useState<CartItem[]>([])
  const [ready, setReady] = useState(!supabase)
  const [error, setError] = useState<string | null>(supabase ? null : 'Backend not configured.')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setItems(await fetchCart(flightId))
      setError(null)
    } catch (e) {
      setError(errorText(e, 'Could not load the cart.'))
    } finally {
      setReady(true)
    }
  }, [flightId])

  useEffect(() => {
    if (!supabase) return
    // State updates in refresh() happen after an await, not synchronously.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
    return subscribeCart(flightId, () => void refresh())
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
    items,
    busy,
    add: (name, kind) => run(() => addItem(flightId, name, kind)),
    setStock: (id, inStock) => run(() => setInStock(flightId, id, inStock)),
    remove: (id) => run(() => removeItem(flightId, id)),
    loadStandard: () => run(() => loadStandardCart(flightId)),
  }
}
