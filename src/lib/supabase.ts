import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
// Publishable key only. The secret key must never be in frontend env vars.
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined

function init(): SupabaseClient | null {
  if (!url || !key) return null
  try {
    // Use only the origin, in case the REST endpoint (…/rest/v1/) was pasted.
    return createClient(new URL(url).origin, key)
  } catch (e) {
    console.error('[CabinFlow] Supabase config invalid:', e instanceof Error ? e.message : e)
    return null
  }
}

// Null when .env.local is missing or invalid, so screens show a setup
// message instead of crashing.
export const supabase = init()
