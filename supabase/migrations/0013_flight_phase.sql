-- Flight-phase rules: crew can override the phase (boarding / in flight /
-- landed) for the aircraft. No row = auto (from flight status and times).
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.

create table if not exists public.aircraft_phase (
  aircraft_id text primary key,
  phase text not null check (phase in ('boarding', 'inflight', 'landed')),
  set_by uuid references auth.users (id) on delete set null,
  set_at timestamptz not null default now()
);

alter table public.aircraft_phase enable row level security;
drop policy if exists "read aircraft phase" on public.aircraft_phase;
create policy "read aircraft phase" on public.aircraft_phase
  for select to anon, authenticated using (true);
grant select on public.aircraft_phase to anon, authenticated;

-- p_phase null = back to auto.
create or replace function public.aircraft_set_phase(p_aircraft text, p_phase text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_crew() then raise exception 'Crew sign-in required.'; end if;
  if p_phase is null then
    delete from aircraft_phase where aircraft_id = p_aircraft;
  else
    insert into aircraft_phase (aircraft_id, phase, set_by, set_at)
    values (p_aircraft, p_phase, auth.uid(), now())
    on conflict (aircraft_id) do update
      set phase = excluded.phase, set_by = excluded.set_by, set_at = excluded.set_at;
  end if;
end $$;

-- Same as 0012, plus: a new flight (or the demo flight) starts on auto.
create or replace function public.aircraft_set_flight(p_aircraft text, p_flight jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_crew() then raise exception 'Crew sign-in required.'; end if;
  if coalesce(p_flight ->> 'flightNumber', '') = '' then raise exception 'Flight is missing a flight number.'; end if;
  insert into aircraft_flights (aircraft_id, flight, set_by, set_at)
  values (p_aircraft, p_flight, auth.uid(), now())
  on conflict (aircraft_id) do update
    set flight = excluded.flight, set_by = excluded.set_by, set_at = excluded.set_at;
  delete from aircraft_phase where aircraft_id = p_aircraft;
end $$;

create or replace function public.aircraft_clear_flight(p_aircraft text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_crew() then raise exception 'Crew sign-in required.'; end if;
  delete from aircraft_flights where aircraft_id = p_aircraft;
  delete from aircraft_phase where aircraft_id = p_aircraft;
end $$;

revoke all on function public.aircraft_set_phase(text, text) from public;
grant execute on function public.aircraft_set_phase(text, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.aircraft_phase;
exception when duplicate_object then null;
end $$;
