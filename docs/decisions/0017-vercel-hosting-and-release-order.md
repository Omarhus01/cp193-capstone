# 0017. Hosting on Vercel; database first, then code

- Status: Accepted
- Date: 2026-10-25
- Issue: #25

## Context

Testers need a public link (#25). The stack fixes Vercel as the host ([0001](0001-nextjs-supabase-stack.md)). What remained open:

- how the monorepo deploys
- which secrets the site may hold
- whether pull requests get preview sites
- in what order database changes and code changes reach production

There is one Supabase project, holding real accounts and the content in review.

## Decision

- **Project:**
  - Vercel builds `apps/web` (Root Directory) with Next.js defaults, and installs the npm workspaces from the repository root.
  - Production is `main`, and Node.js is 22.x.
- **Secrets:**
  - Vercel holds only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, which are public by design.
  - The service role key stays with the owner, in the shell, for `npm run content:seed`. A unit test fails if app code reads it.
  - A Vercel build without the two variables stops instead of deploying a site whose every page fails.
- **No preview deployments for now:** `apps/web/vercel.json` skips builds for every branch except `main`. A preview would run unmerged code against the real database and accounts, and would need a wildcard redirect URL in Supabase Auth.
- **Release order:**
  - For each pull request, from its branch: `db push` (if it has a migration), then the seed (if content changed), then the real-account tests and the smoke run, then the merge, which deploys.
  - Migrations must keep working with the code already deployed.
- **Smoke run:** `E2E_BASE_URL=… npm run test:smoke` checks a deployed site read-only. It never signs up or writes data.
- **Test data only goes to a local Supabase:**
  - The e2e helpers that write data refuse a non-local Supabase URL.
  - Sign-ups or logins through the app first ask the server's `/health`, which says whether its own Supabase is local without revealing the URL.

## Alternatives

- **Previews on, with a wildcard redirect URL:** every PR gets a link, but unmerged migrations and code would meet the real database and real accounts.
- **A staging Supabase project now:** the right setup for previews, but it doubles the seeding and the secrets before there's a need.
- **Deploying with the Vercel CLI from a laptop:** no Git integration, and deploys would depend on whose machine they run from.
- **Code first, then migrations:** the deployed code would query columns that don't exist yet.

## Consequences

- A breaking schema change takes two releases: add, deploy and migrate, then remove.
- Seeded content shows within minutes, not instantly (the cache, [0014](0014-page-layout-preferences-and-caching.md)).
- Turning previews on later means a staging Supabase project, its variables in Vercel's Preview environment, and deleting `vercel.json`.
- The owner runs the database steps by hand before each merge; `docs/deploy.md` lists them.
