import { useCallback, useEffect, useState } from 'react'
import {
  fetchActiveQueue, fetchMySpot, finishTurn, joinQueue, leaveQueue,
  subscribeQueue, tickQueue, type MySpot, type QueueSpot,
} from '../services/restroomQueue'
import { supabase } from '../lib/supabase'

// Supabase errors are plain objects with a message, not Error instances.
function errorText(e: unknown, fallback: string) {
  const msg = (e as { message?: unknown } | null)?.message
  return typeof msg === 'string' && msg ? msg : fallback
}

export const TURN_SECONDS = 5 * 60
export const AVG_VISIT_MINUTES = 4

export interface RestroomQueue {
  ready: boolean
  error: string | null
  waitingCount: number // everyone in line, including whoever is called
  mySpot: MySpot | null
  ahead: number | null // spots in front of me, null if not in line
  isMyTurn: boolean
  busy: boolean
  join: () => Promise<void>
  leave: () => Promise<void>
  finish: () => Promise<void>
  expire: () => Promise<void>
}

// Live restroom line for one flight. `seat` is null for crew.
export function useRestroomQueue(flightId: string, seat: string | null): RestroomQueue {
  const [active, setActive] = useState<QueueSpot[]>([])
  const [mySpot, setMySpot] = useState<MySpot | null>(null)
  const [ready, setReady] = useState(!supabase)
  const [error, setError] = useState<string | null>(supabase ? null : 'Backend not configured.')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [queue, mine] = await Promise.all([
        fetchActiveQueue(flightId),
        seat ? fetchMySpot(flightId, seat) : Promise.resolve(null),
      ])
      setActive(queue)
      setMySpot(mine)
      setError(null)
    } catch (e) {
      setError(errorText(e, 'Could not load the restroom line.'))
    } finally {
      setReady(true)
    }
  }, [flightId, seat])

  useEffect(() => {
    if (!supabase) return
    // State updates in refresh() happen after an await, not synchronously.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
    const unsubscribe = subscribeQueue(flightId, () => void refresh())
    // Safety net: advance timed-out turns even if the called seat goes quiet.
    const timer = setInterval(() => { void tickQueue(flightId).catch(() => {}) }, 30_000)
    return () => { unsubscribe(); clearInterval(timer) }
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

  const index = mySpot ? active.findIndex((s) => s.id === mySpot.id) : -1

  return {
    ready,
    error,
    waitingCount: active.length,
    mySpot,
    ahead: index >= 0 ? index : null,
    isMyTurn: mySpot?.status === 'called',
    busy,
    join: () => run(() => joinQueue(flightId, seat!)),
    leave: () => run(() => leaveQueue(flightId, seat!)),
    finish: () => run(() => finishTurn(flightId, seat!)),
    expire: () => run(() => tickQueue(flightId)),
  }
}
