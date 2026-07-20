-- ============================================================================
-- Das Kitchen — schema UPGRADE
-- Brings the database in line with the current app code (checkout, coupons,
-- UPI payment, delivery pricing, admin order confirmation).
-- Run ONCE in Supabase → SQL Editor. Safe to re-run (idempotent).
-- ============================================================================

-- 1. New payment method: UPI --------------------------------------------------
alter type payment_method add value if not exists 'upi';

-- 2. New columns --------------------------------------------------------------
alter table public.coupons
  add column if not exists once_per_customer boolean not null default true;

alter table public.orders
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists payment_confirmed_by uuid references public.profiles(id) on delete set null;

alter table public.business_settings
  add column if not exists upi_id text,
  add column if not exists upi_name text,
  add column if not exists extra_km_fee numeric(10,2) default 0,
  add column if not exists max_delivery_km numeric(6,2);

-- 3. Functions the app calls via supabase.rpc(...) ---------------------------

-- How many of a menu item have sold today (non-cancelled orders).
create or replace function public.items_sold_today(p_item_id uuid)
returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(oi.quantity), 0)::int
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.menu_item_id = p_item_id
    and o.status <> 'cancelled'
    and o.placed_at >= date_trunc('day', now());
$$;

-- Increment each ordered item's popularity counter (powers best-sellers).
create or replace function public.bump_order_counts(p_order_id uuid)
returns void
language sql security definer set search_path = public as $$
  update public.menu_items m
  set order_count = m.order_count + agg.qty
  from (
    select menu_item_id, sum(quantity) as qty
    from public.order_items
    where order_id = p_order_id and menu_item_id is not null
    group by menu_item_id
  ) agg
  where m.id = agg.menu_item_id;
$$;

-- Mark a coupon as used one more time.
create or replace function public.redeem_coupon(p_coupon_id uuid)
returns void
language sql security definer set search_path = public as $$
  update public.coupons set used_count = used_count + 1 where id = p_coupon_id;
$$;

-- Validate a coupon against a subtotal and return the discount (or a reason).
create or replace function public.apply_coupon(p_code text, p_subtotal numeric)
returns table (
  coupon_id uuid,
  code text,
  discount numeric,
  label text,
  reason text,
  min_required numeric,
  once_per_customer boolean
)
language plpgsql stable security definer set search_path = public as $$
declare
  c public.coupons%rowtype;
  d numeric := 0;
  lbl text;
begin
  select cp.* into c
  from public.coupons cp
  where lower(cp.code) = lower(trim(p_code)) and cp.is_active = true
  limit 1;

  if not found then
    return query select null::uuid, p_code, 0::numeric, null::text, 'not_found'::text, null::numeric, false;
    return;
  end if;

  if c.expiry_date is not null and c.expiry_date < now() then
    return query select c.id, c.code, 0::numeric, null::text, 'expired'::text, c.min_order_amount, c.once_per_customer;
    return;
  end if;

  if c.usage_limit is not null and c.used_count >= c.usage_limit then
    return query select c.id, c.code, 0::numeric, null::text, 'limit_reached'::text, c.min_order_amount, c.once_per_customer;
    return;
  end if;

  if c.min_order_amount is not null and p_subtotal < c.min_order_amount then
    return query select c.id, c.code, 0::numeric, null::text, 'min_order'::text, c.min_order_amount, c.once_per_customer;
    return;
  end if;

  if c.coupon_type = 'percentage' then
    d := p_subtotal * c.discount_value / 100.0;
    if c.max_discount is not null and d > c.max_discount then
      d := c.max_discount;
    end if;
    lbl := round(c.discount_value) || '% off';
  else
    d := c.discount_value;
    lbl := '₹' || round(c.discount_value) || ' off';
  end if;

  if d > p_subtotal then d := p_subtotal; end if;

  if d <= 0 then
    return query select c.id, c.code, 0::numeric, null::text, 'no_discount'::text, c.min_order_amount, c.once_per_customer;
    return;
  end if;

  return query select c.id, c.code, round(d, 2), lbl, 'ok'::text, c.min_order_amount, c.once_per_customer;
end $$;

-- 4. Let the API roles call these functions ----------------------------------
grant execute on function public.items_sold_today(uuid) to anon, authenticated;
grant execute on function public.bump_order_counts(uuid) to anon, authenticated;
grant execute on function public.redeem_coupon(uuid) to anon, authenticated;
grant execute on function public.apply_coupon(text, numeric) to anon, authenticated;

-- ============================================================================
-- Done. Checkout, coupons, UPI, and admin payment confirmation now work.
-- ============================================================================
