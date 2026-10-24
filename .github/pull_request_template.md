## Summary

<!-- What changes for the user or the codebase, and why. -->

Closes #

## How I tested it

<!-- Commands run, browsers or devices checked, anything tested by hand. -->

## Definition of done

- [ ] Acceptance criteria in the issue are met
- [ ] Unit tests added or updated, and `npm test` passes
- [ ] e2e tests added or updated, and `npm run test:e2e` passes
- [ ] Every new UI string is in both `messages/en.json` and `messages/ko.json`
- [ ] No Supabase calls outside `src/lib/data` (`npm run lint` passes)
- [ ] An ADR is written in `docs/decisions/` if this PR makes a decision
- [ ] `npm run format:check` and `npm run typecheck` pass
- [ ] CI is green; merge with a merge commit (not squash) so the issue closes
