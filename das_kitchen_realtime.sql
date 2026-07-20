-- ============================================================================
-- Das Kitchen — enable live updates (Realtime)
-- Makes new orders appear on the admin screen WITHOUT a refresh, and powers
-- live rider tracking. Run ONCE in Supabase → SQL Editor. Idempotent.
-- ============================================================================

-- The publication Supabase Realtime listens on (create if somehow missing).
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Add our tables to it (guarded so re-running is safe).
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='order_items') then
    alter publication supabase_realtime add table public.order_items;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='delivery_tracking') then
    alter publication supabase_realtime add table public.delivery_tracking;
  end if;
end $$;

-- Full row data on updates too (helps live status changes carry their details).
alter table public.orders replica identity full;

-- Done. Admin dashboard now updates live; rider tracking streams in real time.
