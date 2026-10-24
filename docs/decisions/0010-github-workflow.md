# 0010. Issue branches, pull requests with merge commits, protected `main`

- Status: Accepted
- Date: 2026-10-23
- Issue: #1

## Context

Until now every change was committed straight to `main`, with no record of what was planned, why something was built, or whether it was finished. The capstone is assessed on process as well as the product: sprints, feedback rounds, and the history advisors can follow (proposal §3.2). Actions is available again, so CI can gate merges ([0007](0007-husky-pre-push-hook.md)).

## Decision

- **Backlog:** user stories as GitHub issues with acceptance criteria as a checklist. Labels: `story`, `bug`, `chore`, `decision`, plus `priority:high`, `priority:medium` and `priority:low`. Milestones `Sprint 1` (ends 2026-11-08) and `Sprint 2`. The project board "CP193 Capstone" has the columns Backlog, Ready, In progress, In review, Done.
- **Branches:** one per issue, named `feat/<issue>-<short-name>`, `fix/…` or `chore/…`.
- **Pull requests:** every change reaches `main` through a pull request that says `Closes #<issue>` and fills in the template's definition of done.
- **Merge commits, not squash or rebase.** The repository allows only merge commits, so each branch's individual commits stay visible in the history.
- **`main` is protected:** a pull request is required, the CI job `Format, lint, typecheck, unit tests` must pass with the branch up to date, the rule applies to admins too, and force pushes and deletion are blocked.

## Alternatives

- **Squash merges:** a cleaner `main`, but the step-by-step commits that show how a feature was built are lost.
- **Trunk-based commits to `main`:** fastest for one person, but leaves no review point and no link between work and stories.
- **A husky hook that refuses pushes to `main`:** the fallback if branch protection had been unavailable. Server-side protection can't be skipped from another machine.

## Consequences

- Every change is traceable: story → branch → commits → pull request → merge commit.
- Even a one-line fix needs an issue, a branch and a pull request, and has to wait for CI.
- Merged branches are deleted automatically, and closing an issue moves its card to Done.
