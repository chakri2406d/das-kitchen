-- =============================================================================
-- DAS KITCHEN — Repair delivery-partner write permissions
-- Run this in: Supabase Dashboard > SQL Editor > New query > Run
--
-- Why: riders could READ their assigned orders but their UPDATE was being
-- rejected by row-level security. Postgres does not error on this — it just
-- updates 0 rows — so "Confirm delivered" appeared to succeed while the order
-- stayed "out for delivery". This recreates the policies with an explicit
-- WITH CHECK. Safe to re-run.
-- =============================================================================

-- Rider: read the orders assigned to them
drop policy if exists "orders_rider" on public.orders;
create policy "orders_rider" on public.orders
  for select using (delivery_partner_id = auth.uid());

-- Rider: update the orders assigned to them (start delivery / mark delivered)
drop policy if exists "orders_rider_update" on public.orders;
create policy "orders_rider_update" on public.orders
  for update
  using (delivery_partner_id = auth.uid())
  with check (delivery_partner_id = auth.uid());

-- Rider: maintain their own rider record (status, delivery count, GPS)
drop policy if exists "riders_self" on public.delivery_partners;
create policy "riders_self" on public.delivery_partners
  for all
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Rider: write GPS pings for their own deliveries (live tracking)
drop policy if exists "tracking_rider_write" on public.delivery_tracking;
create policy "tracking_rider_write" on public.delivery_tracking
  for insert with check (delivery_partner_id = auth.uid());

-- Make sure RLS is actually switched on for these tables.
alter table public.orders             enable row level security;
alter table public.delivery_partners  enable row level security;
alter table public.delivery_tracking  enable row level security;

-- Check: you should see orders_rider (SELECT) and orders_rider_update (UPDATE).
select policyname, cmd, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename = 'orders'
 order by policyname;

-- =============================================================================
-- DONE.
-- =============================================================================
