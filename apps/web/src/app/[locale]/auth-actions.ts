"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/locale";
import { routing } from "@/i18n/routing";
import { createAccount, logInWithPassword, logOutThisBrowser } from "@/lib/services/auth/accounts";
import { logoutRedirectPath, safeNextPath } from "@/lib/services/auth/paths";
import {
  readCredentials,
  validateCredentials,
  type AuthErrorKey,
} from "@/lib/services/auth/validation";

export type AuthFormState = {
  error: AuthErrorKey | null;
  notice: "checkEmail" | null;
};

function readLocale(formData: FormData): Locale {
  const locale = formData.get("locale");
  return isLocale(locale) ? locale : routing.defaultLocale;
}

/** The site's origin as the browser sees it (Next.js already checks Origin against Host for actions). */
async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  if (origin) {
    return origin;
  }
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

export async function logIn(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = readLocale(formData);
  const credentials = readCredentials(formData);
  const invalid = validateCredentials(credentials);
  if (invalid) {
    return { error: invalid, notice: null };
  }

  const error = await logInWithPassword(credentials);
  if (error) {
    return { error, notice: null };
  }

  redirect(safeNextPath(formData.get("next"), locale));
}

export async function signUp(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = readLocale(formData);
  const credentials = readCredentials(formData);
  const invalid = validateCredentials(credentials);
  if (invalid) {
    return { error: invalid, notice: null };
  }

  const next = safeNextPath(formData.get("next"), locale);
  const result = await createAccount({
    credentials,
    locale,
    origin: await requestOrigin(),
    next,
  });
  if (result.error) {
    return { error: result.error, notice: null };
  }

  // With email confirmation turned off, Supabase logs the user in right away.
  if (result.loggedIn) {
    redirect(next);
  }
  return { error: null, notice: "checkEmail" };
}

export async function logOut(formData: FormData): Promise<void> {
  // End only this browser's session; the user stays logged in on their other devices.
  await logOutThisBrowser();
  // Stay on the current page, unless it needs a login.
  redirect(logoutRedirectPath(formData.get("next"), readLocale(formData)));
}
