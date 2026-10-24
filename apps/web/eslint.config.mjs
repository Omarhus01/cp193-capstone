import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Layers (CLAUDE.md, Architecture): app → components → lib/services → lib/data → lib/supabase.
// lib/domain holds types for every layer; lib/ai holds provider interfaces for lib/services.
// The `**/...` patterns catch relative imports that would skip the "@/" alias.
function banned(reason, group) {
  return { group, message: `${reason} (see CLAUDE.md, Architecture).` };
}

const supabase = banned("Only src/lib/data talks to Supabase", [
  "@supabase/*",
  "@/lib/supabase",
  "@/lib/supabase/*",
  "**/supabase/*",
]);
const data = banned("Pages and components reach the database through src/lib/services", [
  "@/lib/data",
  "@/lib/data/*",
  "**/lib/data/*",
]);
const ai = banned("AI providers are used through src/lib/services", [
  "@/lib/ai",
  "@/lib/ai/*",
  "**/lib/ai/*",
]);
const services = banned("Lower layers don't import src/lib/services", [
  "@/lib/services/*",
  "**/lib/services/*",
]);
const components = banned("Only pages import components", ["@/components/*"]);
const app = banned("Only components import from src/app (server actions)", ["@/app/*"]);

// Flat config doesn't merge options of the same rule, so each block lists everything it bans.
// Later blocks override earlier ones for the files they match.
function restrictImports(files, patterns) {
  return { files, rules: { "no-restricted-imports": ["error", { patterns }] } };
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  restrictImports(["src/**"], [supabase]),
  restrictImports(["src/app/**", "src/components/**"], [supabase, data, ai]),
  restrictImports(["src/lib/services/**"], [supabase, components, app]),
  restrictImports(["src/lib/ai/**"], [supabase, data, services, components, app]),
  restrictImports(["src/lib/data/**"], [services, ai, components, app]),
  restrictImports(["src/lib/supabase/**"], [data, services, ai, components, app]),
  restrictImports(["src/lib/domain/**"], [supabase, data, services, ai, components, app]),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright output.
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
