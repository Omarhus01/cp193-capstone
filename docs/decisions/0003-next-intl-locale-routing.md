# 0003. next-intl with `/en` and `/ko` routes, locale read from the route

- Status: Accepted
- Date: 2026-10-12 (locale source revised 2026-10-22)

## Context

Every page exists in English and Korean, and more languages are a long-term goal (proposal §1.3). A link shared with a Korean tester has to open in Korean. Korean text written by hand must never be missing a string that English has.

## Decision

- next-intl with locale-prefixed routes, `/en` and `/ko`, and `en` as the default. The proxy adds the prefix (`/` → `/en`).
- Every UI string lives in `apps/web/messages/en.json` and `ko.json`. A unit test checks that both files have the same keys, and the next-intl types make an unknown key a type error.
- The server reads the locale from the `[locale]` segment of the route being rendered, with `next/root-params` (`src/i18n/request.ts`). It is never read from request headers, and the deprecated `setRequestLocale` isn't used.

## Alternatives

- **Locale from a cookie or `Accept-Language` on the same URL:** a shared link would open in the sharer's language, not the URL's, and pages couldn't be cached per language.
- **Reading the locale from next-intl's request header (the original setup):** the header describes the requested URL. When a Server Action redirected to another locale, the page rendered in the wrong language. Reading the route's root param fixed it.
- **react-i18next or a hand-written dictionary:** neither integrates with the App Router's server components and routing as directly.

## Consequences

- Each language has its own URLs, and adding a language means a new messages file and a new entry in `src/i18n/routing.ts`.
- Navigation uses the exports from `@/i18n/navigation`, which keep the locale, not `next/link` or `next/navigation`.
- Outside Server Components, `{ locale }` is passed to next-intl explicitly.
