# CP193 Capstone: Quran explanations for Korean-speaking learners

A platform that explains the Quran to Korean-speaking learners who don't read Arabic. Each verse shows:

- the Arabic text
- a Korean explanation of its context (not a literal translation)
- an optional English view
- the meaning of each word in that verse
- a link to the source of every explanation

The project proposal is in [`docs/proposal.pdf`](docs/proposal.pdf).

This is sprint 1, step 1: the site shell, English/Korean routing, and email-and-password accounts. It has no verse content yet.

## Repository layout

| Path                   | What it holds                                                      |
| ---------------------- | ------------------------------------------------------------------ |
| `apps/web/`            | Next.js site (App Router, TypeScript, Tailwind, next-intl)         |
| `services/ai/`         | Python FastAPI service for the Q&A panel (sprint 2, empty for now) |
| `experiments/`         | Model and retrieval trials (empty for now)                         |
| `content/`             | Verse JSON (arrives in step 2)                                     |
| `supabase/migrations/` | Database schema as SQL migrations                                  |
| `prompts/`             | Prompts for the Q&A model (placeholder)                            |
| `.github/workflows/`   | CI: format check, lint, typecheck, unit tests on every push and PR |
| `.husky/`              | Pre-push hook that runs the same checks locally                    |
| `docs/decisions/`      | Architecture decision records (ADRs)                               |
| `CONTRIBUTING.md`      | Issue → branch → pull request workflow and definition of done      |

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

### Auth settings (Supabase dashboard)

1. **Authentication → URL Configuration**
   - Set **Site URL** to `http://localhost:3000` for local work, or to the Vercel URL once deployed.
   - Add `http://localhost:3000/auth/confirm**` and `https://<your-vercel-domain>/auth/confirm**` to **Redirect URLs**. The `**` matters: the redirect carries `?locale=…&next=…`, and Supabase sends users to the Site URL instead when the full URL doesn't match.

The default **Confirm signup** email works as is. Its `{{ .ConfirmationURL }}` link confirms the address and then redirects to `/auth/confirm?code=…`, where the app exchanges the code for a session (PKCE). Signup sets that redirect target (`emailRedirectTo`), including the user's language and where to go next. The code exchange only works in the browser the user signed up in. If they open the link somewhere else, the address is still confirmed, but they see the login page with a "link invalid" message and need to log in by hand.

**Only once custom SMTP is set up** (Supabase allows template edits only with custom SMTP), you can switch the template to a direct link, which works in any browser. Under **Authentication → Emails → Confirm signup**, change the link to:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&locale={{ .Data.language_pref }}
```

The `/auth/confirm` route handles both link shapes, so this is optional.

If you turn **Confirm email** off under **Authentication → Sign In / Providers → Email**, new users are logged in right after signup and no email is sent.

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

### CI and the pre-push hook

`.github/workflows/ci.yml` runs `format:check`, `lint`, `typecheck` and `npm test` on every push and pull request. `main` is protected: changes arrive only through a pull request, and the CI job must pass first. See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

A [husky](https://typicode.github.io/husky/) pre-push hook runs the same checks before every `git push` and blocks the push if any of them fails, so problems show up before CI. `npm install` installs the hook.

## Deploy (Vercel)

1. Import the GitHub repository in Vercel.
2. Set **Root Directory** to `apps/web`. Vercel detects Next.js and installs from the workspace root.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under **Settings → Environment Variables**.
4. Deploy. Then add the Vercel domain to the Supabase Site URL and Redirect URLs, as described above.

## Project history

Commit dates are mapped to the sprint weeks in the project proposal, with Prof. Scheffler's approval.
