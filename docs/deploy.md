# Deploying to Vercel

The site (`apps/web`) runs on Vercel, against the hosted Supabase project. Production deploys from `main`; other branches don't deploy ([ADR 0017](decisions/0017-vercel-hosting-and-release-order.md)). Follow these steps in order.

## 1. Before the first deploy

The hosted database must be up to date: every migration pushed (`npx supabase db push`) and the content seeded (`npm run content:seed`). As of #22 and #23 it is.

## 2. Vercel

1. **Add New → Project**, then import `Omarhus01/cp193-capstone`. Install the Vercel GitHub app for the repository if Vercel asks.
2. **Root Directory:** click **Edit** next to it and choose `apps/web`. Vercel finds the lockfile at the repository root and installs the npm workspaces from there.
3. **Framework Preset:** Next.js (detected). Leave **Build Command**, **Install Command** and **Output Directory** at their defaults.
4. **Environment Variables**, before the first deploy. Next.js builds them into the site, so they must be there when it builds. Add both, for the **Production** environment:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | The same value as in your `apps/web/.env.local`. In Supabase: **Project Settings → Data API → Project URL** (or the **Connect** button → App Frameworks). |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The same value as in your `.env.local`. The project uses the new API keys, so this is either the **publishable key** (`sb_publishable_…`, **Project Settings → API Keys → Publishable key**) or the **legacy anon key** (a JWT starting `eyJ…`, **Project Settings → API Keys → Legacy API Keys** tab → `anon` `public`). Both work; use the one `.env.local` has. |

   Never add the secret key (`sb_secret_…`), the legacy `service_role` key, or `SUPABASE_SERVICE_ROLE_KEY` to Vercel: they bypass row level security, and the site doesn't need them. If either variable above is missing, the Vercel build stops with a message naming them, instead of deploying a site whose every page fails.

5. Click **Deploy**. When it finishes, note the production domain, `<project>.vercel.app`. Below, `<domain>` means that domain.
6. **Settings → Git → Production Branch:** `main`.
7. **Settings → Build and Deployment → Node.js Version:** 22.x.
8. **Preview deployments:** nothing to do. `apps/web/vercel.json` skips the build for every branch except `main`, so pull request branches show as "Ignored" in Vercel. Previews would run unmerged code against the real database; they wait for a separate Supabase project (ADR 0017).

## 3. Supabase: Authentication → URL Configuration

1. **Site URL:** `https://<domain>`
2. **Redirect URLs:** add `https://<domain>/auth/confirm**`. Keep `http://localhost:3000/auth/confirm**` for local work. The `**` matters: the confirmation link carries `?locale=…&next=…`. No wildcard for previews.

## 4. Tester sign-ups

Two things testers can run into when they create an account:

- **Email limit.** Supabase's built-in email sender only sends a few emails per hour per project. When several testers sign up at once, the next ones see "We could not create the account. Try again." / "계정을 만들지 못했습니다. 다시 시도하세요." #16 makes that message clearer, and #18 sets up our own sender.
- **Opening the confirmation link in another browser.** The link completes the login only in the browser where the account was created (PKCE). Checked on a local Supabase with confirmation turned on:
  - **Same browser:** the link confirms the address and the tester lands logged in, on the page they started from.
  - **Different browser** (for example the Gmail app's built-in browser on a phone): the address **is confirmed anyway**, but the tester lands on the login page with "The confirmation link is invalid or has expired." / "확인 링크가 올바르지 않거나 만료되었습니다.". They can simply log in there with their email and password. The message is misleading; #17 makes it gentler.

  Tell testers: "If the link says it's invalid, just log in."

**Option for the testing window (your decision).** Turn **Confirm email** off under **Authentication → Sign In / Providers → Email**. New accounts are then logged in right after sign-up and no email is sent, which avoids both problems. Turn it back on once our own sender (#18) is set up. Nothing in the app needs to change either way.

## 5. Check it worked

**Automatically** (read-only: no sign-ups, no data changes), from the repository:

```bash
E2E_BASE_URL=https://<domain> npm run test:smoke
# also logs in and opens the surah page, with an existing account that is not a tester:
E2E_BASE_URL=https://<domain> E2E_EMAIL=… E2E_PASSWORD=… npm run test:smoke
```

```powershell
$env:E2E_BASE_URL="https://<domain>"; npm run test:smoke
$env:E2E_EMAIL="…"; $env:E2E_PASSWORD="…"; npm run test:smoke
```

It checks the redirect from `/`, both home pages, the Tanzil credit, the login redirect of a surah page, the confirm route, `/health`, and, with the account, that Al-Fatiha shows four sections with no tester banner or "Draft" badge.

**By hand:**

1. Sign up a new account at `https://<domain>/ko/signup`.
2. Open the confirmation email **in the same browser**. The link goes through Supabase to `https://<domain>/auth/confirm…`, and you land logged in.
3. Log out (계정 → 로그아웃), then log in again.
4. Open `/ko/surah/1` as a non-tester: no banner, no "초안" badge, every section "해설 준비 중".
5. Make the account a tester with the SQL in the README ("Tester accounts") and reload: the banner, the badges and the drafts appear. Remove it again if you want.
6. Check the footer's Tanzil link and the English / 한국어 switch.
7. **Cross-browser confirmation:** sign up another account on a laptop and open its confirmation email on a phone (or in another browser). You should see the login page with the "invalid or expired" message (section 4); logging in there works.

## 6. Releasing from now on

Every change reaches the database first, then the code ([ADR 0017](decisions/0017-vercel-hosting-and-release-order.md)). For each pull request, from its branch, in this order:

1. `npx supabase db push`, if it adds a migration.
2. `$env:SUPABASE_SERVICE_ROLE_KEY = "<key>"; npm run content:seed`, if it changes content or the seed.
3. The real-account tests (`E2E_EMAIL=… E2E_PASSWORD=… npm run test:e2e`) and the smoke run against production.
4. Merge. Vercel deploys `main` within a few minutes.

Because the database changes before the code, a migration must keep working with the code already on `main`: add columns and tables first, and remove old ones in a later release. Seeded content shows on the site within a few minutes (the cache, ADR 0014).

## 7. Rolling back

- **Code:** Vercel → **Deployments** → the previous production deployment → **Instant Rollback**.
- **Database:** a new migration that undoes the change. Never edit a migration that was already applied.
