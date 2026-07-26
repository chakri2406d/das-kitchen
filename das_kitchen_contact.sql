-- ============================================================================
-- Das Kitchen — set the live business contact details.
-- Run ONCE in Supabase → SQL Editor. (You can also change these any time in
-- the app under Admin → Settings.)
-- ============================================================================

update public.business_settings
set phone    = '8008885266',
    whatsapp = '918008885266',          -- country code, no "+" (wa.me format)
    email    = 'daskitchen03@gmail.com'
where id = 1;

-- Verify:
select phone, whatsapp, email from public.business_settings where id = 1;
