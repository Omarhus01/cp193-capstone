import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/locale";
import { getCurrentUserId } from "@/lib/supabase/server";
import { loginRedirectPath } from "./paths";

/**
 * Returns the logged-in user's id, or redirects to the login page. The proxy already redirects
 * logged-out users; pages call this as well so they never rely on the proxy alone.
 */
export async function requireUserId(locale: Locale, currentPath: string): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect(loginRedirectPath(locale, currentPath));
  }
  return userId;
}
