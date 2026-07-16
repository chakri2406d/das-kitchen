-- =============================================================================
-- DAS KITCHEN — Data retention (keeps you on the free plan for years)
-- Run in: Supabase Dashboard > SQL Editor > New query > Run. Safe to re-run.
--
-- WHAT IS KEPT FOREVER (your business history — small and valuable):
--   orders, order_items, profiles, coupons, reviews, addresses, payments
--   ~10 MB per year at 20 orders/day. 500 MB lasts decades.
--
-- WHAT IS TRIMMED (worthless once the food arrives):
--   delivery_tracking — one GPS row every 20s per delivery. Left alone it grows
--   ~100 MB/year forever. Kept at 90 days it sits at a flat ~20 MB.
--   90 days is deliberately generous: long enough to settle any delivery
--   dispute, short enough to never threaten the free plan.
-- =============================================================================

-- 1. Index so the nightly delete is instant even with millions of rows.
create index if not exists idx_tracking_recorded_at
  on public.delivery_tracking (recorded_at);

-- 2. The cleanup itself. Returns how many rows it removed.
create or replace function public.prune_delivery_tracking(p_keep_days int default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.delivery_tracking
   where recorded_at < now() - make_interval(days => greatest(1, p_keep_days));
  get diagnostics removed = row_count;
  return removed;
end $$;

revoke all on function public.prune_delivery_tracking(int) from anon, authenticated;

-- 3. Run it automatically every night at 03:30 IST (22:00 UTC — a dead hour).
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('prune-delivery-tracking');
exception when others then
  null; -- wasn't scheduled yet, fine
end $$;

select cron.schedule(
  'prune-delivery-tracking',
  '0 22 * * *',
  $$ select public.prune_delivery_tracking(90); $$
);

-- =============================================================================
-- CHECKS
-- =============================================================================

-- Is the nightly job registered?
select jobname, schedule, active from cron.job where jobname = 'prune-delivery-tracking';

-- How big is everything right now? (watch this occasionally)
select
  relname as table_name,
  pg_size_pretty(pg_total_relation_size(c.oid)) as size,
  to_char(c.reltuples::bigint, 'FM999,999,999') as approx_rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by pg_total_relation_size(c.oid) desc
limit 10;

-- Total database size vs the 500 MB free limit.
select pg_size_pretty(pg_database_size(current_database())) as database_size,
       '500 MB' as free_plan_limit;

-- =============================================================================
-- DONE. To trim harder later (e.g. 30 days): select public.prune_delivery_tracking(30);
-- =============================================================================
