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
