# 0002. One repository with npm workspaces

- Status: Accepted
- Date: 2026-10-05

## Context

The project has a web app, an AI service in sprint 2, model experiments, verse content, prompts, and database migrations. They change together: a content format change touches the loader and the pages, and a prompt change touches the AI service. Advisors and testers need one place to look.

## Decision

A single repository. The root `package.json` declares npm workspaces (`apps/*`) and holds the shared tools: Prettier, husky, and the Supabase CLI. Root scripts (`npm run dev`, `lint`, `test`, …) forward to `apps/web`. Non-JavaScript parts live in plain folders: `services/ai/`, `experiments/`, `content/`, `prompts/`, `supabase/`.

## Alternatives

- **Separate repositories per part:** cross-cutting changes would need coordinated pull requests, and the history of one feature would be split.
- **pnpm, Turborepo or Nx:** worth it with many packages. With one JavaScript app it's another tool to learn and install.

## Consequences

- One clone, one `npm install`, one place for issues and decisions.
- Vercel builds from `apps/web` as its root directory and installs from the workspace root.
- If a second JavaScript package appears, it goes under `apps/` (or a new `packages/*` workspace).
