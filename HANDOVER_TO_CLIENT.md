# Das Kitchen — Handover to Client's Database

Moving the site off your Supabase project onto the client's own, so **they** own the data.
Nothing in the code changes — only the database it points at.

You keep the Vercel project and GitHub repo (you stay the maintainer).

> Do this at a quiet time (not during service). The site keeps running on the old
> database until the very last step, so there's no downtime while you set up.

---

## Before you start — make the account truly theirs

You have the client's Gmail. For a clean handover:

1. Create the Supabase account **with the client's email** so the project lives under
   their name.
2. When done, tell the client to **change the Supabase password** so they alone control
   it. You did the setup; they own the account.

---

## Step 1 — Create the client's Supabase project

1. Go to **supabase.com** → sign in with the **client's Gmail**.
2. **New project**.
   - **Name:** `das-kitchen`
   - **Database password:** set a strong one and **save it somewhere safe** — you cannot
     see it again later.
   - **Region:** **Mumbai (ap-south-1)** — closest to Hyderabad, so the site is fastest.
3. Wait ~2 minutes for it to finish building.

---

## Step 2 — Build the database (run the SQL files in order)

Open **SQL Editor** in the new project. For **each** file below: click **New query**,
open the file from your `das-kitchen` folder, copy everything, paste, click **Run**.
Run them **in this exact order**. Each one prints an "OK" or a small result when it works.

1. `das_kitchen_schema.sql` ← **must be first.** Creates all tables + seeds the menu.
2. `das_kitchen_SETUP_ALL.sql` ← security, coupons, rules, OTP fix, rider permissions.
3. `das_kitchen_upgrade.sql` ← brings the schema in line with the current code.
4. `das_kitchen_upi_payments.sql` ← UPI ID + QR support.
5. `das_kitchen_distance_pricing.sql` ← per-km delivery charge.
6. `das_kitchen_realtime.sql` ← live order updates without refresh.
7. `das_kitchen_push.sql` ← push-notification storage.
8. `das_kitchen_data_retention.sql` ← auto-trims old GPS so it stays on the free plan.
9. `das_kitchen_CHECK.sql` ← **last.** Should print all-OK. If anything says MISSING,
   re-run the file it belongs to.

**Skip** `das_kitchen_contact.sql` and `das_kitchen_location.sql` — those set *your*
Das Kitchen details. The client will enter their own in Admin → Settings (Step 7).

The menu (191 items) is already seeded by file 1, so nothing to copy over.

---

## Step 3 — Create the image storage bucket

Dish photos need a public bucket.

1. In the new project → **Storage** → **New bucket**.
2. Name it exactly **`menu`** (lowercase).
3. Turn **Public bucket** ON.
4. **Create**.

---

## Step 4 — Set up sign-in (Auth)

1. **Authentication** → **Providers** → make sure **Email** is enabled.
2. **Authentication** → **URL Configuration**:
   - **Site URL:** your live address, e.g. `https://das-kitchen.vercel.app`
   - **Redirect URLs:** add both:
     - `https://das-kitchen.vercel.app/**`
     - `http://localhost:3000/**`
3. (Optional) If you want "email confirmation" off so customers sign up instantly,
   turn it off under **Authentication → Sign In / Providers → Email → Confirm email**.

---

## Step 5 — Copy the new project's keys

In the new project → **Project Settings** → **API**. You need three values:

| Key on the page            | Goes into env variable            |
|----------------------------|-----------------------------------|
| Project URL                | `NEXT_PUBLIC_SUPABASE_URL`         |
| `anon` `public` key        | `NEXT_PUBLIC_SUPABASE_ANON_KEY`    |
| `service_role` `secret` key| `SUPABASE_SERVICE_ROLE_KEY`        |

The `service_role` key is a master key — never share it or put it in the browser.

---

## Step 6 — Point the app at the new database

You update the keys in **two** places.

**A) On your computer** — edit `.env.local` in the `das-kitchen` folder:

```
NEXT_PUBLIC_SUPABASE_URL=<new Project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<new anon key>
SUPABASE_SERVICE_ROLE_KEY=<new service_role key>
```

Leave the VAPID and WhatsApp lines as they are for now (see Step 8).

**B) On Vercel** (this is what the live site actually uses):

1. **vercel.com** → your `das-kitchen` project → **Settings** → **Environment Variables**.
2. Edit each of the three above and paste the **new** values.
3. Save, then go to **Deployments** → **⋯** on the latest → **Redeploy**.

After the redeploy, the **live site is now on the client's database.**

---

## Step 7 — Make the client the admin

The very first admin has to be set by hand, once.

1. On the live site, **Sign up** with the **client's email + a password**.
2. Back in Supabase → **SQL Editor**, run (put the client's email in):

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'CLIENT_EMAIL_HERE');
```

3. Have the client sign out and back in. They now see the **Admin** panel.
4. In **Admin → Settings**, the client fills in their **own** phone, WhatsApp (`91…`),
   UPI ID, kitchen location and hours, then **Save**.

---

## Step 8 — Push notifications (optional but recommended)

Push needs its own keys, tied to this new setup.

1. In the `das-kitchen` folder, run in a terminal:

   ```
   node -e "console.log(require('web-push').generateVAPIDKeys())"
   ```

2. It prints a `publicKey` and `privateKey`. Set these in **both** `.env.local` **and**
   Vercel:

   ```
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<publicKey>
   VAPID_PRIVATE_KEY=<privateKey>
   VAPID_SUBJECT=mailto:CLIENT_EMAIL_HERE
   ```

3. Redeploy on Vercel.

If you skip this, everything else works — only web push notifications stay off. The
in-app siren alarm still works regardless.

---

## Step 9 — Final check

On the live site, as the client's admin:

- [ ] Menu shows all dishes
- [ ] Place a test order end-to-end → it appears in **Admin → Orders**
- [ ] The new-order **alarm** sounds
- [ ] Upload a dish photo in **Admin → Menu** (confirms the `menu` bucket works)
- [ ] Contact details in the footer show the client's info

When all six pass, the handover is complete. You can safely leave your old Supabase
project alone (or pause it) — the site no longer touches it.

---

## What you're NOT changing

- **Code / GitHub** — untouched. You keep pushing updates as before.
- **Vercel project** — still yours; only its database keys changed.
- **Domain** — unchanged.

If you later want a full exit (transfer Vercel + GitHub to the client too), that's a
separate short process — ask and I'll write it up.
