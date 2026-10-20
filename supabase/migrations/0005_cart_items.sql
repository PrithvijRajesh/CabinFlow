-- Feature 4: crew set up the snack cart (complimentary drinks and snacks).
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  flight_id text not null,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  kind text not null check (kind in ('drink', 'snack')),
  in_stock boolean not null default true,
  created_at timestamptz not null default now()
);

-- No duplicate names on one cart ("Coffee" and "coffee" count as the same).
create unique index if not exists cart_items_unique_name
  on public.cart_items (flight_id, lower(name));

-- Clients may read the cart, but every write goes through the functions below.
alter table public.cart_items enable row level security;
drop policy if exists "read cart items" on public.cart_items;
create policy "read cart items" on public.cart_items
  for select to anon, authenticated using (true);
grant select on public.cart_items to anon, authenticated;

create or replace function public.cart_add(p_flight text, p_name text, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into cart_items (flight_id, name, kind) values (p_flight, btrim(p_name), p_kind)
  on conflict do nothing;
end $$;

create or replace function public.cart_set_stock(p_flight text, p_id uuid, p_in_stock boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update cart_items set in_stock = p_in_stock where id = p_id and flight_id = p_flight;
end $$;

create or replace function public.cart_remove(p_flight text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from cart_items where id = p_id and flight_id = p_flight;
end $$;

-- One tap for a typical complimentary cart. Skips anything already on it.
create or replace function public.cart_load_standard(p_flight text)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Stagger created_at so the cart lists items in this order.
  insert into cart_items (flight_id, name, kind, created_at)
  select p_flight, v.name, v.kind, now() + v.ord * interval '1 millisecond'
  from unnest(
    array['Water', 'Sparkling water', 'Coffee', 'Tea', 'Cola', 'Diet cola', 'Lemon-lime soda',
          'Orange juice', 'Apple juice', 'Tomato juice', 'Pretzels', 'Cookies', 'Crackers', 'Trail mix'],
    array['drink', 'drink', 'drink', 'drink', 'drink', 'drink', 'drink',
          'drink', 'drink', 'drink', 'snack', 'snack', 'snack', 'snack']
  ) with ordinality as v(name, kind, ord)
  on conflict do nothing;
end $$;

revoke all on function public.cart_add(text, text, text) from public;
revoke all on function public.cart_set_stock(text, uuid, boolean) from public;
revoke all on function public.cart_remove(text, uuid) from public;
revoke all on function public.cart_load_standard(text) from public;
grant execute on function public.cart_add(text, text, text) to anon, authenticated;
grant execute on function public.cart_set_stock(text, uuid, boolean) to anon, authenticated;
grant execute on function public.cart_remove(text, uuid) to anon, authenticated;
grant execute on function public.cart_load_standard(text) to anon, authenticated;

-- Push changes so passenger menus (Feature 5) update live.
do $$
begin
  alter publication supabase_realtime add table public.cart_items;
exception when duplicate_object then null;
end $$;
