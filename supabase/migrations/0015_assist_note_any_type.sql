-- Assistance: an optional note on every request type ("2 blankets",
-- "still water, no ice"). "Something else" still requires one.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.

-- Drop the old note check from 0009, whatever Postgres named it.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.assistance_requests'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%note%'
  loop
    execute format('alter table public.assistance_requests drop constraint %I', c);
  end loop;
end $$;

alter table public.assistance_requests add constraint assistance_requests_note_check check (
  (note is null or char_length(btrim(note)) between 1 and 100)
  and (type <> 'other' or note is not null)
);

-- Blank notes are stored as null.
create or replace function public.assist_request(p_flight text, p_seat text, p_type text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into assistance_requests (flight_id, seat, type, note)
  values (p_flight, upper(p_seat), p_type, nullif(btrim(p_note), ''))
  on conflict do nothing;
end $$;
