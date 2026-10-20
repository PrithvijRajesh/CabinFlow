-- Feature 7: passengers send assistance requests.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.

-- status: open (sent) → ack (crew on the way) → done | cancelled.
-- Crew functions for ack/done come in Feature 8.
create table if not exists public.assistance_requests (
  id uuid primary key default gen_random_uuid(),
  flight_id text not null,
  seat text not null check (seat ~ '^([1-9]|[1-5][0-9]|60)[A-HJK]$'),
  type text not null check (type in ('unwell', 'blanket', 'drink', 'bag', 'cleanup', 'seat', 'other')),
  -- A note only on "Something else", where it's required.
  -- (`note is not null` matters: a check that evaluates to NULL passes.)
  note text check (
    (type = 'other' and note is not null and char_length(btrim(note)) between 1 and 100)
    or (type <> 'other' and note is null)
  ),
  status text not null default 'open' check (status in ('open', 'ack', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  ack_at timestamptz,
  closed_at timestamptz
);

-- Several requests per seat, but only one open request of each type.
create unique index if not exists assistance_one_open_per_type
  on public.assistance_requests (flight_id, seat, type) where status in ('open', 'ack');
create index if not exists assistance_by_flight
  on public.assistance_requests (flight_id, created_at);

-- Clients may read requests (crew need them in Feature 8); writes go through the functions below.
alter table public.assistance_requests enable row level security;
drop policy if exists "read assistance requests" on public.assistance_requests;
create policy "read assistance requests" on public.assistance_requests
  for select to anon, authenticated using (true);
grant select on public.assistance_requests to anon, authenticated;

-- Sending the same type twice while one is open does nothing.
create or replace function public.assist_request(p_flight text, p_seat text, p_type text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into assistance_requests (flight_id, seat, type, note)
  values (p_flight, upper(p_seat), p_type, case when p_type = 'other' then btrim(p_note) end)
  on conflict do nothing;
end $$;

-- A passenger can only cancel their own open request.
create or replace function public.assist_cancel(p_flight text, p_seat text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update assistance_requests set status = 'cancelled', closed_at = now()
  where id = p_id and flight_id = p_flight and seat = upper(p_seat) and status in ('open', 'ack');
end $$;

revoke all on function public.assist_request(text, text, text, text) from public;
revoke all on function public.assist_cancel(text, text, uuid) from public;
grant execute on function public.assist_request(text, text, text, text) to anon, authenticated;
grant execute on function public.assist_cancel(text, text, uuid) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.assistance_requests;
exception when duplicate_object then null;
end $$;
