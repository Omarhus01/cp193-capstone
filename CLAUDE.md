# CLAUDE.md

## Project

CP193 capstone (Minerva University): a Quran explanation platform for Korean-speaking learners who don't read Arabic. Each verse shows:

- the Arabic text
- a Korean explanation of its context (an explanation, not a literal translation)
- an English toggle
- the meaning of each word as it applies in that verse
- a link to the source of every explanation

Later sprints add:

- a Q&A panel backed by RAG over tafsir and hadith books, which cites its sources and declines when they don't support an answer
- Duolingo-style exercises, chosen by a sign-up questionnaire
- daily and weekly reminders
- saved progress

The full proposal, with the market research, sprint plan, and user-testing plan, is in [`docs/proposal.pdf`](docs/proposal.pdf). Read it for product context before making product decisions.

## Content rules (non-negotiable)

- **Islamic terms follow the Arabic word** ([ADR 0008](docs/decisions/0008-terms-follow-the-arabic-word.md), proposal §2.1):
  - الله is a name: always "Allah" in English and 알라 in Korean, never "God" or 하나님.
  - إله means god or deity, so "god" is correct (لا إله إلا الله = "there is no god but Allah").
  - رب means Lord (وهو رب العرش العظيم = "He is the Lord of the Mighty Throne").
  - 하나님 is banned everywhere. It is the Christian term and changes the meaning of the verse.
  - The Korean terms for إله and رب come from the Islamic terms glossary once the owner's reviewers approve it (#8). Don't invent them.
  - `findBannedTerms` (`src/lib/services/terminology.ts`) flags 하나님 and capitalized "God" used as a name. Lowercase "god" passes. A unit test runs it over the message files.
- **Never write Quran verses, translations, explanations, or word meanings.** The project owner provides and validates all religious content in `content/`. Don't generate placeholder verses, explanations or meanings either. The Quran text comes only from Tanzil, through `npm run content:import-tanzil`, and is never edited by hand.
- **Only published content reaches readers.** Explanations, word meanings and surah briefs go draft → en_approved → ko_drafted → ko_approved → published, one step at a time ([ADR 0011](docs/decisions/0011-content-in-git-seeded-into-supabase.md), `content/README.md`).

## Stack (fixed for all sprints)

- **Web:** Next.js 16 (App Router, TypeScript strict), Tailwind CSS 4, next-intl with locale routes `/en` and `/ko` (default `en`)
- **Backend:** Supabase for auth and Postgres, through `@supabase/ssr`. The schema lives in `supabase/migrations/`.
- **AI (sprint 2):** a Python FastAPI service in `services/ai/`
- **Hosting:** Vercel (root directory `apps/web`)
- **Tests:** Vitest for unit tests, Playwright for end-to-end tests
- **CI:** GitHub Actions, a required check on `main`
- **Formatting:** Prettier

Ask before adding any dependency that isn't already in a package.json.

## Layout

```
apps/web/                 Next.js site (npm workspace)
  messages/{en,ko}.json   every UI string
  e2e/                    Playwright specs
  src/proxy.ts            Next 16 "proxy" (formerly middleware): locale routing, session refresh, protected-route redirect
  src/i18n/               next-intl routing, navigation, request config, locale helpers
  src/lib/services/       business logic: auth/ (paths, validation, accounts, requireUserId), surah, terminology,
                          review (review steps and tracks), content/ (content file schema, loading, validation,
                          seed payload), reading/ (surah page view, reading preferences)
  src/lib/data/           all database access: auth, session, content (the only importers of lib/supabase)
  src/lib/supabase/       browser, server, proxy and public (cookie-less, for published content) client factories
  scripts/                content tooling run with tsx: import-tanzil, write-content-schema, seed-content
  src/lib/domain/         domain types shared by every layer
  src/lib/ai/             RetrievalProvider interface and its mock
  src/architecture.test.ts  checks the ESLint layer rules
  src/app/[locale]/       pages: home, login, signup, surah/[n] (protected), auth server actions
  src/app/auth/confirm/   email confirmation route (outside the locale prefix)
  src/components/         layout/ (top bar, phone menu, footer, PageLayout with sidebar and aside slots),
                          surah/ (surah page: sections, word popover, toggles, Q&A shell), auth/ (forms),
                          text/ArabicText
  e2e/fixtures/           content seeded by the surah page e2e tests (placeholder text only)
services/ai/              placeholder (sprint 2)
experiments/              placeholder
content/                  Quran text (Tanzil), explanations, word meanings, sources as JSON; see content/README.md
supabase/migrations/      SQL migrations
prompts/                  model prompts (placeholder)
docs/proposal.pdf         project proposal
docs/design/              approved page designs (surah page, desktop and phone)
docs/content-drafts/      the owner's content drafts under review (not loaded by the site)
docs/decisions/           architecture decision records (ADRs)
CONTRIBUTING.md           workflow and definition of done
```

## Commands (from the repo root)

```bash
npm run dev            # dev server on :3000
npm run build
npm run format         # Prettier write; format:check in CI
npm run lint
npm run typecheck      # next typegen && tsc --noEmit
npm test               # Vitest
npm run test:e2e       # Playwright (builds and serves on :3100)
npx supabase db push   # apply migrations to the linked project
npm run content:seed   # load content/ into Supabase (needs SUPABASE_SERVICE_ROLE_KEY in the shell)
npm run content:schema # rewrite content/schema/ after changing the Zod schemas
```

