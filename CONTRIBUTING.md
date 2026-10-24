# Contributing

How work moves from an idea to `main`. Setup and commands are in the [README](README.md), and the architecture and content rules are in [CLAUDE.md](CLAUDE.md).

## 1. Start from an issue

All work starts from an issue on the [project board](https://github.com/users/Omarhus01/projects/1).

- **Stories** follow the template "As a Korean-speaking learner, I want …, so that …", with acceptance criteria as a checklist. Use the role that fits: learner, reader checking a source, content owner.
- **Labels:** one type (`story`, `bug`, `chore`), one priority (`priority:high`, `priority:medium`, `priority:low`), and `decision` if the work needs an ADR.
- **Milestone:** the sprint it's planned for (`Sprint 1`, `Sprint 2`).
- **Board columns:** Backlog → Ready (refined, can start) → In progress → In review (pull request open) → Done.

## 2. Branch

One branch per issue, created from an up-to-date `main`:

```bash
git switch main && git pull
git switch -c feat/2-verse-page      # feat/, fix/ or chore/ + <issue number>-<short name>
```

Move the issue to **In progress**.

## 3. Commit

Small commits in the style the history already uses, [Conventional Commits](https://www.conventionalcommits.org/) with a scope where it helps:

```
feat(auth): log out of the current browser only
fix(i18n): resolve the server locale from the route with next/root-params
test(e2e): cover the source page link
docs: add ADR for the content status store
```

The body explains why, not what the diff already shows. Each commit stays because pull requests are merged with merge commits.

## 4. Open a pull request

```bash
git push -u origin feat/2-verse-page     # the husky hook runs format, lint, typecheck, unit tests
gh pr create --fill                      # then complete the template
```

- The description says `Closes #<issue>` and fills in the definition of done.
- Move the issue to **In review**.
- CI (`Format, lint, typecheck, unit tests`) must pass, and the branch must be up to date with `main`. Branch protection enforces both, for admins too.

## 5. Merge

```bash
gh pr merge --merge --delete-branch
```

Merge commits only. Squash and rebase merging are turned off. The issue closes and its card moves to **Done**. Never push to `main` directly, and never bypass the hook with `--no-verify`.

## Definition of done

A pull request is done when all of these hold:

- [ ] The acceptance criteria in the issue are met.
- [ ] Unit tests (Vitest) and e2e tests (Playwright) are added for the change, and both suites pass.
- [ ] Every new UI string is in both `messages/en.json` and `messages/ko.json`.
- [ ] No Supabase calls outside `src/lib/data`. The ESLint layer rules enforce this.
- [ ] If a decision was made, an ADR is written in [`docs/decisions/`](docs/decisions/README.md).
- [ ] The pull request is merged with a merge commit.
- [ ] The issue is closed.

## Decision records

When a pull request picks between real alternatives (a library, a data shape, a rule, a trade-off someone might later question), add an ADR. Copy the template from [`docs/decisions/README.md`](docs/decisions/README.md), use the next number, and add it to the index. Keep it short: context, decision, alternatives, consequences.

## Content

Never write Quran verses, translations, explanations or word meanings, even as placeholders. The project owner provides and validates all religious content in `content/`. Islamic terms follow the Arabic word ([ADR 0008](docs/decisions/0008-terms-follow-the-arabic-word.md)).
