-- =============================================================================
-- DAS KITCHEN — CHECK (read-only, changes nothing, run anytime)
-- Paste into Supabase > SQL Editor > Run. All 5 rows should say OK.
-- =============================================================================
select 'Kitchen location' as check,
       coalesce(kitchen_lat::text, 'NOT SET') || ', ' || coalesce(kitchen_lng::text, 'NOT SET')
         || '  (radius ' || coalesce(delivery_radius_km::text, '-') || ' km, fee ' || coalesce(delivery_fee::text, '-') || ')' as value,
       case when kitchen_lat is not null then 'OK' else 'MISSING' end as status
  from public.business_settings where id = 1

union all
select 'Orders missing OTP', count(*)::text,
       case when count(*) = 0 then 'OK' else 'PROBLEM' end
  from public.orders
 where delivery_otp is null and status not in ('delivered', 'cancelled')

union all
select 'Rider can mark delivered', count(*)::text,
       case when count(*) = 1 then 'OK' else 'PROBLEM' end
  from pg_policies
 where tablename = 'orders' and policyname = 'orders_rider_update'

union all
select 'Coupon one-per-customer', count(*)::text,
       case when count(*) = 1 then 'OK' else 'PROBLEM' end
  from information_schema.columns
 where table_schema = 'public' and table_name = 'coupons' and column_name = 'once_per_customer'

union all
select 'Coupon + daily-cap functions', count(*)::text,
       case when count(*) = 4 then 'OK' else 'PROBLEM' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('apply_coupon', 'redeem_coupon', 'items_sold_today', 'bump_order_counts');
