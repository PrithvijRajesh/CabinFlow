-- Plain drinks: no ice / cream / sugar options (hot chocolate, milk, wine).
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- snack_pick_save already stores no options for anything not hot or cold.

alter table public.cart_items drop constraint if exists cart_items_serve_check;
alter table public.cart_items add constraint cart_items_serve_check
  check (serve in ('hot', 'cold', 'plain'));
