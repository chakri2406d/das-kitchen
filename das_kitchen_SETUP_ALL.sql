-- =============================================================================
-- DAS KITCHEN — RUN THIS ONE FILE (everything, in the right order)
--
-- Supabase Dashboard > SQL Editor > New query > paste all of this > Run.
-- Safe to re-run. Takes a few seconds.
--
-- It will:
--   1. Hide rider GPS + coupon codes from strangers
--   2. Stop coupon reuse + enforce daily sell-out caps
--   3. Fix missing delivery OTPs (yours were blank)
--   4. Fix "Confirm delivered" not working  <-- the big one
--   5. Set your kitchen pin, 3 km radius, free delivery
-- =============================================================================



-- ---------------------------------------------------------------------------
-- Make this file safe to re-run: Postgres won't let CREATE OR REPLACE change a
-- function's return type, so clear them out first.
-- ---------------------------------------------------------------------------
drop function if exists public.apply_coupon(text, numeric);
drop function if exists public.redeem_coupon(uuid);
drop function if exists public.items_sold_today(uuid);
drop function if exists public.bump_order_counts(uuid);

-- #############################################################################
-- SECTION: das_kitchen_security_and_coupons.sql
-- #############################################################################
-- =============================================================================
-- DAS KITCHEN — Security hardening + coupon redemption
-- Run this in: Supabase Dashboard > SQL Editor > New query > Run
-- Safe to re-run. No effect on customers' experience — policy/function only.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. RIDERS: stop exposing every rider's live GPS / vehicle to the whole world
-- ----------------------------------------------------------------------------
-- Before: "riders_public_read" allowed SELECT to everyone (using true), and RLS
-- is column-blind — so anonymous visitors could read current_lat/current_lng.
-- After: a rider sees themselves, admins see all, and a customer sees only the
-- rider actually delivering their live order (needed for tracking).
drop policy if exists "riders_public_read" on public.delivery_partners;

drop policy if exists "riders_read_scoped" on public.delivery_partners;
create policy "riders_read_scoped" on public.delivery_partners
  for select using (
    id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.delivery_partner_id = public.delivery_partners.id
        and o.customer_id = auth.uid()
        and o.status in ('ready_for_pickup', 'out_for_delivery')
    )
  );

-- ----------------------------------------------------------------------------
-- 2. COUPONS: stop letting anyone list every active promo code
-- ----------------------------------------------------------------------------
-- Customers no longer read the table directly; they redeem by typing a code,
-- checked by the SECURITY DEFINER function below. Admins keep full access via
-- the existing "coupons_admin_write" policy.
drop policy if exists "coupons_read" on public.coupons;

