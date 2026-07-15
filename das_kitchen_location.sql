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
