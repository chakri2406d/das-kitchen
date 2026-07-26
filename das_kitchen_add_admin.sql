-- ============================================================================
-- Das Kitchen — make the owner + chakradhar admins
--
-- IMPORTANT: each account must SIGN IN to the site at least once first
-- (Continue with Google is fine). Signing in creates its profile row — without
-- one, this update matches nothing and silently does nothing for that email.
--
-- Run in Supabase → SQL Editor.
-- ============================================================================

update public.profiles
set role = 'admin'
where lower(email) in (
  lower('daskitchen03@gmail.com'),
  lower('chakradharvinnakota99@gmail.com')
);

-- ---- Verify -----------------------------------------------------------------
-- 1. Did it land? You should see a row (role = admin) for each that has signed in.
select email, role, created_at
from public.profiles
where lower(email) in (
  lower('daskitchen03@gmail.com'),
  lower('chakradharvinnakota99@gmail.com')
);

-- 2. Everyone who is currently an admin:
select email, role
from public.profiles
where role = 'admin'
order by created_at;
