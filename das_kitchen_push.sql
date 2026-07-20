-- ============================================================================
-- Das Kitchen — push notification subscriptions
-- Stores each device that should be alerted when a new order arrives.
-- Run ONCE in Supabase → SQL Editor. Idempotent.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- A person may only manage their own devices. The server uses the service-role
-- key to read them all when an order needs to go out.
drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Done.
