-- ============================================================================
-- Das Kitchen — charge extra per km beyond the free delivery radius
-- Safe to run more than once.
--
-- What this changes:
--   * extra_km_fee   ₹ charged for each km (or part of a km) beyond
--                    delivery_radius_km. 0 = refuse orders outside the radius
--                    (exactly how the site behaves today).
--   * max_delivery_km  A hard cut-off. Even when extra_km_fee is set, we will
--                      not deliver further than this. NULL = no limit.
-- ============================================================================

alter table public.business_settings
  add column if not exists extra_km_fee numeric(8,2) not null default 0;

alter table public.business_settings
  add column if not exists max_delivery_km numeric(6,2);

comment on column public.business_settings.extra_km_fee is
  'Rupees per km (rounded up) beyond delivery_radius_km. 0 = do not deliver outside the radius.';
comment on column public.business_settings.max_delivery_km is
  'Absolute maximum delivery distance in km. NULL = no limit.';

-- Existing behaviour is preserved: 0 means "outside the radius, we say no".
update public.business_settings set extra_km_fee = 0 where extra_km_fee is null;

-- ---------------------------------------------------------------------------
-- Check
-- ---------------------------------------------------------------------------
select
  case when count(*) = 2 then 'OK — extra_km_fee + max_delivery_km exist'
       else 'MISSING — only ' || count(*) || ' of 2 columns' end as check_columns
from information_schema.columns
where table_schema = 'public'
  and table_name = 'business_settings'
  and column_name in ('extra_km_fee', 'max_delivery_km');

select delivery_fee, delivery_radius_km, extra_km_fee, max_delivery_km
from public.business_settings where id = 1;
