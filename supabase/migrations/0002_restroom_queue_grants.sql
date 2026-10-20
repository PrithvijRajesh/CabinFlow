-- Newer Supabase projects don't auto-grant table access to the API roles.
-- Read-only: all writes still go through the restroom_* functions.
grant usage on schema public to anon, authenticated;
grant select on public.restroom_queue to anon, authenticated;
