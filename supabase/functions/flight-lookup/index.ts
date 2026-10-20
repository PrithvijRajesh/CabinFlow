// Looks up live flight info by flight number via AeroDataBox.
// Runs server-side so the AeroDataBox key never reaches the browser.
//
// Secrets (Supabase dashboard → Edge Functions → Secrets), set ONE of:
//   AERODATABOX_RAPIDAPI_KEY   – key from RapidAPI
//   AERODATABOX_APIMARKET_KEY  – key from API.Market
import { createClient } from 'npm:@supabase/supabase-js@2'

const CACHE_MINUTES = 10
const NUMBER_PATTERN = /^[A-Z0-9]{2}[A-Z]?\d{1,4}[A-Z]?$/

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

interface Movement {
  airport?: {
    iata?: string; icao?: string; name?: string; municipalityName?: string; shortName?: string
    timeZone?: string; location?: { lat?: number; lon?: number }
  }
  scheduledTime?: { local?: string; utc?: string }
  revisedTime?: { local?: string; utc?: string }
  predictedTime?: { local?: string; utc?: string }
}

interface AdbFlight {
  number?: string
  status?: string
  departure?: Movement
  arrival?: Movement
  airline?: { name?: string }
  aircraft?: { model?: string }
}

// AeroDataBox times look like "2026-10-20 09:15-07:00" (local) / "2026-10-20 16:15Z" (utc).
const hhmm = (t?: string) => (t && t.length >= 16 ? t.slice(11, 16) : '')
const toIso = (t?: string) => (t ? t.replace(' ', 'T') : null)

function best(m?: Movement) {
  return m?.revisedTime ?? m?.predictedTime ?? m?.scheduledTime
}

function normalize(f: AdbFlight) {
  // icao + location feed the flight-weather function; timeZone gives local time.
  const place = (m?: Movement) => ({
    code: m?.airport?.iata ?? '—',
    city: m?.airport?.municipalityName ?? m?.airport?.shortName ?? m?.airport?.name ?? '',
    icao: m?.airport?.icao ?? null,
    lat: m?.airport?.location?.lat ?? null,
    lon: m?.airport?.location?.lon ?? null,
    timeZone: m?.airport?.timeZone ?? null,
  })
  return {
    flightNumber: (f.number ?? '').replace(/\s+/g, ' ').trim(),
    airline: f.airline?.name ?? '',
    aircraft: f.aircraft?.model ?? '',
    status: f.status ?? 'Unknown',
    origin: place(f.departure),
    destination: place(f.arrival),
    departureTime: hhmm(best(f.departure)?.local),
    arrivalTime: hhmm(best(f.arrival)?.local),
    departureUtc: toIso(best(f.departure)?.utc),
    arrivalUtc: toIso(best(f.arrival)?.utc),
  }
}

async function fetchFromAeroDataBox(number: string): Promise<AdbFlight[] | null> {
  const rapidKey = Deno.env.get('AERODATABOX_RAPIDAPI_KEY')
  const marketKey = Deno.env.get('AERODATABOX_APIMARKET_KEY')
  const path = `/flights/number/${encodeURIComponent(number)}?withAircraftImage=false&withLocation=false`

  let res: Response
  if (rapidKey) {
    res = await fetch(`https://aerodatabox.p.rapidapi.com${path}`, {
      headers: { 'X-RapidAPI-Key': rapidKey, 'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com' },
    })
  } else if (marketKey) {
    res = await fetch(`https://prod.api.market/api/v1/aedbx/aerodatabox${path}`, {
      headers: { 'x-api-market-key': marketKey },
    })
  } else {
    throw new Error('AeroDataBox key not set on the server.')
  }

  if (res.status === 204 || res.status === 404) return null
  if (!res.ok) throw new Error(`AeroDataBox returned ${res.status}`)
  return await res.json()
}

// Of the flights returned (e.g. yesterday's and today's), pick the one
// closest to now.
function pickClosest(flights: AdbFlight[]) {
  const now = Date.now()
  const dist = (f: AdbFlight) => {
    const t = toIso(best(f.departure)?.utc)
    return t ? Math.abs(new Date(t).getTime() - now) : Infinity
  }
  return [...flights].sort((a, b) => dist(a) - dist(b))[0]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { number: raw } = await req.json().catch(() => ({ number: '' }))
    const number = String(raw ?? '').toUpperCase().replace(/\s+/g, '')
    if (!NUMBER_PATTERN.test(number)) return json({ error: 'Enter a flight number like UA 1234.' }, 400)

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: cached } = await db.from('flight_cache').select('data, fetched_at').eq('flight_number', number).maybeSingle()
    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_MINUTES * 60_000) {
      return json(cached.data)
    }

    const flights = await fetchFromAeroDataBox(number)
    if (!flights || flights.length === 0) return json({ error: `No flight found for ${number}.` }, 404)

    const flight = normalize(pickClosest(flights))
    await db.from('flight_cache').upsert({ flight_number: number, data: flight, fetched_at: new Date().toISOString() })
    return json(flight)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Lookup failed.' }, 502)
  }
})
