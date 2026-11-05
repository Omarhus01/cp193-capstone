# Architecture decision records

Each file records one decision: why it was needed, what was chosen, what else was considered, and what follows from it. Write one whenever a pull request makes a decision someone might later ask "why?" about (see the definition of done in [`CONTRIBUTING.md`](../../CONTRIBUTING.md)).

Records are not rewritten when a decision changes. Add a new record and set the old one's status to `Superseded by NNNN`. Small clarifications, such as a note that a constraint went away, can go under the old record's Consequences.

| #                                                  | Decision                                                            | Status   |
| -------------------------------------------------- | ------------------------------------------------------------------- | -------- |
| [0001](0001-nextjs-supabase-stack.md)              | Next.js and Supabase as the stack                                   | Accepted |
| [0002](0002-npm-workspaces-monorepo.md)            | One repository with npm workspaces                                  | Accepted |
| [0003](0003-next-intl-locale-routing.md)           | next-intl with `/en` and `/ko` routes, locale read from the route   | Accepted |
| [0004](0004-proxy-auth-with-cache-components.md)   | Session refresh in the proxy, session checks in pages, under Cache Components | Accepted |
| [0005](0005-translate-no.md)                       | Opt pages out of browser translation                                | Accepted |
| [0006](0006-local-logout.md)                       | Log out of the current browser only                                 | Accepted |
| [0007](0007-husky-pre-push-hook.md)                | Run the CI checks in a husky pre-push hook                          | Superseded: CI on GitHub runs these checks. |
| [0008](0008-terms-follow-the-arabic-word.md)       | Islamic terms follow the Arabic word (الله → Allah, never 하나님)   | Accepted |
| [0009](0009-layered-architecture.md)               | Layered architecture with a data layer and AI provider interfaces   | Accepted |
| [0010](0010-github-workflow.md)                    | Issue branches, pull requests with merge commits, protected `main`  | Accepted |
| [0011](0011-content-in-git-seeded-into-supabase.md) | Content as JSON in git, seeded into Supabase; review status in the files | Accepted |
| [0012](0012-explanations-attach-to-spans.md)       | Explanations attach to spans; Hafs numbering; pause marks aren't words | Accepted |
| [0013](0013-public-reading-structure-and-transliteration.md) | Reading structure is public; transliteration is reviewed per language | Accepted |
| [0014](0014-page-layout-preferences-and-caching.md) | Page layout slots, reading preferences in cookies, cached published content | Accepted |
| [0015](0015-explanation-items-and-verse-references.md) | Explanations are items with their own citations; related verses are references | Accepted |
| [0016](0016-tester-preview.md) | Tester preview: a service-role tester list, RLS policies, and an uncached draft path | Superseded by #35 |
| [0017](0017-vercel-hosting-and-release-order.md) | Hosting on Vercel; database first, then code | Accepted |

## Template

Copy this into `NNNN-short-name.md`, using the next free number.

```markdown
# NNNN. Title

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD
- Issue: #N

## Context

What problem or constraint forced a decision.

## Decision

What we chose, stated plainly.

## Alternatives

What else we considered, and why we didn't choose it.

## Consequences

What follows, good and bad: what becomes easier, what becomes harder, what we now have to keep doing.
```
