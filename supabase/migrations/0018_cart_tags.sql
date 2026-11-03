-- Snacks: allergen and diet tags on cart items, set by crew. The standard
-- cart comes pre-tagged; crew adjust to what's actually on board.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.

alter table public.cart_items add column if not exists tags text[] not null default '{}';
alter table public.cart_items drop constraint if exists cart_items_tags_check;
alter table public.cart_items add constraint cart_items_tags_check
  check (tags <@ array['nuts', 'dairy', 'gluten_free', 'vegan']::text[]);

-- Defaults for the standard snacks, only where crew haven't tagged yet.
create or replace function public.cart_default_tags(p_flight text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update cart_items set tags = case lower(name)
      when 'pretzels' then '{vegan}'::text[]
      when 'cookies' then '{dairy}'::text[]
      when 'crackers' then '{vegan}'::text[]
      when 'trail mix' then '{nuts,vegan}'::text[]
      else tags
    end
  where (p_flight is null or flight_id = p_flight) and kind = 'snack' and tags = '{}';
end $$;
revoke all on function public.cart_default_tags(text) from public;

select public.cart_default_tags(null);

-- Crew: replace an item's tags.
create or replace function public.cart_set_tags(p_flight text, p_id uuid, p_tags text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_crew() then raise exception 'Crew sign-in required.'; end if;
  update cart_items set tags = coalesce(p_tags, '{}') where id = p_id and flight_id = p_flight;
end $$;

revoke all on function public.cart_set_tags(text, uuid, text[]) from public;
grant execute on function public.cart_set_tags(text, uuid, text[]) to authenticated;

-- Same as 0012, plus default tags on the standard snacks.
create or replace function public.cart_load_standard(p_flight text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_crew() then raise exception 'Crew sign-in required.'; end if;
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
  perform cart_default_tags(p_flight);
end $$;
