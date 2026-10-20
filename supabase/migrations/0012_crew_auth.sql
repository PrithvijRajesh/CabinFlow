-- Crew login: real crew accounts (Supabase Auth), the aircraft's current flight,
-- and crew-only functions locked to signed-in crew.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Before running: create the crew user under Authentication → Users and set
-- the email in the "Demo crew account" insert below.

-- ---------- Crew members ----------

-- Only users listed here are crew. An Auth account alone is not enough.
create table if not exists public.crew_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Crew',
  added_at timestamptz not null default now()
);

alter table public.crew_members enable row level security;
drop policy if exists "crew read own row" on public.crew_members;
create policy "crew read own row" on public.crew_members
  for select to authenticated using (user_id = auth.uid());
grant select on public.crew_members to authenticated;

create or replace function public.is_crew()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from crew_members where user_id = auth.uid())
$$;

-- Demo crew account.
insert into public.crew_members (user_id, name)
select id, 'Demo crew' from auth.users where email = 'crew@email.com'
on conflict do nothing;

-- ---------- Aircraft's current flight ----------

-- One row per aircraft. Seatbacks read it; crew set it once per flight.
create table if not exists public.aircraft_flights (
  aircraft_id text primary key,
  flight jsonb not null, -- FlightInfo, as returned by the flight-lookup function
  set_by uuid references auth.users (id) on delete set null,
  set_at timestamptz not null default now()
);

alter table public.aircraft_flights enable row level security;
drop policy if exists "read aircraft flights" on public.aircraft_flights;
create policy "read aircraft flights" on public.aircraft_flights
  for select to anon, authenticated using (true);
grant select on public.aircraft_flights to anon, authenticated;

