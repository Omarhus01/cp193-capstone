import * as authData from "@/lib/data/auth";
import type { Credentials } from "@/lib/domain/auth";
import type { Locale } from "@/i18n/locale";
import { confirmRedirectUrl, type ConfirmCredential } from "./confirm";
import type { AuthErrorKey } from "./validation";

/** The logged-in user's id, or null. For Server Components; render them inside <Suspense>. */
export const getCurrentUserId = authData.getCurrentUserId;

/** Logs in. Returns the error to show, or null on success. */
export async function logInWithPassword(credentials: Credentials): Promise<AuthErrorKey | null> {
  const result = await authData.signInWithPassword(credentials);
  if (result.ok) {
    return null;
  }
  return result.code === "email_not_confirmed" ? "emailNotConfirmed" : "invalidCredentials";
}

/**
 * Creates an account whose confirmation link returns to `origin`, keeping the user's language
 * and the page to open afterwards.
 */
export async function createAccount({
  credentials,
  locale,
  origin,
  next,
}: {
  credentials: Credentials;
  locale: Locale;
  origin: string;
  next: string;
}): Promise<{ error: AuthErrorKey } | { error: null; loggedIn: boolean }> {
  const result = await authData.signUp({
    credentials,
    languagePref: locale,
    // Where the confirmation email link lands (src/app/auth/confirm/route.ts).
    emailRedirectTo: confirmRedirectUrl(origin, locale, next),
  });
  return result.ok ? { error: null, loggedIn: result.loggedIn } : { error: "signupFailed" };
}

/** Logs out of this browser only (docs/decisions/0006-local-logout.md). */
export const logOutThisBrowser = authData.signOutThisBrowser;

/** Confirms the address from the email link and logs the user in. Returns whether it worked. */
export function confirmEmailLink(credential: ConfirmCredential): Promise<boolean> {
  return authData.confirmEmail(credential);
}
