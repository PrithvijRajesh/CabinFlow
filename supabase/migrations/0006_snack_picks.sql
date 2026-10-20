-- Feature 5: passengers pick one drink and one snack, with drink options.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.

-- Drinks are served hot (cream/sugar) or cold (ice). Null for snacks.
alter table public.cart_items add column if not exists serve text
  check (serve in ('hot', 'cold'));
update public.cart_items set serve = case when lower(name) in ('coffee', 'tea') then 'hot' else 'cold' end
where kind = 'drink' and serve is null;

-- cart_add gains p_serve; drop the 3-argument version from 0005.
drop function if exists public.cart_add(text, text, text);
create or replace function public.cart_add(p_flight text, p_name text, p_kind text, p_serve text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into cart_items (flight_id, name, kind, serve)
  values (p_flight, btrim(p_name), p_kind, case when p_kind = 'drink' then coalesce(p_serve, 'cold') end)
  on conflict do nothing;
end $$;

-- Same list as 0005, now with hot/cold.
create or replace function public.cart_load_standard(p_flight text)
returns void language plpgsql security definer set search_path = public as $$
begin
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

-- One row per seat per flight. Removing an item from the cart clears it here.
create table if not exists public.snack_picks (
  flight_id text not null,
  seat text not null check (seat ~ '^([1-9]|[1-5][0-9]|60)[A-HJK]$'),
  drink_id uuid references public.cart_items (id) on delete set null,
  snack_id uuid references public.cart_items (id) on delete set null,
  ice boolean,                                     -- cold drinks only
  cream boolean,                                   -- hot drinks only
  sugar smallint check (sugar between 0 and 3),    -- hot drinks only
  updated_at timestamptz not null default now(),
  primary key (flight_id, seat)
);

-- Clients may read picks (crew need them in Feature 6); writes go through the function below.
alter table public.snack_picks enable row level security;
drop policy if exists "read snack picks" on public.snack_picks;
create policy "read snack picks" on public.snack_picks
  for select to anon, authenticated using (true);
grant select on public.snack_picks to anon, authenticated;

-- Save a seat's picks. Both items null = clear. Options that don't fit the
-- drink (ice on coffee, sugar on cola) are dropped.
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

  insert into snack_picks (flight_id, seat, drink_id, snack_id, ice, cream, sugar, updated_at)
  values (
    p_flight, upper(p_seat), p_drink, p_snack,
    case when v_serve = 'cold' then coalesce(p_ice, true) end,
    case when v_serve = 'hot' then coalesce(p_cream, false) end,
    case when v_serve = 'hot' then coalesce(p_sugar, 0) end,
    now()
  )
  on conflict (flight_id, seat) do update set
    drink_id = excluded.drink_id, snack_id = excluded.snack_id,
    ice = excluded.ice, cream = excluded.cream, sugar = excluded.sugar,
    updated_at = excluded.updated_at;
end $$;

revoke all on function public.cart_add(text, text, text, text) from public;
revoke all on function public.snack_pick_save(text, text, uuid, uuid, boolean, boolean, smallint) from public;
grant execute on function public.cart_add(text, text, text, text) to anon, authenticated;
grant execute on function public.snack_pick_save(text, text, uuid, uuid, boolean, boolean, smallint) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.snack_picks;
exception when duplicate_object then null;
end $$;
