# 0014. Page layout slots, reading preferences in cookies, cached published content

- Status: Accepted
- Date: 2026-10-24
- Issue: #2

## Context

The approved design (`docs/design/`) changes the site's layout:

- A global top bar. On phones it collapses into a menu button.
- A left sidebar that each page fills with its own content: on the surah page, the reading sections. On phones the sidebar becomes a dropdown.
- On the surah page, a right column for questions and answers. On phones, the questions move under each section.

The reader's choices ("show English explanation too", "show pronunciation") must survive reloads, navigation and the language switch.

Published content is the same for every reader. Cache Components is on, so data can be cached with `"use cache"`.

## Decision

- **Layout:**
  - The locale layout renders the top bar, the page, and a footer with the Tanzil credit that Tanzil's license requires.
  - Pages that need columns use `components/layout/PageLayout`, with a `sidebar` prop (the left slot) and an `aside` prop (the right column, shown on wide screens only).
  - The sidebar and the aside are props, not an `@sidebar` parallel route. A parallel route keeps showing the previous page's slot after client-side navigation to a page without one, and the sidebar needs the same data as the page, which a prop shares in one fetch.
- **Reader state:**
  - `components/surah/SurahReader` holds the page's client state: the preferences, the section in view, and the open word popover. Its data attributes show or hide the English and pronunciation lines through CSS.
  - The preferences are stored in two cookies, `qe-show-english` and `qe-show-pronunciation`, which last a year (`lib/services/reading/preferences.ts`). The page reads them on the server, so it renders in the chosen state without a flash. Local storage would show the default first, then switch.
  - Defaults: English off, pronunciation on.
- **Caching:**
  - Every function in `lib/data/content.ts` is cached with `"use cache"`, `cacheTag("content")` and `cacheLife("minutes")`. The client sends no cookies, so the result doesn't depend on the reader.
  - The surah page itself stays dynamic: it checks the session and reads the preference cookies.
  - **Sprint 1 lifetime:** while content is tested in Sprint 1, the lifetime is a few minutes, so a seed shows up quickly. After testing, the lifetime should become longer (`"hours"` or `"days"`), or the seed script should revalidate the `content` tag through a protected route, so the site shows a seed at once.

## Alternatives

- **A parallel route slot (`@sidebar`):** this is what Next.js provides for slots, but the stale content after client-side navigation needs a catch-all route to clear it, and the page and the slot would fetch the same data separately.
- **Preferences in the URL (`?en=1`):** links could carry the choice, but every internal link would have to carry it too, and the language switch would have to keep it.
- **No cache:** every page view would make five or six queries to Supabase. The content changes only when the owner seeds.

## Consequences

- After a seed, the hosted site can show the old content for a few minutes.
- A page without a sidebar is unchanged. A page that wants one passes it to `PageLayout`.
- Reading preferences are per browser, not per account. Saved progress (#12) can move them to the account later.
