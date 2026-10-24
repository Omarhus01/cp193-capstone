# 0006. Log out of the current browser only

- Status: Accepted
- Date: 2026-10-22

## Context

Supabase's `signOut()` defaults to the global scope, which revokes every session of the user. Other browsers kept a valid access token until it expired, then failed their next refresh and were logged out without warning. Testers use the platform on a phone and a laptop, and the real-account e2e tests share one account across parallel browsers.

## Decision

The Log out button calls `signOut({ scope: "local" })` (through `logOutThisBrowser` in `src/lib/services/auth/accounts.ts`). It ends only the current browser's session.

## Alternatives

- **Global logout as the default:** logging out on one device would log the user out of the others too.
- **Offer only global logout:** loses the common case. Logging out everywhere is useful for a lost or shared device, so it is planned as a separate action (#15).

## Consequences

- Logging out on one device leaves the others logged in.
- A real-account e2e test logs in from two browsers, logs out in one, forces the other to refresh, and checks that it is still logged in. It fails with the global scope.
- A user who wants to end every session needs the separate "log out of all devices" action (#15).
