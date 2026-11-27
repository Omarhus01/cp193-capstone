// Loads content/ into Supabase, one surah per request (content/README.md, "Checking and seeding";
// ADR 0027). Running it twice gives the same database.
//
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<service role key>"; npm run content:seed
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<service role key>"; npm run content:seed -- 2 4
//
// With surah numbers it seeds only those surahs, plus the shared sources and passages. The whole
// of content/ is still validated first, so nothing unapproved can be published.
//
// The project URL is NEXT_PUBLIC_SUPABASE_URL from the shell, or else from apps/web/.env.local.
// The service role key bypasses row level security, so it is read from the shell only, never from
// a file. This script and src/lib/data are the only code that talks to Supabase (CLAUDE.md).
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { loadContent } from "@/lib/services/content/load";
import { toSeedPlan } from "@/lib/services/content/payload";
import { parseSurahArguments } from "@/lib/services/content/seed-arguments";
import { runSeed } from "@/lib/services/content/seed-run";
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

const args = parseSurahArguments(
  process.argv.slice(2),
  bundle.surahs.map(({ number }) => number),
);
if (!args.ok) {
  console.error(`Not seeding: ${args.error}.`);
  process.exit(1);
}

const plan = toSeedPlan(bundle, args.surahs ?? undefined);
const which = args.surahs
  ? `surahs ${args.surahs.join(", ")} and the shared sources and passages`
  : `all ${plan.surahs.length} surahs`;
console.log(`Seeding ${url} …`);
console.log(`Loading ${which}, one request at a time.\n`);

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const result = await runSeed(plan, (fn, payload) => supabase.rpc(fn, { payload }));

if (!result.ok) {
  const where = result.surah === null ? result.step : `surah ${result.surah} (${result.step})`;
  console.error(`\nSeeding stopped at ${where}: ${result.message}`);
  console.error(
    "That request changed nothing. Everything loaded before it stays loaded; nothing after it " +
      "was sent. Fix the problem and run the seed again.",
  );
  process.exit(1);
}
console.log("\nDone. Rows now in the database:", result.counts);
