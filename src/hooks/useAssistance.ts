import { useCallback, useEffect, useState } from 'react'
import {
  cancelRequest, fetchMyRequests, sendRequest, subscribeMyRequests,
  type AssistRequest, type AssistType,
} from '../services/assistance'
import { supabase } from '../lib/supabase'
import { NO_BACKEND, friendlyError } from '../lib/errors'

export interface Assistance {
  ready: boolean
  error: string | null
  requests: AssistRequest[] // newest first: open ones plus recently closed
  active: AssistRequest[] // open or acknowledged
  busy: boolean
  send: (type: AssistType, note: string | null) => Promise<boolean>
  cancel: (id: string) => Promise<void>
  retry: () => Promise<void> // reload after an error
}

// This seat's assistance requests, kept live. `seat` is null for crew.
export function useAssistance(flightId: string, seat: string | null): Assistance {
  const [requests, setRequests] = useState<AssistRequest[]>([])
  const [ready, setReady] = useState(!supabase || !seat)
  const [error, setError] = useState<string | null>(supabase ? null : NO_BACKEND)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!seat) return
    try {
      setRequests(await fetchMyRequests(flightId, seat))
      setError(null)
    } catch (e) {
      setError(friendlyError(e, "We couldn't load your requests."))
    } finally {
      setReady(true)
    }
  }, [flightId, seat])

  useEffect(() => {
    if (!supabase || !seat) return
    // State updates in refresh() happen after an await, not synchronously.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
    const unsubscribe = subscribeMyRequests(flightId, seat, () => void refresh())
    // Recently closed requests drop off after a while; re-check each minute.
    const timer = setInterval(() => void refresh(), 60_000)
    return () => { unsubscribe(); clearInterval(timer) }
  }, [flightId, seat, refresh])

  // Resolves true when the action succeeded, so the screen can reset its form.
  const run = useCallback(async (action: () => Promise<void>) => {
    if (!seat) return false
    setBusy(true)
    try {
      await action()
      await refresh()
      return true
    } catch (e) {
      setError(friendlyError(e, "That didn't go through. Please try again."))
      return false
    } finally {
      setBusy(false)
    }
  }, [seat, refresh])

  return {
    ready,
    error,
    requests,
    active: requests.filter((r) => r.status === 'open' || r.status === 'ack'),
    busy,
    retry: refresh,
    send: (type, note) => run(() => sendRequest(flightId, seat!, type, note)),
    cancel: async (id) => { await run(() => cancelRequest(flightId, seat!, id)) },
  }
}
