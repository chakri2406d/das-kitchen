-- ============================================================================
-- Das Kitchen — full database setup
-- Reconstructed from src/types/database.ts. Run this ONCE in the Supabase
-- dashboard → SQL Editor (paste all, click Run). It creates every table,
-- security policies, and seeds the real Das Kitchen menu.
-- Safe to re-run: it drops and recreates the menu seed each time.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role         as enum ('customer','admin','delivery_partner');
exception when duplicate_object then null; end $$;
do $$ begin
  create type order_status      as enum ('pending','accepted','preparing','ready_for_pickup','out_for_delivery','delivered','cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type payment_method    as enum ('cod','razorpay');
exception when duplicate_object then null; end $$;
do $$ begin
  create type payment_status    as enum ('pending','paid','failed','refunded');
exception when duplicate_object then null; end $$;
do $$ begin
  create type food_type         as enum ('veg','non_veg','egg');
exception when duplicate_object then null; end $$;
do $$ begin
  create type business_status   as enum ('open','closed','busy');
exception when duplicate_object then null; end $$;
do $$ begin
  create type coupon_type       as enum ('percentage','flat');
exception when duplicate_object then null; end $$;
do $$ begin
  create type vehicle_type      as enum ('bike','scooter','bicycle','car');
exception when duplicate_object then null; end $$;
do $$ begin
  create type rider_status      as enum ('available','busy','offline');
exception when duplicate_object then null; end $$;
do $$ begin
  create type notification_type as enum ('order_confirmed','order_accepted','preparing','out_for_delivery','delivered','cancelled','general');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Helper: updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  phone       text,
  avatar_url  text,
  role        user_role not null default 'customer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.delivery_partners (
  id               uuid primary key references public.profiles(id) on delete cascade,
  vehicle_type     vehicle_type not null default 'bike',
  vehicle_number   text,
  status           rider_status not null default 'offline',
  current_lat      double precision,
  current_lng      double precision,
  is_verified      boolean not null default false,
  total_deliveries integer not null default 0,
  rating           numeric(2,1) not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.addresses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  label        text,
  house_number text,
  street       text,
  landmark     text,
  area         text,
  city         text,
  state        text,
  pincode      text,
  latitude     double precision,
  longitude    double precision,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.categories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  image_url     text,
  display_order integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.menu_items (
  id                   uuid primary key default gen_random_uuid(),
  category_id          uuid references public.categories(id) on delete set null,
  name                 text not null,
  description          text,
  price                numeric(10,2) not null,
  image_url            text,
  food_type            food_type not null default 'veg',
  is_available         boolean not null default true,
  is_special           boolean not null default false,
  daily_quantity_limit integer,
  prep_time_minutes    integer not null default 20,
  order_count          integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.cart_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  quantity     integer not null default 1,
  created_at   timestamptz not null default now(),
  unique (user_id, menu_item_id)
);

create table if not exists public.coupons (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  coupon_type      coupon_type not null,
  discount_value   numeric(10,2) not null,
  min_order_amount numeric(10,2),
  max_discount     numeric(10,2),
  expiry_date      timestamptz,
  usage_limit      integer,
  used_count       integer not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

create table if not exists public.orders (
  id                     uuid primary key default gen_random_uuid(),
  order_number           text unique,
  customer_id            uuid not null references public.profiles(id) on delete cascade,
  delivery_partner_id    uuid references public.profiles(id) on delete set null,
  status                 order_status not null default 'pending',
  subtotal               numeric(10,2) not null default 0,
  discount               numeric(10,2) not null default 0,
  delivery_fee           numeric(10,2) not null default 0,
  total                  numeric(10,2) not null default 0,
  coupon_id              uuid references public.coupons(id) on delete set null,
  payment_method         payment_method not null default 'cod',
  payment_status         payment_status not null default 'pending',
  delivery_otp           text,
  delivery_notes         text,
  customer_lat           double precision,
  customer_lng           double precision,
  delivery_address       jsonb,
  estimated_delivery_time timestamptz,
  placed_at              timestamptz not null default now(),
  accepted_at            timestamptz,
  delivered_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  item_name    text not null,
  item_price   numeric(10,2) not null,
  quantity     integer not null,
  subtotal     numeric(10,2) not null
);

create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders(id) on delete cascade,
  razorpay_order_id   text,
  razorpay_payment_id text,
  razorpay_signature  text,
  amount              numeric(10,2) not null,
  method              payment_method not null default 'razorpay',
  status              payment_status not null default 'pending',
  created_at          timestamptz not null default now()
);

create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid references public.orders(id) on delete set null,
  customer_id  uuid not null references public.profiles(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  rating       integer not null check (rating between 1 and 5),
  comment      text,
  is_approved  boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  order_id   uuid references public.orders(id) on delete set null,
  type       notification_type not null default 'general',
  title      text not null,
  message    text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_tracking (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders(id) on delete cascade,
  delivery_partner_id uuid not null references public.profiles(id) on delete cascade,
  latitude            double precision not null,
  longitude           double precision not null,
  recorded_at         timestamptz not null default now()
);

create table if not exists public.business_settings (
  id                 integer primary key default 1 check (id = 1),
  status             business_status not null default 'open',
  is_accepting_orders boolean not null default true,
  min_order_amount   numeric(10,2) default 0,
  delivery_fee       numeric(10,2) default 0,
  delivery_radius_km numeric(6,2) default 5,
  kitchen_lat        double precision,
  kitchen_lng        double precision,
  kitchen_address    text,
  phone              text,
  whatsapp           text,
  email              text,
  fssai_license      text,
  open_time          text,
  close_time         text,
  updated_at         timestamptz not null default now()
);

-- updated_at triggers
drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
drop trigger if exists trg_menu_items_updated on public.menu_items;
create trigger trg_menu_items_updated before update on public.menu_items
  for each row execute function public.set_updated_at();
drop trigger if exists trg_orders_updated on public.orders;
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.set_updated_at();
drop trigger if exists trg_business_updated on public.business_settings;
create trigger trg_business_updated before update on public.business_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Auto-create a profile row when a user signs up
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 5. Admin helper (SECURITY DEFINER avoids RLS recursion on profiles)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.delivery_partners enable row level security;
alter table public.addresses         enable row level security;
alter table public.categories        enable row level security;
alter table public.menu_items        enable row level security;
alter table public.cart_items        enable row level security;
alter table public.coupons           enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.payments          enable row level security;
alter table public.reviews           enable row level security;
alter table public.notifications     enable row level security;
alter table public.delivery_tracking enable row level security;
alter table public.business_settings enable row level security;

-- profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select
  using (auth.uid() = id or public.is_admin());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update
  using (auth.uid() = id or public.is_admin());

-- categories (public read of active; admin full)
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select
  using (is_active or public.is_admin());
drop policy if exists categories_admin on public.categories;
create policy categories_admin on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

-- menu_items (public read of available; admin full)
drop policy if exists menu_read on public.menu_items;
create policy menu_read on public.menu_items for select
  using (is_available or public.is_admin());
drop policy if exists menu_admin on public.menu_items;
create policy menu_admin on public.menu_items for all
  using (public.is_admin()) with check (public.is_admin());

-- business_settings (public read; admin write)
drop policy if exists business_read on public.business_settings;
create policy business_read on public.business_settings for select using (true);
drop policy if exists business_admin on public.business_settings;
create policy business_admin on public.business_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- coupons (public can read active ones; admin full)
drop policy if exists coupons_read on public.coupons;
create policy coupons_read on public.coupons for select
  using (is_active or public.is_admin());
drop policy if exists coupons_admin on public.coupons;
create policy coupons_admin on public.coupons for all
  using (public.is_admin()) with check (public.is_admin());

-- addresses (owner only)
drop policy if exists addresses_own on public.addresses;
create policy addresses_own on public.addresses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- cart_items (owner only)
drop policy if exists cart_own on public.cart_items;
create policy cart_own on public.cart_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- delivery_partners (own row; admin full)
drop policy if exists dp_own on public.delivery_partners;
create policy dp_own on public.delivery_partners for all
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- orders (customer owns; assigned rider reads; admin full)
drop policy if exists orders_customer on public.orders;
create policy orders_customer on public.orders for all
  using (auth.uid() = customer_id or public.is_admin())
  with check (auth.uid() = customer_id or public.is_admin());
drop policy if exists orders_rider_read on public.orders;
create policy orders_rider_read on public.orders for select
  using (auth.uid() = delivery_partner_id);

-- order_items (via parent order)
drop policy if exists order_items_access on public.order_items;
create policy order_items_access on public.order_items for all
  using (exists (select 1 from public.orders o where o.id = order_id
         and (o.customer_id = auth.uid() or o.delivery_partner_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.orders o where o.id = order_id
         and (o.customer_id = auth.uid() or public.is_admin())));

-- payments (via parent order)
drop policy if exists payments_access on public.payments;
create policy payments_access on public.payments for all
  using (exists (select 1 from public.orders o where o.id = order_id
         and (o.customer_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.orders o where o.id = order_id
         and (o.customer_id = auth.uid() or public.is_admin())));

-- reviews (public reads approved; author manages own)
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select
  using (is_approved or auth.uid() = customer_id or public.is_admin());
drop policy if exists reviews_own on public.reviews;
create policy reviews_own on public.reviews for all
  using (auth.uid() = customer_id or public.is_admin())
  with check (auth.uid() = customer_id);

-- notifications (owner only)
drop policy if exists notif_own on public.notifications;
create policy notif_own on public.notifications for all
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- delivery_tracking (assigned rider writes; order customer + rider + admin read)
drop policy if exists tracking_read on public.delivery_tracking;
create policy tracking_read on public.delivery_tracking for select
  using (auth.uid() = delivery_partner_id or public.is_admin()
         or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));
drop policy if exists tracking_write on public.delivery_tracking;
create policy tracking_write on public.delivery_tracking for insert
  with check (auth.uid() = delivery_partner_id or public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. Business settings singleton
-- ---------------------------------------------------------------------------
insert into public.business_settings (id, status, whatsapp, phone)
values (1, 'open', '917989050925', '7989050925')
on conflict (id) do nothing;

-- ============================================================================
-- 8. MENU SEED  (categories + items from the Das Kitchen menu card)
--    Re-runnable: clears existing menu first.
-- ============================================================================
delete from public.menu_items;
delete from public.categories;

insert into public.categories (name, slug, display_order) values
  ('Veg Starters',           'veg-starters',           1),
  ('Non-Veg Starters',       'non-veg-starters',       2),
  ('Veg Soup',               'veg-soup',               3),
  ('Non-Veg Soup',           'non-veg-soup',           4),
  ('Veg Rice',               'veg-rice',               5),
  ('Non-Veg Rice',           'non-veg-rice',           6),
  ('Veg Noodles',            'veg-noodles',            7),
  ('Non-Veg Noodles',        'non-veg-noodles',        8),
  ('Indian Veg Curries',     'indian-veg-curries',     9),
  ('Indian Non-Veg Curries', 'indian-non-veg-curries', 10),
  ('Seafood',                'seafood',                11),
  ('Biryani',                'biryani',                12),
  ('Das Kitchen Special',    'das-kitchen-special',    13);

-- helper macro pattern: (select id from public.categories where slug = '...')

-- ---- VEG STARTERS (veg) ----
insert into public.menu_items (category_id, name, price, food_type) values
((select id from public.categories where slug='veg-starters'),'Veg Manchurian (Half)',100,'veg'),
((select id from public.categories where slug='veg-starters'),'Veg Manchurian (Full)',150,'veg'),
((select id from public.categories where slug='veg-starters'),'Crispy Corn (Half)',100,'veg'),
((select id from public.categories where slug='veg-starters'),'Crispy Corn (Full)',150,'veg'),
((select id from public.categories where slug='veg-starters'),'Paneer Manchurian (Half)',100,'veg'),
((select id from public.categories where slug='veg-starters'),'Paneer Manchurian (Full)',150,'veg'),
((select id from public.categories where slug='veg-starters'),'Chilli Paneer (Half)',130,'veg'),
((select id from public.categories where slug='veg-starters'),'Chilli Paneer (Full)',180,'veg'),
((select id from public.categories where slug='veg-starters'),'Veg 65 (Half)',130,'veg'),
((select id from public.categories where slug='veg-starters'),'Veg 65 (Full)',180,'veg'),
((select id from public.categories where slug='veg-starters'),'Paneer 65 (Half)',130,'veg'),
((select id from public.categories where slug='veg-starters'),'Paneer 65 (Full)',180,'veg'),
((select id from public.categories where slug='veg-starters'),'Mushroom 65 (Half)',130,'veg'),
((select id from public.categories where slug='veg-starters'),'Mushroom 65 (Full)',180,'veg'),
((select id from public.categories where slug='veg-starters'),'Mushroom Kaju Fry (Half)',130,'veg'),
((select id from public.categories where slug='veg-starters'),'Mushroom Kaju Fry (Full)',180,'veg'),
((select id from public.categories where slug='veg-starters'),'Mushroom Chilli (Half)',130,'veg'),
((select id from public.categories where slug='veg-starters'),'Mushroom Chilli (Full)',180,'veg'),
((select id from public.categories where slug='veg-starters'),'Baby Corn (Half)',130,'veg'),
((select id from public.categories where slug='veg-starters'),'Baby Corn (Full)',180,'veg'),
((select id from public.categories where slug='veg-starters'),'Chilli Baby Corn (Half)',150,'veg'),
((select id from public.categories where slug='veg-starters'),'Chilli Baby Corn (Full)',200,'veg');

-- ---- NON-VEG STARTERS (non_veg) ----
insert into public.menu_items (category_id, name, price, food_type) values
((select id from public.categories where slug='non-veg-starters'),'Chicken 65 (Half)',140,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Chicken 65 (Full)',220,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Chicken Manchuria (Half)',140,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Chicken Manchuria (Full)',220,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Chilli Chicken (Half)',140,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Chilli Chicken (Full)',220,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Ginger Chicken (Half)',140,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Ginger Chicken (Full)',220,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Dragon Chicken (Half)',150,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Dragon Chicken (Full)',240,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Pepper Chicken (Half)',150,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Pepper Chicken (Full)',240,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Chicken Majestic (Half)',150,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Chicken Majestic (Full)',240,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Chicken 555 (Half)',150,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Chicken 555 (Full)',240,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Chicken Pakoda (Half)',150,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Chicken Pakoda (Full)',240,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Chicken Lollipop (6 pcs)',150,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Chicken Lollipop (10 pcs)',250,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Chicken Drumstick (6 pcs)',150,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Chicken Drumstick (10 pcs)',250,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Lemon Chicken (Half)',150,'non_veg'),
((select id from public.categories where slug='non-veg-starters'),'Lemon Chicken (Full)',240,'non_veg');

-- ---- VEG SOUP (veg, single price 110) ----
insert into public.menu_items (category_id, name, price, food_type) values
((select id from public.categories where slug='veg-soup'),'Tomato Soup',110,'veg'),
((select id from public.categories where slug='veg-soup'),'Manchow Soup',110,'veg'),
((select id from public.categories where slug='veg-soup'),'Hot & Sour Soup',110,'veg'),
((select id from public.categories where slug='veg-soup'),'Veg Noodle Soup',110,'veg'),
((select id from public.categories where slug='veg-soup'),'Sweet Corn Soup',110,'veg');

-- ---- NON-VEG SOUP (non_veg, single price 130) ----
insert into public.menu_items (category_id, name, price, food_type) values
((select id from public.categories where slug='non-veg-soup'),'Chicken Manchow Soup',130,'non_veg'),
((select id from public.categories where slug='non-veg-soup'),'Chicken Hot & Sour Soup',130,'non_veg'),
((select id from public.categories where slug='non-veg-soup'),'Chicken Noodles Soup',130,'non_veg'),
((select id from public.categories where slug='non-veg-soup'),'Chicken Corn Soup',130,'non_veg'),
((select id from public.categories where slug='non-veg-soup'),'Chicken Lemon Coriander Soup',130,'non_veg');

-- ---- VEG RICE (veg) ----
insert into public.menu_items (category_id, name, price, food_type) values
((select id from public.categories where slug='veg-rice'),'Veg Fried Rice (Half)',90,'veg'),
((select id from public.categories where slug='veg-rice'),'Veg Fried Rice (Full)',130,'veg'),
((select id from public.categories where slug='veg-rice'),'Veg Schezwan Fried Rice (Half)',100,'veg'),
((select id from public.categories where slug='veg-rice'),'Veg Schezwan Fried Rice (Full)',140,'veg'),
((select id from public.categories where slug='veg-rice'),'Veg Schezwan Manchurian Fried Rice (Half)',110,'veg'),
((select id from public.categories where slug='veg-rice'),'Veg Schezwan Manchurian Fried Rice (Full)',160,'veg'),
((select id from public.categories where slug='veg-rice'),'Chilli Garlic Fried Rice (Half)',120,'veg'),
((select id from public.categories where slug='veg-rice'),'Chilli Garlic Fried Rice (Full)',180,'veg'),
((select id from public.categories where slug='veg-rice'),'Veg Manchurian Fried Rice (Half)',120,'veg'),
((select id from public.categories where slug='veg-rice'),'Veg Manchurian Fried Rice (Full)',180,'veg'),
((select id from public.categories where slug='veg-rice'),'Paneer Fried Rice (Half)',120,'veg'),
((select id from public.categories where slug='veg-rice'),'Paneer Fried Rice (Full)',180,'veg'),
((select id from public.categories where slug='veg-rice'),'Paneer Schezwan Fried Rice (Half)',120,'veg'),
((select id from public.categories where slug='veg-rice'),'Paneer Schezwan Fried Rice (Full)',180,'veg'),
((select id from public.categories where slug='veg-rice'),'Veg Mushroom Fried Rice (Half)',120,'veg'),
((select id from public.categories where slug='veg-rice'),'Veg Mushroom Fried Rice (Full)',180,'veg'),
((select id from public.categories where slug='veg-rice'),'Veg Mushroom Schezwan Fried Rice (Half)',120,'veg'),
((select id from public.categories where slug='veg-rice'),'Veg Mushroom Schezwan Fried Rice (Full)',180,'veg'),
((select id from public.categories where slug='veg-rice'),'Jeera Rice (Half)',160,'veg'),
((select id from public.categories where slug='veg-rice'),'Jeera Rice (Full)',220,'veg'),
((select id from public.categories where slug='veg-rice'),'Kaju Rice (Half)',100,'veg'),
((select id from public.categories where slug='veg-rice'),'Kaju Rice (Full)',160,'veg'),
((select id from public.categories where slug='veg-rice'),'Curd Rice',100,'veg');

-- ---- NON-VEG RICE ----
insert into public.menu_items (category_id, name, price, food_type) values
((select id from public.categories where slug='non-veg-rice'),'Egg Fried Rice (Half)',100,'egg'),
((select id from public.categories where slug='non-veg-rice'),'Egg Fried Rice (Full)',180,'egg'),
((select id from public.categories where slug='non-veg-rice'),'Double Egg Fried Rice (Half)',120,'egg'),
((select id from public.categories where slug='non-veg-rice'),'Double Egg Fried Rice (Full)',180,'egg'),
((select id from public.categories where slug='non-veg-rice'),'Egg Schezwan Fried Rice (Half)',120,'egg'),
((select id from public.categories where slug='non-veg-rice'),'Egg Schezwan Fried Rice (Full)',180,'egg'),
((select id from public.categories where slug='non-veg-rice'),'Chicken Fried Rice (Half)',130,'non_veg'),
((select id from public.categories where slug='non-veg-rice'),'Chicken Fried Rice (Full)',200,'non_veg'),
((select id from public.categories where slug='non-veg-rice'),'Ginger Chicken Fried Rice (Half)',140,'non_veg'),
((select id from public.categories where slug='non-veg-rice'),'Ginger Chicken Fried Rice (Full)',200,'non_veg'),
((select id from public.categories where slug='non-veg-rice'),'Chilli Garlic Chicken Fried Rice (Half)',140,'non_veg'),
((select id from public.categories where slug='non-veg-rice'),'Chilli Garlic Chicken Fried Rice (Full)',200,'non_veg'),
((select id from public.categories where slug='non-veg-rice'),'Schezwan Chicken Fried Rice (Half)',140,'non_veg'),
((select id from public.categories where slug='non-veg-rice'),'Schezwan Chicken Fried Rice (Full)',200,'non_veg'),
((select id from public.categories where slug='non-veg-rice'),'Chicken Manchuria Fried Rice (Half)',150,'non_veg'),
((select id from public.categories where slug='non-veg-rice'),'Chicken Manchuria Fried Rice (Full)',200,'non_veg'),
((select id from public.categories where slug='non-veg-rice'),'Mixed Fried Rice (Half)',160,'non_veg'),
((select id from public.categories where slug='non-veg-rice'),'Mixed Fried Rice (Full)',220,'non_veg');

-- ---- VEG NOODLES (veg) ----
insert into public.menu_items (category_id, name, price, food_type) values
((select id from public.categories where slug='veg-noodles'),'Veg Soft Noodles (Half)',90,'veg'),
((select id from public.categories where slug='veg-noodles'),'Veg Soft Noodles (Full)',130,'veg'),
((select id from public.categories where slug='veg-noodles'),'Veg Schezwan Noodles (Half)',100,'veg'),
((select id from public.categories where slug='veg-noodles'),'Veg Schezwan Noodles (Full)',140,'veg'),
((select id from public.categories where slug='veg-noodles'),'Veg Manchurian Noodles (Half)',120,'veg'),
((select id from public.categories where slug='veg-noodles'),'Veg Manchurian Noodles (Full)',180,'veg'),
((select id from public.categories where slug='veg-noodles'),'Paneer Noodles (Half)',120,'veg'),
((select id from public.categories where slug='veg-noodles'),'Paneer Noodles (Full)',180,'veg'),
((select id from public.categories where slug='veg-noodles'),'Paneer Schezwan Noodles (Half)',120,'veg'),
((select id from public.categories where slug='veg-noodles'),'Paneer Schezwan Noodles (Full)',180,'veg'),
((select id from public.categories where slug='veg-noodles'),'Veg Manchurian Schezwan Noodles (Half)',120,'veg'),
((select id from public.categories where slug='veg-noodles'),'Veg Manchurian Schezwan Noodles (Full)',180,'veg'),
((select id from public.categories where slug='veg-noodles'),'Ginger Veg Noodles (Half)',120,'veg'),
((select id from public.categories where slug='veg-noodles'),'Ginger Veg Noodles (Full)',180,'veg'),
((select id from public.categories where slug='veg-noodles'),'Chilli Garlic Veg Noodles (Half)',120,'veg'),
((select id from public.categories where slug='veg-noodles'),'Chilli Garlic Veg Noodles (Full)',180,'veg');

-- ---- NON-VEG NOODLES ----
insert into public.menu_items (category_id, name, price, food_type) values
((select id from public.categories where slug='non-veg-noodles'),'Egg Soft Noodles (Half)',100,'egg'),
((select id from public.categories where slug='non-veg-noodles'),'Egg Soft Noodles (Full)',180,'egg'),
((select id from public.categories where slug='non-veg-noodles'),'Double Egg Noodles (Half)',120,'egg'),
((select id from public.categories where slug='non-veg-noodles'),'Double Egg Noodles (Full)',180,'egg'),
((select id from public.categories where slug='non-veg-noodles'),'Egg Schezwan Noodles (Half)',120,'egg'),
((select id from public.categories where slug='non-veg-noodles'),'Egg Schezwan Noodles (Full)',180,'egg'),
((select id from public.categories where slug='non-veg-noodles'),'Chicken Soft Noodles (Half)',130,'non_veg'),
((select id from public.categories where slug='non-veg-noodles'),'Chicken Soft Noodles (Full)',200,'non_veg'),
((select id from public.categories where slug='non-veg-noodles'),'Chicken Schezwan Noodles (Half)',140,'non_veg'),
((select id from public.categories where slug='non-veg-noodles'),'Chicken Schezwan Noodles (Full)',200,'non_veg'),
((select id from public.categories where slug='non-veg-noodles'),'Ginger Chicken Noodles (Half)',140,'non_veg'),
((select id from public.categories where slug='non-veg-noodles'),'Ginger Chicken Noodles (Full)',200,'non_veg'),
((select id from public.categories where slug='non-veg-noodles'),'Chicken Chilli Garlic Noodles (Half)',140,'non_veg'),
((select id from public.categories where slug='non-veg-noodles'),'Chicken Chilli Garlic Noodles (Full)',200,'non_veg'),
((select id from public.categories where slug='non-veg-noodles'),'Chicken Manchurian Noodles (Half)',150,'non_veg'),
((select id from public.categories where slug='non-veg-noodles'),'Chicken Manchurian Noodles (Full)',200,'non_veg'),
((select id from public.categories where slug='non-veg-noodles'),'Mixed Noodles (Half)',160,'non_veg'),
((select id from public.categories where slug='non-veg-noodles'),'Mixed Noodles (Full)',220,'non_veg');

-- ---- INDIAN VEG CURRIES (veg, single price) ----
insert into public.menu_items (category_id, name, price, food_type) values
((select id from public.categories where slug='indian-veg-curries'),'Dal Tadka',100,'veg'),
((select id from public.categories where slug='indian-veg-curries'),'Dal Fry',100,'veg'),
((select id from public.categories where slug='indian-veg-curries'),'Paneer Butter Masala',140,'veg'),
((select id from public.categories where slug='indian-veg-curries'),'Kadai Paneer',140,'veg'),
((select id from public.categories where slug='indian-veg-curries'),'Ginger Paneer',140,'veg'),
((select id from public.categories where slug='indian-veg-curries'),'Mushroom Masala',150,'veg'),
((select id from public.categories where slug='indian-veg-curries'),'Kadai Mushroom',150,'veg'),
((select id from public.categories where slug='indian-veg-curries'),'Mushroom Curry',150,'veg'),
((select id from public.categories where slug='indian-veg-curries'),'Kaju Mushroom Masala',160,'veg'),
((select id from public.categories where slug='indian-veg-curries'),'Tomato Kaju Masala',160,'veg'),
((select id from public.categories where slug='indian-veg-curries'),'Kaju Masala',160,'veg'),
((select id from public.categories where slug='indian-veg-curries'),'Paneer Kaju Masala',160,'veg');

-- ---- INDIAN NON-VEG CURRIES (non_veg, single price) ----
insert into public.menu_items (category_id, name, price, food_type) values
((select id from public.categories where slug='indian-non-veg-curries'),'Telangana Chicken',180,'non_veg'),
((select id from public.categories where slug='indian-non-veg-curries'),'Punjabi Chicken',180,'non_veg'),
((select id from public.categories where slug='indian-non-veg-curries'),'Andhra Chicken',180,'non_veg'),
((select id from public.categories where slug='indian-non-veg-curries'),'Kadai Chicken',180,'non_veg'),
((select id from public.categories where slug='indian-non-veg-curries'),'Chicken Masala',180,'non_veg'),
((select id from public.categories where slug='indian-non-veg-curries'),'Chicken Butter Masala',180,'non_veg'),
((select id from public.categories where slug='indian-non-veg-curries'),'Chicken Do Pyaza',180,'non_veg'),
((select id from public.categories where slug='indian-non-veg-curries'),'Chicken Fry',180,'non_veg'),
((select id from public.categories where slug='indian-non-veg-curries'),'Hyderabadi Chicken',180,'non_veg'),
((select id from public.categories where slug='indian-non-veg-curries'),'Methi Chicken',200,'non_veg'),
((select id from public.categories where slug='indian-non-veg-curries'),'Chicken Mughlai',200,'non_veg'),
((select id from public.categories where slug='indian-non-veg-curries'),'Chicken Afghani',200,'non_veg');

-- ---- SEAFOOD (non_veg, single price 200) ----
insert into public.menu_items (category_id, name, price, food_type) values
((select id from public.categories where slug='seafood'),'Chilli Prawns',200,'non_veg'),
((select id from public.categories where slug='seafood'),'Prawns Manchuria',200,'non_veg'),
((select id from public.categories where slug='seafood'),'Loose Prawns',200,'non_veg'),
((select id from public.categories where slug='seafood'),'Pepper Prawns',200,'non_veg'),
((select id from public.categories where slug='seafood'),'Ginger Prawns',200,'non_veg'),
((select id from public.categories where slug='seafood'),'Schezwan Prawns',200,'non_veg'),
((select id from public.categories where slug='seafood'),'Fish Manchuria',200,'non_veg'),
((select id from public.categories where slug='seafood'),'Chilli Fish',200,'non_veg'),
((select id from public.categories where slug='seafood'),'Schezwan Fish',200,'non_veg');

-- ---- BIRYANI (non_veg) ----
insert into public.menu_items (category_id, name, price, food_type, is_special) values
((select id from public.categories where slug='biryani'),'Chicken Biryani (Half)',129,'non_veg',true),
((select id from public.categories where slug='biryani'),'Chicken Biryani (Full)',200,'non_veg',true),
((select id from public.categories where slug='biryani'),'Chicken Fried Piece Biryani (Half)',129,'non_veg',false),
((select id from public.categories where slug='biryani'),'Chicken Fried Piece Biryani (Full)',200,'non_veg',false),
((select id from public.categories where slug='biryani'),'Chicken 65 Biryani (Half)',129,'non_veg',false),
((select id from public.categories where slug='biryani'),'Chicken 65 Biryani (Full)',200,'non_veg',false),
((select id from public.categories where slug='biryani'),'Chicken Lollipop Biryani (Half)',129,'non_veg',false),
((select id from public.categories where slug='biryani'),'Chicken Lollipop Biryani (Full)',200,'non_veg',false),
((select id from public.categories where slug='biryani'),'Fish Biryani (Half)',140,'non_veg',false),
((select id from public.categories where slug='biryani'),'Fish Biryani (Full)',220,'non_veg',false),
((select id from public.categories where slug='biryani'),'Prawns Biryani (Half)',140,'non_veg',false),
((select id from public.categories where slug='biryani'),'Prawns Biryani (Full)',220,'non_veg',false);

-- ---- DAS KITCHEN SPECIAL (non_veg) ----
insert into public.menu_items (category_id, name, price, food_type, is_special) values
((select id from public.categories where slug='das-kitchen-special'),'Bagara Rice with Chicken Curry or Chicken Fry',149,'non_veg',true),
((select id from public.categories where slug='das-kitchen-special'),'Bagara Rice with Chicken Curry or Chicken Fry (Large)',170,'non_veg',true);

-- ============================================================================
-- Done. After running:  select count(*) from public.menu_items;  -> 178
-- To make yourself admin after signing up once:
--   update public.profiles set role='admin' where email='YOUR_EMAIL';
-- ============================================================================
