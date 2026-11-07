# Quran Explained (꾸란 해설)

CP193 Capstone: Quran explanations for Korean-speaking learners

A platform that explains the Quran to Korean-speaking learners who don't read Arabic. Each verse shows:

- the Arabic text
- a Korean explanation of its context (not a literal translation)
- an optional English view
- the meaning of each word in that verse
- a link to the source of every explanation

The project proposal is in [`docs/proposal.pdf`](docs/proposal.pdf).

## Start here

For reviewers:

1. **Live site:** https://cp193-capstone.vercel.app. An account is needed to read surah pages; sign-up is open.
2. **Demo videos**, in order:
   1. [The problem and the site](https://www.loom.com/share/e49ffb2d86cf46868e5e29cb42de7aed)
   2. [How it's built](https://www.loom.com/share/d1c1b520b24142d292b22eabd6b0baa6)
   3. [How I keep it correct](https://www.loom.com/share/d1c1b520b24142d292b22eabd6b0baa6)
   4. [What testers said and what's next](https://www.loom.com/share/c9de8bdd91234446b90455f143937056)
3. Then read [How it works](#how-it-works), the [database schema](docs/schema.md) and the [user flow](docs/user-flow.md).

## Sprint 1 (done)

- **Published:** Al-Fātiḥa in full, and An-Nisāʾ 4:34 as a partial surah (a surah can show only some of its verses).
- **Home page:** lists every published surah.
- **Prepared questions:** each reading section has prepared questions with sourced answers. 4:34 includes the modern "go away from them" reading of ḍaraba and the scholars' response, citing three modern works (a new "modern study" source type).
- **User testing:** round 1 with four testers, through the feedback form.
- **Sprint 2:** fixes from testing (switching surahs from the header, the word box on phones, pronunciation matching), a question-answering chat with retrieval and a check step before any answer is shown, new verses from tester requests, and audio.

## Repository layout

| Path                   | What it holds                                                              |
| ---------------------- | -------------------------------------------------------------------------- |
| `apps/web/`            | Next.js site (App Router, TypeScript, Tailwind, next-intl)                 |
| `apps/web/e2e/`        | Playwright tests                                                           |
| `apps/web/scripts/`    | Content import and seed                                                    |
| `content/`             | Quran text, explanations and sources as JSON ([README](content/README.md)) |
| `supabase/migrations/` | Database schema as SQL migrations                                          |
| `.github/workflows/`   | CI (`ci.yml`) on every push and PR; daily Supabase ping (`keep-alive.yml`) |
| `docs/`                | Proposal, schema, user flow, deploy, decisions, designs, content drafts    |
| `docs/decisions/`      | Architecture decision records (ADRs)                                       |

## How it works

The site is built in layers. Each layer uses only the layers below it, so a change to the database touches one layer, not every page. A lint rule enforces this ([decision record: layered architecture](docs/decisions/0009-layered-architecture.md)).

1. **Pages** (`apps/web/src/app/`): one file per address, such as the home page, log in, or a surah page. A page checks who is logged in, asks the services for what it needs, and arranges the components.
2. **Components** (`apps/web/src/components/`): the pieces on screen, such as a reading section, the word popup, a source chip or the questions panel. They show what they are given and handle clicks. When they need data, they ask the services, never the database.
3. **Services** (`apps/web/src/lib/services/`): the rules of the app, in plain functions with their own tests. For example: which questions belong to which reading section, whether a link after log in stays on this site, or whether a text uses a banned term.
4. **Data** (`apps/web/src/lib/data/`): the only code that talks to Supabase, for accounts and for content. It reads only published content, keeps it cached, and hands the services plain values.
5. **Database** (Supabase, `supabase/migrations/`): Postgres holds the Quran text, the reviewed content, the sources and user accounts. Row level security in the database decides what each visitor may read, so unpublished content stays hidden even if the code above asks for it. Content is written only by the seed script, from the files in `content/`.

Two more folders sit beside the layers: `lib/domain` holds the shared data types every layer uses, and `lib/ai` holds the interface the Sprint 2 question-answering service will plug into.

The [database schema](docs/schema.md) shows the tables, and the [user flow](docs/user-flow.md) shows how a reader moves through the site.

## Documentation

- [Project proposal](docs/proposal.pdf): scope, market research, sprint plan and the user-testing plan
- [`docs/schema.md`](docs/schema.md): a diagram of the database tables, how they connect, and what each group is for
- [`docs/user-flow.md`](docs/user-flow.md): a diagram of how a reader moves through the site, from the home page to the surah page
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

`.github/workflows/ci.yml` runs `format:check`, `lint`, `typecheck`, `npm test` and `npm run build` (with placeholder Supabase values) on every push and pull request. `main` is protected: changes arrive only through a pull request, and the CI job must pass first. See [How I work](#how-i-work) for the workflow.

## How I work

- **Issue first.** Stories read "As a Korean-speaking learner, I want …, so that …", with acceptance criteria as a checklist. Each issue has one type label (`story`, `bug`, `chore`), one priority label (`priority:high`, `priority:medium`, `priority:low`), `decision` if it needs an ADR, and a milestone (`Sprint 1` or `Sprint 2`). The [project board](https://github.com/users/Omarhus01/projects/1) runs Backlog → Ready → In progress → In review → Done.
- **One branch per issue**, from an up-to-date `main`: `feat/`, `fix/` or `chore/` + `<issue number>-<short-name>`.
- **Small commits** in [Conventional Commits](https://www.conventionalcommits.org/) style, with a scope where it helps (`fix(i18n): …`). The body says why, not what the diff already shows.
- **Pull request:** the description says `Closes #<issue>` and fills in the [template](.github/pull_request_template.md). The CI job `Format, lint, typecheck, unit tests` must pass and the branch must be up to date with `main`; branch protection enforces both, for admins too. Never push to `main` directly.
- **Merge** with `gh pr merge --merge`: merge commits only, so each commit stays in the history.
- **Decisions get an ADR.** When a pull request picks between real alternatives (a library, a data shape, a rule, a trade-off someone might later question), add a record to [`docs/decisions/`](docs/decisions/README.md) from the template there.
- **Content is the owner's.** Never write Quran verses, translations, explanations or word meanings, even as placeholders. The project owner provides and validates them in `content/`, and Islamic terms follow the Arabic word ([decision record: Islamic terms](docs/decisions/0008-terms-follow-the-arabic-word.md)).

**Definition of done.** A pull request is done when:

- the acceptance criteria in the issue are met
- unit tests (Vitest) and e2e tests (Playwright) are added for the change, and both suites pass
- every new UI string is in both `messages/en.json` and `messages/ko.json`
- there are no Supabase calls outside `src/lib/data` (the ESLint layer rules enforce this)
- an ADR is written if a decision was made
- the pull request is merged with a merge commit, and the issue is closed

## Deploy (Vercel)

[`docs/deploy.md`](docs/deploy.md) is the step-by-step checklist: the Vercel project (Root Directory `apps/web`, the two public variables, production from `main`, no previews), the Supabase Auth URLs, sign-ups and the Confirm signup email template, a smoke test, the release order for every later change (database first, then the merge; [decision record: hosting on Vercel](docs/decisions/0017-vercel-hosting-and-release-order.md)), and the daily keep-alive that stops the free Supabase project from pausing (`.github/workflows/keep-alive.yml`).

**The feedback form:** the surah page's feedback button opens `NEXT_PUBLIC_FEEDBACK_URL` (optional, set in Vercel). Without it, the button reads "Feedback form coming soon".

## Credits

- **Quran text:** the [Tanzil Project](https://tanzil.net), used under its license, unchanged.
- **Source pages:** [Shamela](https://shamela.ws).
- **[Athars](https://athars.ai):** built by Ali, who gave API access used for the 4:34 model trials.

## Project history

Commit dates are mapped to the sprint weeks in the project proposal, with Prof. Scheffler's approval.
