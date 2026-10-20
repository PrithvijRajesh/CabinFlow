-- Feature 9 refinement: cache for the flight-weather Edge Function, so every
-- seatback on a flight doesn't call NOAA. Only the function (service role)
-- touches it; no grants to anon/authenticated on purpose.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
create table if not exists public.weather_cache (
  key text primary key, -- ORIGIN-DEST-arrival hour, e.g. KSFO-KDFW-2026-10-20T21
  data jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.weather_cache enable row level security;
