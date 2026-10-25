# 0016. Tester preview: a service-role tester list, RLS policies, and an uncached draft path

- Status: Accepted
- Date: 2026-10-25
- Issue: #23

## Context

The Al-Fatiha content is loaded but not published (#22). Testers need to read it on the site, marked as unreviewed, before it passes review. Everyone else must keep reading published content only ([0011](0011-content-in-git-seeded-into-supabase.md)).

The site caches published content with `"use cache"`, and every reader gets the same cache entry ([0014](0014-page-layout-preferences-and-caching.md)). If a draft entered that cache, every reader would see it.

## Decision

- **Who is a tester:**
  - A table, `public.tester` (keyed by the user id), lists the testers.
  - It has row level security (RLS) with no policies, and all privileges are revoked from `anon` and `authenticated`. Only the service role, or the SQL editor, can read or change it.
  - No client call can add a tester. The README has the SQL to add or remove one by email.
- **The database decides access:**
  - `public.is_tester()` is a `security definer` function with an empty `search_path` and no arguments. It answers only for the caller (`auth.uid()`), and returns false for anon.
  - New RLS policies, placed next to the existing ones, let testers also read explanations, briefs and word meanings at `en_approved`, `ko_drafted` or `ko_approved`, with their items, citations, context links and Elsewhere notes. They also cover every transliteration, and the passages all of those cite.
  - Plain `draft` items stay hidden, since no reviewer has approved their English. The review history stays private.
  - Postgres ORs permissive policies, so these policies only widen access for testers.
- **Two read paths:**
  - **Published:** `lib/data/content.ts` stays the only cached module. It reads as anon with no cookies, and also filters on `status = 'published'`.
  - **Preview:** `lib/data/content-preview.ts` reads with the user's session and has no `"use cache"`. It uses the same queries (`content-queries.ts`) without the status filter, so RLS decides.
  - The page asks `is_tester()` and takes the preview path only for testers. If anyone else reached the preview path, RLS would still return only published rows.
- **Status on content:** explanations, briefs, word meanings and transliterations carry their review status. Testers see a banner at the top of the surah page, and a "Draft" badge on each unreviewed section, the brief, the word popover and the pronunciation line.
- **Keeping drafts out of the cache:**
  - **Unit test:** a static test fails if the cached module imports the session client or a function in it isn't `"use cache"` with the anon client, or if the preview module is ever cached.
  - **e2e test:** against the production build, a tester loads the page first, then a normal reader loads it. The reader must see no drafts.

## Alternatives

- **A role claim in the JWT** (a custom access token hook): no lookup per request, but it means configuring a hook, and a change only takes effect after the token is refreshed.
- **A `tester` column on `profiles`:** users can update their own profile row, so one column-level mistake would let anyone make themselves a tester.
- **Caching drafts per user (`"use cache: private"`):** it caches the reads, but whether a draft stays out of the shared cache would then depend on cache keys being right.
- **Separate preview pages (`/preview/surah/[n]`):** a second page to keep in step with the real one. The real page, with badges, is what testers need to judge.

## Consequences

- A tester's surah page renders on every request, without the cache. That's fine for a handful of testers.
- The page calls `is_tester()` on every request: one small database call.
- Removing a tester takes effect on their next request.
- Publishing an item makes it a normal published item: its badge disappears, and every reader sees it once the cache refreshes.
