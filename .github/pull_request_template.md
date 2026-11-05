## What changes and why

<!--
Write for someone who doesn't know this repo. Use plain words, and never a code or number on its
own: say what it means first, then add the link or code if useful.
Example: "Release order: database first, then content, then merge (decision record: hosting on Vercel)."
-->

Closes # <!-- the issue number, then say in words what the issue is -->

## How I checked it

<!-- What you ran or tried by hand, what passed, and anything you couldn't check and why. -->

## Before merging

<!-- Steps someone has to do before merging, in order (for example: update the database, load the content). Write "None" if there are none. -->

## Done checklist

See [How I work](https://github.com/Omarhus01/cp193-capstone/blob/main/README.md#how-i-work).

- [ ] The issue's goals are met
- [ ] Automated tests for the logic are added or updated, and they pass (`npm test`)
- [ ] Browser tests are added or updated, and they pass (`npm run test:e2e`)
- [ ] Every new piece of on-screen text exists in both English and Korean (`messages/en.json`, `messages/ko.json`)
- [ ] Only the data layer talks to the database (`src/lib/data`; `npm run lint` checks this)
- [ ] If this change makes a decision, it is written up in `docs/decisions/`
- [ ] Formatting and type checks pass (`npm run format:check`, `npm run typecheck`)
- [ ] The automatic checks on GitHub pass; merge with a merge commit, not squash, so the issue closes
