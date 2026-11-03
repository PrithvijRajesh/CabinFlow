-- Assistance: "Seen by crew". Set when crew open the Requests screen, so
-- passengers know their request reached someone before anyone is on the way.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.

alter table public.assistance_requests add column if not exists seen_at timestamptz;

-- Crew: mark every new request on the flight as seen.
create or replace function public.assist_seen(p_flight text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_crew() then raise exception 'Crew sign-in required.'; end if;
  update assistance_requests set seen_at = now()
  where flight_id = p_flight and status = 'open' and seen_at is null;
end $$;

revoke all on function public.assist_seen(text) from public;
grant execute on function public.assist_seen(text) to authenticated;
