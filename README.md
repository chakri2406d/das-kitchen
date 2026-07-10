# Das Kitchen — Web Platform

Homemade food ordering & delivery platform (customer + admin + delivery portals).
Next.js 15 · TypeScript · Tailwind · Supabase · Razorpay · Google Maps.

## 1. Prerequisites
- Node.js 18.18+ (20+ recommended)
- A free Supabase project
- (Later) Razorpay + Google Maps API keys

## 2. Database
In the Supabase dashboard → **SQL Editor**, paste and run `das_kitchen_schema.sql`
(the file shared alongside this project). It creates every table, all RLS
policies, realtime, and seed categories.

Make yourself an admin after signing up once:
```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

## 3. Environment
```bash
cp .env.example .env.local
```
Fill in your Supabase URL + anon key (from Project Settings → API). The Razorpay
and Maps keys can wait until those features are wired.

## 4. Run
```bash
npm install
npm run dev
```
Open http://localhost:3000

## 5. What's included
```
src/
  app/
    page.tsx              landing (hero, why-us, contact)
    (auth)/login,signup   email + Google auth
    auth/callback         OAuth code exchange
    (customer)/menu       live menu from Supabase
    (customer)/cart,orders
    admin/                role-gated dashboard (live stats)
    delivery/             role-gated rider portal
  components/  brand logo, button, navbar
  lib/supabase/  browser + server clients, middleware guard
  types/database.ts  types matching the SQL schema
middleware.ts   session refresh + RBAC (admin/delivery/customer)
tailwind.config.ts  brand tokens (gold / brown / cream / coffee)
```

## 6. Access control
Route protection lives in `middleware.ts` **and** is enforced at the database
level by Row Level Security — so even a leaked API call can't read another
user's orders. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

## 7. Roadmap (next build steps)
1. Cart + checkout (COD + Razorpay server action + webhook)
2. Order lifecycle + Supabase Realtime status updates
3. Location picker (Google Maps drag-pin) + saved addresses
4. Admin: order/menu/coupon CRUD, live map, sales charts
5. Delivery: OTP verify, GPS pings, Navigate deep-link
6. Reviews + in-app notifications
```
```
