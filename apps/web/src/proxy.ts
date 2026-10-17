import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/proxy";

const handleI18nRouting = createIntlMiddleware(routing);

/**
 * Runs before every page request (Next.js 16 renamed middleware to proxy):
 * 1. next-intl adds the locale prefix ("/" → "/en") and sets the locale for the page.
 * 2. Supabase refreshes the session cookie.
 */
export default async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);
  if (response.headers.has("location")) {
    return response;
  }

  await updateSession(request, response);

  return response;
}

export const config = {
  // Skip Next.js internals, files with an extension, and the email confirmation route.
  matcher: ["/((?!_next|_vercel|auth/confirm|.*\\..*).*)"],
};
