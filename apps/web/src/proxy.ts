import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { stripLocale } from "@/i18n/locale";
import { routing } from "@/i18n/routing";
import { isProtectedPath, loginRedirectPath } from "@/lib/services/auth/paths";
import { refreshSession } from "@/lib/data/session";

const handleI18nRouting = createIntlMiddleware(routing);

/**
 * Runs before every page request (Next.js 16 renamed middleware to proxy):
 * 1. next-intl adds the locale prefix ("/" → "/en") and sets the locale for the page.
 * 2. Supabase refreshes the session cookie.
 * 3. Logged-out users on a protected page are sent to the login page.
 */
export default async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);
  if (response.headers.has("location")) {
    return response;
  }

  const { isLoggedIn } = await refreshSession(request, response);

  const { pathname, search } = request.nextUrl;
  const { locale } = stripLocale(pathname);
  if (!isLoggedIn && locale && isProtectedPath(pathname)) {
    const loginUrl = new URL(loginRedirectPath(locale, pathname + search), request.url);
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  // Skip Next.js internals, files with an extension, the email confirmation route, and /health.
  matcher: ["/((?!_next|_vercel|auth/confirm|health|.*\\..*).*)"],
};
