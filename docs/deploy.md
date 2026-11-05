# Deploying to Vercel

The site (`apps/web`) runs on Vercel, against the hosted Supabase project. Production deploys from `main`; other branches don't deploy ([ADR 0017](decisions/0017-vercel-hosting-and-release-order.md)). Follow these steps in order.

## 1. Before the first deploy

The hosted database must be up to date: every migration pushed (`npx supabase db push`) and the content seeded (`npm run content:seed`). As of #22 and #23 it is.

## 2. Vercel

1. **Add New → Project**, then import `Omarhus01/cp193-capstone`. Install the Vercel GitHub app for the repository if Vercel asks.
2. **Root Directory:** click **Edit** next to it and choose `apps/web`. Vercel finds the lockfile at the repository root and installs the npm workspaces from there.
3. **Framework Preset:** Next.js (detected). Leave **Build Command**, **Install Command** and **Output Directory** at their defaults. `apps/web/vercel.json` sets the install command (section 8).
4. **Environment Variables**, before the first deploy. Next.js builds them into the site, so they must be there when it builds. Add both, for the **Production** environment:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | The same value as in your `apps/web/.env.local`. In Supabase: **Project Settings → Data API → Project URL** (or the **Connect** button → App Frameworks). |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The same value as in your `.env.local`. The project uses the new API keys, so this is either the **publishable key** (`sb_publishable_…`, **Project Settings → API Keys → Publishable key**) or the **legacy anon key** (a JWT starting `eyJ…`, **Project Settings → API Keys → Legacy API Keys** tab → `anon` `public`). Both work; use the one `.env.local` has. |

   Never add the secret key (`sb_secret_…`), the legacy `service_role` key, or `SUPABASE_SERVICE_ROLE_KEY` to Vercel: they bypass row level security, and the site doesn't need them. If either variable above is missing, the Vercel build stops with a message naming them, instead of deploying a site whose every page fails.

   **Optional:** `NEXT_PUBLIC_FEEDBACK_URL`, the link to the user-testing feedback form, for example a Google Form. The surah page's feedback button opens it in a new tab. Without it, the button reads "Feedback form coming soon". Like the other two, it's built into the site, so redeploy after adding or changing it (**Deployments** → the latest → **Redeploy**).

5. Click **Deploy**. When it finishes, note the production domain, `<project>.vercel.app`. Below, `<domain>` means that domain.
6. **Settings → Git → Production Branch:** `main`.
7. **Settings → Build and Deployment → Node.js Version:** 22.x.
8. **Preview deployments:** nothing to do. `apps/web/vercel.json` skips the build for every branch except `main`, so pull request branches show as "Ignored" in Vercel. Previews would run unmerged code against the real database; they wait for a separate Supabase project (ADR 0017).

## 3. Supabase: Authentication → URL Configuration

1. **Site URL:** `https://<domain>`
2. **Redirect URLs:** add `https://<domain>/auth/confirm**`. Keep `http://localhost:3000/auth/confirm**` for local work. The `**` matters: the confirmation link carries `?locale=…&next=…`. No wildcard for previews.

## 4. Sign-ups and the confirmation email

**The current setup:** **Confirm email** is on (**Authentication → Sign In / Providers → Email**). Supabase sends auth emails through custom SMTP with a Gmail account (**Authentication → Emails → SMTP Settings**: `smtp.gmail.com`, the Gmail address as the username, and a Google app password, never the account password). That lifts the built-in sender's limits: it delivers to any address, not only to members of the Supabase organization.

**Things to know:**

