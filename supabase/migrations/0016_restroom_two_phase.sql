-- Restroom: two-phase turn. When called, a passenger has 2 minutes to tap
-- "I'm heading there" (else the next seat is called). After that no clock
-- runs: crew see a long-visit flag at 10 minutes, and the turn is released
-- automatically at 15. Fixes being rushed, or timed out while still inside.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.

alter table public.restroom_queue add column if not exists going_at timestamptz;

create or replace function public.restroom_tick(p_flight text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_flight));

  -- Called but never answered.
  update restroom_queue set status = 'skipped', ended_at = now()
  where flight_id = p_flight and status = 'called' and going_at is null
    and called_at < now() - interval '2 minutes';

  -- Went but never tapped "I'm back".
  update restroom_queue set status = 'done', ended_at = now()
  where flight_id = p_flight and status = 'called'
    and going_at < now() - interval '15 minutes';

  if exists (select 1 from restroom_line_state where flight_id = p_flight and paused) then
    return;
  end if;

  if not exists (select 1 from restroom_queue where flight_id = p_flight and status = 'called') then
    update restroom_queue set status = 'called', called_at = now()
    where id = (
      select id from restroom_queue
      where flight_id = p_flight and status = 'waiting'
      order by joined_at, id limit 1
    );
  end if;
end $$;

-- Passenger: "I'm heading there". Only the called seat, only once.
create or replace function public.restroom_going(p_flight text, p_seat text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_flight));
  update restroom_queue set going_at = now()
  where flight_id = p_flight and seat = upper(p_seat) and status = 'called' and going_at is null;
end $$;

revoke all on function public.restroom_going(text, text) from public;
grant execute on function public.restroom_going(text, text) to anon, authenticated;

-- Same as 0012, but call_now also clears going_at on the seat it sends back.
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
    update restroom_queue set status = 'waiting', called_at = null, going_at = null
    where flight_id = p_flight and status = 'called';
    update restroom_queue set status = 'called', called_at = now()
    where id = p_id;
    return;
  else
    raise exception 'invalid action %', p_action;
  end if;

  perform restroom_tick(p_flight);
end $$;

-- Same as 0012, but pausing only sends back a seat that hasn't left yet.
-- Someone already on their way keeps their turn.
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
    where flight_id = p_flight and status = 'called' and going_at is null;
  end if;

  perform restroom_tick(p_flight);
end $$;
