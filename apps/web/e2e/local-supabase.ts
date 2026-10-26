import { execSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  assertLocalServer,
  assertLocalSupabaseUrl,
  isLocalUrl,
} from "../src/lib/supabase/local-guard";
import type { ContentBundle } from "../src/lib/services/content/load";
import { toSeedPayload } from "../src/lib/services/content/payload";
import { validateContent } from "../src/lib/services/content/validate";

// Tests that need content run against a local Supabase (npx supabase start), because they replace
// its content with fixtures. They run only when E2E_LOCAL_SUPABASE=1, the Supabase URL is local,
// and the service role key is in the shell; the web server must use the same local URL and anon
// key (README, "Testing").
//
// Every helper here that writes data refuses to run unless the Supabase URL is local, and
// assertLocalTestServer() refuses an app server whose own Supabase isn't local. Test data never
// reaches the hosted project, even through an app server left running on the same port.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const localSupabaseEnabled =
  process.env.E2E_LOCAL_SUPABASE === "1" && isLocalUrl(url) && serviceRoleKey !== "";

/**
 * Before signing up or logging in through the app: refuses unless the app server runs on this
 * machine and its own Supabase is local (it asks the server's /health).
 */
export async function assertLocalTestServer(baseURL: string | undefined) {
  await assertLocalServer(baseURL, "write test data through the app");
}

export const LOCAL_SUPABASE_SKIP_REASON =
  "set E2E_LOCAL_SUPABASE=1 with a local NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY";

/** A service-role client, for the local Supabase only. */
function serviceClient(action: string): SupabaseClient {
  assertLocalSupabaseUrl(url, action);
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
  const { error } = await serviceClient("seed fixture content").rpc("seed_content", {
    payload: toSeedPayload(bundle),
  });
  if (error) {
    throw new Error(`Seeding failed: ${error.message}`);
  }
}

/**
 * Puts the real content/ back with the seed script (load.ts reads content/ through import.meta,
 * which Playwright's compiled specs can't load).
 */
export function restoreContent() {
  assertLocalSupabaseUrl(url, "restore content/");
  execSync("npx tsx scripts/seed-content.mts", { stdio: "ignore", env: process.env });
}

export type TestUser = { id: string; email: string; password: string };

/** A confirmed account for the tests, created through the admin API. */
export async function createTestUser(): Promise<TestUser> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "e2e-test-password";
  const { data, error } = await serviceClient("create a test user").auth.admin.createUser({
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
  await serviceClient("delete a test user").auth.admin.deleteUser(user.id);
}
