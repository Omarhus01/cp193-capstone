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

- **Always write "Allah", never "God".** In Korean UI text use 알라, never 하나님. 하나님 is the Christian term and changes the meaning of the verse (proposal §2.1). A unit test enforces this for the message files.
- **Never write Quran verses, translations, explanations, or word meanings.** The project owner provides and validates all religious content. It lives in `content/` from step 2 on. Don't generate placeholder verses either.

## Stack (fixed for all sprints)

- **Web:** Next.js 16 (App Router, TypeScript strict), Tailwind CSS 4, next-intl with locale routes `/en` and `/ko` (default `en`)
- **Backend:** Supabase for auth and Postgres, through `@supabase/ssr`. The schema lives in `supabase/migrations/`.
- **AI (sprint 2):** a Python FastAPI service in `services/ai/`
- **Hosting:** Vercel (root directory `apps/web`)
- **Tests:** Vitest for unit tests, Playwright for end-to-end tests
- **CI:** GitHub Actions
- **Formatting:** Prettier

Ask before adding any dependency that isn't already in a package.json.

## Layout

```
apps/web/                 Next.js site (npm workspace)
  messages/{en,ko}.json   every UI string
  e2e/                    Playwright specs
  src/proxy.ts            Next 16 "proxy" (formerly middleware): locale routing, session refresh, protected-route redirect
  src/i18n/               next-intl routing, navigation, request config, locale helpers
  src/lib/auth/           path rules, credential validation, requireUserId
  src/lib/supabase/       browser, server and proxy clients, env reading
  src/app/[locale]/       pages: home, login, signup, surah/[n] (protected), auth server actions
  src/app/auth/confirm/   email confirmation route (outside the locale prefix)
  src/components/         layout/ (header pieces), auth/ (forms), text/ArabicText
services/ai/              placeholder (sprint 2)
experiments/              placeholder
content/                  verse JSON (step 2), provided by the owner
supabase/migrations/      SQL migrations
prompts/                  model prompts (placeholder)
docs/proposal.pdf         project proposal
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
```

GitHub Actions is unavailable on the owner's account for now. A husky pre-push hook (`.husky/pre-push`) runs format:check, lint, typecheck, and test locally and blocks the push if any fail. `npm install` sets it up through the `prepare` script. `.github/workflows/ci.yml` runs the same checks on every push and PR and stays in place for when Actions is back. Don't bypass the hook with `--no-verify`.

## Conventions

- **Next.js 16 differs from older versions.** Read the bundled docs in `node_modules/next/dist/docs/` before writing Next code (see `apps/web/AGENTS.md`). Middleware is now `src/proxy.ts`.
- **Cache Components is on.** Anything that reads request data (cookies, session, `searchParams`, `useSearchParams`, `usePathname` on dynamic routes) must render inside `<Suspense>`, or the build fails.
- **No hardcoded UI text.** Add keys to both `messages/en.json` and `messages/ko.json`. A unit test checks that the two files have the same keys, and the next-intl types make an unknown key a type error.
- **Arabic always goes through `ArabicText`**, which sets `dir="rtl"`, `lang="ar"` and the Amiri font.
- **Use the navigation exports from `@/i18n/navigation`** (`Link`, `redirect`, `usePathname`, `useRouter`), not `next/link` or `next/navigation`. They keep the locale.
- **Auth:**
  - Server code checks the session with `getCurrentUserId()` or `requireUserId()`, which use `getClaims()` and so verify the JWT.
  - Pages check the session themselves and don't rely on the proxy alone.
  - Redirect targets from user input go through `safeNextPath`.
- **Database:** every table has row level security enabled with explicit policies. Change the schema only through a new migration file. Never edit an applied migration.
- **Code style:** keep components small and clearly named. Other people read this code. Put pure logic in `src/lib/`, with a colocated `*.test.ts`.
