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
  ended_by: 'crew' | null
}

// Crew view: includes seat numbers. Never used on passenger screens.
export interface CrewSpot extends QueueSpot {
  seat: string
  called_at: string | null
}

export type CrewAction = 'done' | 'skip' | 'call_now' | 'remove'

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

export async function fetchCrewQueue(flightId: string): Promise<CrewSpot[]> {
  const { data, error } = await client()
    .from('restroom_queue')
    .select('id, seat, status, joined_at, called_at')
    .eq('flight_id', flightId)
    .in('status', ['waiting', 'called'])
    .order('joined_at')
    .order('id')
  if (error) throw error
  return data
}

export async function fetchPaused(flightId: string): Promise<boolean> {
  const { data, error } = await client()
    .from('restroom_line_state')
    .select('paused')
    .eq('flight_id', flightId)
    .maybeSingle()
  if (error) throw error
  return data?.paused ?? false
}

// The seat's most recent spot, including finished ones (to show "timed out").
export async function fetchMySpot(flightId: string, seat: string): Promise<MySpot | null> {
  const { data, error } = await client()
    .from('restroom_queue')
    .select('id, status, joined_at, called_at, ended_at, ended_by')
    .eq('flight_id', flightId)
    .eq('seat', seat)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

async function rpc(fn: string, args: Record<string, string | boolean>) {
  const { error } = await client().rpc(fn, args)
  if (error) throw error
}

export const joinQueue = (flightId: string, seat: string) => rpc('restroom_join', { p_flight: flightId, p_seat: seat })
export const leaveQueue = (flightId: string, seat: string) => rpc('restroom_finish', { p_flight: flightId, p_seat: seat, p_status: 'left' })
export const finishTurn = (flightId: string, seat: string) => rpc('restroom_finish', { p_flight: flightId, p_seat: seat, p_status: 'done' })
export const tickQueue = (flightId: string) => rpc('restroom_tick', { p_flight: flightId })
export const crewAction = (flightId: string, spotId: string, action: CrewAction) =>
  rpc('restroom_crew_action', { p_flight: flightId, p_id: spotId, p_action: action })
export const setPaused = (flightId: string, paused: boolean) =>
  rpc('restroom_set_paused', { p_flight: flightId, p_paused: paused })

// Calls onChange whenever any spot or the pause state on this flight changes.
// `name` keeps channels unique when two hooks watch the same flight.
export function subscribeQueue(flightId: string, onChange: () => void, name = 'restroom'): () => void {
  const filter = `flight_id=eq.${flightId}`
  const channel = client()
    .channel(`${name}:${flightId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'restroom_queue', filter }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'restroom_line_state', filter }, onChange)
    .subscribe()
  return () => { void client().removeChannel(channel) }
}
