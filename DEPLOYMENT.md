# Das Kitchen — Deployment Checklist (Vercel)

## 1. Push the code to GitHub
In PowerShell, in the project folder:
```powershell
del .git\index.lock      # only if git complains about a lock
git add -A
git commit -m "Ready for deployment"
git push
```

## 2. Deploy on Vercel
1. Go to **vercel.com** → **Sign up** → **Continue with GitHub**.
2. **Add New… → Project** → import the **das-kitchen** repository.
3. Framework is auto-detected as Next.js. Do NOT deploy yet — add env vars first (step 3).

## 3. Environment variables (Vercel → Project → Settings → Environment Variables)
Copy the values from your local `.env.local`:

| Name | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Legacy API keys → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Legacy API keys → service_role (SECRET) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | 917799546464 |

Apply each to **Production, Preview and Development**. Then click **Deploy**.

You'll get a URL like `https://das-kitchen.vercel.app`.

## 4. After the first deploy — point auth at the live URL
Replace `YOUR-APP.vercel.app` with your real Vercel domain.

**Supabase → Authentication → URL Configuration**
- Site URL: `https://YOUR-APP.vercel.app`
- Redirect URLs: add `https://YOUR-APP.vercel.app/**`
  (keep `http://localhost:3000/**` so local dev still works)

**Google Cloud → APIs & Services → Credentials → your OAuth client**
- Authorized JavaScript origins: add `https://YOUR-APP.vercel.app`
- Authorized redirect URIs: unchanged — it stays
  `https://kwkejupxpvujpwegwmee.supabase.co/auth/v1/callback`

## 5. Test on the live URL
- [ ] Menu loads with all 178 items
- [ ] Sign up + Google sign-in both work
- [ ] Place a test order (location is required)
- [ ] Admin alarm fires on the new order
- [ ] Rider assignment + WhatsApp button work

## 6. Security before real customers
- [ ] Rotate the Supabase **service_role** key (it was committed to git history)
- [ ] Rotate the Google **client secret** (it was pasted into chat)
- [ ] Confirm `.env.local` is NOT in the repo (it's gitignored)

## Later
- Custom domain: Vercel → Settings → Domains
- Installable phone app (PWA) + push notifications — needs this deployment first
