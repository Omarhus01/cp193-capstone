import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/**
 * Runs before every page request (Next.js 16 renamed middleware to proxy).
 * next-intl adds the locale prefix ("/" → "/en") and sets the locale for the page.
 */
export default createIntlMiddleware(routing);

export const config = {
  // Skip Next.js internals and files with an extension.
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
