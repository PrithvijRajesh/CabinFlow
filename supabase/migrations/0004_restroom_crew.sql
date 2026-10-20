-- Feature 3: crew restroom line controls + pause line.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.

-- Who ended a spot: null = the passenger or the timer, 'crew' = crew action.
alter table public.restroom_queue add column if not exists ended_by text
  check (ended_by in ('crew'));

-- One row per flight. While paused (seatbelt sign, turbulence), no one is called.
create table if not exists public.restroom_line_state (
  flight_id text primary key,
  paused boolean not null default false,
  paused_at timestamptz
);

alter table public.restroom_line_state enable row level security;
drop policy if exists "read restroom line state" on public.restroom_line_state;
create policy "read restroom line state" on public.restroom_line_state
  for select to anon, authenticated using (true);
grant select on public.restroom_line_state to anon, authenticated;

-- Same as 0001, plus: don't call anyone while the line is paused.
create or replace function public.restroom_tick(p_flight text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_flight));

  update restroom_queue set status = 'skipped', ended_at = now()
  where flight_id = p_flight and status = 'called'
    and called_at < now() - interval '5 minutes';

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

-- p_action:
--   'done'     called seat is back → next is called
--   'skip'     called seat didn't show → next is called
--   'call_now' override: this waiting seat goes now; the called seat returns
--              to its place in line (works even while paused)
--   'remove'   take a waiting or called seat out of the line
create or replace function public.restroom_crew_action(p_flight text, p_id uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
begin
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
    return; -- skip tick: it would not call anyone else anyway
  else
    raise exception 'invalid action %', p_action;
  end if;

  perform restroom_tick(p_flight);
end $$;

-- Pausing sends the called seat back to its place, so no one is told to go.
-- Resuming calls the next seat right away.
create or replace function public.restroom_set_paused(p_flight text, p_paused boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
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

revoke all on function public.restroom_crew_action(text, uuid, text) from public;
revoke all on function public.restroom_set_paused(text, boolean) from public;
grant execute on function public.restroom_crew_action(text, uuid, text) to anon, authenticated;
grant execute on function public.restroom_set_paused(text, boolean) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.restroom_line_state;
exception when duplicate_object then null;
end $$;
