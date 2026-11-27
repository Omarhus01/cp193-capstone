# 0027. Seeding the content one surah per request

- Status: Accepted
- Date: 2026-11-27
- Issue: #69

## Context

The seed ([0011](0011-content-in-git-seeded-into-supabase.md)) sent all of `content/` in one request to the `seed_content` database function, which synced everything in one transaction. After the whole Quran was imported ([0025](0025-every-verse-shows-grouped-by-mushaf-page.md)), that request carried about 6.5 MB: 114 surahs, 6,236 verses and about 77,000 words. The hosted database cancelled it ("canceling statement due to statement timeout"). It limits how long one statement may run; a local Supabase sets 8 seconds on the role the API connects with. The seed only went through after the service role's timeout was raised to 180 seconds for one run, which can't be part of every release.

0011 already expected this: "the whole Quran with its words may need seeding surah by surah".

## Decision

- **The seed is a sequence of short requests, each one transaction.** Four database functions (`supabase/migrations/20261127120000_seed_content_per_surah.sql`), called in this order:
  1. `seed_surah_text`, once per surah: the surah, its verses and its words. Unchanged rows aren't rewritten.
  2. `seed_shared_content`, once: sources and passages, inserted or updated.
  3. `seed_surah_content`, once per surah: everything that belongs to that surah, replaced whole. This covers explanations and their points, citations, context links and reviews, reading sections, the brief, word meanings, transliterations and fixed questions. Then it deletes the verse ranges (spans) nothing uses any more, and the surah's verses and words that left the content.
  4. `seed_content_finish`, once: deletes the passages and sources that left the content and that nothing cites any more. On a full seed, it also deletes surahs that left the content, with their content. It returns the row counts.
- **The text comes before the shared data**, not after. A passage can point to a verse, and a context link can point to words in another surah, so on an empty database the verses have to exist first.
- **An explanation or fixed question belongs to the surah its span starts in.** Validation already keeps it in that surah's folder. Every other surah row carries its surah number. `seed_surah_content` refuses a row of another surah, since what it deletes is limited to its own surah.
- **On the first failure the script stops** and names the surah and the step. That request changed nothing. What was sent before it stays loaded, and nothing after it is sent. Running the seed again picks up from the current state.
- **Seeding only some surahs:** `npm run content:seed -- 2 4` sends the text and content of surahs 2 and 4, plus the shared data. The finish step then keeps every other surah as it is. The whole of `content/` is still validated first, so the review steps apply as before.
- **Removed sources and passages wait for the finish step.** A passage that left the content is deleted only once nothing cites it. A surah not seeded in this run therefore never loses a citation.
- The plan of requests is built by pure code (`lib/services/content/payload.ts`, `toSeedPlan`) and run by `lib/services/content/seed-run.ts`. The request itself is passed in, so services don't import Supabase. The seed script, the local database tests and the end-to-end fixtures all use the same path.
- `seed_content` stays in the database until this change is on `main`, because a migration must keep working with the code already there. A later migration drops it (#70).

## Alternatives

- **Raise the service role's statement timeout for good:** one line, but every seed would hold one long transaction, with locks on every content table, for as long as the whole Quran takes. The next content growth (word meanings for every word, more tafsir passages) would need the limit raised again.
- **One request per table, or rows in fixed-size batches:** short requests too, but a failure would leave a surah half loaded (its explanations without their citations, say). One surah per transaction keeps each surah whole, and it matches how content is edited and reviewed.
- **Shared data first, as first asked:** on an empty database, the passages that point to verses would be refused, because those verses don't exist yet.
- **Seed the text once, outside the normal seed:** the Tanzil text rarely changes, but then two commands would have to be run in the right order, and a fresh database would need both. With unchanged rows skipped, re-sending the text costs little.

## Consequences

- Locally, a full seed of the whole Quran takes about 4 seconds over 230 requests. The slowest single request takes under 0.3 seconds. On the hosted database each request adds network time, so a full seed takes longer overall, but no request comes near the limit.
- A seed can now leave the database partly updated: the surahs before a failure are new, the rest old. Each surah is consistent on its own, and running the seed again finishes the job.
- An unused verse range is deleted as soon as nothing points to it, even on a partial seed. Before, it was deleted when it wasn't in the payload. A span exists only for the rows that use it, so the two rules give the same result.
- Changes to the content tables now touch four functions instead of one, and each refuses a payload with a missing key, as `seed_content` did.
