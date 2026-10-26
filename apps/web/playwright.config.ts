import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// E2E_BASE_URL points the tests at a deployed site (npm run test:smoke, docs/deploy.md). Then no
// local server is built or started.
const deployedURL = process.env.E2E_BASE_URL?.replace(/\/$/, "");
const baseURL = deployedURL ?? `http://localhost:${PORT}`;

// Say where the tests run, once per run (workers load this file too, with TEST_WORKER_INDEX set).
// A leftover E2E_BASE_URL in the shell would otherwise send `npm run test:e2e` to the deployed
// site without a word.
if (process.env.TEST_WORKER_INDEX === undefined) {
  console.log(
    deployedURL
      ? `e2e target: ${deployedURL} (E2E_BASE_URL is set; no local build)`
      : `e2e target: ${baseURL} (a local production build of this checkout)`,
  );
}

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

/** The feedback form address the e2e build uses, unless the shell sets another. */
export const E2E_FEEDBACK_URL = "https://example.com/feedback";

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
        env: {
          ...placeholderSupabaseEnv,
          // The surah page's feedback button links here (docs/deploy.md); a fixed address keeps the
          // tests independent of the real form.
          NEXT_PUBLIC_FEEDBACK_URL: process.env.NEXT_PUBLIC_FEEDBACK_URL ?? E2E_FEEDBACK_URL,
        },
      },
});
