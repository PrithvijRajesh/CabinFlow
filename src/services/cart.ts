import { supabase } from '../lib/supabase'

// All snack-cart backend calls live here, so Supabase can later be swapped
// for an onboard server without touching the UI.

export type ItemKind = 'drink' | 'snack'
export type Serve = 'hot' | 'cold' | 'plain'
export type ItemTag = 'nuts' | 'dairy' | 'gluten_free' | 'vegan'

// Allergen and diet tags, set by crew on snacks. `warn` ones are allergens.
export const ITEM_TAGS: { tag: ItemTag; label: string; warn?: boolean }[] = [
  { tag: 'nuts', label: 'Contains nuts', warn: true },
  { tag: 'dairy', label: 'Contains dairy', warn: true },
  { tag: 'gluten_free', label: 'Gluten-free' },
  { tag: 'vegan', label: 'Vegan' },
]

export interface CartItem {
  id: string
  name: string
  kind: ItemKind
  serve: Serve | null // drinks only: hot gets cream/sugar, cold gets ice, plain gets nothing
  in_stock: boolean
  tags: ItemTag[]
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured. Add .env.local and restart the dev server.')
  return supabase
}

export async function fetchCart(flightId: string): Promise<CartItem[]> {
  const { data, error } = await client()
    .from('cart_items')
    .select('id, name, kind, serve, in_stock, tags')
    .eq('flight_id', flightId)
    .order('created_at')
    .order('id')
  if (error) throw error
  return data
}

async function rpc(fn: string, args: Record<string, string | string[] | boolean | null>) {
  const { error } = await client().rpc(fn, args)
  if (error) throw error
}

export const addItem = (flightId: string, name: string, kind: ItemKind, serve: Serve | null) =>
  rpc('cart_add', { p_flight: flightId, p_name: name, p_kind: kind, p_serve: serve })
export const setInStock = (flightId: string, id: string, inStock: boolean) =>
  rpc('cart_set_stock', { p_flight: flightId, p_id: id, p_in_stock: inStock })
export const setTags = (flightId: string, id: string, tags: ItemTag[]) =>
  rpc('cart_set_tags', { p_flight: flightId, p_id: id, p_tags: tags })
export const removeItem = (flightId: string, id: string) => rpc('cart_remove', { p_flight: flightId, p_id: id })
export const loadStandardCart = (flightId: string) => rpc('cart_load_standard', { p_flight: flightId })

// Calls onChange whenever this flight's cart changes. Returns unsubscribe.
export function subscribeCart(flightId: string, onChange: () => void): () => void {
  const channel = client()
    .channel(`cart:${flightId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cart_items', filter: `flight_id=eq.${flightId}` }, onChange)
    .subscribe()
  return () => { void client().removeChannel(channel) }
}
