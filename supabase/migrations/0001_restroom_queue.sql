-- Feature 2: passenger restroom line.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.

create table if not exists public.restroom_queue (
  id uuid primary key default gen_random_uuid(),
  flight_id text not null,
  seat text not null check (seat ~ '^([1-9]|[1-5][0-9]|60)[A-HJK]$'),
  status text not null default 'waiting'
    check (status in ('waiting', 'called', 'done', 'skipped', 'left')),
  joined_at timestamptz not null default now(),
  called_at timestamptz,
  ended_at timestamptz
);

-- A seat can only hold one active spot per flight.
create unique index if not exists restroom_queue_one_active_per_seat
  on public.restroom_queue (flight_id, seat) where status in ('waiting', 'called');
create index if not exists restroom_queue_active_order
  on public.restroom_queue (flight_id, joined_at) where status in ('waiting', 'called');

-- Clients may read the queue, but every write goes through the functions below.
alter table public.restroom_queue enable row level security;
drop policy if exists "read restroom queue" on public.restroom_queue;
create policy "read restroom queue" on public.restroom_queue
  for select to anon, authenticated using (true);

-- Advance the line: time out a turn after 5 minutes, then call the next seat.
-- One lavatory per flight for the MVP, so only one seat is 'called' at a time.
create or replace function public.restroom_tick(p_flight text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_flight));

  update restroom_queue set status = 'skipped', ended_at = now()
  where flight_id = p_flight and status = 'called'
    and called_at < now() - interval '5 minutes';

  if not exists (select 1 from restroom_queue where flight_id = p_flight and status = 'called') then
    update restroom_queue set status = 'called', called_at = now()
    where id = (
      select id from restroom_queue
      where flight_id = p_flight and status = 'waiting'
      order by joined_at, id limit 1
    );
  end if;
end $$;

create or replace function public.restroom_join(p_flight text, p_seat text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_flight));
  insert into restroom_queue (flight_id, seat) values (p_flight, upper(p_seat))
  on conflict do nothing;
  perform restroom_tick(p_flight);
end $$;

-- p_status: 'done' (back from the restroom) or 'left' (gave up the spot).
create or replace function public.restroom_finish(p_flight text, p_seat text, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('done', 'left') then
    raise exception 'invalid status %', p_status;
  end if;
  perform pg_advisory_xact_lock(hashtext(p_flight));
  update restroom_queue set status = p_status, ended_at = now()
  where flight_id = p_flight and seat = upper(p_seat) and status in ('waiting', 'called');
  perform restroom_tick(p_flight);
end $$;

revoke all on function public.restroom_tick(text) from public;
revoke all on function public.restroom_join(text, text) from public;
revoke all on function public.restroom_finish(text, text, text) from public;
grant execute on function public.restroom_tick(text) to anon, authenticated;
grant execute on function public.restroom_join(text, text) to anon, authenticated;
grant execute on function public.restroom_finish(text, text, text) to anon, authenticated;

-- Push row changes to subscribed clients.
do $$
begin
  alter publication supabase_realtime add table public.restroom_queue;
exception when duplicate_object then null;
end $$;