create or replace function public.aircraft_set_flight(p_aircraft text, p_flight jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_crew() then raise exception 'Crew sign-in required.'; end if;
  if coalesce(p_flight ->> 'flightNumber', '') = '' then raise exception 'Flight is missing a flight number.'; end if;
  insert into aircraft_flights (aircraft_id, flight, set_by, set_at)
  values (p_aircraft, p_flight, auth.uid(), now())
  on conflict (aircraft_id) do update
    set flight = excluded.flight, set_by = excluded.set_by, set_at = excluded.set_at;
end $$;

-- Back to the demo flight.
create or replace function public.aircraft_clear_flight(p_aircraft text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_crew() then raise exception 'Crew sign-in required.'; end if;
  delete from aircraft_flights where aircraft_id = p_aircraft;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.aircraft_flights;
exception when duplicate_object then null;
end $$;

-- ---------- Lock crew-only functions to signed-in crew ----------
-- Same bodies as before (0004, 0006, 0008, 0010) plus the is_crew() check.

create or replace function public.restroom_crew_action(p_flight text, p_id uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_crew() then raise exception 'Crew sign-in required.'; end if;
  perform pg_advisory_xact_lock(hashtext(p_flight));

  if p_action = 'done' then
    update restroom_queue set status = 'done', ended_at = now(), ended_by = 'crew'
    where id = p_id and flight_id = p_flight and status = 'called';
  elsif p_action = 'skip' then
    update restroom_queue set status = 'skipped', ended_at = now(), ended_by = 'crew'
    where id = p_id and flight_id = p_flight and status = 'called';
  elsif p_action = 'remove' then
    update restroom_queue set status = 'left', ended_at = now(), ended_by = 'crew'
    where id = p_id and flight_id = p_flight and status in ('waiting', 'called');
  elsif p_action = 'call_now' then
    if not exists (select 1 from restroom_queue where id = p_id and flight_id = p_flight and status = 'waiting') then
      return;
    end if;
    update restroom_queue set status = 'waiting', called_at = null
    where flight_id = p_flight and status = 'called';
    update restroom_queue set status = 'called', called_at = now()
    where id = p_id;
    return;
  else
    raise exception 'invalid action %', p_action;
  end if;

  perform restroom_tick(p_flight);
end $$;

create or replace function public.restroom_set_paused(p_flight text, p_paused boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_crew() then raise exception 'Crew sign-in required.'; end if;
  perform pg_advisory_xact_lock(hashtext(p_flight));

  insert into restroom_line_state (flight_id, paused, paused_at)
  values (p_flight, p_paused, case when p_paused then now() end)
  on conflict (flight_id) do update
    set paused = excluded.paused, paused_at = excluded.paused_at;

  if p_paused then
    update restroom_queue set status = 'waiting', called_at = null
    where flight_id = p_flight and status = 'called';
  end if;

  perform restroom_tick(p_flight);
end $$;

create or replace function public.cart_add(p_flight text, p_name text, p_kind text, p_serve text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_crew() then raise exception 'Crew sign-in required.'; end if;
  insert into cart_items (flight_id, name, kind, serve)
  values (p_flight, btrim(p_name), p_kind, case when p_kind = 'drink' then coalesce(p_serve, 'cold') end)
  on conflict do nothing;
end $$;

create or replace function public.cart_set_stock(p_flight text, p_id uuid, p_in_stock boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_crew() then raise exception 'Crew sign-in required.'; end if;
  update cart_items set in_stock = p_in_stock where id = p_id and flight_id = p_flight;
end $$;

create or replace function public.cart_remove(p_flight text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_crew() then raise exception 'Crew sign-in required.'; end if;
  delete from cart_items where id = p_id and flight_id = p_flight;
end $$;

create or replace function public.cart_load_standard(p_flight text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_crew() then raise exception 'Crew sign-in required.'; end if;
  -- Stagger created_at so the cart lists items in this order.
  insert into cart_items (flight_id, name, kind, serve, created_at)
  select p_flight, v.name, v.kind, case when v.kind = 'drink' then v.serve end, now() + v.ord * interval '1 millisecond'
  from unnest(
    array['Water', 'Sparkling water', 'Coffee', 'Tea', 'Cola', 'Diet cola', 'Lemon-lime soda',
          'Orange juice', 'Apple juice', 'Tomato juice', 'Pretzels', 'Cookies', 'Crackers', 'Trail mix'],
    array['drink', 'drink', 'drink', 'drink', 'drink', 'drink', 'drink',
          'drink', 'drink', 'drink', 'snack', 'snack', 'snack', 'snack'],
    array['cold', 'cold', 'hot', 'hot', 'cold', 'cold', 'cold',
          'cold', 'cold', 'cold', null, null, null, null]
  ) with ordinality as v(name, kind, serve, ord)
  on conflict do nothing;
end $$;

create or replace function public.snack_pick_served(p_flight text, p_seat text, p_served boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_crew() then raise exception 'Crew sign-in required.'; end if;
  update snack_picks set served_at = case when p_served then now() end
  where flight_id = p_flight and seat = upper(p_seat);
end $$;

create or replace function public.assist_ack(p_flight text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_crew() then raise exception 'Crew sign-in required.'; end if;
  update assistance_requests set status = 'ack', ack_at = now()
  where id = p_id and flight_id = p_flight and status = 'open';
end $$;

create or replace function public.assist_done(p_flight text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_crew() then raise exception 'Crew sign-in required.'; end if;
  update assistance_requests set status = 'done', closed_at = now(), ack_at = coalesce(ack_at, now())
  where id = p_id and flight_id = p_flight and status in ('open', 'ack');
end $$;

-- Crew-only functions: signed-in users only (is_crew() then checks the list).
revoke execute on function public.restroom_crew_action(text, uuid, text) from anon;
revoke execute on function public.restroom_set_paused(text, boolean) from anon;
revoke execute on function public.cart_add(text, text, text, text) from anon;
revoke execute on function public.cart_set_stock(text, uuid, boolean) from anon;
revoke execute on function public.cart_remove(text, uuid) from anon;
revoke execute on function public.cart_load_standard(text) from anon;
revoke execute on function public.snack_pick_served(text, text, boolean) from anon;
revoke execute on function public.assist_ack(text, uuid) from anon;
revoke execute on function public.assist_done(text, uuid) from anon;

revoke all on function public.aircraft_set_flight(text, jsonb) from public;
revoke all on function public.aircraft_clear_flight(text) from public;
grant execute on function public.aircraft_set_flight(text, jsonb) to authenticated;
grant execute on function public.aircraft_clear_flight(text) to authenticated;
grant execute on function public.is_crew() to anon, authenticated;