-- Validates a typed code against a cart subtotal and returns the discount.
-- Always returns exactly one row; `reason` says why it did or didn't apply.
create or replace function public.apply_coupon(p_code text, p_subtotal numeric)
returns table (
  coupon_id    uuid,
  code         text,
  discount     numeric,
  label        text,
  reason       text,
  min_required numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c public.coupons%rowtype;
  d numeric;
begin
  select * into c
  from public.coupons
  where upper(btrim(code)) = upper(btrim(p_code))
  limit 1;

  if not found or not c.is_active then
    return query select null::uuid, null::text, 0::numeric, null::text, 'not_found'::text, null::numeric;
    return;
  end if;

  if c.expiry_date is not null and c.expiry_date < now() then
    return query select null::uuid, c.code, 0::numeric, null::text, 'expired'::text, null::numeric;
    return;
  end if;

  if c.usage_limit is not null and c.used_count >= c.usage_limit then
    return query select null::uuid, c.code, 0::numeric, null::text, 'limit_reached'::text, null::numeric;
    return;
  end if;

  if c.min_order_amount is not null and p_subtotal < c.min_order_amount then
    return query select null::uuid, c.code, 0::numeric, null::text, 'min_order'::text, c.min_order_amount;
    return;
  end if;

  if c.coupon_type = 'percentage' then
    d := p_subtotal * c.discount_value / 100.0;
    if c.max_discount is not null then
      d := least(d, c.max_discount);
    end if;
  else
    d := least(c.discount_value, p_subtotal);
  end if;

  d := round(d);

  if d <= 0 then
    return query select null::uuid, c.code, 0::numeric, null::text, 'no_discount'::text, null::numeric;
    return;
  end if;

  return query select
    c.id,
    c.code,
    d,
    case
      when c.coupon_type = 'percentage'
        then trim(to_char(c.discount_value, 'FM999999990.99')) || '% off'
      else '₹' || trim(to_char(c.discount_value, 'FM999999990.99')) || ' off'
    end,
    'ok'::text,
    c.min_order_amount;
end $$;

grant execute on function public.apply_coupon(text, numeric) to anon, authenticated;

-- Counts a redemption once an order is actually placed (customers can't UPDATE
-- the coupons table directly, so this runs as definer).
create or replace function public.redeem_coupon(p_coupon_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.coupons
     set used_count = used_count + 1
   where id = p_coupon_id;
$$;

grant execute on function public.redeem_coupon(uuid) to authenticated;

-- =============================================================================
-- DONE.
-- =============================================================================

-- #############################################################################
-- SECTION: das_kitchen_business_rules.sql
-- #############################################################################
-- =============================================================================
-- DAS KITCHEN — Business rules (stop giving money away)
-- Run this in: Supabase Dashboard > SQL Editor > New query > Run
-- Safe to re-run.
--
-- Fixes:
--   1. A coupon could be reused by the same customer on every order.
--   2. daily_quantity_limit was never enforced (you could be sold 100 of 20).
--   3. order_count never grew, so "Best Sellers" / specials sorting was dead.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Coupons: allow "one use per customer" (the default for promo codes)
-- ----------------------------------------------------------------------------
alter table public.coupons
  add column if not exists once_per_customer boolean not null default true;

-- Recreate apply_coupon so it also reports the once_per_customer flag.
drop function if exists public.apply_coupon(text, numeric);

create function public.apply_coupon(p_code text, p_subtotal numeric)
returns table (
  coupon_id         uuid,
  code              text,
  discount          numeric,
  label             text,
  reason            text,
  min_required      numeric,
  once_per_customer boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c public.coupons%rowtype;
  d numeric;
begin
  select * into c
  from public.coupons
  where upper(btrim(code)) = upper(btrim(p_code))
  limit 1;

  if not found or not c.is_active then
    return query select null::uuid, null::text, 0::numeric, null::text, 'not_found'::text, null::numeric, true;
    return;
  end if;

  if c.expiry_date is not null and c.expiry_date < now() then
    return query select null::uuid, c.code, 0::numeric, null::text, 'expired'::text, null::numeric, c.once_per_customer;
    return;
  end if;

  if c.usage_limit is not null and c.used_count >= c.usage_limit then
    return query select null::uuid, c.code, 0::numeric, null::text, 'limit_reached'::text, null::numeric, c.once_per_customer;
    return;
  end if;

  if c.min_order_amount is not null and p_subtotal < c.min_order_amount then
    return query select null::uuid, c.code, 0::numeric, null::text, 'min_order'::text, c.min_order_amount, c.once_per_customer;
    return;
  end if;

  if c.coupon_type = 'percentage' then
    d := p_subtotal * c.discount_value / 100.0;
    if c.max_discount is not null then
      d := least(d, c.max_discount);
    end if;
  else
    d := least(c.discount_value, p_subtotal);
  end if;

  d := round(d);

  if d <= 0 then
    return query select null::uuid, c.code, 0::numeric, null::text, 'no_discount'::text, null::numeric, c.once_per_customer;
    return;
  end if;

  return query select
    c.id,
    c.code,
    d,
    case
      when c.coupon_type = 'percentage'
        then trim(to_char(c.discount_value, 'FM999999990.99')) || '% off'
      else '₹' || trim(to_char(c.discount_value, 'FM999999990.99')) || ' off'
    end,
    'ok'::text,
    c.min_order_amount,
    c.once_per_customer;
end $$;

grant execute on function public.apply_coupon(text, numeric) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Daily sell-out cap: how many of an item have gone out today (IST)
-- ----------------------------------------------------------------------------
-- Customers can only read their OWN order_items, so this must run as definer
-- to count across everyone's orders.
create or replace function public.items_sold_today(p_item_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(oi.quantity), 0)::int
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.menu_item_id = p_item_id
     and o.status <> 'cancelled'
     and o.placed_at >= (date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata');
$$;

grant execute on function public.items_sold_today(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Best sellers: grow order_count when an order is placed
-- ----------------------------------------------------------------------------
create or replace function public.bump_order_counts(p_order_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.menu_items m
     set order_count = m.order_count + t.qty
    from (
      select menu_item_id, sum(quantity)::int as qty
        from public.order_items
       where order_id = p_order_id and menu_item_id is not null
       group by menu_item_id
    ) t
   where m.id = t.menu_item_id;
$$;

grant execute on function public.bump_order_counts(uuid) to authenticated;

-- =============================================================================
-- DONE.
-- =============================================================================

-- #############################################################################
-- SECTION: das_kitchen_fix_otp.sql
-- #############################################################################
-- =============================================================================
-- DAS KITCHEN — Repair delivery OTPs
-- Run this in: Supabase Dashboard > SQL Editor > New query > Run
--
-- Why: existing orders were saved with delivery_otp = NULL, so customers saw no
-- OTP and the rider app accepted ANY code. The app now generates the OTP itself,
-- but this (a) rebuilds the safety-net trigger and (b) backfills live orders.
-- Safe to re-run.
-- =============================================================================

-- 1. Rebuild the trigger that auto-fills order_number + a 4-digit OTP.
create or replace function public.before_order_insert()
returns trigger language plpgsql as $$
begin
  if new.order_number is null then
    new.order_number := 'DK-' || to_char(now(), 'YYYYMMDD') || '-' ||
                        lpad(floor(random() * 10000)::text, 4, '0');
  end if;
  if new.delivery_otp is null then
    new.delivery_otp := lpad(floor(random() * 10000)::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_before_order_insert on public.orders;
create trigger trg_before_order_insert
  before insert on public.orders
  for each row execute function public.before_order_insert();

-- 2. Backfill any live order that is missing its OTP.
update public.orders
   set delivery_otp = lpad(floor(random() * 10000)::text, 4, '0')
 where delivery_otp is null
   and status not in ('delivered', 'cancelled');

-- 3. Check: this should return 0 rows.
select id, order_number, status, delivery_otp
  from public.orders
 where delivery_otp is null
   and status not in ('delivered', 'cancelled');

-- =============================================================================
-- DONE.
-- =============================================================================

-- #############################################################################
-- SECTION: das_kitchen_fix_rider_permissions.sql
-- #############################################################################
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

-- #############################################################################
-- SECTION: das_kitchen_location.sql
-- #############################################################################
-- =============================================================================
-- DAS KITCHEN — Set the kitchen location
-- Run this in: Supabase Dashboard > SQL Editor > New query > Run
--
-- Powers the "X km from the kitchen" badge on every admin order and the
-- delivery-radius check at checkout. Safe to re-run.
-- =============================================================================

update public.business_settings
   set kitchen_lat     = 17.475057,
       kitchen_lng     = 78.480377,
       kitchen_address = 'Old Bowenpally, near Greenwood High School, Bowenpally, Hyderabad',
       delivery_radius_km = 3,     -- matches "Free delivery within 3 KM"
       delivery_fee       = 0
 where id = 1;

-- Check: should show your kitchen pinned in Old Bowenpally.
select kitchen_lat, kitchen_lng, delivery_radius_km, delivery_fee, kitchen_address
  from public.business_settings
 where id = 1;

-- =============================================================================
-- DONE.
-- =============================================================================

-- =============================================================================
-- FINAL CHECK — all three rows below should look right.
-- =============================================================================
select 'kitchen'  as check, kitchen_lat::text, kitchen_lng::text, delivery_radius_km::text
  from public.business_settings where id = 1
union all
select 'orders missing OTP (should be 0)', count(*)::text, '', ''
  from public.orders where delivery_otp is null and status not in ('delivered','cancelled')
union all
select 'rider update policy (should be 1)', count(*)::text, '', ''
  from pg_policies where tablename = 'orders' and policyname = 'orders_rider_update';
