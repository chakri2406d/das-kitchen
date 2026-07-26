-- ============================================================================
-- Das Kitchen — Security hardening (guard rails)
-- Run ONCE in Supabase → SQL Editor. Safe & idempotent.
--
-- These are ADDITIVE guards. They block malicious writes coming straight from
-- a customer's/rider's browser (which talks to the DB with the public key), but
-- they do NOT change any legitimate flow:
--   • placeOrder already inserts orders as pending/unpaid  -> unaffected
--   • admin actions run as an admin (is_admin() = true)     -> allowed
--   • the assigned rider updates their own order            -> allowed
--   • SQL-editor / service-role scripts (auth.uid() is null) -> allowed
-- Every guard only fires for a logged-in NON-admin acting outside their lane.
-- ============================================================================

-- ── #1  Stop a customer promoting themselves to admin ───────────────────────
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and new.role is distinct from old.role then
    new.role := old.role;            -- silently keep the real role
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();


-- ── #2  Stop a customer forging order money / status ────────────────────────
-- On INSERT: force a customer's new order to be pending & unpaid, with no rider
-- and no payment confirmation (exactly what placeOrder already does).
create or replace function public.guard_order_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.payment_status       := 'pending';
    new.status               := 'pending';
    new.delivery_partner_id  := null;
    new.payment_confirmed_by := null;
    new.payment_confirmed_at := null;
    new.accepted_at          := null;
    new.delivered_at         := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_order_insert on public.orders;
create trigger trg_guard_order_insert
  before insert on public.orders
  for each row execute function public.guard_order_insert();

-- On UPDATE: a customer (anyone who is neither admin nor the order's assigned
-- rider) cannot change money, status, OTP, or the rider — those revert.
create or replace function public.guard_order_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and not public.is_admin()
     and old.delivery_partner_id is distinct from auth.uid() then
    new.payment_status       := old.payment_status;
    new.status               := old.status;
    new.total                := old.total;
    new.subtotal             := old.subtotal;
    new.discount             := old.discount;
    new.delivery_fee         := old.delivery_fee;
    new.delivery_otp         := old.delivery_otp;
    new.delivery_partner_id  := old.delivery_partner_id;
    new.payment_confirmed_by := old.payment_confirmed_by;
    new.payment_confirmed_at := old.payment_confirmed_at;
    new.accepted_at          := old.accepted_at;
    new.delivered_at         := old.delivered_at;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_order_update on public.orders;
create trigger trg_guard_order_update
  before update on public.orders
  for each row execute function public.guard_order_update();


-- ── #5  Stop a rider self-approving (setting is_verified) ────────────────────
create or replace function public.guard_rider_verify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and new.is_verified is distinct from old.is_verified then
    new.is_verified := old.is_verified;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_rider_verify on public.delivery_partners;
create trigger trg_guard_rider_verify
  before update on public.delivery_partners
  for each row execute function public.guard_rider_verify();


-- ── #10  Stop a customer self-approving their own review ────────────────────
create or replace function public.guard_review_approve()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.is_approved := false;
    else
      new.is_approved := old.is_approved;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_review_approve on public.reviews;
create trigger trg_guard_review_approve
  before insert or update on public.reviews
  for each row execute function public.guard_review_approve();


-- ── #7  Reject negative / zero quantities (data integrity) ──────────────────
-- NOT VALID = enforced on all new writes but does not re-scan existing rows,
-- so this can never fail on data already in the table.
do $$ begin
  alter table public.cart_items
    add constraint cart_items_qty_positive check (quantity > 0) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.order_items
    add constraint order_items_qty_positive check (quantity > 0) not valid;
exception when duplicate_object then null; end $$;


-- ── Done. Quick check that the guards are installed: ────────────────────────
select tgname
from pg_trigger
where tgname in (
  'trg_guard_profile_role','trg_guard_order_insert','trg_guard_order_update',
  'trg_guard_rider_verify','trg_guard_review_approve'
)
order by tgname;
