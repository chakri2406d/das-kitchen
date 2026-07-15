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
