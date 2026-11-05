# CP193 Capstone: Quran explanations for Korean-speaking learners

A platform that explains the Quran to Korean-speaking learners who don't read Arabic. Each verse shows:

- the Arabic text
- a Korean explanation of its context (not a literal translation)
- an optional English view
- the meaning of each word in that verse
- a link to the source of every explanation

The project proposal is in [`docs/proposal.pdf`](docs/proposal.pdf).

Sprint 1 so far: the site shell, English/Korean routing, email-and-password accounts, the content model (Quran text, explanations, review steps, sources), and the surah page with reading sections, word meanings, English and pronunciation toggles, and source chips that open the passage on Shamela. Al-Fatiha is published: its explanations, brief, word meanings and transliterations have passed review. The Vercel deploy setup (checklist, build guard, smoke tests) and a feedback button for user testing are in place. Next up: the Q&A panel with prepared answers (#5), surah navigation and search (#6), and the Islamic terms glossary (#8).

## Repository layout

| Path                   | What it holds                                                              |
| ---------------------- | -------------------------------------------------------------------------- |
| `apps/web/`            | Next.js site (App Router, TypeScript, Tailwind, next-intl)                 |
| `services/ai/`         | Python FastAPI service for the Q&A panel (sprint 2, empty for now)         |
| `experiments/`         | Model and retrieval trials (empty for now)                                 |
| `content/`             | Quran text, explanations and sources as JSON ([README](content/README.md)) |
| `supabase/migrations/` | Database schema as SQL migrations                                          |
| `prompts/`             | Prompts for the Q&A model (placeholder)                                    |
| `.github/workflows/`   | CI (`ci.yml`) on every push and PR; daily Supabase ping (`keep-alive.yml`) |
| `docs/decisions/`      | Architecture decision records (ADRs)                                       |
| `CONTRIBUTING.md`      | Issue → branch → pull request workflow and definition of done              |

## Documentation

- [Project proposal](docs/proposal.pdf): scope, market research, sprint plan and the user-testing plan
- [`docs/deploy.md`](docs/deploy.md): Vercel and Supabase setup, the release order, and the daily keep-alive
- [`docs/decisions/`](docs/decisions/README.md): architecture decision records (ADRs), one file per decision
- [`docs/design/`](docs/design/): approved designs of the surah page (English, Korean, phone)
- [`content/README.md`](content/README.md): the content files, the review steps, and how to seed the database
- [`docs/content-drafts/`](docs/content-drafts/): the owner's content drafts under review (not loaded by the site)

## Requirements

- Node.js 22 or newer, and npm
- A Supabase project (free tier is fine)

## Setup

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # then fill in both values
```

Get both values from the Supabase dashboard under **Project Settings → API**:

- `NEXT_PUBLIC_SUPABASE_URL`: the project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the `anon` public key

### Database

Apply the migrations in `supabase/migrations/` with the Supabase CLI. It is installed as a dev dependency.

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

If you'd rather not use the CLI, paste each migration file into the dashboard's **SQL Editor** and run it.

### Content

Load `content/` into the database after applying the migrations, and again after every content change. The seed needs the project's service role key (**Project Settings → API**). Pass it in the shell, never in a file:

```bash
SUPABASE_SERVICE_ROLE_KEY=... npm run content:seed                       # bash
$env:SUPABASE_SERVICE_ROLE_KEY="..."; npm run content:seed               # PowerShell
```

[`content/README.md`](content/README.md) explains the files, the review steps, and how to try migrations and the seed on a local Supabase in Docker first.

### Auth settings (Supabase dashboard)

1. **Authentication → URL Configuration**
   - Set **Site URL** to `http://localhost:3000` for local work, or to the Vercel URL once deployed.
   - Add `http://localhost:3000/auth/confirm**` and `https://<your-vercel-domain>/auth/confirm**` to **Redirect URLs**. The `**` matters: the redirect carries `?locale=…&next=…`, and Supabase sends users to the Site URL instead when the full URL doesn't match.

2. **Email:** **Confirm email** is on (**Authentication → Sign In / Providers → Email**). Auth emails go through custom SMTP with a Gmail account (**Authentication → Emails → SMTP Settings**).
3. **Authentication → Emails → Confirm signup:** the template in [`docs/deploy.md`](docs/deploy.md), section 4.

**How the confirmation link works:**

- **The template's link:** it goes straight to `/auth/confirm?…&token_hash=…&type=email`. The app verifies the token on the server (`verifyOtp`), so the link works in any browser. Signup sets the start of the link (`emailRedirectTo`), which carries the user's language and where to go next.
- **The default link (`?code=`):** the route still accepts it. That link only completes the login in the browser where the user signed up (PKCE). Opened elsewhere, the address is confirmed anyway, and the login page says to try logging in.

## Run

```bash
npm run dev        # http://localhost:3000 (redirects to /en)
npm run build      # production build
npm start          # serve the production build
```

## Checks

```bash
npm run format:check   # Prettier
npm run lint           # ESLint
npm run typecheck      # generates Next route types, then runs tsc
npm test               # Vitest unit tests
npm run test:e2e       # Playwright end-to-end tests (builds and starts the app on port 3100)
E2E_BASE_URL=https://<domain> npm run test:smoke   # read-only checks against a deployed site
```

Before the first end-to-end run, install the browser once:

```bash
npx playwright install chromium
```

Most end-to-end tests cover logged-out flows and run without a Supabase project: when `apps/web/.env.local` is missing, placeholder values are used. With `.env.local`, the test server uses your project.

The tests in `e2e/real-account.spec.ts` log in with a real, confirmed account on that project. They are skipped unless you pass the account in the environment. Never put it in a file.

```bash
E2E_EMAIL=you@example.com E2E_PASSWORD=... npm run test:e2e        # bash
$env:E2E_EMAIL="you@example.com"; $env:E2E_PASSWORD="..."; npm run test:e2e   # PowerShell
```

Logging out only ends the current browser's session, so these tests can share one account and run in parallel. A run doesn't log the account out anywhere else.

The tests in `e2e/surah-page.spec.ts` need content. They seed fixtures into a local Supabase in Docker, log in with an account they create there, and put `content/` back afterwards. They are skipped unless `E2E_LOCAL_SUPABASE=1` and the Supabase URL is local. Set the local URL and keys in the shell, so the test server uses the local database instead of `.env.local`:

```bash
npx supabase start
npx supabase status -o env   # API_URL, ANON_KEY, SERVICE_ROLE_KEY
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  SUPABASE_SERVICE_ROLE_KEY=... E2E_LOCAL_SUPABASE=1 npm run test:e2e
```

### CI

`.github/workflows/ci.yml` runs `format:check`, `lint`, `typecheck`, `npm test` and `npm run build` (with placeholder Supabase values) on every push and pull request. `main` is protected: changes arrive only through a pull request, and the CI job must pass first. See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## Deploy (Vercel)

[`docs/deploy.md`](docs/deploy.md) is the step-by-step checklist: the Vercel project (Root Directory `apps/web`, the two public variables, production from `main`, no previews), the Supabase Auth URLs, sign-ups and the Confirm signup email template, a smoke test, the release order for every later change (database first, then the merge; [ADR 0017](docs/decisions/0017-vercel-hosting-and-release-order.md)), and the daily keep-alive that stops the free Supabase project from pausing (`.github/workflows/keep-alive.yml`).

**The feedback form:** the surah page's feedback button opens `NEXT_PUBLIC_FEEDBACK_URL` (optional, set in Vercel). Without it, the button reads "Feedback form coming soon".

## Project history

Commit dates are mapped to the sprint weeks in the project proposal, with Prof. Scheffler's approval.
