// Loads content/ into Supabase through the seed_content database function (content/README.md,
// "Seeding"). Running it twice gives the same database.
//
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<service role key>"; npm run content:seed
//
// The project URL is NEXT_PUBLIC_SUPABASE_URL from the shell, or else from apps/web/.env.local.
// The service role key bypasses row level security, so it is read from the shell only, never from
// a file. This script and src/lib/data are the only code that talks to Supabase (CLAUDE.md).
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { loadContent } from "@/lib/services/content/load";
import { toSeedPayload } from "@/lib/services/content/payload";
import { validateContent } from "@/lib/services/content/validate";

const envFile = new URL("../.env.local", import.meta.url);
const fileEnv = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "Set SUPABASE_SERVICE_ROLE_KEY in the shell (Supabase dashboard: Project Settings → API), " +
      "and NEXT_PUBLIC_SUPABASE_URL in the shell or apps/web/.env.local.",
  );
  process.exit(1);
}

const { bundle, errors } = loadContent();
const problems = [...errors, ...validateContent(bundle)];
if (problems.length > 0) {
  console.error("Not seeding: content/ has problems.\n");
  for (const { file, path, message } of problems) {
    console.error(`  content/${file}${path ? ` ${path}` : ""}: ${message}`);
  }
  process.exit(1);
}

console.log(`Seeding ${url} …`);
const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await supabase.rpc("seed_content", { payload: toSeedPayload(bundle) });
if (error) {
  console.error(`Seeding failed, nothing was changed: ${error.message}`);
  process.exit(1);
}
console.log("Done. Rows now in the database:", data);
