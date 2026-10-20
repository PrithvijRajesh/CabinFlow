-- Flight lookup cache, so repeated lookups don't spend AeroDataBox quota.
-- Only the flight-lookup Edge Function (service role) touches this table;
-- no grants to anon/authenticated on purpose.
create table if not exists public.flight_cache (
  flight_number text primary key,
  data jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.flight_cache enable row level security;
