-- Feature 6: crew mark a seat's pick as served.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.

alter table public.snack_picks add column if not exists served_at timestamptz;

create or replace function public.snack_pick_served(p_flight text, p_seat text, p_served boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update snack_picks set served_at = case when p_served then now() end
  where flight_id = p_flight and seat = upper(p_seat);
end $$;

-- Same as 0006, except a changed pick counts as a new order (served_at reset).
create or replace function public.snack_pick_save(
  p_flight text, p_seat text, p_drink uuid, p_snack uuid,
  p_ice boolean, p_cream boolean, p_sugar smallint
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_serve text;
begin
  if p_drink is null and p_snack is null then
    delete from snack_picks where flight_id = p_flight and seat = upper(p_seat);
    return;
  end if;

  if p_drink is not null then
    select serve into v_serve from cart_items
    where id = p_drink and flight_id = p_flight and kind = 'drink' and in_stock;
    if not found then raise exception 'That drink is not available.'; end if;
  end if;

  if p_snack is not null and not exists (
    select 1 from cart_items where id = p_snack and flight_id = p_flight and kind = 'snack' and in_stock
  ) then
    raise exception 'That snack is not available.';
  end if;

  insert into snack_picks (flight_id, seat, drink_id, snack_id, ice, cream, sugar, updated_at, served_at)
  values (
    p_flight, upper(p_seat), p_drink, p_snack,
    case when v_serve = 'cold' then coalesce(p_ice, true) end,
    case when v_serve = 'hot' then coalesce(p_cream, false) end,
    case when v_serve = 'hot' then coalesce(p_sugar, 0) end,
    now(), null
  )
  on conflict (flight_id, seat) do update set
    drink_id = excluded.drink_id, snack_id = excluded.snack_id,
    ice = excluded.ice, cream = excluded.cream, sugar = excluded.sugar,
    updated_at = excluded.updated_at, served_at = null;
end $$;

revoke all on function public.snack_pick_served(text, text, boolean) from public;
grant execute on function public.snack_pick_served(text, text, boolean) to anon, authenticated;
