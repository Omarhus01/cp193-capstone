import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Checks the layer rules in eslint.config.mjs (CLAUDE.md, Architecture) against sample imports.
const eslint = new ESLint({ cwd: fileURLToPath(new URL("..", import.meta.url)) });

async function restrictedImports(filePath: string, source: string): Promise<number> {
  const [result] = await eslint.lintText(`${source}\n`, { filePath });
  return result.messages.filter((m) => m.ruleId === "no-restricted-imports").length;
}

const cases: [file: string, source: string, allowed: boolean][] = [
  // Supabase only in lib/data (and the client factories in lib/supabase).
  ["src/components/Example.tsx", 'import { createClient } from "@/lib/supabase/server";', false],
  ["src/components/Example.tsx", 'import { createServerClient } from "@supabase/ssr";', false],
  ["src/app/[locale]/page.tsx", 'import { createClient } from "@/lib/supabase/server";', false],
  ["src/lib/services/x.ts", 'import type { User } from "@supabase/supabase-js";', false],
  ["src/lib/services/x.ts", 'import { createClient } from "../supabase/server";', false],
  ["src/lib/data/x.ts", 'import { createClient } from "@/lib/supabase/server";', true],
  ["src/lib/supabase/x.ts", 'import { createServerClient } from "@supabase/ssr";', true],
  // Pages and components go through lib/services.
  ["src/components/Example.tsx", 'import { getCurrentUserId } from "@/lib/data/auth";', false],
  ["src/components/Example.tsx", 'import { getCurrentUserId } from "../lib/data/auth";', false],
  ["src/app/[locale]/page.tsx", 'import { getRetrievalProvider } from "@/lib/ai";', false],
  [
    "src/components/Example.tsx",
    'import { logInWithPassword } from "@/lib/services/auth/accounts";',
    true,
  ],
  ["src/components/Example.tsx", 'import { logIn } from "@/app/[locale]/auth-actions";', true],
  // Services use data and ai; nothing below imports upward.
  ["src/lib/services/x.ts", 'import { getCurrentUserId } from "@/lib/data/auth";', true],
  ["src/lib/services/x.ts", 'import { getRetrievalProvider } from "@/lib/ai";', true],
  ["src/lib/services/x.ts", 'import { Header } from "@/components/layout/Header";', false],
  ["src/lib/data/x.ts", 'import { requireUserId } from "@/lib/services/auth/require-user";', false],
  ["src/lib/ai/x.ts", 'import { getCurrentUserId } from "@/lib/data/auth";', false],
  ["src/lib/domain/x.ts", 'import { getCurrentUserId } from "@/lib/data/auth";', false],
  // Everyone may use the domain types.
  ["src/components/Example.tsx", 'import type { Citation } from "@/lib/domain/qa";', true],
  ["src/lib/data/x.ts", 'import type { Credentials } from "@/lib/domain/auth";', true],
];

describe("layer import rules", () => {
  it.each(cases)("%s: %s (allowed: %s)", async (file, source, allowed) => {
    expect(await restrictedImports(file, source)).toBe(allowed ? 0 : 1);
  });
});
