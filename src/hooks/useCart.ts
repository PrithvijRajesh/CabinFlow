import { useCallback, useEffect, useState } from 'react'
import {
  addItem, fetchCart, loadStandardCart, removeItem, setInStock, setTags, subscribeCart,
  type CartItem, type ItemKind, type ItemTag, type Serve,
} from '../services/cart'
import { supabase } from '../lib/supabase'
import { NO_BACKEND, friendlyError } from '../lib/errors'

export interface Cart {
  ready: boolean
  error: string | null
  items: CartItem[]
  busy: boolean
  add: (name: string, kind: ItemKind, serve: Serve | null) => Promise<void>
  setStock: (id: string, inStock: boolean) => Promise<void>
  setTags: (id: string, tags: ItemTag[]) => Promise<void>
  remove: (id: string) => Promise<void>
  loadStandard: () => Promise<void>
  retry: () => Promise<void> // reload after an error
}

// Live snack cart for one flight. Crew use the write actions; passengers
// (Feature 5) will only read `items`.
export function useCart(flightId: string): Cart {
  const [items, setItems] = useState<CartItem[]>([])
  const [ready, setReady] = useState(!supabase)
  const [error, setError] = useState<string | null>(supabase ? null : NO_BACKEND)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setItems(await fetchCart(flightId))
      setError(null)
    } catch (e) {
      setError(friendlyError(e, "We couldn't load the snack cart."))
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
      setError(friendlyError(e, "That didn't go through. Please try again."))
    } finally {
      setBusy(false)
    }
  }, [refresh])

  return {
    ready,
    error,
    items,
    busy,
    retry: refresh,
    add: (name, kind, serve) => run(() => addItem(flightId, name, kind, serve)),
    setStock: (id, inStock) => run(() => setInStock(flightId, id, inStock)),
    setTags: (id, tags) => run(() => setTags(flightId, id, tags)),
    remove: (id) => run(() => removeItem(flightId, id)),
    loadStandard: () => run(() => loadStandardCart(flightId)),
  }
}
