-- =============================================================================
-- DAS KITCHEN — UPI payments (QR + UPI ID, no gateway, no KYC, no fees)
-- Run in: Supabase Dashboard > SQL Editor > New query > Run. Safe to re-run.
--
-- HOW THIS WORKS — read this:
--   A UPI QR is just a link that opens the customer's UPI app with your ID and
--   the amount pre-filled. Money lands straight in your account with NO gateway
--   cut. But nothing tells this website the money arrived — so a human (your
--   rider at the door, or you in the admin panel) confirms every payment.
--   `payment_method` records how it was ACTUALLY paid once confirmed.
-- =============================================================================

-- 1. Your UPI details, edited from Admin > Settings.
alter table public.business_settings
  add column if not exists upi_id   text,   -- e.g. daskitchen@okaxis
  add column if not exists upi_name text;   -- payee name shown in the UPI app

-- 2. Allow 'upi' as a payment method (previously only cod / razorpay).
--    Note: Postgres won't let a brand-new enum value be USED in the same
--    transaction that adds it — that's fine, nothing below uses it.
alter type payment_method add value if not exists 'upi';

-- 3. Audit trail: who confirmed the money came in, and when.
alter table public.orders
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists payment_confirmed_by uuid references public.profiles(id) on delete set null;

-- 4. Reporting: quickly split online vs cash over a date range.
create index if not exists idx_orders_payment
  on public.orders (payment_method, payment_status, placed_at);

-- 5. Speeds up the Customers report (orders per customer over a date range).
create index if not exists idx_orders_customer_placed
  on public.orders (customer_id, placed_at desc);

-- =============================================================================
-- CHECKS
-- =============================================================================
select 'upi columns' as check,
       count(*)::text as value,
       case when count(*) = 2 then 'OK' else 'PROBLEM' end as status
  from information_schema.columns
 where table_schema = 'public' and table_name = 'business_settings'
   and column_name in ('upi_id', 'upi_name')
union all
select 'payment_method has upi',
       count(*)::text,
       case when count(*) = 1 then 'OK' else 'PROBLEM' end
  from pg_enum e join pg_type t on t.oid = e.enumtypid
 where t.typname = 'payment_method' and e.enumlabel = 'upi'
union all
select 'payment audit columns',
       count(*)::text,
       case when count(*) = 2 then 'OK' else 'PROBLEM' end
  from information_schema.columns
 where table_schema = 'public' and table_name = 'orders'
   and column_name in ('payment_confirmed_at', 'payment_confirmed_by');

-- =============================================================================
-- NEXT: put your UPI ID in Admin > Settings > Payments. Until then the QR is
-- hidden and everything stays Cash on Delivery.
-- =============================================================================
