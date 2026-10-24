# 0011. Content as JSON in git, seeded into Supabase

- Status: Accepted
- Date: 2026-10-24
- Issue: #7

## Context

Every explanation, word meaning and surah brief has to pass an Arabic review of the English and a Korean review before readers see it (proposal §3.1, #ethicalconsiderations). Issue #7 asked where that content and its review status live. During the capstone, the owner and a few reviewers write and check the content, and advisors follow the history. The site already reads its data from Supabase through `lib/data` ([0009](0009-layered-architecture.md)).

## Decision

- **Authoring:** content is JSON in `content/` (layout in `content/README.md`), changed through pull requests. Each reviewable item carries its `status` and its full `review` history (step, reviewer, date, notes). The pull request is where the review happens.
- **Validation:** Zod schemas in `lib/services/content/schema.ts` define the files, and generated JSON Schema in `content/schema/` gives editors autocomplete. A Vitest test validates every file and the checks across files: refs to existing text, reading sections that cover their surah, review histories that follow the steps (`lib/services/review.ts`), and banned terms.
- **Loading:** `npm run content:seed` validates, builds one payload and calls the `seed_content` database function. The function runs a full sync in one transaction, so seeding is idempotent and a failed seed changes nothing. Only the service role may call it. The script (`apps/web/scripts/seed-content.mts`) is tooling outside `src`; it and `lib/data` are the only code that talks to Supabase.
- **Reading:** the site reads only from Supabase, through `lib/data/content.ts`, with a cookie-less anon client (`lib/supabase/public.ts`). Row level security lets readers see only published items, and the queries also filter on `status`. Review history is stored in private tables.
- **Later: database first.** When the content outgrows pull requests, a review page will write to the database directly and the database becomes the source of truth. The transition rule then moves into the database (a trigger or a function), `content/` becomes an export, and `lib/data` stays the only access point, so pages don't change.

## Alternatives

- **Database first now, with a review page:** the end state, but it means building a review interface, roles and an audit log before there is any content to review. Git already gives review, history and blame.
- **Pages read the JSON directly:** simpler, but readers would get whatever is in the repository, drafts included, unless every page filtered correctly. It also leaves the Q&A retrieval (#10) and later database-first editing without a database to build on.
- **A headless CMS:** another hosted service and account for a handful of editors. Its review flow wouldn't match the bilingual steps.
- **Ajv with hand-written JSON Schema instead of Zod:** the schema would be the literal contract, but the TypeScript types would have to be written and kept in sync by hand. With Zod, both the types and the JSON Schema come from one definition.

## Consequences

- The review steps are enforced by a test, not by the database: setting `"published"` without the steps in between fails CI. Editing the text of an approved item doesn't reset its status automatically. The reviewer sees the change in the pull request diff and sends the item back.
- Every merged content change needs a seed (`npm run content:seed`), run by the owner with the service role key. Until it runs, the site shows the previous content.
- The seed sends all content in one request. That is fine for a sample of surahs; the whole Quran with its words may need seeding surah by surah.
- `zod` and `tsx` are development dependencies. Nothing in the site's bundle depends on them.
