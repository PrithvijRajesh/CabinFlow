// Ride outlook along the route + weather at the arrival airport, from the
// NOAA Aviation Weather Center (aviationweather.gov). Free, no key, but no
// CORS and fair-use limits, so it runs here behind a 15-minute cache.
//
// Turbulence sources:
//   - International SIGMETs (worldwide, significant turbulence only)
//   - US G-AIRMETs "tango" (moderate turbulence areas, US only)
//   - Pilot reports (PIREPs) from the last 2 hours near the route (mostly US)
import { createClient } from 'npm:@supabase/supabase-js@2'

const API = 'https://aviationweather.gov/api/data'
const USER_AGENT = 'CabinFlow/0.1 (seatback IFE prototype)'
const CACHE_MINUTES = 15
const ICAO = /^[A-Z0-9]{4}$/

const LEGS = ['Climb', 'Early cruise', 'Mid cruise', 'Late cruise', 'Descent']
const POINTS_PER_LEG = 8
const PIREP_RADIUS_KM = 120
// Altitude band (feet) each leg flies through: climb/descent low, cruise high.
const LOW: [number, number] = [0, 25_000]
const HIGH: [number, number] = [28_000, 43_000]

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

async function get<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API}${path}`, { headers: { 'User-Agent': USER_AGENT } })
  if (res.status === 204) return null
  if (!res.ok) throw new Error(`Aviation Weather returned ${res.status}`)
  const text = await res.text()
  return text ? (JSON.parse(text) as T) : null
}

// ---------- Geometry ----------

type Pt = { lat: number; lon: number }
const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

function distanceKm(a: Pt, b: Pt) {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

// Point a fraction f of the way along the great circle from a to b.
function along(a: Pt, b: Pt, f: number): Pt {
  const d = distanceKm(a, b) / 6371
  if (d === 0) return a
  const A = Math.sin((1 - f) * d) / Math.sin(d)
  const B = Math.sin(f * d) / Math.sin(d)
  const x = A * Math.cos(rad(a.lat)) * Math.cos(rad(a.lon)) + B * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon))
  const y = A * Math.cos(rad(a.lat)) * Math.sin(rad(a.lon)) + B * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon))
  const z = A * Math.sin(rad(a.lat)) + B * Math.sin(rad(b.lat))
  return { lat: deg(Math.atan2(z, Math.hypot(x, y))), lon: deg(Math.atan2(y, x)) }
}

// Ray casting; fine for advisory-sized polygons that don't cross the date line.
function inPolygon(p: Pt, poly: Pt[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a.lat > p.lat) !== (b.lat > p.lat) && p.lon < ((b.lon - a.lon) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lon) {
      inside = !inside
    }
  }
  return inside
}

const overlaps = (band: [number, number], base: number | null, top: number | null) =>
  (base ?? 0) <= band[1] && (top ?? 60_000) >= band[0]

// ---------- Turbulence ----------

type Ride = 'none' | 'light' | 'bumpy'
const rank: Record<Ride, number> = { none: 0, light: 1, bumpy: 2 }
const worse = (a: Ride, b: Ride) => (rank[b] > rank[a] ? b : a)

// Passenger terms: light turbulence = "light chop", moderate or severe = "bumpy".
function rideFrom(intensity: string | null | undefined): Ride {
  const s = (intensity ?? '').toUpperCase()
  if (s.includes('SEV') || s.includes('MOD') || s.includes('EXTM')) return 'bumpy'
  if (s.includes('LGT')) return 'light'
  return 'none'
}

interface Sigmet { hazard?: string; qualifier?: string; base?: number | null; top?: number | null; coords?: Pt[] }
interface GAirmet { hazard?: string; severity?: string; base?: string | null; top?: string | null; coords?: { lat: string; lon: string }[] }
interface Pirep { lat: number; lon: number; fltLvl?: number | null; tbInt1?: string; tbInt2?: string }

// G-AIRMET levels are hundreds of feet ("040" = 4,000 ft) or "SFC".
const level = (v: string | null | undefined) => (!v || v === 'SFC' ? 0 : Number(v) * 100)

interface Leg { name: string; ride: Ride; sources: string[] }

async function routeOutlook(from: Pt, to: Pt): Promise<{ legs: Leg[]; usOnly: boolean; pirepCount: number }> {
  const legPoints = LEGS.map((_, i) =>
    Array.from({ length: POINTS_PER_LEG }, (_, k) => along(from, to, (i + k / (POINTS_PER_LEG - 1)) / LEGS.length)))
  const all = legPoints.flat()

  // PIREPs only for routes that don't span half the globe (bbox would be useless).
  const lats = all.map((p) => p.lat), lons = all.map((p) => p.lon)
  const lonSpan = Math.max(...lons) - Math.min(...lons)
  const bbox = lonSpan < 120
    ? `${Math.min(...lats) - 2},${Math.min(...lons) - 2},${Math.max(...lats) + 2},${Math.max(...lons) + 2}`
    : null

  const [sigmets, gairmets, pireps] = await Promise.all([
    get<Sigmet[]>('/isigmet?format=json&hazard=turb').catch(() => null),
    get<GAirmet[]>('/gairmet?type=tango&format=json').catch(() => null),
    bbox ? get<Pirep[]>(`/pirep?format=json&age=2&bbox=${bbox}`).catch(() => null) : Promise.resolve(null),
  ])

  const turbPireps = (pireps ?? []).filter((p) => rideFrom(p.tbInt1) !== 'none' || rideFrom(p.tbInt2) !== 'none')

  const legs = LEGS.map((name, i): Leg => {
    const pts = legPoints[i]
    const band = i === 0 || i === LEGS.length - 1 ? LOW : HIGH
    let ride: Ride = 'none'
    const sources = new Set<string>()

    for (const s of sigmets ?? []) {
      if (s.hazard !== 'TURB' || !s.coords?.length || !overlaps(band, s.base ?? null, s.top ?? null)) continue
      if (pts.some((p) => inPolygon(p, s.coords!))) { ride = worse(ride, 'bumpy'); sources.add('SIGMET') }
    }
    for (const g of gairmets ?? []) {
      if (!g.hazard?.startsWith('TURB') || !g.coords?.length || !overlaps(band, level(g.base), level(g.top))) continue
      const poly = g.coords.map((c) => ({ lat: Number(c.lat), lon: Number(c.lon) }))
      if (pts.some((p) => inPolygon(p, poly))) { ride = worse(ride, rideFrom(g.severity ?? 'MOD')); sources.add('AIRMET') }
    }
    for (const r of turbPireps) {
      const alt = (r.fltLvl ?? 0) * 100
      if (alt < band[0] || alt > band[1]) continue
      if (pts.some((p) => distanceKm(p, r) < PIREP_RADIUS_KM)) {
        ride = worse(ride, worse(rideFrom(r.tbInt1), rideFrom(r.tbInt2)))
        sources.add('pilot reports')
      }
    }
    return { name, ride, sources: [...sources] }
  })

  // G-AIRMETs and most PIREPs are US-only; outside the US we only have SIGMETs.
  const inUS = (p: Pt) => p.lat > 24 && p.lat < 50 && p.lon > -125 && p.lon < -66
  return { legs, usOnly: all.every(inUS), pirepCount: turbPireps.length }
}

// ---------- Destination weather ----------

interface Metar {
  icaoId: string; name?: string; lat: number; lon: number; obsTime?: number
  temp?: number | null; wdir?: number | string | null; wspd?: number | null; wgst?: number | null
  visib?: number | string | null; wxString?: string | null; cover?: string | null
}
interface TafFcst {
  timeFrom: number; timeTo: number; fcstChange?: string | null; probability?: number | null
  wspd?: number | null; wgst?: number | null; wxString?: string | null; clouds?: { cover: string }[]
}
interface Taf { icaoId: string; fcsts?: TafFcst[] }

const WX: [string, string][] = [
  ['TS', 'Thunderstorms'], ['SN', 'Snow'], ['PL', 'Ice pellets'], ['GR', 'Hail'], ['FZRA', 'Freezing rain'],
  ['RA', 'Rain'], ['DZ', 'Drizzle'], ['FG', 'Fog'], ['BR', 'Mist'], ['HZ', 'Haze'], ['FU', 'Smoke'], ['DU', 'Dust'],
]
const COVER: Record<string, string> = {
  SKC: 'Clear', CLR: 'Clear', CAVOK: 'Clear', NSC: 'Clear', FEW: 'Mostly clear',
  SCT: 'Partly cloudy', BKN: 'Mostly cloudy', OVC: 'Overcast', OVX: 'Overcast',
}

function condition(wx: string | null | undefined, cover: string | null | undefined) {
  if (wx) {
    const hit = WX.find(([code]) => wx.includes(code))
    if (hit) {
      const strength = wx.startsWith('-') ? 'Light' : wx.startsWith('+') ? 'Heavy' : ''
      return strength ? `${strength} ${hit[1].toLowerCase()}` : hit[1]
    }
  }
  return COVER[cover ?? ''] ?? 'Clouds'
}

function wind(speed: number | null | undefined, gust: number | null | undefined) {
  const kt = speed ?? 0
  const label = kt < 4 ? 'Calm' : kt < 12 ? 'Light wind' : kt < 22 ? 'Breezy' : 'Windy'
  return gust ? `${label}, gusts to ${Math.round(gust * 1.852)} km/h` : label
}

function arrivalForecast(taf: Taf | undefined, arrivalUtc: string | null) {
  if (!taf?.fcsts?.length || !arrivalUtc) return null
  const t = new Date(arrivalUtc).getTime() / 1000
  // Main forecast lines only (skip TEMPO / PROB30 maybes); the last one covering t wins.
  const covering = taf.fcsts.filter((f) => f.timeFrom <= t && t < f.timeTo && f.fcstChange !== 'TEMPO' && !f.probability)
  const f = covering.at(-1)
  if (!f) return null
  const cover = f.clouds?.at(-1)?.cover ?? (f.wxString ? null : 'CLR')
  return { condition: condition(f.wxString, cover), wind: wind(f.wspd, f.wgst) }
}

// ---------- Handler ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json().catch(() => ({}))
    const origin = String(body.origin ?? '').toUpperCase()
    const destination = String(body.destination ?? '').toUpperCase()
    const arrivalUtc = typeof body.arrivalUtc === 'string' ? body.arrivalUtc : null
    if (!ICAO.test(origin) || !ICAO.test(destination)) return json({ error: 'Airport codes missing.' }, 400)

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const key = `${origin}-${destination}-${arrivalUtc?.slice(0, 13) ?? ''}`

    const { data: cached } = await db.from('weather_cache').select('data, fetched_at').eq('key', key).maybeSingle()
    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_MINUTES * 60_000) {
      return json(cached.data)
    }

    const [metars, tafs] = await Promise.all([
      get<Metar[]>(`/metar?ids=${origin},${destination}&format=json`),
      get<Taf[]>(`/taf?ids=${destination}&format=json`).catch(() => null),
    ])
    const from = metars?.find((m) => m.icaoId === origin)
    const to = metars?.find((m) => m.icaoId === destination)

    const route = from && to ? await routeOutlook(from, to) : null

    const result = {
      generatedAt: new Date().toISOString(),
      outlook: route,
      destination: to
        ? {
            name: to.name ?? destination,
            observedAt: to.obsTime ? new Date(to.obsTime * 1000).toISOString() : null,
            tempC: to.temp ?? null,
            condition: condition(to.wxString, to.cover),
            wind: wind(to.wspd, to.wgst),
            atArrival: arrivalForecast(tafs?.find((t) => t.icaoId === destination), arrivalUtc),
          }
        : null,
    }

    await db.from('weather_cache').upsert({ key, data: result, fetched_at: new Date().toISOString() })
    return json(result)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Weather lookup failed.' }, 502)
  }
})
