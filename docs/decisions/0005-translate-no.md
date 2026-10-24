# 0005. Opt pages out of browser translation

- Status: Accepted
- Date: 2026-10-22

## Context

During manual testing, the browser offered to translate pages, and a translated page threw a hydration error: the translator rewrote text React manages (for example, the server rendered `lang="en"` and the browser showed "Sura" on `/ko`). Machine translation also changes meaning: it can turn 알라 into "God", which is the mistake the platform exists to avoid (proposal §2.1, [0008](0008-terms-follow-the-arabic-word.md)).

## Decision

The root layout sets `translate="no"` on `<html>` and adds `<meta name="google" content="notranslate">`. The site provides its own English and Korean versions through the language switcher.

## Alternatives

- **Allow translation and tolerate hydration errors:** the page breaks for those users, and the translated religious terms are wrong.
- **`suppressHydrationWarning`:** hides the error without stopping the translator from changing the text.

## Consequences

- Users who read neither English nor Korean can't machine-translate the site. More languages come as reviewed message files instead (proposal §1.3).
- A Playwright test switches between `/en` and `/ko`, reloads each, and fails on any console error.