- **Spam folder:** mail sent through Gmail for another site can land in spam. The sign-up page tells new users to look there. A sender on our own domain (#18) would help.
- **Rate limit:** Supabase still caps how many auth emails it sends per hour. Check **Authentication → Rate Limits** before a group session. When the cap is hit, the sign-up page shows "We could not create the account. Try again." / "계정을 만들지 못했습니다. 다시 시도하세요." (#16 makes that message clearer).

### The Confirm signup template

Supabase's default email link confirms the address and then redirects with a PKCE `code`. That only completes the login in the browser where the account was created. With this template, the link carries a `token_hash` instead, which `/auth/confirm` verifies on the server (`verifyOtp`), so it works in any browser, including the Gmail app on a phone.

Paste it under **Authentication → Emails → Confirm signup**:

**Subject:**

```
Confirm your email / 이메일 인증
```

**Message body:**

```html
<h2>Confirm your email / 이메일 인증</h2>
<p>Click the link below to confirm your email and log in.</p>
<p>아래 링크를 눌러 이메일 인증을 완료하고 로그인하세요.</p>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Confirm my email / 이메일 인증하기</a></p>
<p>If you didn't sign up, you can ignore this email.</p>
<p>가입하지 않으셨다면 이 이메일을 무시하셔도 됩니다.</p>
```

**How the link works:**

- `{{ .RedirectTo }}` is the address the sign-up form asks for: `https://<domain>/auth/confirm?locale=…&next=…`, on the site where the user signed up. It keeps the user's language and the page they started from. The template adds the token to it.
- **It relies on the Redirect URL in section 3** (`https://<domain>/auth/confirm**`). If the address isn't on that list, Supabase puts the Site URL there instead, and the link breaks.
- **Links already sent keep working:** the route still accepts the old `?code=` link. Opened in another browser, that one confirms the address but can't log in. The login page then says the email may already be confirmed and to try logging in.
- `src/lib/services/auth/confirm.test.ts` checks the template above against the route, so the two can't drift apart.

## 5. Check it worked

**Automatically** (read-only: no sign-ups, no data changes), from the repository:

```bash
E2E_BASE_URL=https://<domain> npm run test:smoke
# also logs in and opens the surah page, with an existing account:
E2E_BASE_URL=https://<domain> E2E_EMAIL=… E2E_PASSWORD=… npm run test:smoke
```

```powershell
$env:E2E_BASE_URL="https://<domain>"; npm run test:smoke; Remove-Item Env:E2E_BASE_URL
# also logs in and opens the surah page, with an existing account:
$env:E2E_BASE_URL="https://<domain>"; $env:E2E_EMAIL="…"; $env:E2E_PASSWORD="…"; npm run test:smoke; Remove-Item Env:E2E_BASE_URL, Env:E2E_EMAIL, Env:E2E_PASSWORD
```

In PowerShell, `$env:` variables stay set for the rest of the window, so each line removes them again, even when the run fails. A leftover `E2E_BASE_URL` would send every later `npm run test:e2e` to the deployed site instead of a local build of your branch. Every run prints its target first (`e2e target: …`); check it says `http://localhost:3100` when you mean to test the branch.

**What it checks:**

- the redirect from `/`, both home pages and the Tanzil credit
- the login redirect of a surah page
- the sign-up page's email note
- the confirm route, with its message
- `/health`
- **with the account:** Al-Fatiha in both languages, with the note at the top, every section's explanation and sources, and the feedback button (or "Feedback form coming soon")

**By hand:**

1. **Sign up:** create a new account at `https://<domain>/ko/signup` on a phone, with any address. The page asks you to check your inbox and spam folder.
2. **Confirm in another app:** open the confirmation email in the phone's mail app, so the link opens in a different browser from the one you signed up in. You land logged in, on the page you started from.
3. **Log out and back in:** log out (계정 → 로그아웃), then log in again.
4. **Read the surah:** open `/ko/surah/1`. Check the note at the top, the explanation of all four sections, the word meanings, and the pronunciation line.
5. **Feedback:** check the button at the end of the page on the phone, and in the right column on a laptop. It opens the form in a new tab, or says "설문 곧 제공" until `NEXT_PUBLIC_FEEDBACK_URL` is set.
6. **Footer and language:** check the footer's Tanzil link and the English / 한국어 switch.

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

## 8. Why Vercel installs from the repository root

The first deploy of `main` (f2fa5db) failed during the install:

```
> prepare
> husky
sh: line 1: husky: command not found
Error: [BUILD_UTILS_SPAWN_127] Command "npm install" exited with 127
```

**Cause:**

- Vercel runs the install command in the Root Directory, `apps/web`.
- Run inside a workspace folder, npm installs only that workspace's dependencies. The root's devDependencies (husky, Prettier, the Supabase CLI) are left out.
- npm still runs the root's `prepare` script, which called `husky`. So it failed with the path `/vercel/path0`, the repository root.
- Earlier checks missed it because they installed at the root, as CI does, and there husky is present. Without a `.git` folder, husky only prints ".git can't be found" and exits 0.
- Reproduce it in a copy without `.git` (`git archive HEAD`) by running `npm install` inside `apps/web`, or `npm ci --omit=dev` at the root.

**Two fixes:**

- **The install runs at the root.** `apps/web/vercel.json` sets `"installCommand": "cd ../.. && npm ci"`, the same install CI runs. Without it, the build failed next: `next build` type-checks `apps/web/scripts/json-file.ts`, which imports Prettier.
- **No `prepare` script.** The root `prepare` script, which ran husky, was removed together with the pre-push hook, so an install can't fail that way any more.

## 9. Keeping the Supabase project awake

Supabase pauses a free project after a week without activity. `.github/workflows/keep-alive.yml` prevents that. Once a day, it makes one read-only request: it reads the number of one surah through the REST API, with the public key. It can also be run by hand.

**Add the two repository secrets once.** On GitHub, go to the repository → **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|---|---|
| `SUPABASE_URL` | The same value as `NEXT_PUBLIC_SUPABASE_URL` in Vercel |
| `SUPABASE_ANON_KEY` | The same value as `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel (the publishable or legacy anon key) |

Never put the secret key or the service role key there; the request needs only public access.

**Run it by hand:** **Actions → Keep Supabase awake → Run workflow**, on `main`. A green run means Supabase answered.

**When it runs:**

- GitHub runs scheduled workflows only from the default branch, so the schedule starts once the workflow is on `main`.
- GitHub turns schedules off in a repository with no activity for 60 days. **Actions** then shows a banner to turn it back on.
