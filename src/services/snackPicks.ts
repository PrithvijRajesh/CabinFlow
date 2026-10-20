import { supabase } from '../lib/supabase'

// All snack-pick backend calls live here, so Supabase can later be swapped
// for an onboard server without touching the UI.

export interface SnackPick {
  drink_id: string | null
  snack_id: string | null
  ice: boolean | null // cold drinks only
  cream: boolean | null // hot drinks only
  sugar: number | null // hot drinks only, 0–3
}

// Crew view: includes the seat and whether it has been served.
export interface CrewPick extends SnackPick {
  seat: string
  served_at: string | null
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured. Add .env.local and restart the dev server.')
  return supabase
}

// This seat's picks only. Passengers never load other seats.
export async function fetchMyPick(flightId: string, seat: string): Promise<SnackPick | null> {
  const { data, error } = await client()
    .from('snack_picks')
    .select('drink_id, snack_id, ice, cream, sugar')
    .eq('flight_id', flightId)
    .eq('seat', seat)
    .maybeSingle()
  if (error) throw error
  return data
}

// Every seat's pick on this flight. Crew screens only.
export async function fetchAllPicks(flightId: string): Promise<CrewPick[]> {
  const { data, error } = await client()
    .from('snack_picks')
    .select('seat, drink_id, snack_id, ice, cream, sugar, served_at')
    .eq('flight_id', flightId)
  if (error) throw error
  return data
}

export async function setServed(flightId: string, seat: string, served: boolean) {
  const { error } = await client().rpc('snack_pick_served', { p_flight: flightId, p_seat: seat, p_served: served })
  if (error) throw error
}

// Both items null clears the pick.
export async function savePick(flightId: string, seat: string, pick: SnackPick) {
  const { error } = await client().rpc('snack_pick_save', {
    p_flight: flightId,
    p_seat: seat,
    p_drink: pick.drink_id,
    p_snack: pick.snack_id,
    p_ice: pick.ice,
    p_cream: pick.cream,
    p_sugar: pick.sugar,
  })
  if (error) throw error
}

// Calls onChange when this seat's pick changes (e.g. the crew removed a picked item).
export function subscribeMyPick(flightId: string, seat: string, onChange: () => void): () => void {
  const channel = client()
    .channel(`picks:${flightId}:${seat}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'snack_picks', filter: `flight_id=eq.${flightId}` }, (p) => {
      const row = (p.new && 'seat' in p.new ? p.new : p.old) as { seat?: string }
      if (!row.seat || row.seat === seat) onChange()
    })
    .subscribe()
  return () => { void client().removeChannel(channel) }
}

// Calls onChange when any seat's pick on this flight changes. Crew only.
export function subscribeAllPicks(flightId: string, onChange: () => void): () => void {
  const channel = client()
    .channel(`picks-crew:${flightId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'snack_picks', filter: `flight_id=eq.${flightId}` }, onChange)
    .subscribe()
  return () => { void client().removeChannel(channel) }
}
