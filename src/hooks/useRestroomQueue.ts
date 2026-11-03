import { useCallback, useEffect, useState } from 'react'
import {
  fetchActiveQueue, fetchMySpot, fetchPaused, finishTurn, joinQueue, leaveQueue, startGoing,
  subscribeQueue, tickQueue, type MySpot, type QueueSpot,
} from '../services/restroomQueue'
import { supabase } from '../lib/supabase'
import { NO_BACKEND, friendlyError } from '../lib/errors'

// Two-phase turn (times match restroom_tick in migration 0016): once called,
// a passenger has CALL_SECONDS to say they're heading there. After that no
// clock runs; crew see a long-visit flag, then the turn is released.
export const CALL_SECONDS = 2 * 60
export const LONG_VISIT_MINUTES = 10
export const RELEASE_MINUTES = 15
export const AVG_VISIT_MINUTES = 4

export interface RestroomQueue {
  ready: boolean
  error: string | null
  waitingCount: number // everyone in line, including whoever is called
  paused: boolean // crew paused the line (seatbelt sign)
  mySpot: MySpot | null
  ahead: number | null // spots in front of me, null if not in line
  isMyTurn: boolean // called: in the 2-minute window or already gone
  isGoing: boolean // tapped "I'm heading there"
  busy: boolean
  join: () => Promise<boolean> // true when the spot was saved
  goNow: () => Promise<void> // empty line: join and head there in one go
  going: () => Promise<void>
  leave: () => Promise<void>
  finish: () => Promise<void>
  expire: () => Promise<void>
  retry: () => Promise<void> // reload after an error
}

// Live restroom line for one flight. `seat` is null for crew.
export function useRestroomQueue(flightId: string, seat: string | null): RestroomQueue {
  const [active, setActive] = useState<QueueSpot[]>([])
  const [mySpot, setMySpot] = useState<MySpot | null>(null)
  const [paused, setPaused] = useState(false)
  const [ready, setReady] = useState(!supabase)
  const [error, setError] = useState<string | null>(supabase ? null : NO_BACKEND)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [queue, mine, isPaused] = await Promise.all([
        fetchActiveQueue(flightId),
        seat ? fetchMySpot(flightId, seat) : Promise.resolve(null),
        fetchPaused(flightId),
      ])
      setActive(queue)
      setMySpot(mine)
      setPaused(isPaused)
      setError(null)
    } catch (e) {
      setError(friendlyError(e, "We couldn't load the restroom line."))
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
      return true
    } catch (e) {
      setError(friendlyError(e, "That didn't go through. Please try again."))
      return false
    } finally {
      setBusy(false)
    }
  }, [refresh])

  const index = mySpot ? active.findIndex((s) => s.id === mySpot.id) : -1

  return {
    ready,
    error,
    waitingCount: active.length,
    paused,
    mySpot,
    ahead: index >= 0 ? index : null,
    isMyTurn: mySpot?.status === 'called',
    isGoing: mySpot?.status === 'called' && !!mySpot.going_at,
    busy,
    retry: refresh,
    join: () => run(() => joinQueue(flightId, seat!)),
    goNow: async () => { await run(async () => { await joinQueue(flightId, seat!); await startGoing(flightId, seat!) }) },
    going: async () => { await run(() => startGoing(flightId, seat!)) },
    leave: async () => { await run(() => leaveQueue(flightId, seat!)) },
    finish: async () => { await run(() => finishTurn(flightId, seat!)) },
    expire: async () => { await run(() => tickQueue(flightId)) },
  }
}
