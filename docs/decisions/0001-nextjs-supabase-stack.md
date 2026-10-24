# 0001. Next.js and Supabase as the stack

- Status: Accepted
- Date: 2026-10-05

## Context

One developer has five weeks per sprint to ship a site that testers open from a link (proposal §3.2, #deployment). The site needs English and Korean pages, accounts that store progress and questionnaire answers in later sprints, and an AI service in sprint 2. Time spent on infrastructure is time not spent on content and user testing.

## Decision

- **Web:** Next.js 16 (App Router, TypeScript strict) with Tailwind CSS 4, hosted on Vercel from `apps/web`.
- **Backend:** Supabase for auth and Postgres, used through `@supabase/ssr`. The schema lives in `supabase/migrations/`, with row level security on every table.
- **AI (sprint 2):** a separate Python FastAPI service in `services/ai/`, since the retrieval trials are Python work (#pythonprogramming).
- **Tests:** Vitest for unit tests and Playwright for end-to-end tests.

## Alternatives

- **A custom Node or Python backend with its own auth:** more code to write and secure, for no gain at this scale.
- **Firebase:** a document store fits progress and exercise results less well than SQL, and SQL is a course outcome (#sql).
- **A single-page React app without a server:** loses server-side session checks and server rendering of the Arabic text, which keeps first load fast on testers' phones.

## Consequences

- Auth, the database and hosting are managed services, and the free tiers cover user testing.
- Next.js 16 changes often (the proxy replaces middleware, Cache Components). Code follows the docs bundled in `node_modules/next/dist/docs/`, not older habits.
- The stack is fixed for all sprints. A new dependency needs the owner's approval.
