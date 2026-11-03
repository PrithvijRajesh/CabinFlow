import { useCallback, useEffect, useState } from 'react'
import {
  ASSIST_TYPES, ackRequest, doneRequest, fetchFlightRequests, markSeen as markFlightSeen, subscribeFlightRequests,
  type CrewAssistRequest,
} from '../services/assistance'
import { supabase } from '../lib/supabase'
import { NO_BACKEND, friendlyError } from '../lib/errors'

export interface CrewAssistance {
  ready: boolean
  error: string | null
  open: CrewAssistRequest[] // not yet acknowledged: urgent first, then oldest first
  onTheWay: CrewAssistRequest[] // acknowledged, oldest first
  recent: CrewAssistRequest[] // closed in the last few minutes, newest first
  urgentOpen: CrewAssistRequest[] // urgent and nobody on the way yet
  busy: boolean
  ack: (id: string) => Promise<void>
  done: (id: string) => Promise<void>
  markSeen: () => Promise<void> // crew are looking at the Requests screen
  retry: () => Promise<void> // reload after an error
}

const URGENT = new Set(ASSIST_TYPES.filter((t) => t.urgent).map((t) => t.type))
export const isUrgent = (r: CrewAssistRequest) => URGENT.has(r.type)

// Every assistance request on the flight, kept live. `enabled` is false for
// passengers, who never load other seats' requests.
export function useCrewAssistance(flightId: string, enabled: boolean): CrewAssistance {
  const [rows, setRows] = useState<CrewAssistRequest[]>([])
  const [ready, setReady] = useState(!supabase || !enabled)
  const [error, setError] = useState<string | null>(supabase ? null : NO_BACKEND)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!enabled) return
    try {
      setRows(await fetchFlightRequests(flightId))
      setError(null)
    } catch (e) {
      setError(friendlyError(e, "We couldn't load passenger requests."))
    } finally {
      setReady(true)
    }
  }, [flightId, enabled])

  useEffect(() => {
    if (!supabase || !enabled) return
    // State updates in refresh() happen after an await, not synchronously.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
    const unsubscribe = subscribeFlightRequests(flightId, () => void refresh())
    // Recently closed requests drop off after a while; re-check each minute.
    const timer = setInterval(() => void refresh(), 60_000)
    return () => { unsubscribe(); clearInterval(timer) }
  }, [flightId, enabled, refresh])

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

  // Stable, so the Requests screen can call it from an effect.
  const markSeen = useCallback(async () => {
    try {
      await markFlightSeen(flightId)
    } catch (e) {
      setError(friendlyError(e, "That didn't go through. Please try again."))
    }
  }, [flightId])

  // rows arrive oldest first.
  const open = rows.filter((r) => r.status === 'open').sort((a, b) => Number(isUrgent(b)) - Number(isUrgent(a)))

  return {
    ready,
    error,
    open,
    onTheWay: rows.filter((r) => r.status === 'ack'),
    recent: rows.filter((r) => r.status === 'done' || r.status === 'cancelled').reverse(),
    urgentOpen: open.filter(isUrgent),
    busy,
    retry: refresh,
    ack: (id) => run(() => ackRequest(flightId, id)),
    done: (id) => run(() => doneRequest(flightId, id)),
    markSeen,
  }
}
