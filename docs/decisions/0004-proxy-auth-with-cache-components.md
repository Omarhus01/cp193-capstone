# 0004. Session refresh in the proxy, session checks in pages, under Cache Components

- Status: Accepted
- Date: 2026-10-15 (revised 2026-10-22)

## Context

Supabase keeps the session in cookies, and its access token expires, so something has to refresh it before pages read it. Server Components can't write cookies. Next.js 16 renamed middleware to the proxy (`src/proxy.ts`) and turns on Cache Components, which prerenders a static shell of each page and fails the build if request data is read outside `<Suspense>`. The surah pages are protected, and a protected page must not depend on one layer alone.

## Decision

- **The proxy refreshes the session** on every page request (`refreshSession` in `src/lib/data/session.ts`), copying refreshed cookies to both the request (for Server Components) and the response (for the browser). It redirects logged-out users away from protected paths.
- **Pages check the session themselves** with `requireUserId()` or `getCurrentUserId()`. These call `getClaims()`, which verifies the JWT rather than only decoding it.
- **Anything that reads the session renders inside `<Suspense>`.** `getCurrentUserId` awaits `connection()` first, because `getClaims()` compares the token expiry with `Date.now()`, and Cache Components rejects that during a prerender.
- Redirect targets taken from user input go through `safeNextPath`.

## Alternatives

- **Rely on the proxy alone:** a matcher mistake would expose a protected page. A second check in the page costs one verified call.
- **`getSession()` instead of `getClaims()`:** it trusts the cookie without verifying the JWT.
- **Turn Cache Components off:** every page would render on each request, including the parts that never change.

## Consequences

- Pages keep a static shell, and only the auth UI and protected content render per request.
- Every new piece of UI that reads cookies, the session or `searchParams` needs a `<Suspense>` boundary, or the build fails.
- `src/proxy.test.ts` covers the cookie refresh and the redirect, and the e2e tests cover the protected pages.
