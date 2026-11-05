# 0007. Run the CI checks in a husky pre-push hook

- Status: Superseded: CI on GitHub runs these checks.
- Date: 2026-10-22

## Context

`.github/workflows/ci.yml` runs format check, lint, typecheck and unit tests on every push and pull request. GitHub Actions was unavailable on the owner's account, because billing was locked, and every run failed at startup. Nothing was checking pushes.

## Decision

A husky pre-push hook (`.husky/pre-push`) runs the same four checks, `format:check`, `lint`, `typecheck` and `test`, and blocks the push if any fail. `npm install` installs it through the `prepare` script. The workflow file stays in the repository unchanged. Bypassing the hook with `--no-verify` is not allowed.

## Alternatives

- **No checks until Actions returns:** broken code would reach `main` unnoticed.
- **A pre-commit hook:** runs too often for checks this slow, and pushes from other clones would still go unchecked.
- **Another CI provider:** extra setup for what was meant to be a temporary gap.

## Consequences

- Pushes take longer, since the checks run first.
- The hook only runs on machines where `npm install` was run. It can't stop a push from elsewhere.
- **Update, 2026-10-23:** Actions is available again. The CI job is now a required check on `main` ([0010](0010-github-workflow.md)), and the hook stays as a local safety net that catches failures before they reach a pull request.
