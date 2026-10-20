import { supabase } from '../lib/supabase'

// All restroom-queue backend calls live here, so Supabase can later be
// swapped for an onboard server without touching the UI.

export type QueueStatus = 'waiting' | 'called' | 'done' | 'skipped' | 'left'

// Other passengers' spots: no seat numbers are fetched, only order and status.
export interface QueueSpot {
  id: string
  status: QueueStatus
  joined_at: string
}

export interface MySpot extends QueueSpot {
  called_at: string | null
  ended_at: string | null
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured. Add .env.local and restart the dev server.')
  return supabase
}

export async function fetchActiveQueue(flightId: string): Promise<QueueSpot[]> {
  const { data, error } = await client()
    .from('restroom_queue')
    .select('id, status, joined_at')
    .eq('flight_id', flightId)
    .in('status', ['waiting', 'called'])
    .order('joined_at')
    .order('id')
  if (error) throw error
  return data
}

// The seat's most recent spot, including finished ones (to show "timed out").
export async function fetchMySpot(flightId: string, seat: string): Promise<MySpot | null> {
  const { data, error } = await client()
    .from('restroom_queue')
    .select('id, status, joined_at, called_at, ended_at')
    .eq('flight_id', flightId)
    .eq('seat', seat)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

async function rpc(fn: string, args: Record<string, string>) {
  const { error } = await client().rpc(fn, args)
  if (error) throw error
}

export const joinQueue = (flightId: string, seat: string) => rpc('restroom_join', { p_flight: flightId, p_seat: seat })
export const leaveQueue = (flightId: string, seat: string) => rpc('restroom_finish', { p_flight: flightId, p_seat: seat, p_status: 'left' })
export const finishTurn = (flightId: string, seat: string) => rpc('restroom_finish', { p_flight: flightId, p_seat: seat, p_status: 'done' })
export const tickQueue = (flightId: string) => rpc('restroom_tick', { p_flight: flightId })

// Calls onChange whenever any spot on this flight changes. Returns unsubscribe.
export function subscribeQueue(flightId: string, onChange: () => void): () => void {
  const channel = client()
    .channel(`restroom:${flightId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'restroom_queue', filter: `flight_id=eq.${flightId}` }, onChange)
    .subscribe()
  return () => { void client().removeChannel(channel) }
}
