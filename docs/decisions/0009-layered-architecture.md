# 0009. Layered architecture with a data layer and AI provider interfaces

- Status: Accepted
- Date: 2026-10-23
- Issue: #1

## Context

Pages and components called Supabase directly: the server actions, the email confirmation route and two header components each created their own client. Verse content and its review status are coming (#2, #7), and so is a Q&A model that isn't chosen yet (proposal §4, #abstraction and #separationofconcerns). The proposal asks that the interface, the login, the content and the model each stay in their own part, so the content and the model can change without touching the pages. Advisors and a possible model partner read this code.

## Decision

Code lives in layers under `apps/web/src`, and each layer imports only from the layers below it:

```
app/ (routes, pages, server actions)
  → components/
    → lib/services/   business logic
      → lib/data/     all database access
        → lib/supabase/  client factories only
          → Supabase
lib/domain/  types, importable from every layer
lib/ai/      provider interfaces and implementations, used by lib/services
```

- Only `lib/data` uses the Supabase clients, and it returns plain results, never Supabase objects. `src/proxy.ts` is infrastructure and calls `lib/data/session` directly.
- AI features go through interfaces in `lib/ai`. `RetrievalProvider` answers a question with citations or declines. Sprint 1 uses a mock that serves the owner's prepared answers. The RAG service (#10) becomes another implementation.
- Components may import server actions from `app/`, which is the standard Next.js pattern.
- ESLint enforces this with `no-restricted-imports` blocks per layer (`apps/web/eslint.config.mjs`), and `src/architecture.test.ts` checks that each ban fires.

## Alternatives

- **Convention only, without a lint rule:** it would erode on the first deadline.
- **Calling Supabase from pages and components (the previous state):** simpler at first, but every content or schema change touches UI code, and tests have to mock Supabase everywhere.
- **A repository class per table, or dependency injection:** more structure than one developer and a few tables need. Plain modules with functions are enough.

## Consequences

- Swapping the Q&A model or the content store doesn't touch pages.
- Services can be unit tested by mocking one `lib/data` module (see `accounts.test.ts`).
- Some functions are thin passthroughs, for example `getCurrentUserId` in services re-exporting the data one. That's the cost of a rule simple enough to lint.
- Relative imports are caught for `supabase`, and for `lib/data`, `lib/ai` and `lib/services` when the path contains `lib/`. Use the `@/` alias for imports across layers.
