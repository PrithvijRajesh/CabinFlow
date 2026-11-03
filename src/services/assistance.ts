import { supabase } from '../lib/supabase'

// All assistance backend calls live here, so Supabase can later be swapped
// for an onboard server without touching the UI.

export type AssistType = 'unwell' | 'blanket' | 'drink' | 'bag' | 'cleanup' | 'seat' | 'other'
export type AssistStatus = 'open' | 'ack' | 'done' | 'cancelled'

export interface AssistRequest {
  id: string
  type: AssistType
  note: string | null
  status: AssistStatus
  created_at: string
  seen_at: string | null // crew opened their Requests screen
  ack_at: string | null
  closed_at: string | null
}

// Crew view: includes the seat. Never used on passenger screens.
export interface CrewAssistRequest extends AssistRequest {
  seat: string
}

// Shown on passenger and crew screens. "Something else" needs a note.
export const ASSIST_TYPES: { type: AssistType; label: string; hint: string; urgent?: boolean }[] = [
  { type: 'unwell', label: 'Feeling unwell', hint: 'Dizzy, sick or in pain', urgent: true },
  { type: 'blanket', label: 'Blanket or pillow', hint: 'Cold, or want to rest' },
  { type: 'drink', label: 'Water or a drink', hint: 'Outside of cart service' },
  { type: 'bag', label: 'Help with a bag', hint: 'Overhead bin or under seat' },
  { type: 'cleanup', label: 'Spill or cleanup', hint: 'Something got messy' },
  { type: 'seat', label: 'Seat or screen problem', hint: "Something isn't working" },
  { type: 'other', label: 'Something else', hint: 'Tell us in a few words' },
]

export const NOTE_MAX = 100

// Recently closed requests stay visible this long, so "Done" can be seen.
const RECENT_MINUTES = 15

function client() {
  if (!supabase) throw new Error('Supabase is not configured. Add .env.local and restart the dev server.')
  return supabase
}

// This seat's open requests plus ones closed in the last few minutes.
export async function fetchMyRequests(flightId: string, seat: string): Promise<AssistRequest[]> {
  const since = new Date(Date.now() - RECENT_MINUTES * 60_000).toISOString()
  const { data, error } = await client()
    .from('assistance_requests')
    .select('id, type, note, status, created_at, seen_at, ack_at, closed_at')
    .eq('flight_id', flightId)
    .eq('seat', seat)
    .or(`status.in.(open,ack),closed_at.gte.${since}`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Every open request on this flight plus recently closed ones. Crew only.
export async function fetchFlightRequests(flightId: string): Promise<CrewAssistRequest[]> {
  const since = new Date(Date.now() - RECENT_MINUTES * 60_000).toISOString()
  const { data, error } = await client()
    .from('assistance_requests')
    .select('id, seat, type, note, status, created_at, seen_at, ack_at, closed_at')
    .eq('flight_id', flightId)
    .or(`status.in.(open,ack),closed_at.gte.${since}`)
    .order('created_at')
  if (error) throw error
  return data
}

async function rpc(fn: string, args: Record<string, string | null>) {
  const { error } = await client().rpc(fn, args)
  if (error) throw error
}

export const sendRequest = (flightId: string, seat: string, type: AssistType, note: string | null) =>
  rpc('assist_request', { p_flight: flightId, p_seat: seat, p_type: type, p_note: note })
export const markSeen = (flightId: string) => rpc('assist_seen', { p_flight: flightId })
export const ackRequest = (flightId: string, id: string) => rpc('assist_ack', { p_flight: flightId, p_id: id })
export const doneRequest = (flightId: string, id: string) => rpc('assist_done', { p_flight: flightId, p_id: id })
export const cancelRequest = (flightId: string, seat: string, id: string) =>
  rpc('assist_cancel', { p_flight: flightId, p_seat: seat, p_id: id })

// Calls onChange when this seat's requests change (e.g. crew acknowledged one).
export function subscribeMyRequests(flightId: string, seat: string, onChange: () => void): () => void {
  const channel = client()
    .channel(`assist:${flightId}:${seat}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'assistance_requests', filter: `flight_id=eq.${flightId}` }, (p) => {
      const row = (p.new && 'seat' in p.new ? p.new : p.old) as { seat?: string }
      if (!row.seat || row.seat === seat) onChange()
    })
    .subscribe()
  return () => { void client().removeChannel(channel) }
}

// Calls onChange when any request on this flight changes. Crew only.
export function subscribeFlightRequests(flightId: string, onChange: () => void): () => void {
  const channel = client()
    .channel(`assist-crew:${flightId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'assistance_requests', filter: `flight_id=eq.${flightId}` }, onChange)
    .subscribe()
  return () => { void client().removeChannel(channel) }
}
