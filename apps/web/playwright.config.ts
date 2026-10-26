import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// E2E_BASE_URL points the tests at a deployed site (npm run test:smoke, docs/deploy.md). Then no
// local server is built or started.
const deployedURL = process.env.E2E_BASE_URL?.replace(/\/$/, "");
const baseURL = deployedURL ?? `http://localhost:${PORT}`;

// Placeholder Supabase settings for when .env.local is missing (the logged-out tests never contact
// Supabase). They must not be set otherwise: variables in the environment override .env.local in
// Next.js, so the build and server would talk to the placeholder and every login would fail.
// The web server inherits process.env, so values already set there (e.g. CI secrets) still win.
const placeholderSupabaseEnv: Record<string, string> = existsSync(".env.local")
  ? {}
  : {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
    };

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: deployedURL
    ? undefined
    : {
        command: `npm run build && npm run start -- --port ${PORT}`,
        url: `${baseURL}/en`,
        timeout: 240_000,
        reuseExistingServer: !process.env.CI,
        env: placeholderSupabaseEnv,
      },
});
