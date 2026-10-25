import { execSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ContentBundle } from "../src/lib/services/content/load";
import { toSeedPayload } from "../src/lib/services/content/payload";
import { validateContent } from "../src/lib/services/content/validate";

// Tests that need content run against a local Supabase (npx supabase start), because they replace
// its content with fixtures. They run only when E2E_LOCAL_SUPABASE=1, the Supabase URL is local,
// and the service role key is in the shell; the web server must use the same local URL and anon
// key (README, "Testing").

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const localSupabaseEnabled =
  process.env.E2E_LOCAL_SUPABASE === "1" &&
  /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url) &&
  serviceRoleKey !== "";

export const LOCAL_SUPABASE_SKIP_REASON =
  "set E2E_LOCAL_SUPABASE=1 with a local NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY";

function serviceClient(): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Validates `bundle` like the content test does, then seeds it. Throws on any problem. */
export async function seedContent(bundle: ContentBundle) {
  const problems = validateContent(bundle);
  if (problems.length > 0) {
    throw new Error(`Fixture content is invalid: ${JSON.stringify(problems, null, 2)}`);
  }
  const { error } = await serviceClient().rpc("seed_content", { payload: toSeedPayload(bundle) });
  if (error) {
    throw new Error(`Seeding failed: ${error.message}`);
  }
}

/**
 * Puts the real content/ back with the seed script (load.ts reads content/ through import.meta,
 * which Playwright's compiled specs can't load).
 */
export function restoreContent() {
  execSync("npx tsx scripts/seed-content.mts", { stdio: "ignore", env: process.env });
}

export type TestUser = { id: string; email: string; password: string };

/** A confirmed account for the tests, created through the admin API. */
export async function createTestUser(): Promise<TestUser> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "e2e-test-password";
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Couldn't create the test user: ${error?.message}`);
  }
  return { id: data.user.id, email, password };
}

export async function deleteTestUser(user: TestUser) {
  await serviceClient().auth.admin.deleteUser(user.id);
}