`.github/workflows/ci.yml` runs format:check, lint, typecheck, and test on every push and PR. Its job, `Format, lint, typecheck, unit tests`, is a required check on `main`. A husky pre-push hook (`.husky/pre-push`) runs the same checks locally as a safety net and blocks the push if any fail. `npm install` sets it up through the `prepare` script. Don't bypass the hook with `--no-verify`.

## Workflow

Details are in [`CONTRIBUTING.md`](CONTRIBUTING.md).

- Work starts from a GitHub issue on the board "CP193 Capstone" (Backlog → Ready → In progress → In review → Done), with milestones `Sprint 1` and `Sprint 2`.
- One branch per issue: `feat/<issue>-<short-name>`, `fix/…` or `chore/…`.
- Changes reach `main` only through a pull request that says `Closes #<issue>` and uses `.github/pull_request_template.md`. `main` is protected: a PR and a passing CI check are required, admins included.
- Merge with a merge commit (`gh pr merge --merge`), never squash or rebase, so each commit stays in the history. Commit messages follow the existing Conventional Commits style.

## Definition of done

- Acceptance criteria met.
- Unit and e2e tests added and passing.
- en and ko strings both present.
- No Supabase calls outside `src/lib/data`.
- ADR written in `docs/decisions/` if a decision was made.
- PR merged, with a merge commit.
- Issue closed.

## Architecture

Each layer imports only from the layers below it ([ADR 0009](docs/decisions/0009-layered-architecture.md)):

```
app/ (routes, pages, server actions) → components/ → lib/services/ → lib/data/ → lib/supabase/ → Supabase
```

- **`lib/data`** holds all database access. It is the only code that imports `@/lib/supabase/*` or `@supabase/*`, and it returns plain results, not Supabase objects. `src/proxy.ts` is infrastructure and calls `lib/data/session` directly. The one exception outside `src` is `scripts/seed-content.mts`, which writes content with the service role key through the `seed_content` database function ([ADR 0011](docs/decisions/0011-content-in-git-seeded-into-supabase.md)).
- **`lib/services`** holds the business logic. Pages and components use it and never import `lib/data` or `lib/ai`. Components may import server actions from `app/`.
- **`lib/ai`**: AI features go through interfaces here. `RetrievalProvider` answers with citations or declines. The mock serves prepared answers now, and the real provider (#10) plugs in later without page changes.
- **`lib/domain`**: domain types live here, in one place, and every layer may import them. It imports no other layer.
- **Enforced:** `no-restricted-imports` blocks in `apps/web/eslint.config.mjs`, checked by `src/architecture.test.ts`. Use the `@/` alias for imports across layers.

## Conventions

- **Next.js 16 differs from older versions.** Read the bundled docs in `node_modules/next/dist/docs/` before writing Next code (see `apps/web/AGENTS.md`). Middleware is now `src/proxy.ts`.
- **Cache Components is on.** Anything that reads request data (cookies, session, `searchParams`, `useSearchParams`, `usePathname` on dynamic routes) must render inside `<Suspense>`, or the build fails.
- **No hardcoded UI text.** Add keys to both `messages/en.json` and `messages/ko.json`. A unit test checks that the two files have the same keys, and the next-intl types make an unknown key a type error.
- **The server locale comes from the route.** `src/i18n/request.ts` reads it with `next/root-params`, never from request headers. Don't add `setRequestLocale` (deprecated). Pass `{ locale }` explicitly to next-intl only outside Server Components.
- **Arabic always goes through `ArabicText`**, which sets `dir="rtl"`, `lang="ar"` and the Amiri font.
- **Use the navigation exports from `@/i18n/navigation`** (`Link`, `redirect`, `usePathname`, `useRouter`), not `next/link` or `next/navigation`. They keep the locale.
- **Auth:**
  - Server code checks the session with `getCurrentUserId()` (`@/lib/services/auth/accounts`) or `requireUserId()` (`@/lib/services/auth/require-user`), which use `getClaims()` and so verify the JWT.
  - Pages check the session themselves and don't rely on the proxy alone.
  - Redirect targets from user input go through `safeNextPath`.
- **Content:** explanations attach to spans, not verses, and verse numbering follows the Hafs mushaf as in Tanzil ([ADR 0012](docs/decisions/0012-explanations-attach-to-spans.md)). Public content is read with `createPublicClient()` and filtered on `status = 'published'` on top of RLS. The functions in `lib/data/content.ts` are cached with `"use cache"` and `cacheTag("content")` ([ADR 0014](docs/decisions/0014-page-layout-preferences-and-caching.md)).
- **Tanzil credit:** every page that shows Quran text must credit the Tanzil Project with a link to tanzil.net. The global `SiteFooter` does this; don't remove it.
- **Layout:** pages with columns use `PageLayout` (`sidebar` and `aside` props). The right column shows on wide screens only, so a page puts its phone version inline.
- **e2e with content:** tests that need content seed fixtures into a local Supabase (`e2e/local-supabase.ts`), and are skipped unless `E2E_LOCAL_SUPABASE=1` with a local URL. Never point them at the hosted project.
- **Database:** every table has row level security enabled with explicit policies. Change the schema only through a new migration file. Never edit an applied migration.
- **Code style:** keep components small and clearly named. Other people read this code. Put pure logic in `src/lib/services/`, with a colocated `*.test.ts`.
