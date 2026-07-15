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
