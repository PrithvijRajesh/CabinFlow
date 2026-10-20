-- Feature 8: crew manage assistance requests.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.

-- Fix from Feature 7: "other" without a note slipped through, because a check
-- that evaluates to NULL passes. Patch any such rows, then tighten the check.
update public.assistance_requests set note = 'No details given'
where type = 'other' and (note is null or btrim(note) = '');
alter table public.assistance_requests drop constraint if exists assistance_requests_note_check;
alter table public.assistance_requests add constraint assistance_requests_note_check check (
  (type = 'other' and note is not null and char_length(btrim(note)) between 1 and 100)
  or (type <> 'other' and note is null)
);

-- Crew: "On my way" (open → ack).
create or replace function public.assist_ack(p_flight text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update assistance_requests set status = 'ack', ack_at = now()
  where id = p_id and flight_id = p_flight and status = 'open';
end $$;

-- Crew: "Done" (open or ack → done). Allowed straight from open, e.g. when
-- crew handle it while passing by.
create or replace function public.assist_done(p_flight text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update assistance_requests set status = 'done', closed_at = now(), ack_at = coalesce(ack_at, now())
  where id = p_id and flight_id = p_flight and status in ('open', 'ack');
end $$;

revoke all on function public.assist_ack(text, uuid) from public;
revoke all on function public.assist_done(text, uuid) from public;
grant execute on function public.assist_ack(text, uuid) to anon, authenticated;
grant execute on function public.assist_done(text, uuid) to anon, authenticated;
