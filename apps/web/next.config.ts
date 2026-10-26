import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Next.js inlines NEXT_PUBLIC_ variables at build time. Without these two, a Vercel build still
// succeeds but every page fails with a 500, so stop the build instead (docs/deploy.md). Local
// builds and CI are unaffected: Vercel sets VERCEL=1.
if (
  process.env.VERCEL &&
  (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel → Settings → " +
      "Environment Variables (docs/deploy.md), then redeploy.",
  );
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
